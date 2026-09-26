/**
 * RailNexus DevKit Server
 * Manages spawning, stopping, and log-streaming for all project services.
 */

import { spawn } from "child_process";
import { createServer } from "http";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const HTML_PATH = join(__dirname, "index.html");

const SERVICES = {
  "main-backend": {
    id: "main-backend",
    label: "RailNexus Backend",
    description: "FastAPI + uvicorn (port 8000)",
    group: "main",
    color: "#6366f1",
    icon: "🚂",
    cwd: ROOT,
    cmd: join(ROOT, ".venv", "bin", "python3"),
    args: ["-m", "uvicorn", "backend.main:app", "--reload", "--port", "8000"],
    env: {},
    url: "http://localhost:8000/health",
  },
  "main-frontend": {
    id: "main-frontend",
    label: "RailNexus Frontend",
    description: "Next.js dev server (port 3000)",
    group: "main",
    color: "#8b5cf6",
    icon: "🖥️",
    cwd: ROOT + "/frontend",
    cmd: "npm",
    args: ["run", "dev"],
    env: {},
    url: "http://localhost:3000",
  },
  "member-a": {
    id: "member-a",
    label: "Member A — World",
    description: "Physical world authority (port 9001)",
    group: "demo",
    color: "#0ea5e9",
    icon: "🌍",
    cwd: ROOT + "/demo/member-a",
    cmd: "npm",
    args: ["run", "start"],
    env: { PORT: "9001" },
    url: "http://localhost:9001/world-state",
  },
  "mid-layer": {
    id: "mid-layer",
    label: "Mid-Layer Gateway",
    description: "Translation / ABP gateway (port 9002)",
    group: "demo",
    color: "#f59e0b",
    icon: "🔀",
    cwd: ROOT + "/demo/mid-layer",
    cmd: "npm",
    args: ["run", "start"],
    env: { PORT: "9002", WORLD_URL: "http://localhost:9001/world-state", ABP_API_URL: "http://localhost:8000/api/demo-gateway/requests", MOCK_ABP: "false" },
    url: "http://localhost:9002/world-state",
  },
  "member-b": {
    id: "member-b",
    label: "Member B — Requests",
    description: "Request departments & COA state (port 8787)",
    group: "demo",
    color: "#10b981",
    icon: "📋",
    cwd: ROOT + "/demo/member-b",
    cmd: "npm",
    args: ["run", "start"],
    env: { PORT: "8787", MID_LAYER_URL: "http://localhost:9002" },
    url: "http://localhost:8787",
  },
  "demo-frontend": {
    id: "demo-frontend",
    label: "Demo Frontend",
    description: "Vite + React service window UI",
    group: "demo",
    color: "#ec4899",
    icon: "🪟",
    cwd: ROOT + "/demo/frontend",
    cmd: "npm",
    args: ["run", "dev"],
    env: {},
    url: null,
  },
};

const running = new Map();
const sseClients = new Map();
const statuses = new Map(Object.keys(SERVICES).map((id) => [id, "stopped"]));

function pushLog(serviceId, line) {
  const entry = running.get(serviceId);
  if (entry) {
    entry.logs.push(line);
    if (entry.logs.length > 2000) entry.logs.shift();
  }
  broadcastSSE(serviceId, { type: "log", line });
}

function broadcastSSE(serviceId, payload) {
  const clients = sseClients.get(serviceId) ?? new Set();
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of clients) {
    try { res.write(data); } catch { clients.delete(res); }
  }
}

function broadcastStatus(serviceId) {
  const status = statuses.get(serviceId) ?? "stopped";
  broadcastSSE(serviceId, { type: "status", status });
  const globalClients = sseClients.get("__global__") ?? new Set();
  const data = `data: ${JSON.stringify({ type: "status", serviceId, status })}\n\n`;
  for (const res of globalClients) {
    try { res.write(data); } catch { globalClients.delete(res); }
  }
}

