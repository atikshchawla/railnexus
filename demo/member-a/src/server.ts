import express from "express";
import type { Express } from "express";
import { z } from "zod";
import type { WorldSimulator } from "./simulator.js";

const faultSchema = z.object({
  section_id: z.string(),
  type: z.string().min(1),
  duration_ticks: z.number().int().positive(),
});

export function buildApp(simulator: WorldSimulator): Express {
  const app = express();
  app.use(express.json());
  app.use((_req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (_req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.get("/health", (_req, res) => res.json({ ok: true, service: "member-a-world", corridor: simulator.network().corridor }));
  app.get("/network", (_req, res) => res.json(simulator.network()));
  app.get("/world-state", (_req, res) => res.json(simulator.snapshot()));
  app.get("/feed", (_req, res) => res.json(simulator.snapshot()));
  app.post("/tick", (_req, res) => res.json(simulator.tick()));
  app.post("/faults", (req, res) => {
    const parsed = faultSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_fault", issues: parsed.error.issues });
      return;
    }
    try {
      res.status(201).json(simulator.setFault(parsed.data.section_id, parsed.data.type, parsed.data.duration_ticks));
    } catch (error) {
      res.status(404).json({ error: "unknown_section", message: String(error) });
    }
  });
  app.delete("/faults/:sectionId", (req, res) => {
    simulator.clearFault(req.params.sectionId);
    res.status(204).send();
  });
  return app;
}
