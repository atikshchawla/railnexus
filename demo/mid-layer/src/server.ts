import express from "express";
import type { Express } from "express";
import type { WorldBridge } from "./bridge.js";

export function buildApp(bridge: WorldBridge): Express {
  const app = express();
  app.use(express.json());
  app.use((_req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (_req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.get("/health", (_req, res) => res.json({ ok: true, service: "demo-mid-layer", ...bridge.current() }));
  app.get("/world", (_req, res) => {
    const state = bridge.current();
    if (!state.snapshot) {
      res.status(503).json({ error: "world_unavailable" });
      return;
    }
    res.json(state.snapshot);
  });
  app.get("/state", (_req, res) => res.json(bridge.current()));
  app.post("/sync", async (_req, res) => {
    try {
      res.json(await bridge.pullAndForward());
    } catch (error) {
      res.status(502).json({ error: "sync_failed", message: String(error) });
    }
  });
  return app;
}
