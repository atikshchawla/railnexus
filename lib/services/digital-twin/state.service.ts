import { create } from "zustand";
import {
  cumulativeLengths,
  nearestPointOnPolyline,
  pointAtDistance,
  polylineLength,
} from "./geometry";
import { nextId, removeTrack } from "./network.service";
import { stepTrains, setTrainPosition, toggleHalt } from "./simulation.service";
import { buildDemoNetwork } from "./seed";
import type {
  DisasterEvent,
  DisasterKind,
  LogEntry,
  RailwayNetwork,
  Selection,
  SignalAspect,
  Station,
  Tool,
  Track,
  Train,
} from "./types";

interface TwinState {
  network: RailwayNetwork;
  tool: Tool;
  selection: Selection | null;
  running: boolean;
  speedMultiplier: number;
  clockMs: number;
  activeEvents: DisasterEvent[];
  notice: string | null;
  noticeUntil: number;
  log: LogEntry[];

  setTool: (tool: Tool) => void;
  select: (selection: Selection | null) => void;

  /* network editing */
  createTrack: (name: string, kind: Track["kind"], points: Track["points"]) => string;
  reshapeTrack: (trackId: string, points: Track["points"]) => void;
  createStation: (position: Station["position"]) => string;
  moveStation: (stationId: string, position: Station["position"]) => void;
  createSignal: (trackId: string, positionM: number, aspect?: SignalAspect) => string;
  cycleSignalAspect: (signalId: string) => void;
  createPole: (trackId: string, positionM: number) => string;
  createCrossing: (trackId: string, positionM: number) => string;
  createTrain: (trackId: string, positionM: number) => string;
  deleteEntity: (kind: Selection["kind"], id: string) => void;
  resetNetwork: () => void;

  /* simulation */
  toggleRunning: () => void;
  setSpeedMultiplier: (multiplier: number) => void;
  tick: (dtSec: number) => void;
  toggleTrainHalt: (trainId: string) => void;
  moveTrain: (trainId: string, positionM: number) => void;

  /* disasters */
  triggerDisaster: (kind: DisasterKind) => void;
  removeEvent: (eventId: string) => void;
  clearEvents: () => void;
}

const ASPECT_CYCLE: SignalAspect[] = ["GREEN", "YELLOW", "DOUBLE_YELLOW", "RED"];

const DISASTER_LABELS: Record<DisasterKind, string> = {
  BROKEN_TRACK: "Broken track",
  FLOODING: "Flooding",
  SIGNAL_FAILURE: "Signal failure",
  OHE_FAULT: "OHE fault",
  MIXED_SCHEDULE: "Mixed schedule",
};

let trainCounter = 0;
let logCounter = 0;

function toLogEntries(
  entries: Omit<LogEntry, "id">[]
): LogEntry[] {
  return entries.map((e) => ({ ...e, id: ++logCounter }));
}

