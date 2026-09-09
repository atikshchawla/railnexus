# Demo Showcase System — Work Distribution (Revision 3)
## Split: World Simulation vs. Three-Department Request System

---

## 1. The split

**Member A — World Simulation.** Owns the live physical world: real stations, sections, crossings, and trains actually moving through them in real time. This is the single source of truth for "what is happening right now."

**Member B — Request-Raising System, structured as three departments.** Owns everything that turns a live world event into a formal request/complaint into ABP, mirroring how this works on the real railway: different departments raise different kinds of requests, and each has its own view of the outcome. TMS, TDMS, and SMMS become three distinct department modules under Member B, not three flat mock services.

The two halves connect through exactly one shared feed: **Member A publishes live world state; Member B's three departments read it and decide when to act.** Requests then go to ABP, and ABP's decisions come back to update each department's own display. Neither member needs to touch the other's internals.

```
┌─────────────────────────────┐
│   MEMBER A — World Sim        │
│                               │
│   Real network (stations,     │
│   sections, crossings)        │
│           │                   │
│   Trains running live on it   │
│   (tick clock, positions,     │
│    speeds, section occupancy) │
└──────────────┬────────────────┘
               │  Live World State Feed
               │  (read-only, published continuously)
               ▼
┌─────────────────────────────────────────────────────┐
│   MEMBER B — Request-Raising System (3 departments)   │
│                                                         │
│  ┌────────────┐  ┌─────────────┐  ┌───────────────┐  │
│  │ TMS dept.   │  │ TDMS dept.  │  │ SMMS dept.     │  │
│  │ running-    │  │ section-    │  │ maintenance /  │  │
│  │ status      │  │ entry       │  │ fault raising  │  │
│  │ requests    │  │ requests    │  │ + outcome view │  │
│  └──────┬──────┘  └──────┬──────┘  └───────┬────────┘  │
│         └────────────────┴──────────────────┘          │
│                          │                              │
│                 requests → ABP → decisions back         │
└─────────────────────────┼───────────────────────────────┘
                           ▼
                  ABP (real system, untouched)
```

---

## 2. Member A — World Simulation

**Goal:** trains actually running, live, on a real stretch of track, with nothing waiting on ABP or on Member B to look alive.

- Source and clean real geography for one corridor (stations, block sections, level crossings) from public data (data.gov.in station catalog, DataMeet/`arunasank` GeoJSON — as discussed).
- Build the network graph: stations, the sections between them, which sections are adjacent, which share a crossing.
- Build the movement engine: a tick loop that advances every train's position along its route at a realistic speed, updates which section each train currently occupies, and occasionally introduces a delay.
- Publish this as a **live world state feed** — a continuously updating snapshot (or event stream) of: every train's position/speed/status, and every section's current occupancy. This is the one artifact Member B depends on.
- Own the fault-injection hook at the physical level — e.g. force a section's track to be physically unavailable — which Member B's SMMS department will pick up and turn into a formal maintenance request.

**Testable alone:** run the simulation, watch trains move and sections fill/clear correctly over the real geography, with no ABP or Member B involved at all.

---

## 3. Member B — Request-Raising System (three departments)

**Goal:** turn what's happening in the live world into the formal request traffic ABP actually processes, department by department, and show each department's own view of the outcome.

### 3.1 TMS department — running-status requests
Watches the world feed for train-level issues: a train running late, a train needing priority. When a threshold is crossed, raises a request to ABP on that train's behalf (e.g. "Train X requests priority handling due to delay").

### 3.2 TDMS department — section-entry requests
Watches the world feed for a train approaching a section boundary. When a train is about to need a section it doesn't yet hold, raises a block-entry request to ABP for that section. This is the steady drumbeat of "ordinary" requests the demo runs on.

### 3.3 SMMS department — maintenance / fault requests, and outcome display
Two jobs:
- **Raising:** watches for physical faults (from Member A's fault-injection hook, or triggered directly for the demo) and raises a maintenance/block request to ABP — e.g. "Section C-2 requires emergency maintenance block."
- **Reflecting:** once ABP resolves *any* request (from any of the three departments), SMMS is the department that shows the resulting section state — approved / reserved / queued / rerouted — since in the real system it's the one that owns section status.

### 3.4 Shared responsibilities across the three departments
- All three emit requests in **one common request schema** into ABP — same fields, a `department`/`source` tag identifying which one raised it, nothing else different. ABP shouldn't need to know or care which department a request came from.
- All three (plus the judge-facing query injector, if you keep it) write to that same schema, so a judge-raised request is indistinguishable from one the simulation raised on its own.
- The COA live dashboard (built by whichever of you takes presentation, or split further if there's a third person) reads ABP's decisions plus each department's status, and renders the map.

**Testable alone:** feed the three departments a hand-written fake world-state snapshot (no need for Member A's simulation to be running yet), confirm each raises the right kind of request in the right schema, and confirm SMMS correctly reflects a hand-written fake ABP decision.

---

## 4. What must be agreed before splitting off (Day 1)

1. **World State Feed schema** — exactly what Member A publishes (train positions, statuses, section occupancy) and how often. This is Member B's only input.
2. **Request schema** — the one common shape all three departments (and the query injector) use to talk to ABP, including the `department` tag.
3. **ABP decision schema** — what comes back, that SMMS and the dashboard both consume.
4. **The real corridor** — same station/section list, so Member A's world and Member B's departments are reasoning about the same geography.

Once these four are frozen, each of you builds and tests independently against mocks of the other side, same as before — Member A never needs ABP or Member B running to prove trains move correctly; Member B never needs Member A's simulator running to prove the three departments raise and resolve requests correctly.

---

## 5. Integration plan

- **Day 1:** freeze the four items above together.
- **Days 2 to N-2:** independent builds. Flag schema changes immediately, don't discover them at integration.
- **Day N-1:** wire Member A's live feed into Member B's three departments for real, and Member B's departments into the real ABP. Run the full loop: train moves → department raises request → ABP decides → SMMS/dashboard reflects it.
- **Day N:** dry-run the full judge demo at least twice, including confirming ABP is unaffected if the whole demo stack is stopped.
