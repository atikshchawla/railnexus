import { once } from "node:events";
import { buildApp } from "./server.js";
import { WorldSimulator } from "./simulator.js";

const port = Number(process.env.PORT ?? 9001);
const tickMs = Number(process.env.TICK_MS ?? 1000);
const simulator = new WorldSimulator();
const app = buildApp(simulator);
const server = app.listen(port);

setInterval(() => simulator.tick(), tickMs);
await once(server, "listening");
console.log(`[member-a] world listening on http://localhost:${port}/feed`);
