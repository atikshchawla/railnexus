# Agent Updates — RailNexus Working Log

> Living document for tracking plan / progress / pending work across agent sessions.
> Update this file at the end of every work session. Do not delete history — append new sessions.

---

## Current Plan (Simulation Branch)

**Goal:** Working visual demo of a railway network with trains — the foundation for the
Digital Twin and, later, the disaster-management simulation.

**Scope for this iteration:**
1. 2D railway network editor (tracks, stations, signals, OHE poles)
2. Trains placed on tracks, moving along them (multiple trains, multiple tracks)
3. Stations + signals with visual state (signal aspects)
4. Demo controls as **placeholders only** (Broken Track / Flooding etc.) — NO disaster logic yet

**Explicitly OUT of scope:** disaster/flood/broken-track logic, AI decisions,
optimization, physics, backend/DB integration.

---

## Architecture Decisions (keep these in mind when editing)

- **Stack additions:** `zustand` v5 installed (docs-recommended in
  `docs/01-architecture/tech-stack.md`). Rendering = plain HTML5 Canvas 2D + rAF loop.
  No D3/Mapbox needed for this demo stage (Mapbox needs an API key; schematic view first).
- **Directory mapping (MANDATED by docs/01-architecture/directory-structure.md):**
  - Logic → `lib/services/digital-twin/` (`types.ts`, `geometry.ts`, `state.service.ts`,
    `network.service.ts`, `simulation.service.ts`, `seed.ts`)
  - UI → `components/digital-twin/` (`MapRenderer.tsx`, `renderers.ts`,
    `SignalNode.tsx`, `TrainMarker.tsx`, `Toolbar.tsx`, `DemoControls.tsx`,
    `InspectorPanel.tsx`)
  - Page → `app/(dashboard)/digital-twin/page.tsx` (URL: `/digital-twin`)
- **State pattern:** everything lives in one zustand store (`useTwinStore`).
  The canvas render loop reads via `useTwinStore.getState()` imperatively each frame —
  do NOT subscribe React components to per-frame data (positionM changes every frame);
  subscribe only to selection/tool/config.
- **Train ↔ track relationship:** a train stores `trackId` + `positionM`
  (distance along the polyline), never raw coordinates. World position is derived
  via `pointAtDistance()`. If you change track geometry, trains keep their distance-along-track.
- **Cascade deletes:** deleting a track removes its signals, poles AND trains
  (see `removeTrack()`). Keep this invariant.
- **Units:** 1 world unit == 1 metre. Speeds stored km/h; converted in `stepTrains`.
  Camera zoom default ~0.6; speedMultiplier default 5× so motion is visible.
- **Visual language (from docs/07-digital-twin/simulator-design.md):**
  Up track = blue, Down = green, loops/sidings = grey; Passenger train = blue,
  Freight = orange, Express = violet; signal aspects RED/YELLOW/DOUBLE_YELLOW/GREEN.
- **Disaster hooks:** `DemoControls.tsx` buttons are disabled placeholders. When disasters
  arrive: add an `events` slice to the store (e.g. `activeEvents: DisasterEvent[]`) and have
  `simulation.service.ts` consult it (e.g. broken track ⇒ trains on that track HALT).
  Do not wire disaster state into components directly.
- **Docs are read-only:** never edit `docs/**` (project rule) — including directory-structure doc.
- **Windows note:** PowerShell execution policy blocks `npm.ps1`/`npx.ps1`; use `npm.cmd`.
  Prisma CLI works via `node_modules\.bin\prisma.cmd`.
- **Next.js version quirk:** repo AGENTS.md warns this Next.js has breaking changes;
  bundled docs live in `node_modules/next/dist/docs/`. Standard `'use client'` still applies.

---

## Work Done

### Session 1 — 2026-08-24 (branch: `simulation`)

