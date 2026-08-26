import { buildRailGraph, findRoute, junctionBetween, stationAnchors } from "./rail-graph";
import type { DisasterEvent, LogEntry, RailwayNetwork, Train } from "./types";

/** Distance at which a train notices a disruption ahead and re-routes. */
const DETECT_M = 380;
/** Distance at which a train starts braking for a red/failed signal. */
const SIGNAL_BRAKE_M = 260;
/** Stand back from the signal mast. */
const SIG_BUFFER = 12;
/** Distance at which a train brakes for a station stop. */
const STATION_BRAKE_M = 120;
/** Safe following distance behind another train. */
const TRAIN_SAFE_GAP = 30;
/** Distance at which a train starts braking for a train ahead. */
const TRAIN_BRAKE_M = 220;
/** Dwell at an intermediate station (real ms). */
const DWELL_MS = 1500;
/** Dwell at the destination station before choosing a new one (real ms). */
const ARRIVE_DWELL_MS = 2600;
/** Minimum time between single-line turnbacks for one train (anti ping-pong). */
const TURNBACK_COOLDOWN_MS = 4000;

export interface StepResult {
  trains: Record<string, Train>;
  entries: Omit<LogEntry, "id">[];
}

function stepMeters(train: Train, dtSec: number, speedMultiplier: number): number {
  return (train.speedKmph * 1000 * dtSec * speedMultiplier) / 3600;
}

function describeRoute(network: RailwayNetwork, route: string[]): string {
  return route.map((id) => network.tracks[id]?.name ?? "?").join(" → ");
}

/**
 * A train is "diverted" while it is running a calamity detour instead of its
 * original plan. The flag is set when a disaster reroute is applied and
 * cleared when the train switches back onto its original route sequence.
 */
export function isDiverted(train: Train): boolean {
  return train.diverted === true;
}

/**
 * Advance every train one tick. Each train is an independent agent: it looks
 * ahead along ITS OWN direction and position, and reacts only to what affects
 * its route — signals, stations, disruptions, junctions.
 */
