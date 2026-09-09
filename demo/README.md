# RailNexus demo runtime

The demo is split into independent HTTP services. They do not import each other's source code.

## Runtime ownership

- `member-a`: physical world authority. It owns the AJJ-JTJ corridor, stations, block sections, level crossings, train movement, occupancy, delays, and physical faults.
- `mid-layer`: API-only bridge. It validates Member A snapshots, caches the latest frame, and forwards the same frame to Member B.
- `member-b`: request departments and ABP integration. It consumes snapshots through its existing `/api/ingest` contract.

The corridor is the same corridor used by the trained models: `AJJ-SHU`, `SHU-WJR`, `WJR-MCN`, `MCN-KPD`, `KPD-GYM`, `GYM-AB`, `AB-VN`, and `VN-JTJ`.

## Run independently

From separate terminals:

```sh
cd demo/member-a && npm install && PORT=9001 npm run start
cd demo/mid-layer && npm install && WORLD_URL=http://localhost:9001/feed MEMBER_B_INGEST_URL=http://localhost:8787/api/ingest PORT=9002 npm run start
cd demo/member-b && FEED_MODE=manual npm run start
```

For Member B to consume the bridge directly, use `FEED_MODE=http MEMBER_A_FEED_URL=http://localhost:9002/world` instead of manual mode. The bridge itself forwards snapshots to Member B when `MEMBER_B_INGEST_URL` is set.

## World API

- `GET http://localhost:9001/feed` - current `WorldSnapshot`
- `GET http://localhost:9001/network` - stations, sections, crossings, and geometry metadata
- `POST http://localhost:9001/tick` - advance one simulation step
- `POST http://localhost:9001/faults` with `{ "sectionId": "MCN-KPD", "description": "OHE isolator failure" }`
- `DELETE http://localhost:9001/faults/MCN-KPD`

The mid-layer exposes `GET /world`, `GET /state`, and `POST /sync`. A future database adapter belongs in the mid-layer and can persist snapshots without changing either member's API contract.