- Read inherited docs: tech-stack, directory-structure, simulator-design, system-architecture.
- Verified Neon Postgres connection via Prisma (`prisma db execute` OK) — not used by demo.
- Installed `zustand@^5.0.15`.
- Created service layer under `lib/services/digital-twin/`:
  - `types.ts` — Track/Station/Signal/OhePole/Train/RailwayNetwork/Selection/Tool domain model.
  - `geometry.ts` — polyline length, point-at-distance, nearest-point projection, nearest-track finder.
  - `network.service.ts` — entity factories + cascade `removeTrack()`.
  - `simulation.service.ts` — `stepTrains()` movement engine (shuttle behaviour at track ends),
    halt toggle, position setter.
  - `state.service.ts` — zustand store: tool, selection, running/speed, all CRUD actions, tick().
- Created UI layer under `components/digital-twin/`:
  - `renderers.ts` — canvas draw fns: grid, tracks (+sleepers, kind colours), stations, poles.
  - `SignalNode.tsx` / `TrainMarker.tsx` — canvas draw fns for signals (aspect colours) and
    trains (kind colours, direction chevron, labels, selection ring).
  - `MapRenderer.tsx` — full editor viewport: DPR-aware canvas, rAF loop driving `tick()`,
    pan (drag/middle-mouse), wheel zoom-to-cursor, tools (select / track-draw / station /
    signal / pole / train / delete), snapping to nearest track, station & vertex dragging,
    train dragging along its track, Esc/Enter keyboard handling, hover ghosts.
  - `Toolbar.tsx` — tool buttons + play/pause + speed multiplier + reset.
  - `InspectorPanel.tsx` — selection details; Halt/Resume for trains; Cycle Aspect for signals.
  - `DemoControls.tsx` — disabled placeholder disaster buttons (Broken Track, Flooding,
    Signal Failure, OHE Fault).
- Pages:
  - `app/(dashboard)/digital-twin/page.tsx` — demo layout composing the above.
  - `app/page.tsx` — minimal landing linking to `/digital-twin`.
  - `app/layout.tsx` — metadata title updated to RailNexus.
- Created `seed.ts` — hardcoded-but-centralised demo corridor: Up Main + Down Main +
  loop + siding (4 tracks), 3 stations, signals, OHE poles, 3 trains (< tracks count).

---

## Pending Work

- [x] Run `npm.cmd run lint` — clean (0 errors, 0 warnings).
- [x] Run `npm.cmd run build` — passes; routes `/` and `/digital-twin` generated (static).
- [x] SSR smoke test — `GET /digital-twin` returned 200 with expected page marker.
- [ ] User manual smoke test on `npm.cmd run dev` → http://localhost:3000/digital-twin
      (place/edit/delete every entity type, trains move, controls render).
- [ ] Optional polish after user feedback: track-kind picker when drawing, rename entities
      from inspector, km markers along mains, signal double-yellow two-head visual.

## Future Work (later iterations — do NOT start without instruction)

1. **Disaster/event system**: `DisasterEvent` types, `activeEvents` store slice,
   effects in `simulation.service.ts` (halt trains on broken track/flooded segment),
   DemoControls buttons become functional, event overlays on canvas.
2. **Persistence**: Prisma models for network/trains; save/load layouts (Neon DB already wired).
3. **Real-time sync**: WebSocket layer per digital-twin docs (multi-viewer demos).
4. **Time-distance graph** (D3) once schedules exist; Mapbox/Deck.gl geographic mode later.
5. FastAPI/AI services remain a separate process (user decision) — integrate via API routes.

---

## Session History

| Date | Branch | Summary |
|------|--------|---------|
| 2026-08-24 | simulation | Digital twin demo foundation + full editor UI built (session 1) |
| 2026-08-24 | simulation | Metro-map visual overhaul: light theme, dashboard chrome, multi-line schematic network, interchange stations (session 2) |
| 2026-08-24 | simulation | UX fixes: zoom buttons, tool hints + failure toasts, Level Crossing element, Orange+Violet lines, richer network (session 3) |
| 2026-08-24 | simulation | Disaster system: 5 event types, train reactions (divert/hold/exempt), event overlays, active-event UI (session 4) |
| 2026-08-24 | simulation | Logic rework: network graph, train agents w/ routes & destinations, infrastructure interaction, event log (session 5) |
| 2026-08-24 | simulation | Simplification for judging: 5 lines / 3 trains, destination marker, clean diversion story (session 6) |
| 2026-08-24 | simulation | Visual route identity: per-train coloured planned path, grey abandoned segments, diverted labels (session 7) |
| 2026-08-24 | simulation | Collision avoidance: safe-following, single-line turnbacks, junction occupancy; train legend (session 8) |
| 2026-08-24 | simulation | Return-to-original-route after recovery; explicit diverted flag; escape routing around break position (session 9) |
| 2026-08-24 | simulation | Event UX clarity: descriptions, affected-train counts, duplicate guards, honest notices (session 10) |