export function stepTrains(
  network: RailwayNetwork,
  events: DisasterEvent[],
  dtSec: number,
  speedMultiplier: number,
  clockMs: number
): StepResult {
  const graph = buildRailGraph(network);
  const anchors = stationAnchors(network);
  const stationIds = Object.keys(network.stations);

  const disrupted = new Map<string, DisasterEvent>();
  const failedSignals = new Set<string>();
  for (const ev of events) {
    if (ev.trackId && (ev.kind === "BROKEN_TRACK" || ev.kind === "FLOODING" || ev.kind === "OHE_FAULT")) {
      if (!disrupted.has(ev.trackId)) disrupted.set(ev.trackId, ev);
    }
    if (ev.kind === "SIGNAL_FAILURE" && ev.signalId) failedSignals.add(ev.signalId);
  }

  const entries: Omit<LogEntry, "id">[] = [];
  const log = (text: string, kind: LogEntry["kind"] = "train") =>
    entries.push({ timeMs: clockMs, text, kind });

  const trains: Record<string, Train> = {};

  outer: for (const [id, original] of Object.entries(network.trains)) {
    if (original.manualHold || original.status === "OUT_OF_SERVICE") {
      trains[id] = original;
      continue;
    }

    const track = network.tracks[original.trackId];
    if (!track) {
      trains[id] = { ...original, status: "OUT_OF_SERVICE", haltReason: "track removed" };
      continue;
    }

    const t: Train = { ...original };

    // --- destination sanity ---
    let anchor = anchors.get(t.destinationStationId);
    if (!anchor) {
      const fallback = stationIds.find((sid) => sid !== t.destinationStationId);
      if (!fallback) {
        trains[id] = t;
        continue;
      }
      t.destinationStationId = fallback;
      anchor = anchors.get(fallback);
      t.route = [];
    }
    if (!anchor) {
      trains[id] = t;
      continue;
    }

    // --- ensure a route exists ---
    if (t.route.length === 0) {
      const route = findRoute(graph, t.trackId, anchor.trackId) ?? [t.trackId];
      t.route = route;
      t.originalRoute = route;
      t.diverted = false;
      if (route.length > 1) {
        log(
          `${t.name}: heading to ${network.stations[t.destinationStationId]?.name} via ${describeRoute(network, route)}`
        );
      }
    }

    // --- reroute if the planned path runs through a disrupted line ---
    const disruptedIds = new Set(disrupted.keys());
    if (t.route.slice(1).some((tid) => disruptedIds.has(tid))) {
      const alt = findRoute(graph, t.trackId, anchor.trackId, disruptedIds);
      if (alt && alt.join("|") !== t.route.join("|")) {
        t.route = alt;
        t.diverted = true;
        log(
          `${t.name}: line ahead disrupted — diverting via ${describeRoute(network, alt.slice(1))} to ${network.stations[t.destinationStationId]?.name}`,
          "warn"
        );
      }
    }

    // --- after a calamity clears, prioritise returning to the original route ---
    if (
      t.diverted &&
      !t.originalRoute.some((tid) => disruptedIds.has(tid))
    ) {
      const idx = t.originalRoute.indexOf(t.trackId);
      let candidate: string[] | null = null;
      if (idx >= 0) {
        candidate = t.originalRoute.slice(idx);
      } else {
        let best: { path: string[]; idx: number } | null = null;
        for (let i = 0; i < t.originalRoute.length; i++) {
          const path = findRoute(graph, t.trackId, t.originalRoute[i], disruptedIds);
          if (path && (!best || path.length < best.path.length)) {
            best = { path, idx: i };
          }
        }
        if (best) candidate = [...best.path, ...t.originalRoute.slice(best.idx + 1)];
      }
      if (candidate && candidate.join("|") !== t.route.join("|")) {
        t.route = candidate;
        applyRouteEntry(graph, network, t, anchors.get(t.destinationStationId));
        log(`${t.name}: line restored — returning to original route`, "success");
      }
    }

    const step = stepMeters(t, dtSec, speedMultiplier);
    const disruption = disrupted.get(t.trackId);
    const dieselExempt = disruption?.kind === "OHE_FAULT" && t.kind === "FREIGHT";

    // --- pending timer (dwelling at station / reacting to a problem) ---
    if (t.resumeAtMs !== undefined) {
      if (clockMs < t.resumeAtMs) {
        trains[id] = t;
        continue;
      }
      const pending = t.pendingAction;
      t.resumeAtMs = undefined;
      t.pendingAction = undefined;

      if (pending === "depart" || pending === "nextDest") {
        // nudge off the stop marker so we don't re-dwell on the same spot
        t.positionM = Math.max(0, Math.min(t.positionM + t.direction * 2, track.lengthM));
        if (pending === "nextDest") {
          const others = stationIds.filter((sid) => sid !== t.destinationStationId);
          const nextDest = others[Math.floor(Math.random() * others.length)];
          t.destinationStationId = nextDest;
          const nextAnchor = anchors.get(nextDest);
          if (!nextAnchor) {
            trains[id] = t;
            continue;
          }
          anchor = nextAnchor;
          t.route = findRoute(graph, t.trackId, anchor.trackId, disruptedIds) ?? [];
          t.originalRoute = t.route;
          t.diverted = false;
          log(
            `${t.name}: departed ${network.stations[original.destinationStationId]?.name} — new destination ${network.stations[nextDest]?.name}`,
            "success"
          );
        }
        // fall through to movement below
      }
    }

    // --- disruption detection: re-route IMMEDIATELY, without stopping ---
    // Only if the break lies AHEAD of this train, before the junction where
    // it would leave this line. If no alternate exists, hold and keep retrying.
    const activeDisruption = disrupted.get(t.trackId);
    const activeTrack = network.tracks[t.trackId];
    if (activeDisruption && activeDisruption.positionM !== undefined && !dieselExempt && activeTrack) {
      const jAhead = t.route[1]
        ? nearestJunctionAhead(graph, t.trackId, t.route[1], t.positionM, t.direction)
        : null;
      const leaveAtM = jAhead
        ? jAhead.aTrack === t.trackId
          ? jAhead.aPosM
          : jAhead.bPosM
        : t.direction === 1
          ? activeTrack.lengthM
          : 0;
      const delta = (activeDisruption.positionM - t.positionM) * t.direction;
      const limitDelta = (leaveAtM - t.positionM) * t.direction;
      if (delta > 0 && delta < DETECT_M && delta < limitDelta) {
        const alt = escapeRouteFromDisruption(
          graph,
          network,
          t,
          activeDisruption,
          disruptedIds,
          anchor.trackId
        );
        const viable = alt && !(alt.length === 1 && alt[0] === t.trackId);
        if (viable) {
          if (alt!.join("|") !== t.route.join("|")) {
            t.route = alt!;
            t.diverted = true;
            applyRouteEntry(graph, network, t, anchors.get(t.destinationStationId));
            log(
              `${t.name}: ${activeDisruption.label.toLowerCase()} ${Math.round(delta)} m ahead — diverting immediately via ${describeRoute(network, t.route.slice(1))} to ${network.stations[t.destinationStationId]?.name}`,
              "warn"
            );
          }
          // fall through to movement at full speed
        } else {
          if (t.status !== "HALTED") {
            log(
              `${t.name}: ${activeDisruption.label.toLowerCase()} ahead — no alternate route, holding`,
              "warn"
            );
          }
          t.status = "HALTED";
          t.haltReason = `${activeDisruption.label.toLowerCase()} — no alternate route, holding`;
          trains[id] = t;
          continue;
        }
      }
    }
    // --- look ahead: nearest constraint (train ahead, red/failed signal or station stop) ---
    const posNow = t.positionM;
    const dir = t.direction;
    const candidates: { distM: number; stopPosM: number; kind: "signal" | "station" | "train"; label: string; isDest: boolean; stationId?: string }[] = [];

    for (const other of Object.values(network.trains)) {
      if (other.id === t.id || other.trackId !== t.trackId || other.status === "OUT_OF_SERVICE") continue;
      const delta = (other.positionM - posNow) * dir;
      if (delta <= 0 || delta >= TRAIN_BRAKE_M) continue;

      if (other.direction !== dir) {
        // head-on conflict on a single line — turn back, or hold if we just did
        const inCooldown =
          t.lastTurnbackMs !== undefined && clockMs - t.lastTurnbackMs < TURNBACK_COOLDOWN_MS;
        if (inCooldown) {
          candidates.push({
            distM: 0,
            stopPosM: posNow,
            kind: "train",
            label: `oncoming ${other.name}`,
            isDest: false,
          });
        } else {
          t.direction = (-dir) as 1 | -1;
          t.lastTurnbackMs = clockMs;
          t.status = "RUNNING";
          t.haltReason = undefined;
          log(`${t.name}: oncoming ${other.name} on the same line — turning back`, "warn");
          trains[id] = t;
          continue outer;
        }
      }

      const stopPos = other.positionM - dir * TRAIN_SAFE_GAP;
      const dist = (stopPos - posNow) * dir;
      candidates.push({
        distM: Math.max(dist, 0),
        stopPosM: dist >= 0 ? stopPos : posNow,
        kind: "train",
        label: other.name,
        isDest: false,
      });
    }

    for (const signal of Object.values(network.signals)) {
      if (signal.trackId !== t.trackId) continue;
      const isBlocked = signal.aspect === "RED" || failedSignals.has(signal.id);
      if (!isBlocked) continue;
      const delta = (signal.positionM - posNow) * dir;
      if (delta >= 0 && delta < SIGNAL_BRAKE_M) {
        const stopPos = signal.positionM - dir * SIG_BUFFER;
        const dist = (stopPos - posNow) * dir;
        if (dist >= 0) {
          candidates.push({
            distM: dist,
            stopPosM: stopPos,
            kind: "signal",
            label: signal.name,
            isDest: false,
          });
        }
      }
    }

    // forget a just-departed station once it is behind us
    if (t.lastStationId) {
      const la = anchors.get(t.lastStationId);
      if (!la || la.trackId !== t.trackId || (la.posM - posNow) * t.direction < 0) {
        t.lastStationId = undefined;
      }
    }

    for (const [stationId, stAnchor] of anchors) {
      if (stAnchor.trackId !== t.trackId) continue;
      if (stationId === t.lastStationId) continue;
      const isDest = stationId === t.destinationStationId;
      if (t.kind === "FREIGHT" && !isDest) continue;
      const delta = (stAnchor.posM - posNow) * dir;
      if (delta > 0 && delta < STATION_BRAKE_M) {
        candidates.push({
          distM: delta,
          stopPosM: stAnchor.posM,
          kind: "station",
          label: network.stations[stationId]?.name ?? stationId,
          isDest,
          stationId,
        });
      }
    }

    candidates.sort((a, b) => a.distM - b.distM);
    const nearest = candidates[0];

    if (nearest && nearest.distM <= step) {
      t.positionM = nearest.stopPosM;
      if (nearest.kind === "signal") {
        t.status = "HALTED";
        t.haltReason = `held at ${nearest.label} (red)`;
        trains[id] = t;
        continue;
      }
      if (nearest.kind === "train") {
        t.status = "HALTED";
        t.haltReason = `safe distance behind ${nearest.label}`;
        trains[id] = t;
        continue;
      }
      t.status = "HALTED";
      t.haltReason = nearest.isDest
        ? `arrived at ${nearest.label}`
        : `boarding at ${nearest.label}`;
      t.pendingAction = nearest.isDest ? "nextDest" : "depart";
      t.resumeAtMs = clockMs + (nearest.isDest ? ARRIVE_DWELL_MS : DWELL_MS);
      if (nearest.kind === "station") t.lastStationId = nearest.stationId;
      log(
        nearest.isDest
          ? `${t.name}: arrived at ${nearest.label}`
          : `${t.name}: stopping at ${nearest.label}`,
        "info"
      );
      trains[id] = t;
      continue;
    }

    // --- free movement ---
    const before = t.positionM;
    let after = before + step * dir;
    if (after > (network.tracks[t.trackId]?.lengthM ?? track.lengthM)) {
      after = network.tracks[t.trackId]?.lengthM ?? track.lengthM;
    }
    if (after < 0) after = 0;
    t.positionM = after;

    // --- junction traversal: switch only if the junction leads along our route ---
    const nextTrackId = t.route[1];
    if (nextTrackId && disruptedIds.has(nextTrackId)) {
      // route leads into a disrupted line — stop and re-plan
      const alt = findRoute(graph, t.trackId, anchor.trackId, disruptedIds);
      if (alt && alt[1] !== nextTrackId) {
        t.route = alt;
        t.diverted = true;
        log(
          `${t.name}: diverting via ${describeRoute(network, alt.slice(1))} to ${network.stations[t.destinationStationId]?.name}`,
          "warn"
        );
      } else {
        t.status = "HALTED";
        t.haltReason = "next line on route is blocked — holding";
        trains[id] = t;
        continue;
      }
    }

    const routeNext = t.route[1];
    if (routeNext) {
      const js = junctionBetween(graph, t.trackId, routeNext)
        .filter((j) => {
          const jp = j.aTrack === t.trackId ? j.aPosM : j.bPosM;
          // small backward tolerance so a station-departure nudge can't skip a junction
          return (jp - before) * dir >= -5 && (jp - after) * dir <= 0;
        })
        .sort((a, b) => {
          const pa = a.aTrack === t.trackId ? a.aPosM : a.bPosM;
          const pb = b.aTrack === t.trackId ? b.aPosM : b.bPosM;
          return (pa - before) * dir - (pb - before) * dir;
        });

      if (js.length > 0) {
        const j = js[0];
        const enterPos = j.aTrack === t.trackId ? j.bPosM : j.aPosM;

        // never enter a block that is occupied too closely by another train
        const entryOccupied = Object.values(network.trains).some(
          (o) =>
            o.id !== t.id &&
            o.status !== "OUT_OF_SERVICE" &&
            o.trackId === routeNext &&
            Math.abs(o.positionM - enterPos) < TRAIN_SAFE_GAP
        );
        if (entryOccupied) {
          const jPosM = j.aTrack === t.trackId ? j.aPosM : j.bPosM;
          t.positionM = Math.max(0, Math.min(jPosM - dir * 5, track.lengthM));
          t.status = "HALTED";
          t.haltReason = "awaiting clear line ahead";
          trains[id] = t;
          continue;
        }

        t.trackId = routeNext;
        t.positionM = enterPos;
        t.route = t.route.slice(1);

        // back on the original plan? diversion over
        if (t.diverted) {
          const idx = t.originalRoute.indexOf(t.trackId);
          if (idx >= 0 && t.route.join("|") === t.originalRoute.slice(idx).join("|")) {
            t.diverted = false;
            log(`${t.name}: back on original route`, "success");
          }
        }

        const newTrack = network.tracks[t.trackId];
        let targetPosM: number | null = null;
        if (t.route[1]) {
          const j2 = junctionBetween(graph, t.trackId, t.route[1])[0];
          if (j2) targetPosM = j2.aTrack === t.trackId ? j2.aPosM : j2.bPosM;
        }
        if (targetPosM === null) {
          const destA = anchors.get(t.destinationStationId);
          if (destA && destA.trackId === t.trackId) targetPosM = destA.posM;
        }
        if (targetPosM !== null && newTrack) {
          const d = Math.sign(targetPosM - enterPos);
          if (d !== 0) t.direction = d as 1 | -1;
        }
        t.positionM = Math.max(0, Math.min(t.positionM, (newTrack?.lengthM ?? enterPos)));
      }
    }

    // --- track end: follow route via an end junction, else reverse (terminus) ---
    const curTrack = network.tracks[t.trackId];
    if (curTrack) {
      if (t.positionM >= curTrack.lengthM) {
        t.positionM = curTrack.lengthM;
        t.direction = -1;
      } else if (t.positionM <= 0) {
        t.positionM = 0;
        t.direction = 1;
      }
    }

    t.status = "RUNNING";
    t.haltReason = undefined;
    trains[id] = t;
  }

  return { trains, entries };
}

