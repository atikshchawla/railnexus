import { once } from "node:events";
import { buildCoaApp } from "./coaServer.js";
import { MidLayerClient } from "./gatewayClient.js";

const port = Number(process.env.PORT ?? 8787);
const midLayerUrl = process.env.MID_LAYER_URL ?? "http://localhost:9002";
const server = buildCoaApp(new MidLayerClient(midLayerUrl)).listen(port);
await once(server, "listening");
console.log(`[member-b] COA listening on http://localhost:${port} · mid-layer=${midLayerUrl}`);
