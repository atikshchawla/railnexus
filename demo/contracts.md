# Demo HTTP contracts

The three demo services remain independent and communicate only over HTTP. Each service owns a copy of these schemas in its own `src/contracts.ts`; no package is shared.

## World state

`GET member-a:9001/world-state` and `GET mid-layer:9002/world-state` return:

```json
{
  "tick": 142,
  "timestamp": "2026-09-09T10:51:59.136Z",
  "trains": [{
    "train_id": "12005",
    "section_id": "GYM-AB",
    "position_km": 3.2,
    "speed_kmph": 65,
    "status": "running",
    "delay_min": 0
  }],
  "sections": [{
    "section_id": "GYM-AB",
    "occupant_train_id": "12005",
    "state": "occupied",
    "fault_reason": null
  }]
}
```

## Requests and decisions

Member B sends the exact request object to `POST mid-layer:9002/requests`. The Mid-Layer validates it, queues it, and either forwards it to `ABP_API_URL` or resolves it with the mock when `MOCK_ABP=true`.

`GET mid-layer:9002/decisions` returns exact decision objects. `GET mid-layer:9002/log` returns the rolling gateway audit log.

## Runtime boundaries

- Member A: `WORLD_PORT`/`PORT`, `GET /world-state`, `POST /faults` with `{ section_id, type, duration_ticks }`.
- Mid-Layer: `WORLD_URL`, `ABP_API_URL`, `MOCK_ABP`, `GET /world-state`, `POST /requests`, `GET /decisions`, `GET /log`.
- Member B: `MID_LAYER_URL`, `GET /state`, `GET /api/state`, and `POST /api/inject` for the judge form.

The trained corridor is restricted to the eight model sections: `AJJ-SHU`, `SHU-WJR`, `WJR-MCN`, `MCN-KPD`, `KPD-GYM`, `GYM-AB`, `AB-VN`, `VN-JTJ`.

## Three-System Architectural Boundary

RailNexus ABP enforces strict separation across three layers:
1. **Demo / Simulation**: External environment producing synthetic operational events (TMS, SMMS, TDMS).
2. **Integration / Gateway**: Accepts external requests, captures source provenance (`source_system`, `external_id`), and normalizes into Core schema. Acceptance here is strictly non-authoritative (`status: "queued"`, `resulting_state: "clear"`).
3. **Core RailNexus**: The authoritative planning system:
   `MaintenanceRequest` → `Prediction` → `CP-SAT OptimizationRun` → `BlockProposal` → `Conflict Detection` → `Human Approval` → `OperationalBlock`.

**Important Invariant:**
Demo acceptance (`queued`) ≠ Core planning (`PROPOSED`) ≠ Human approval (`APPROVED`) ≠ Operational block (`OperationalBlock`).
The Demo Gateway does NOT approve blocks.