/**
 * Route a train OFF a disrupted line. Track-level BFS is not enough here —
 * the escape junction must sit BEFORE the break (or behind the train, via a
 * reversal). Forward escapes are preferred over reversals.
 */
function escapeRouteFromDisruption(
  graph: Parameters<typeof junctionBetween>[0],
  network: RailwayNetwork,
  t: Train,
  disruption: DisasterEvent,
  disruptedIds: Set<string>,
  anchorTrackId: string
): string[] | null {
  const track = network.tracks[t.trackId];
  if (!track || disruption.positionM === undefined) {
    return findRoute(graph, t.trackId, anchorTrackId, disruptedIds);
  }
  const dir = t.direction;
  const edges = graph.adjacency.get(t.trackId) ?? [];
  let best: { route: string[]; score: number } | null = null;

  for (const e of edges) {
    const jPosM = e.junction.aTrack === t.trackId ? e.junction.aPosM : e.junction.bPosM;
    const forward = (jPosM - t.positionM) * dir > 0;
    const beforeBreak = (disruption.positionM - jPosM) * dir > 0;
    if (forward && !beforeBreak) continue;
    const sub = findRoute(graph, e.to, anchorTrackId, new Set([...disruptedIds, t.trackId]));
    if (!sub) continue;
    const score = (forward ? 0 : 10000) + Math.abs(jPosM - t.positionM) + sub.length * 500;
    if (!best || score < best.score) best = { route: [t.trackId, ...sub], score };
  }
  return best?.route ?? null;
}

