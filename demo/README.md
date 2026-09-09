# RailNexus demo runtime

The demo is split into independent HTTP services. They do not import each other's source code. The frozen copies of the HTTP contracts live in [contracts.md](contracts.md) and each service's own `src/contracts.ts`.

## Runtime ownership

- `member-a`: physical world authority. It owns the AJJ-JTJ corridor, stations, block sections, level crossings, eight train movement, single-section occupancy, delays, and physical faults.
- `mid-layer`: the only ABP gateway. It validates and queues requests, calls `ABP_API_URL` or the mock when `MOCK_ABP=true`, exposes decisions and audit logs, and proxies `/world-state`.
- `member-b`: request departments and COA state. Its runtime only calls the Mid-Layer; it does not import or call ABP clients.

The corridor is the same corridor used by the trained models: `AJJ-SHU`, `SHU-WJR`, `WJR-MCN`, `MCN-KPD`, `KPD-GYM`, `GYM-AB`, `AB-VN`, and `VN-JTJ`.

## Run independently

From separate terminals:

```sh
cd demo/member-a && npm install && PORT=9001 npm run start
cd demo/mid-layer && npm install && WORLD_URL=http://localhost:9001/world-state MOCK_ABP=true PORT=9002 npm run start
cd demo/member-b && npm install && MID_LAYER_URL=http://localhost:9002 PORT=8787 npm run start
```

The Mid-Layer is the only process that knows `ABP_API_URL`. Set `MOCK_ABP=false ABP_API_URL=https://your-abp/requests` only when the real ABP endpoint is ready. Member B never receives an ABP URL.

## World API

- `GET http://localhost:9001/world-state` - current exact `WORLD-STATE`
- `GET http://localhost:9001/network` - stations, sections, crossings, and geometry metadata
- `POST http://localhost:9001/tick` - advance one simulation step
- `POST http://localhost:9001/faults` with `{ "section_id": "MCN-KPD", "type": "OHE isolator failure", "duration_ticks": 30 }`
- `DELETE http://localhost:9001/faults/MCN-KPD`

The mid-layer exposes `GET /world-state`, `POST /requests`, `GET /decisions`, `GET /log`, and `POST /sync`. A future database adapter belongs in the mid-layer and can persist snapshots without changing either member's API contract.
