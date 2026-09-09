# Member B — Request-Raising System (three departments)

Scope: branch `atikshmemb` + `demo-work-split-v3.md`. Stack: TypeScript/Node
service. Corridor: Ambala Cantt–Saharanpur (Km 238–252). Integration point:
mock ABP (real ABP targeted later via env). Frontend: one minimal proof page.

## Service layout: `backend/`

```
backend/
  package.json  tsconfig.json  .env.example
  src/
    types.ts               # all contract schemas via zod + z.infer
    corridor.ts            # frozen Ambala–Saharanpur station/section list
    config.ts              # env: PORT, ABP_BASE_URL, MEMBER_A_FEED_URL, tick ms
    store.ts               # in-memory requests / decisions / section state
    feed/
      snapshot.ts          # world snapshot zod schema
      jsonFeed.ts          # read hand-written fixture files (standalone tests)
      httpFeed.ts          # poll Member A's live URL (Day N-1 integration)
      replayFeed.ts        # demo: replays fixtures for a live-looking loop
    departments/
      base.ts              # engine contract: (snapshot, store) => Request[]
      tms.ts               # running-status requests
      tdms.ts              # section-entry requests
      smms.ts              # maintenance-block raising + decision reflection
    abp/
      client.ts            # posts in common request schema; mock unless ABP_BASE_URL set
      mock.ts              # deterministic auto-decider (demo)
      applyDecision.ts     # ABP decision -> section-state update (SMMS reflecting)
    server.ts              # Express app
    index.ts               # bootstrap: feed source + engines + server
  fixtures/world/snapshot-*.json   # hand-written fake world snapshots
  tests/                   # vitest: engines, reflection, api
```

## Frozen contracts (Day-1 items)

- **World-state feed** — snapshot with `timestamp`, `trains[]`
  (`id, name, line UP/DN, km, speedKmh, status running|delayed|stopped,
  delayMinutes?, nextSectionId, heldSectionIds[]`), `sections[]`
  (`id, fromStation, fromKm, toKm, status Clear|Caution, occupiedBy?, fault?`).
- **Common request schema** — one shape, `department: TMS|TDMS|SMMS` tag, plus
  `type`, `trainId?`, `sectionId`, `km`, `payload`, `description`, `raisedAt`.
  ABP never distinguishes departments.
- **ABP decision schema** — `decision: approved|reserved|queued|rerouted|rejected`,
  `grantedWindow?`, `sectionState`, `decidedAt`.
- **Corridor** — stations UMB(238) BAR(243) YJ(248) YWS(250) SRE(252); block
  sections `UMB-BAR`, `BAR-YJ`, `YJ-YWS`, `YWS-SRE`. Project-defined, needs
  ratification.

## Department engine rules (project-defined, recorded in glossary)

- **TMS** — train `delayed` with `delayMinutes >= 10` raises running-status
  request. One per train until resolved.
- **TDMS** — train's `nextSectionId` not in `heldSectionIds` raises block-entry
  request. Deduped per (train, section) until granted.
- **SMMS** — section with `fault` raises maintenance-block request. Deduped
  while section not `Block active`. Reflection: ABP decisions update
  `sectionState` (`approved`->Block active, `reserved`->Reserved,
  `queued`->Queued, `rerouted`->Rerouted).

## API routes (Express, port 8787)

- `POST /api/ingest` — snapshot in -> engines -> ABP -> apply decisions.
- `POST /api/inject` — judge-facing query injector (§3.4): a bare request
  (`{department, type, sectionId, trainId?, description?, km?, payload?}`) in the
  same common schema, decided+reflected through the same path as engine-raised
  requests. 201 on success; 400 `invalid_inject` / `unknown_section`. Requests
  are indistinguishable from auto ones (`REQ-<DEPT>-<n>` ids, same tables).
- `GET /api/state` — section states, per-department request history, decisions.
- `GET /api/departments/:id/requests` — each department's view of outcomes.

Mock ABP decides deterministically: section-entry approved (queued if occupied),
maintenance approved with window, running-status approved.

## Frontend

- Sidebar item "Live loop" (`/live`) -> `components/live/LiveLoop.tsx` polling
  `GET /api/state` (~2s), rendering `TrackMap` + request/decision tables with
  fallback when backend is down. Base URL from `NEXT_PUBLIC_API_BASE_URL`.
- `components/live/InjectRequest.tsx` — judge panel (dept/type/section/trainId +
  Raise), POSTs `/api/inject`, shows the decision chip and refetches state.
  Client helper `frontend/lib/live.ts` `injectRequest()`.

## Tests (vitest)

- Engine tests from fixture snapshots (right request type, schema, dept tag,
  dedupe).
- SMMS reflection test from fake ABP decisions.
- API test: `POST /api/ingest` end-to-end via mock ABP.

## Docs / governance

- Glossary entries: request types, thresholds, ABP decision states, corridor —
  all Project-defined / needs ratification.

## Build order

1. Scaffold `backend/`.
2. Contracts + fixtures.
3. Engines + ABP mock/applyDecision.
4. Feed sources + server + routes.
5. Tests.
6. Frontend `/live`.
7. Glossary updates.