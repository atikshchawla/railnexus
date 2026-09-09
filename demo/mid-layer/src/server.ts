import express from "express";
import type { Express } from "express";
import { ZodError } from "zod";
import type { Gateway } from "./bridge.js";

export function buildApp(gateway: Gateway): Express {
  const app = express();
  app.use(express.json({ limit: "256kb" }));
  app.use((_req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (_req.method === "OPTIONS") { res.sendStatus(204); return; }
    next();
  });
  app.get("/health", (_req, res) => res.json({ ok: true, service: "demo-mid-layer", abp: process.env.MOCK_ABP === "true" ? "mock" : process.env.ABP_API_URL ? "external" : "mock" }));
  app.get("/world-state", (_req, res) => { const world = gateway.currentWorld(); if (!world) { res.status(503).json({ error: "world_unavailable" }); return; } res.json(world); });
  app.get("/world", (_req, res) => { const world = gateway.currentWorld(); if (!world) { res.status(503).json({ error: "world_unavailable" }); return; } res.json(world); });
  app.post("/requests", async (req, res) => {
    try { res.status(202).json(await gateway.submit(req.body)); }
    catch (error) {
      if (error instanceof ZodError) { res.status(400).json({ error: "invalid_request", issues: error.issues }); return; }
      res.status(422).json({ error: "request_rejected", message: String(error) });
    }
  });
  app.get("/decisions", (req, res) => res.json(gateway.getDecisions(Number(req.query.limit) || 100)));
  app.get("/log", (req, res) => res.json(gateway.logsSince(Number(req.query.limit) || 100)));
  app.post("/sync", async (_req, res) => { try { res.json(await gateway.syncWorld()); } catch (error) { res.status(502).json({ error: "world_sync_failed", message: String(error) }); } });
  app.use((_error: unknown, _req, res, _next) => res.status(500).json({ error: "internal_error" }));
  return app;
}