export const useTwinStore = create<TwinState>((set, get) => ({
  network: buildDemoNetwork(),
  tool: "select",
  selection: null,
  running: true,
  speedMultiplier: 5,
  clockMs: 0,
  activeEvents: [],
  notice: null,
  noticeUntil: 0,
  log: [],

  setTool: (tool) => set({ tool, selection: null }),
  select: (selection) => set({ selection }),

  createTrack: (name, kind, points) => {
    const id = nextId("trk");
    set((s) => ({
      network: {
        ...s.network,
        tracks: {
          ...s.network.tracks,
          [id]: { id, name, kind, points, lengthM: polylineLength(points) },
        },
      },
    }));
    return id;
  },

  reshapeTrack: (trackId, points) =>
    set((s) => {
      const track = s.network.tracks[trackId];
      if (!track) return s;
      return {
        network: {
          ...s.network,
          tracks: {
            ...s.network.tracks,
            [trackId]: { ...track, points, lengthM: polylineLength(points) },
          },
        },
      };
    }),

  createStation: (position) => {
    const id = nextId("stn");
    set((s) => ({
      network: {
        ...s.network,
        stations: {
          ...s.network.stations,
          [id]: {
            id,
            name: `New Station ${Object.keys(s.network.stations).length + 1}`,
            position,
            platforms: 2,
          },
        },
      },
    }));
    return id;
  },

  moveStation: (stationId, position) =>
    set((s) => {
      const station = s.network.stations[stationId];
      if (!station) return s;
      return {
        network: {
          ...s.network,
          stations: { ...s.network.stations, [stationId]: { ...station, position } },
        },
      };
    }),

  createSignal: (trackId, positionM, aspect = "RED") => {
    const id = nextId("sig");
    set((s) => ({
      network: {
        ...s.network,
        signals: {
          ...s.network.signals,
          [id]: {
            id,
            name: `SIG ${Object.keys(s.network.signals).length + 1}`,
            trackId,
            positionM,
            aspect,
          },
        },
      },
    }));
    return id;
  },

  cycleSignalAspect: (signalId) =>
    set((s) => {
      const signal = s.network.signals[signalId];
      if (!signal) return s;
      const aspect =
        ASPECT_CYCLE[(ASPECT_CYCLE.indexOf(signal.aspect) + 1) % ASPECT_CYCLE.length];
      return {
        network: {
          ...s.network,
          signals: { ...s.network.signals, [signalId]: { ...signal, aspect } },
        },
      };
    }),

  createPole: (trackId, positionM) => {
    const id = nextId("pole");
    set((s) => ({
      network: {
        ...s.network,
        poles: {
          ...s.network.poles,
          [id]: {
            id,
            name: `OHE ${Object.keys(s.network.poles).length + 1}`,
            trackId,
            positionM,
          },
        },
      },
    }));
    return id;
  },

  createCrossing: (trackId, positionM) => {
    const id = nextId("lc");
    set((s) => ({
      network: {
        ...s.network,
        crossings: {
          ...s.network.crossings,
          [id]: {
            id,
            name: `LC ${Object.keys(s.network.crossings).length + 1}`,
            trackId,
            positionM,
          },
        },
      },
    }));
    return id;
  },

  createTrain: (trackId, positionM) => {
    const id = nextId("trn");
    trainCounter += 1;
    const kinds: Train["kind"][] = ["PASSENGER", "EXPRESS", "FREIGHT"];
    const kind = kinds[trainCounter % kinds.length];
    const speeds: Record<Train["kind"], number> = {
      PASSENGER: 110,
      EXPRESS: 140,
      FREIGHT: 70,
    };
    const stationIds = Object.keys(get().network.stations);
    const destinationStationId =
      stationIds[Math.floor(Math.random() * stationIds.length)] ?? "";
    const TRAIN_PALETTE = ["#8b5cf6", "#06b6d4", "#ec4899", "#14b8a6", "#a3e635"];
    set((s) => ({
      network: {
        ...s.network,
        trains: {
          ...s.network.trains,
          [id]: {
            id,
            name: `Train ${trainCounter}`,
            kind,
            status: "RUNNING",
            trackId,
            positionM,
            direction: 1,
            speedKmph: speeds[kind],
            color: TRAIN_PALETTE[trainCounter % TRAIN_PALETTE.length],
            destinationStationId,
            route: [],
            originalRoute: [],
          },
        },
      },
    }));
    return id;
  },

  deleteEntity: (kind, id) =>
    set((s) => {
      const network: RailwayNetwork = {
        ...s.network,
        tracks: { ...s.network.tracks },
        stations: { ...s.network.stations },
        signals: { ...s.network.signals },
        poles: { ...s.network.poles },
        crossings: { ...s.network.crossings },
        trains: { ...s.network.trains },
      };
      if (kind === "track") removeTrack(network, id);
      else if (kind === "station") delete network.stations[id];
      else if (kind === "signal") delete network.signals[id];
      else if (kind === "pole") delete network.poles[id];
      else if (kind === "crossing") delete network.crossings[id];
      else if (kind === "train") delete network.trains[id];
      const activeEvents =
        kind === "track"
          ? s.activeEvents.filter((e) => e.trackId !== id)
          : kind === "signal"
            ? s.activeEvents.filter((e) => e.signalId !== id)
            : s.activeEvents;
      return { network, selection: null, activeEvents };
    }),

  resetNetwork: () =>
    set((s) => ({
      network: buildDemoNetwork(),
      selection: null,
      running: true,
      activeEvents: [],
      log: toLogEntries([{ timeMs: s.clockMs, text: "Demo reset — network restored", kind: "info" }]),
    })),

  toggleRunning: () => set((s) => ({ running: !s.running })),
  setSpeedMultiplier: (speedMultiplier) => set({ speedMultiplier }),

  tick: (dtSec) =>
    set((s) => {
      const clockMs = s.clockMs + dtSec * 1000;
      const { trains, entries } = stepTrains(
        s.network,
        s.activeEvents,
        dtSec,
        s.speedMultiplier,
        clockMs
      );
      let { notice, noticeUntil } = s;
      if (notice && clockMs > noticeUntil) {
        notice = null;
        noticeUntil = 0;
      }
      const log = entries.length
        ? [...s.log, ...toLogEntries(entries)].slice(-120)
        : s.log;
      return {
        clockMs,
        network: { ...s.network, trains },
        notice,
        noticeUntil,
        log,
      };
    }),

  toggleTrainHalt: (trainId) =>
    set((s) => {
      const train = s.network.trains[trainId];
      if (!train) return s;
      return {
        network: {
          ...s.network,
          trains: { ...s.network.trains, [trainId]: toggleHalt(train) },
        },
      };
    }),

  moveTrain: (trainId, positionM) =>
    set((s) => {
      const train = s.network.trains[trainId];
      const track = train && s.network.tracks[train.trackId];
      if (!train || !track) return s;
      return {
        network: {
          ...s.network,
          trains: {
            ...s.network.trains,
            [trainId]: setTrainPosition(train, positionM, track.lengthM),
          },
        },
      };
    }),

  triggerDisaster: (kind) =>
    set((s) => {
      const events = [...s.activeEvents];
      let notice: string;

      if (kind === "SIGNAL_FAILURE") {
        const signals = Object.values(s.network.signals);
        if (signals.length === 0) return s;
        const selected =
          s.selection?.kind === "signal" ? s.network.signals[s.selection.id] : undefined;
        const signal =
          selected ?? signals[Math.floor(Math.random() * signals.length)];

        const duplicate = events.find((e) => e.kind === kind && e.signalId === signal.id);
        if (duplicate) {
          return {
            notice: `Signal failure is already active at ${signal.name} — resolve it first`,
            noticeUntil: s.clockMs + 3500,
          };
        }

        const affected = Object.values(s.network.trains).filter(
          (tr) => tr.trackId === signal.trackId
        );
        events.push({
          id: nextId("evt"),
          kind,
          signalId: signal.id,
          createdAtMs: s.clockMs,
          label: `${DISASTER_LABELS[kind]} — ${signal.name} (${s.network.tracks[signal.trackId]?.name ?? "?"})`,
          affectedTrains: affected.length,
        });
        notice = `Signal failure at ${signal.name} on ${s.network.tracks[signal.trackId]?.name} — ${affected.length} train(s) approaching will hold at caution`;
        return {
          activeEvents: events,
          notice,
          noticeUntil: s.clockMs + 3500,
          log: [
            ...s.log,
            ...toLogEntries([
              {
                timeMs: s.clockMs,
                text: `Signal failure at ${signal.name} on ${s.network.tracks[signal.trackId]?.name ?? "?"}${affected.length ? ` — ${affected.length} train(s) on line` : " — no trains on line"}`,
                kind: "warn",
              },
            ]),
          ],
        };
      } else if (kind === "MIXED_SCHEDULE") {
        const tracks = Object.values(s.network.tracks);
        const trains: Record<string, Train> = {};
        for (const [id, train] of Object.entries(s.network.trains)) {
          let next: Train = {
            ...train,
            direction: train.direction === 1 ? -1 : 1,
            route: [],
            resumeAtMs: undefined,
            pendingAction: undefined,
            haltReason: train.manualHold ? "held by controller" : undefined,
          };
          if (tracks.length > 1 && Math.random() < 0.5) {
            const current = tracks.find((t) => t.id === train.trackId);
            const others = tracks.filter((t) => t.id !== train.trackId);
            const target = others[Math.floor(Math.random() * others.length)];
            if (current && target.points.length >= 2) {
              const cum = cumulativeLengths(current.points);
              const { position } = pointAtDistance(current.points, cum, train.positionM);
              const near = nearestPointOnPolyline(target.points, position);
              if (near) {
                next = {
                  ...next,
                  trackId: target.id,
                  positionM: near.trackDistM,
                };
              }
            }
          }
          trains[id] = next;
        }
        events.push({
          id: nextId("evt"),
          kind,
          createdAtMs: s.clockMs,
          label: `${DISASTER_LABELS[kind]} — trains reversed & re-slotted`,
          affectedTrains: Object.keys(trains).length,
        });
        notice = "Mixed schedule — every train reversed direction; half were re-slotted onto other lines";
        return {
          activeEvents: events,
          network: { ...s.network, trains },
          notice,
          noticeUntil: s.clockMs + 3500,
          log: [
            ...s.log,
            ...toLogEntries([
              { timeMs: s.clockMs, text: "Mixed schedule triggered — all trains reversed, half re-slotted", kind: "warn" },
            ]),
          ],
        };
      } else {
        const tracks = Object.values(s.network.tracks);
        if (tracks.length === 0) return s;
        const selectedTrack =
          s.selection?.kind === "track"
            ? s.network.tracks[s.selection.id.split("::")[0]]
            : undefined;
        const track =
          selectedTrack ?? tracks[Math.floor(Math.random() * tracks.length)];

        const duplicate = events.find((e) => e.kind === kind && e.trackId === track.id);
        if (duplicate) {
          return {
            notice: `${DISASTER_LABELS[kind]} is already active on ${track.name} — resolve it first`,
            noticeUntil: s.clockMs + 3500,
          };
        }

        const positionM = Math.round(track.lengthM * (0.3 + Math.random() * 0.4));
        const onLine = Object.values(s.network.trains).filter((tr) => tr.trackId === track.id);
        const affected =
          kind === "OHE_FAULT" ? onLine.filter((tr) => tr.kind !== "FREIGHT") : onLine;
        events.push({
          id: nextId("evt"),
          kind,
          trackId: track.id,
          positionM,
          createdAtMs: s.clockMs,
          label: `${DISASTER_LABELS[kind]} — ${track.name}`,
          affectedTrains: affected.length,
        });

        let notice: string;
        if (kind === "OHE_FAULT" && affected.length === 0) {
          notice = `OHE fault on ${track.name} — only freight (diesel) present, trains keep running`;
        } else if (affected.length === 0) {
          notice = `${DISASTER_LABELS[kind]} on ${track.name} — no trains on the line right now`;
        } else if (kind === "OHE_FAULT") {
          notice = `OHE fault on ${track.name} — ${affected.length} electric train(s) will divert or hold; freight keeps running`;
        } else {
          notice = `${DISASTER_LABELS[kind]} on ${track.name} — ${affected.length} train(s) affected: they will stop, then divert via another line`;
        }
        return {
          activeEvents: events,
          notice,
          noticeUntil: s.clockMs + 3500,
          log: [
            ...s.log,
            ...toLogEntries([
              {
                timeMs: s.clockMs,
                text: `${DISASTER_LABELS[kind]} on ${track.name} at ~${positionM} m${affected.length ? ` — ${affected.length} train(s) affected` : " — no trains affected"}`,
                kind: "warn",
              },
            ]),
          ],
        };
      }

      return {
        activeEvents: events,
        notice,
        noticeUntil: s.clockMs + 3500,
      };
    }),

  removeEvent: (eventId) =>
    set((s) => {
      const removed = s.activeEvents.find((e) => e.id === eventId);
      return {
        activeEvents: s.activeEvents.filter((e) => e.id !== eventId),
        log: removed
          ? [
              ...s.log,
              ...toLogEntries([
                { timeMs: s.clockMs, text: `${removed.label} resolved — affected trains recovering`, kind: "success" },
              ]),
            ]
          : s.log,
      };
    }),

  clearEvents: () =>
    set((s) => ({
      activeEvents: [],
      log: s.activeEvents.length
        ? [
            ...s.log,
            ...toLogEntries([
              { timeMs: s.clockMs, text: `All ${s.activeEvents.length} event(s) resolved`, kind: "success" },
            ]),
          ]
        : s.log,
    })),
}));
