# Member B — Request-Raising System (Implementation Guide)

Scope: branch `atikshmemb`, per `demo-work-split-v3.md` §3. Three departments
(TMS / TDMS / SMMS) turn live world-state events into formal requests to ABP,
show each department's own view of the outcome, and let a judge inject requests
from the UI.

---

## 1. What Member B does

```
┌──────────────────────────────┐
│  World-state feed            │  FEED_MODE=replay | http | manual
│  (Member A published, or     │  backend/src/feed/*
│   bundled fixtures)          │
└──────────────┬───────────────┘
               ▼  snapshot
┌──────────────────────────────┐
│  Three department engines    │  TMS → running_status
│  (backend/src/departments/)  │  TDMS → section_entry
│                              │  SMMS → maintenance_block
└──────────────┬───────────────┘
               ▼  Request (one common schema, `department` tag)
┌──────────────────────────────┐
│  ABP decide                  │  buildMockAbp() by default;
│  (backend/src/abp/)          │  real ABP when ABP_BASE_URL set
└──────────────┬───────────────┘
               ▼  AbpDecision
┌──────────────────────────────┐
│  Reflection into section     │  applyDecisionState() → section.state
│  state + per-dept history    │  served via GET /api/state
└──────────────────────────────┘
               ▼
   frontend /live page (polls /api/state)
```

Key rule: **ABP never needs to know which department raised a request.** All
three (and the query injector) write the same schema.

---

## 2. The three request kinds

| Kind | Department | Trigger | Example description |
|---|---|---|---|
| `running_status` | TMS | train `status: delayed` with `delayMinutes >= 10` (once per train) | "Train X requests priority handling due to N min delay" |
| `section_entry` | TDMS | train's `nextSectionId` not in its `heldSectionIds` (once per train+section) | "Train X requests block entry into section BAR-YJ" |
| `maintenance_block` | SMMS | section has a `fault` and is not already `Block active` | "Section BAR-YJ requires emergency maintenance block" |

SMMS also **reflects** outcomes: every ABP decision updates the affected
section's state (`approved`+maintenance → `Block active`, `approved`+section
entry → `Approved`, reserved/queued/rerouted → same-named state, `rejected` →
unchanged; running-status decisions never change section state).

---

## 3. Backend layout (`backend/`)

```
src/
  types.ts            # all contract schemas (zod + z.infer)
  corridor.ts         # Ambala Cantt–Saharanpur, sections UMB-BAR/BAR-YJ/YJ-YWS/YWS-SRE
  config.ts           # env: PORT, FEED_MODE, FEED_POLL_MS, ABP_BASE_URL, MEMBER_A_FEED_URL
  store.ts            # in-memory section reflection, requests, decisions, feed health
  pipeline.ts         # snapshot → engines → ABP → reflect; also builds the injector
  server.ts           # Express app + all routes
  index.ts            # bootstrap: feed source + engines + ABP + server
  abp/                # client → mock.ts (port.ts, http.ts, applyDecision.ts)
  departments/        # base.ts, tms.ts, tdms.ts, smms.ts
  feed/               # snapshot.ts, jsonFeed.ts, httpFeed.ts, replayFeed.ts, loop.ts, types.ts
fixtures/world/
  snapshot-1..4.json  # replay demo progression
  snapshot-manual.json# deterministic demo via manual ingest
tests/                # vitest: engines, reflection, pipeline, api
```

### Feed modes (`FEED_MODE`)

| Mode | Behaviour |
|---|---|
| `replay` (**default**) | Loops `snapshot-1..4.json` every 1.5s. Demo runs with zero input. |
| `manual` | Idles on boot; you drive it with `POST /api/ingest` (deterministic). |
| `http` | Polls the **real Member A** feed (`MEMBER_A_FEED_URL`, `FEED_POLL_MS`). Day N-1 integration. |

---

## 4. HTTP endpoints

| Method & path | Purpose | Success | Errors |
|---|---|---|---|
| `GET /health` | liveness + corridor | `200` | — |
| `POST /api/ingest` | push a world snapshot; runs engines → ABP → reflects | `200` `{requests, decisions}` | `400 invalid_snapshot` |
| `POST /api/inject` | judge raises a bare request (query injector) | `201` `{request, decision}` | `400 invalid_inject` / `400 unknown_section` |
| `GET /api/state` | full state: sections, per-dept requests, decisions, feed | `200` | — |
| `GET /api/departments/:id/requests` | one department's request history | `200` | `400 unknown_department` |

### `POST /api/ingest` example

```bash
curl -X POST http://localhost:8787/api/ingest \
  -H "content-type: application/json" \
  -d @backend/fixtures/world/snapshot-manual.json
```

