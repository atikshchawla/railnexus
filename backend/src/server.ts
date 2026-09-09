import express from "express";
import type { Express, NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { parseSnapshot } from "./feed/snapshot.js";
import type { Store } from "./store.js";
import { departmentSchema, queryInjectSchema } from "./types.js";
import type { QueryInject, WorldSnapshot } from "./types.js";
import { QueryInjectError } from "./pipeline.js";
import type { InjectResult, IngestResult } from "./pipeline.js";

export interface AppDeps {
  store: Store;
  /** process(snapshot) — passed in so index.ts and tests share one instance */
  process: (snapshot: WorldSnapshot) => Promise<IngestResult>;
  /** inject(input) — judge-facing query injector (§3.4) */
  inject: (input: QueryInject) => Promise<InjectResult>;
}

export function buildApp(deps: AppDeps): Express {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
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

  app.get("/health", (_req, res) => {
    res.json({ ok: true, corridor: deps.store.snapshotState().corridor });
  });

  app.post("/api/ingest", async (req, res) => {
    try {
      const snapshot = parseSnapshot(req.body);
      const result = await deps.process(snapshot);
      res.json(result);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ error: "invalid_snapshot", issues: error.issues });
        return;
      }
      throw error;
    }
  });

  app.post("/api/inject", async (req, res) => {
    const parsed = queryInjectSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_inject", issues: parsed.error.issues });
      return;
    }
    try {
      const result = await deps.inject(parsed.data);
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof QueryInjectError) {
        res.status(400).json({ error: "unknown_section", message: error.message });
        return;
      }
      throw error;
    }
  });

  app.get("/api/state", (_req, res) => {
    res.json(deps.store.snapshotState());
  });

  app.get("/api/departments/:id/requests", (req, res) => {
    const parsed = departmentSchema.safeParse(req.params.id);
    if (!parsed.success) {
      res.status(400).json({ error: "unknown_department" });
      return;
    }
    res.json({
      department: parsed.data,
      requests: deps.store.requestsFor(parsed.data),
    });
  });

  app.use((_req, res) => {
    res.status(404).json({ error: "not_found" });
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[member-b] unhandled error:", error);
    res.status(500).json({ error: "internal_error" });
  });

  return app;
}