---

## Session 10 — Event UI/UX Clarity + Functional Hardening (2026-08-24)

**User ask:** triggered events are unclear — what they do must be obvious in the UI, and
they must be functionally correct.

### UX changes (`DemoControls.tsx`)

- **Hover description box** built into the card (min-height, no layout jump): each event
  button reveals a plain-language explanation of its exact effect, e.g.
  "Cracks a line (pulsing red X). Trains heading toward the break stop for a moment,
  then divert via another line to still reach their destination."
- Card subtitle: "targets the selected line/signal, otherwise a random one".
- **Event chips now show impact**: "Flooding — Red Line · 1 train affected" (stored at
  trigger time as `DisasterEvent.affectedTrains`).
- Idle/hover states: button highlights on hover; hint area shows resolve instructions when
  events are active.

### Functional hardening (`state.service.ts` triggerDisaster)

- **Duplicate guard**: same kind on the same track/signal while active → notice
  "already active — resolve it first", no duplicate event (prevents double-diversion noise).
- **Honest notices with counts**:
  - Broken/flood: "N train(s) affected: they will stop, then divert via another line"
  - OHE with only diesel on the line: "only freight (diesel) present, trains keep running"
    (previously this case looked like nothing happened)
  - Any event with zero trains on the line: "no trains on the line right now"
  - Signal failure includes the line name + affected count.
- **Mixed schedule** clears stale `haltReason` on non-manually-held trains (controller
  holds survive, correctly).

### Verification (session 10)

- [x] Node tests against the store: duplicate guard ✓, affectedTrains stored ✓,
      OHE electric-only count ✓, signal failure notice ✓, clear ✓, mixed schedule
      reversal + clean haltReasons ✓.
- [x] lint clean, build passes, SSR 200.
- [ ] User visual pass.

---

## Session 9 — Return to Own Track + Calamity Correctness (2026-08-24)

**User ask:** trains should prioritise going back on their own track after a calamity;
then verify calamities work correctly.

### Changes

- **`Train.diverted` flag** (replaces derived comparison — the suffix heuristic gave false
  negatives when a diversion reused a later original segment): set on ANY disaster reroute
  (route-validation / pending-expiry / detection-retry / junction-blocked); cleared on fresh
  plans (spawn, new destination) and when the train SWITCHES onto a track that makes its
  route equal the original route's suffix from there (logs "back on original route").
  `isDiverted(train)` is the single source used by renderers + inspector.
- **Return-to-original block** (per tick, when `diverted` and originalRoute has no
  disrupted track): if current track ∈ originalRoute → adopt suffix; else BFS home to
  earliest original track + append originalRoute. Logs "line restored — returning to
  original route". `applyRouteEntry` orients/reverses as needed.
- **Escape routing around the break** (`escapeRouteFromDisruption`): track-level BFS could
  return [Red, Blue] switching at a junction BEYOND the break. Now: for each junction on
  the disrupted line, skip junctions ahead-but-past-the-break; sub-route from the neighbour
  avoiding the disrupted track; score prefers forward escapes over reversals.
  **BUG FIXED**: candidate was built as `[current, ...sub.slice(1)]` which DROPPED the
  neighbour (sub[0]) — produced the invalid [Red, Blue] again. Now `[current, ...sub]`.
- **Turnback cooldown** (`TURNBACK_COOLDOWN_MS=4000`, `Train.lastTurnbackMs`): a train that
  just turned back HOLDS ("waiting for oncoming X") instead of ping-ponging.
- **Seed**: Red Express dest → Noida City (original route Red→Blue; flood diversion uses
  foreign Yellow line, so "return to own track" is a visible manoeuvre). Green Local dest →
  Mundka (same-line).