function nearestJunctionAhead(  graph: Parameters<typeof junctionBetween>[0],
  fromTrack: string,
  toTrack: string,
  posM: number,
  dir: 1 | -1
) {
  const js = junctionBetween(graph, fromTrack, toTrack).filter((j) => {
    const jp = j.aTrack === fromTrack ? j.aPosM : j.bPosM;
    return (jp - posM) * dir > 0;
  });
  js.sort((a, b) => {
    const pa = a.aTrack === fromTrack ? a.aPosM : a.bPosM;
    const pb = b.aTrack === fromTrack ? b.aPosM : b.bPosM;
    return (pa - posM) * dir - (pb - posM) * dir;
  });
  return js[0] ?? null;
}

/**
 * Orient a train onto its (new) route: face the first route junction,
 * or the destination when the route is a single line. Reverses if needed.
 */
function applyRouteEntry(
  graph: Parameters<typeof junctionBetween>[0],
  network: RailwayNetwork,
  t: Train,
  destAnchor: { trackId: string; posM: number } | undefined
): void {
  let targetPosM: number | null = null;
  if (t.route[1]) {
    const entry = routeEntry(graph, t.trackId, t.route[1], t.positionM);
    if (entry) {
      targetPosM = entry.jPosM;
      t.direction = entry.dir;
    }
  }
  if (targetPosM === null && destAnchor && destAnchor.trackId === t.trackId) {
    targetPosM = destAnchor.posM;
    const d = Math.sign(targetPosM - t.positionM);
    if (d !== 0) t.direction = d as 1 | -1;
  }
}

