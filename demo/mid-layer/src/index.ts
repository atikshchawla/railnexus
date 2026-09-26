import { once } from "node:events";
import { Gateway } from "./bridge.js";
import { buildApp } from "./server.js";

const port = Number(process.env.PORT ?? 9002);
const pollMs = Number(process.env.POLL_MS ?? 1000);
const abpApiUrl = process.env.ABP_API_URL ?? "http://localhost:8000/api/demo-gateway/requests";
const mockAbp = process.env.MOCK_ABP === "true";
const gateway = new Gateway({
  worldUrl: process.env.WORLD_URL ?? "http://localhost:9001/world-state",
  abpApiUrl,
  mockAbp,
});
const server = buildApp(gateway).listen(port);
const sync = async () => { try { await gateway.syncWorld(); } catch (error) { console.warn(`[mid-layer] world sync failed: ${String(error)}`); } };
await sync();
setInterval(() => void sync(), pollMs);
await once(server, "listening");
console.log(`[mid-layer] listening on http://localhost:${port} · abp=${mockAbp ? "mock" : abpApiUrl}`);