### Verified story (headless harness)

```
heading to Noida City via Red → Blue
stopping at Ashok Vihar / Inderlok / Sarai Rohilla
broken track detected 138 m ahead — stopping
diverting via Yellow Line → Blue Line to Noida City   (reverses to Sarai Rohilla Jn)
stopping at Chandni Chowk / Rajiv Chowk
back on original route                                 (switched onto Blue)
arrived at Noida City
```
If the event clears while still on Yellow: "line restored — returning to original route"
→ reverses to Red → "back on original route" → Blue → destination.

### Keep in mind

- `diverted` clears via the junction-switch suffix check — if you change route shapes,
  keep originalRoute/route comparisons join("|")-based and consistent.
- escapeRouteFromDisruption assumes the break sits on the train's CURRENT track; for
  disruptions further along the route the plain-BFS validation path handles it.

### Verification (session 9)

- [x] lint clean, build passes, SSR 200.
- [x] Harness: divert via foreign line → rejoin → arrive; cooldown stops ping-pong.
- [ ] User demo pass (flood + clear, watch grey segments revert and label clear).

---

## Session 8 — Collision Avoidance + Legend (2026-08-24)

**User ask:** trains should never crash/stack by default (they were halting en masse on
each other's tracks); add a legend for the train route colours.

### Changes

- **Safe following** (`TRAIN_SAFE_GAP=30`, `TRAIN_BRAKE_M=220`): a train brakes and holds
  ("safe distance behind X") behind any train ahead on the SAME track & direction —
  including emergency hold when already inside the gap (prevents station-centre teleport
  overlaps when two trains brake for the same station in one tick).
- **Single-line turnback**: opposing train ahead within brake distance → the train REVERSES
  ("oncoming X on the same line — turning back", logged amber) instead of colliding or
  deadlocking. Verified: min same-track gap 29.8m over 120s sim, 28 arrivals (flow kept).
- **Junction occupancy**: a train never switches onto a line whose entry point has another
  train within 30m — holds before the junction ("awaiting clear line ahead").
- **Default signals all non-blocking** (SIG 8 RED → YELLOW): the permanent red was silently
  blocking Green Local's destination — that was the "everyone halted" symptom. Judges can
  still cycle any signal to RED manually.
- **Legend** (TopBar second row): line colours + per-train route colour dashes + grey
  "abandoned by diversion". Toolbar/Inspector moved down (top-[76px]) for the taller header.

### Keep in mind

- Turnbacks can ping-pong on a busy single line (70 in 120s @5x) — visually reads as
  "single-line working"; if judges ask, that's the intended simplification.
- Opposing deadlock is impossible (turnback always resolves), but two trains may briefly
  dwell at the same station from opposite ends — gap stays ≥ 0, no overlap.

### Verification (session 8)

- [x] lint clean, build passes, SSR 200.
- [x] Headless 120s: min gap 29.8m, 28 arrivals, turnbacks logged, no overlaps.
- [ ] User visual pass.

---

## Session 7 — Route Visual Identity (2026-08-24)

**User ask:** symbolise the original path by colour so the default path is understood,
and diversions are visible when a calamity hits.

### Changes

- **Train identity colours** (`Train.color`, palette cycled on creation):
  Red Express = violet `#8b5cf6`, Yellow Local = cyan `#06b6d4`, Green Local = pink `#ec4899`.
- **Route overlays (always drawn, per train)**:
  - Planned/active route → dashed line in the train's colour (bright when selected, 40% otherwise)
  - Abandoned segments (in `originalRoute` but not current route) → grey dashed
- **`Train.originalRoute`**: captured whenever a FRESH plan is made (spawn, new destination
  after arrival). Disaster reroutes do NOT touch it — so "diverted" = originalRoute ≠ route
  (computed dynamically, self-heals when the event clears and BFS returns the original path).
- **Labels**: diverted trains show `Name · diverted` (amber); halted stay `(halted)` (red).
- **Inspector**: shows struck-through "Original plan" row + "Diverted route" row when diverted.
- Hint chip updated: "Coloured dashes = planned route · Grey dashes = abandoned by diversion".

### Keep in mind

- `originalRoute` is set in exactly TWO places (ensure-route block + nextDest expiry).
  If you add another route-computation path, decide deliberately whether it's a new plan
  (set originalRoute) or a diversion (don't).
- Diverted status is DERIVED (string join compare), not stored — no stale flags.

### Verification (session 7)

- [x] lint clean, build passes, SSR 200, harness story unchanged.
- [ ] User visual pass: trigger a flood and watch grey abandoned segments + amber
      "· diverted" label appear on Red Express.

---

## Session 6 — Simplification for Judge Clarity (2026-08-24)

**User ask:** routes felt messy; simplify — 3 trains, 5-6 tracks; showcase how trains
change path during a calamity; trains should prioritise reaching their station.

### Changes

- **Network pruned to 5 lines** (Red, Yellow, Blue, Green, Orange — Ring & Violet removed,
  they caused junction noise): 9 junctions instead of 16, 28 stations, 11 signals
  (mostly GREEN — one deliberate RED on Blue so random holds don't muddy the story),
  3 level crossings, 3 trains (< 5 tracks).
- **3 trains with cross-line destinations** (the diversion story):
  - Red Express (140 km/h) — Red Line, dest **Okhla** (on Green): route Red → Yellow → Green
  - Yellow Local (110) — Yellow Line, dest Chhatarpur (same-line run, shows station ops)
  - Green Local (100) — Green Line, dest Noida City (route Green → Yellow → Blue)
- **Log wording simplified**: "heading to X via A → B", "flooding detected 138 m ahead —
  stopping", "diverting via Yellow Line → Green Line to X" (diversion logs omit the line
  the train is already on).
- **Destination marker**: selecting a train draws a pulsing sky ring + "DESTINATION" label
  at its target station.
- Reroute logic unchanged (BFS to destination line avoiding disrupted tracks, reversing to a
  junction when needed) — simplification is in network size, train count, signals, log/marker.

### Verified showcase (headless harness, 5x speed)

Red Express: heading to Okhla via Red-Yellow-Green → flood detected 138m ahead → diverting
via Yellow-Green → stops at Chandni Chowk/Rajiv Chowk/Central Sec/Saket/Tughlakabad/Kalkaji
→ arrived at Okhla. Yellow & Green Locals unaffected (Green Local later held at SIG 8 RED).

### Keep in mind

- Removed Ring/Violet stations (`stn_tilak`, `stn_mohan`, `stn_sarita`, `stn_daya`,
  `stn_sadar`, `stn_pratap`, `stn_lajpat`) — don't reference them.
- Two trains can dwell at the same station (no platform capacity logic — fine for demo).

### Verification (session 6)

- [x] lint clean, build passes, SSR 200, harness shows the full diversion story.
- [ ] User demo pass.

---

## Session 5 — Cohesive Simulation Logic (2026-08-24)

**User ask:** trains must be independent agents on a real network — routes, destinations,
infrastructure interaction (signals/stations/poles), per-train problem detection, and a
visible decision log.

### Architecture (new file: `lib/services/digital-twin/rail-graph.ts`)

- **Junctions from pure geometry**: every pair of tracks is scanned for segment
  intersections or touches (< 15 units) → `Junction {aTrack, aPosM, bTrack, bPosM}`.
  16 junctions on the demo map. Adjacency + BFS `findRoute(from, to, avoid?)`.
  NOTHING is hardcoded to the demo map — user-uploaded networks will work as-is.
- **Station anchors**: every station projected onto its nearest track (posM) each tick.
- **Train agent model** (types.ts): `destinationStationId`, `route: string[]` (remaining
  tracks), `resumeAtMs` (dwell/reaction timer), `pendingAction` ("reroute"|"depart"|"nextDest"),
  `haltReason`, `manualHold`, `lastStationId` (prevents re-dwell after departure).

### Per-tick train decision pipeline (`simulation.service.ts`)

1. manualHold / OOS → skip. 2. Destination sanity. 3. Route via BFS if empty.
4. Route validation: disrupted track in route → re-BFS avoiding (log "rerouting").
5. Pending timer: dwell expiry → nudge 2m + depart (or pick new destination + log);
   reaction expiry → try reroute (BFS avoiding disrupted) else hold.
6. **Disruption detection — position & path aware**: fires only if the break is ahead
   AND before the junction where the train would leave the line (`pathLimit`).
   Detect → HALT (1.8s reaction, log) → reroute or hold.
7. **Look-ahead constraints** (nearest wins): RED/failed signal → stop 12m before
   (releases automatically when aspect changes); station → dwell 1.5s (freight skips
   except its destination); destination → dwell 2.6s → new random destination.
8. **Junction traversal**: switches onto route[1] when crossing the junction
   (5m backward tolerance for departure nudges); direction on the new line is derived
   from the following junction/destination. Blocked next line → re-plan/hold.
9. Track end → reverse (terminus shuttle) if no route junction there.

### Reroute entry (`routeEntry`/`applyRouteEntry`)

Prefers a junction AHEAD; if all junctions for the next line are BEHIND, the train
REVERSES to the nearest one. Direction on each new line is derived from what comes next.

### UI

- **`LogPanel.tsx`** (bottom-left, collapsible): timestamped log (10:00:00 base clock):
  route set / stopping at / arrived / detected / alternative route found / held at red /
  event triggered & resolved. Store: `log: LogEntry[]` (cap 120), `clockMs`.
- **Inspector (train)**: Destination, Route (line sequence), Next action, Action/reason;
  Hold button now shows Release (manualHold).
- **Map**: selected train's route drawn as white dashed overlay.
- `triggerDisaster`/`removeEvent`/`clearEvents`/`resetNetwork` write log entries too.

### Bugs found & fixed via headless harness (temp/opencode/simtest)

1. Reroute oscillation — detection refired while escaping along a disrupted line →
   fixed with pathLimit (junction-aware detection).
2. Reroute to a junction BEHIND the train → now reverses (routeEntry).
3. Station skipped when tick step > remaining distance → fixed with lastStationId memory.
4. Departure nudge skipping a junction 2m behind → 5m backward tolerance in crossing test.

### Verification (session 5)

- [x] lint clean, build passes, SSR 200.
- [x] Headless harness: routes across lines, station dwells + arrivals + new destinations,
      red-signal holds, break detection at 138m → halt → reverse → divert to Yellow,
      unaffected trains continue. (Harness in %TEMP%\opencode\simtest — delete freely.)
- [ ] User demo pass: cycle a signal to RED and watch a train stop & release; break a line
      ahead of a selected train and follow its log.

---

## Session 4 — Disaster/Event System (2026-08-24)

**User ask:** broken track / mixed schedule etc. — trains must react (change path, halt,
or find another solution).

### How it works

- **`DisasterEvent`** (types.ts): `{ id, kind, label, createdAtMs, trackId?, signalId?, positionM? }`.
  Kinds: BROKEN_TRACK, FLOODING, SIGNAL_FAILURE, OHE_FAULT, MIXED_SCHEDULE.
- **Store** (`state.service.ts`): `activeEvents[]`, `clockMs` (advanced in `tick`, pauses with
  sim), `triggerDisaster(kind)` (targets the SELECTED track/signal, else random),
  `removeEvent(id)`, `clearEvents()`, `notice`/`noticeUntil` (top-centre toast, auto-expires).
  Deleting a track/signal also removes its events. Reset Demo clears events.
- **Reactions** (`simulation.service.ts` `stepTrains`):
  1. Train on disrupted line → HALTED with `haltReason` for REACTION_DELAY_MS=1800 (real time),
  2. then **diverts**: `rerouteTrain()` projects the train onto the NEAREST non-disrupted line
     and continues there,
  3. no clean line → holds ("…no alternate line").
  - **OHE_FAULT exempts FREIGHT** (diesel) — they keep running.
  - **SIGNAL_FAILURE**: failed signal drawn dark + red X; trains within SIGNAL_APPROACH_M=140
    (direction-aware) are held at caution; pass it before the failure → unaffected.
  - **MIXED_SCHEDULE**: instant — all trains reverse direction, 50% re-slotted onto a random
    other line at the projected nearest point.
  - **Auto-recovery**: when an event is removed/cleared, trains it held resume automatically.
    Manual controller halts use `haltReason: "held by controller"` and are NEVER auto-resumed.
- **Visuals** (`renderers.ts` `drawNetwork(..., events, clockMs)`): flooding = translucent blue
  stroke over the line; broken track = red X + pulsing ring at `positionM`; OHE fault = orange
  bolt; failed signal via `drawSignalNode(..., failed)`.
- **UI**: `DemoControls` buttons now functional (coloured dots + hint tooltips), active-event
  chips with per-event × resolve + "Clear all (n)". Inspector shows train `Held: <reason>`.
  Notice toast renders top-centre in MapRenderer (store-subscribed).

### Keep in mind

- `stepTrains` signature: `(network, events, dtSec, speedMultiplier, clockMs)` — clock comes
  from the store tick; reaction delay is REAL time (pausing sim pauses reactions).
- Reroute = teleport to nearest point on the clean line (after the 1.8s halt). Acceptable demo
  simplification; a path-following reroute would need a graph — see Future Work.
- Diversion targets ANY clean line (even a different colour) — visually reads as "diverted to
  another line". If you want same-corridor-only diversions, filter candidates by kind.
- MIXED_SCHEDULE trains keep running after re-slot (no haltReason set deliberately).

### Verification (session 4)

- [x] lint clean, build passes, SSR 200 with new controls.
- [ ] Manual demo check of each disaster + recovery.

---

## Session 3 — UX Fixes & Richer Network (2026-08-24)

**User feedback addressed:** tools had no explanation and silently failed when clicking
away from lines; no zoom buttons; map needed more complexity/elements.

### What changed

- **Zoom controls** (in `MapRenderer.tsx`): floating +/−/Fit buttons bottom-right;
  keyboard `+`/`=` zoom in, `-`/`_` zoom out, `0` fit. `zoomAroundPoint`, `zoomAtCenter`,
  `fitView()` (computes bbox over tracks+stations, pads 80 units). Wheel zoom unchanged.
- **Placement feedback**: `SNAP_RADIUS` 30→45; clicking too far from a line with
  signal/pole/crossing/train tool now shows a toast ("Click on or near a line to place a …")
  for 2.4s instead of silently doing nothing. Ghost previews already show when snap is in range.
- **Tool explanations**: `Toolbar.tsx` — every tool button has a `title` tooltip, and an
  active-tool hint box (blue) below the buttons explains what the selected tool does.
  Sidebar widened to w-40 to fit "Level Crossing".
- **NEW element type — Level Crossing** (`LevelCrossing` in types.ts, `crossings` record on
  `RailwayNetwork`): white circle + red X on the line. Full pipeline wired: store
  `createCrossing`, delete (incl. cascade in `removeTrack`), hit-test (12 units), ghost,
  inspector branch, toolbar tool, seeded instances (5 across lines).
- **Network enriched** (`seed.ts`): 7 tracks now — added **Orange Line** (diagonal NW→SE,
  interchanges at Ashok Vihar/red, Central Sec./yellow, Tughlakabad/green) and **Violet Line**
  (short shuttle through Okhla). 35 stations (was 26) incl. new ring stations Sadar Bazar,
  Pratap Nagar (moved off yellow to avoid false interchange), Lajpat Nagar (same), Akshardham,
  Mohan Estate, Sarita Vihar. 17 signals, 5 level crossings, poles on orange too.
  **6 trains (< 7 tracks)**: added Orange Local.
- Interchange proximity rule note: stations moved to ≥46 units from other lines where they
  should NOT be interchanges (Pratap Nagar → (620,295), Lajpat Nagar → (620,665)).

### Keep in mind

- New placable element checklist (for future element types): types.ts interface + Tool +
  EntityKind → store create action + deleteEntity branch → removeTrack cascade →
  renderers draw + drawNetwork loop → MapRenderer hitTest + placement case + ghost →
  Toolbar entry + hint → InspectorPanel branch → seed instances.
- Zoom buttons live inside MapRenderer (below the page overlay z-10, which is
  pointer-events-none, so clicks pass through).

### Verification (session 3)

- [x] `npm.cmd run lint` — clean.
- [x] `npm.cmd run build` — passes.
- [x] SSR smoke test (port 3000): HTTP 200, Level Crossing tool present in HTML.
- [ ] User visual check.

---

## Session 2 — UI Overhaul & Metro-Map Visualization (2026-08-24)

**Goal:** make the demo look like a railway simulation dashboard showing a schematic
metro/railway network map (per user's reference image), while keeping all editing/simulation.

### What changed

- **Light map theme**: canvas background `#f8fafc`, hairline grid. Dark theme removed.
- **Dashboard chrome**:
  - NEW `components/digital-twin/TopBar.tsx` — dark header bar: branding, **line legend**
    (coloured chips generated from `network.tracks`), LIVE/PAUSED status pill w/ pulse.
  - Panels (`Toolbar`, `InspectorPanel`, `DemoControls`) restyled as white translucent cards
    (`bg-white/95 ring-slate-200 shadow-lg backdrop-blur`).
  - Page `app/(dashboard)/digital-twin/page.tsx`: MapRenderer fills screen; TopBar top;
    tool rail left; inspector right; event controls bottom-centre. Landing page light-themed.
- **Track = coloured line**: added optional `color?: string` to `Track` type +
  `makeTrack(..., color?)`. Renderer draws metro-style thick rounded line:
  white casing (13px) → colour stroke (9px) → faint dashed white centreline.
  Fallback colours by kind via `TRACK_COLORS` / helper `lineColor()`.
- **Stations as nodes**: white circle + ring in the colour of the serving line;
  **interchange detection** (`isInterchange()` in renderers.ts): station within 45 units of
  ≥2 tracks → larger double-ring node + bold label. Labels have white halo for readability.
- **Signals** restyled: short perpendicular mast + aspect dot(s) with white ring
  (readable on light bg). DOUBLE_YELLOW shows two dots.
- **OHE poles**: subtle grey ticks, **auto-hidden when zoom < 0.55** (declutter zoomed-out view).
  `drawNetwork(..., zoom)` / `drawPole(..., zoom)` take zoom now.
- **Trains**: bigger capsule (34×16) with white outline + drop shadow, direction chevron,
  red "halted" badge, halo labels. Kind colours changed to teal/violet/orange (distinct from
  line colours). Ghost previews updated for light background.
- **New seed network** (`seed.ts`): schematic octilinear **5-line network** inspired by the
  Delhi Metro reference but data-driven:
  - Red Line (E-W, y=200), Yellow Line (N-S, x=700), Blue Line (W→NE→SE zig-zag),
    Green Line (E-W, y=750), grey Ring Line (octagon centred 680,480 R=210, closed polyline).
  - 26 stations incl. interchanges: Sarai Rohilla, New Delhi, Rajiv Chowk, Saket.
  - 12 signals across lines; poles on red/yellow/blue every ~220–260m.
  - 5 trains (< 6 tracks): Red Express, Yellow Local, Blue Express, Green Local, Ring Orbital.
  - Camera initial fit updated: centre ≈ (790, 470), span ≈1450×900.
- Draft-track preview + placement ghosts recoloured (#0284c7) for light theme.

### Keep in mind when editing further

- `drawStation(ctx, network, station, selected)` signature includes `network` (needed for
  interchange detection + ring colour). Same for ghost calls.
- Interchange detection is proximity-based (45 units); if you move a station far off its
  lines it loses interchange status/ring colour — keep stations near their tracks.
- Line colours live in TWO places: `LINE_COLORS` (seed.ts palette) and per-track `color`
  field (persisted into the store). TopBar legend reads `track.color ?? TRACK_COLORS[kind]`.
- The Ring Line is a closed polyline (last point == first point); trains ping-pong at the
  seam — acceptable for demo, revisit if looping behaviour is wanted.
- A dev server may already be running on port 3000 (user's). Don't kill node processes blindly.

### Verification (session 2)

- [x] `npm.cmd run lint` — clean.
- [x] `npm.cmd run build` — passes; `/` + `/digital-twin` static.
- [x] SSR smoke test against running dev server (port 3000): HTTP 200, page + TopBar markers present.
- [ ] User visual check of the new map style.