function startService(id) {
  if (running.has(id)) return { ok: false, msg: "Already running" };
  const svc = SERVICES[id];
  if (!svc) return { ok: false, msg: "Unknown service" };

  const env = { ...process.env, ...svc.env };
  const proc = spawn(svc.cmd, svc.args, { cwd: svc.cwd, env });
  running.set(id, { proc, logs: [] });
  statuses.set(id, "running");
  broadcastStatus(id);

  const onData = (chunk) => {
    const lines = chunk.toString().split(/\r?\n/).filter(Boolean);
    for (const line of lines) pushLog(id, line);
  };
  proc.stdout.on("data", onData);
  proc.stderr.on("data", onData);

  proc.on("exit", (code, signal) => {
    running.delete(id);
    const status = code === 0 || signal === "SIGTERM" ? "stopped" : "error";
    statuses.set(id, status);
    pushLog(id, `[devkit] process exited — code=${code} signal=${signal}`);
    broadcastStatus(id);
  });

  proc.on("error", (err) => {
    running.delete(id);
    statuses.set(id, "error");
    pushLog(id, `[devkit] spawn error: ${err.message}`);
    broadcastStatus(id);
  });

  return { ok: true };
}

function stopService(id) {
  const entry = running.get(id);
  if (!entry) return { ok: false, msg: "Not running" };
  entry.proc.kill("SIGTERM");
  setTimeout(() => { if (running.has(id)) entry.proc.kill("SIGKILL"); }, 4000);
  return { ok: true };
}

function send(res, status, body, contentType = "application/json") {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, { "Content-Type": contentType, "Access-Control-Allow-Origin": "*" });
  res.end(payload);
}

const server = createServer((req, res) => {
  const { method } = req;
  const url = new URL(req.url, "http://localhost");
  const path = url.pathname;

  if (method === "OPTIONS") {
    res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST", "Access-Control-Allow-Headers": "Content-Type" });
    res.end();
    return;
  }

  if (method === "GET" && (path === "/" || path === "/index.html")) {
    try {
      const html = readFileSync(HTML_PATH, "utf8");
      return send(res, 200, html, "text/html; charset=utf-8");
    } catch {
      return send(res, 500, "UI not found", "text/plain");
    }
  }

  if (method === "GET" && path === "/api/services") {
    const list = Object.values(SERVICES).map((svc) => ({ ...svc, status: statuses.get(svc.id) ?? "stopped" }));
    return send(res, 200, list);
  }

  if (method === "POST" && path.startsWith("/api/services/") && path.endsWith("/start")) {
    const id = path.split("/")[3];
    const result = startService(id);
    return send(res, result.ok ? 200 : 409, result);
  }

  if (method === "POST" && path.startsWith("/api/services/") && path.endsWith("/stop")) {
    const id = path.split("/")[3];
    const result = stopService(id);
    return send(res, result.ok ? 200 : 409, result);
  }

  if (method === "GET" && path.startsWith("/api/services/") && path.endsWith("/logs")) {
    const id = path.split("/")[3];
    const entry = running.get(id);
    return send(res, 200, { logs: entry ? entry.logs : [] });
  }

  if (method === "GET" && path.startsWith("/api/services/") && path.endsWith("/stream")) {
    const id = path.split("/")[3];
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive", "Access-Control-Allow-Origin": "*" });
    res.write(": connected\n\n");
    res.write(`data: ${JSON.stringify({ type: "status", status: statuses.get(id) ?? "stopped" })}\n\n`);
    if (!sseClients.has(id)) sseClients.set(id, new Set());
    sseClients.get(id).add(res);
    req.on("close", () => sseClients.get(id)?.delete(res));
    return;
  }

  if (method === "GET" && path === "/api/stream") {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive", "Access-Control-Allow-Origin": "*" });
    res.write(": connected\n\n");
    for (const [serviceId, status] of statuses) {
      res.write(`data: ${JSON.stringify({ type: "status", serviceId, status })}\n\n`);
    }
    if (!sseClients.has("__global__")) sseClients.set("__global__", new Set());
    sseClients.get("__global__").add(res);
    req.on("close", () => sseClients.get("__global__")?.delete(res));
    return;
  }

  return send(res, 404, { error: "Not found" });
});

const PORT = process.env.DEVKIT_PORT || 4242;
server.listen(PORT, () => {
  console.log(`\n🚂 RailNexus DevKit running at http://localhost:${PORT}\n`);
});