### `POST /api/inject` example (judge-facing)

```bash
curl -X POST http://localhost:8787/api/inject \
  -H "content-type: application/json" \
  -d '{
    "department": "TDMS",
    "type": "section_entry",
    "sectionId": "BAR-YJ",
    "trainId": "JUDGE-1"
  }'
# 201 → { "request": { "id": "REQ-TDMS-1", ... }, "decision": { "decision": "approved", "sectionState": "Approved", ... } }
```

Injected requests are **indistinguishable** from engine-raised ones: same
`REQ-<DEPT>-<n>` id sequence, same schema, same decide→reflect path. Only
`department` and `type` enums plus a known `sectionId` are validated; payload
is deliberately free-form.

---

## 5. Frontend `/live` (COA proof page)

`frontend/app/(dashboard)/live/page.tsx` → `components/live/LiveLoop.tsx`,
polling `GET /api/state` every 2.5 s. Shows:

- **Status strip** — total requests, ABP outcome counts (approved/queued/…),
  active sections (`X/4`).
- **Section schematic** — the 4 block sections with reflected states, faults,
  occupancy.
- **Per-department feeds** (TMS / TDMS / SMMS) — full history, scrollable, each
  row shows type, train/section, km, the **ABP decision chip**, and the
  reflected section state.
- **ABP decisions table** — all decisions, newest first, scrollable with a
  sticky header (request id, decision, section, result state, granted window).
- **Query injector panel** — dept / type / section selects + optional train id
  + "Raise request"; shows the outcome chip and refetches immediately.

Backend base URL: `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:8787`).
Backend must be reachable or the page shows a "Backend not reachable" banner
with a Retry button.

---

## 6. How to test

### Automated
```bash
cd backend
npm run typecheck        # tsc --noEmit
npm test                 # 28 tests: engines ×3, reflection ×7, pipeline ×2, api ×7
```
```bash
cd frontend
npx tsc --noEmit         # NOTE: run `npx next typegen` first if globals are new
npm run lint             # 0 errors (7 pre-existing warnings in untouched files)
npm run build            # /live is in the static route table
```

### Manual (backend)
1. Start: `cd backend && npm run dev` (port 8787; stop any older instance on that port).
2. Default replay demo runs by itself — watch `/live` populate.
3. Manual mode for a deterministic demo:
   ```bash
   FEED_MODE=manual PORT=8799 npm run dev
   curl -X POST http://localhost:8799/api/ingest -H "content-type: application/json" -d @backend/fixtures/world/snapshot-manual.json
   curl -X POST http://localhost:8799/api/inject -H "content-type: application/json" -d '{"department":"SMMS","type":"maintenance_block","sectionId":"BAR-YJ"}'
   curl http://localhost:8799/api/state
   ```
   `snapshot-manual.json` exercises all four request paths deterministically:
   SMP-3301 delayed → TMS, SMP-4402 approaching YWS-SRE → TDMS, BAR-YJ fault →
   SMMS, plus the injector call above.

### Manual (frontend)
```bash
cd frontend && npm run dev   # → http://localhost:3000/live
```
Confirm: schematic states change with the feed, per-department feeds show
decision chips, ABP decisions table grows, and the injector panel reflects new
requests into tables/state instantly.

---

## 7. What is COMPLETE

- ✅ All three engines + reflection (`demo-work-split-v3.md` §3.1–3.3)
- ✅ One common request schema with `department` tag (§3.4)
- ✅ Judge-facing query injector, indistinguishable (§3.4) — backend + `/live` panel
- ✅ COA proof page `/live`: schematic, per-dept views, decisions, offline banner
- ✅ "Testable alone": fixtures, replay + manual feeds, 28 passing tests
- ✅ CORS, error handling, 404 handler, `/health`
- ✅ Docs: this guide + `member-b-plan.md` + glossary entries

## 8. What is LEFT for later (not code gaps — integration / ratification)

- ⏳ **Day N-1: real Member A feed** — run with `FEED_MODE=http` +
  `MEMBER_A_FEED_URL` once Member A's simulator is up; validate field names /
  timing, fix any schema drift.
- ⏳ **Day N-1: real ABP** — set `ABP_BASE_URL`; verify request/decision
  contract against the actual ABP (highest-risk integration item).
- ⏳ **Day N: dry-run the full judge demo at least twice**, incl. confirming ABP
  is unaffected if the demo stack is stopped.
- ⏳ **Ratify with the team**: glossary entries flagged ⚠️ project-defined
  (department *roles*, 10-min delay threshold, query injector — per
  `/.agents/rules/domain-governance.md`).
- ♻ **Optional**: merge `/live` proof into the main COA dashboard if Member B
  takes presentation (currently a standalone proof page).