/**
 * How to enter the next line of a route from the current position:
 * prefer a junction ahead; if all junctions are behind, reverse toward
 * the nearest one. Returns the junction position and travel direction.
 */
function routeEntry(
  graph: Parameters<typeof junctionBetween>[0],
  fromTrack: string,
  toTrack: string,
  posM: number
): { jPosM: number; dir: 1 | -1 } | null {
  const js = junctionBetween(graph, fromTrack, toTrack);
  if (js.length === 0) return null;
  let best: { jPosM: number; score: number } | null = null;
  for (const j of js) {
    const jp = j.aTrack === fromTrack ? j.aPosM : j.bPosM;
    const delta = jp - posM;
    const score = delta > 0 ? delta : 1e9 + Math.abs(delta);
    if (!best || score < best.score) best = { jPosM: jp, score };
  }
  if (!best) return null;
  return { jPosM: best.jPosM, dir: best.jPosM >= posM ? 1 : -1 };
}

export function toggleHalt(train: Train): Train {
  if (train.manualHold) {
    return {
      ...train,
      manualHold: false,
      status: "RUNNING",
      haltReason: undefined,
      resumeAtMs: undefined,
      pendingAction: undefined,
    };
  }
  return {
    ...train,
    manualHold: true,
    status: "HALTED",
    haltReason: "held by controller",
  };
}

export function setTrainPosition(train: Train, positionM: number, trackLengthM: number): Train {
  const clamped = Math.max(0, Math.min(positionM, trackLengthM));
  return { ...train, positionM: clamped };
}
