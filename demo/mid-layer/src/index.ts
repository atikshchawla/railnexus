import { once } from "node:events";
import { WorldBridge } from "./bridge.js";
import { buildApp } from "./server.js";

const port = Number(process.env.PORT ?? 9002);
const pollMs = Number(process.env.POLL_MS ?? 1000);
const bridge = new WorldBridge({
  worldUrl: process.env.WORLD_URL ?? "http://localhost:9001/feed",
  memberBUrl: process.env.MEMBER_B_INGEST_URL ?? "http://localhost:8787/api/ingest",
});
const server = buildApp(bridge).listen(port);

const sync = async () => {
  try {
    await bridge.pullAndForward();
  } catch (error) {
    console.warn(`[mid-layer] sync failed: ${String(error)}`);
  }
};
await sync();
setInterval(() => void sync(), pollMs);
await once(server, "listening");
console.log(`[mid-layer] listening on http://localhost:${port} · source=${process.env.WORLD_URL ?? "http://localhost:9001/feed"}`);
