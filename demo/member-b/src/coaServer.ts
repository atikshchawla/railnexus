import express from "express";
import type { Express } from "express";
import { randomUUID } from "node:crypto";
import { requestSchema } from "./contracts.js";
import type { Decision, Request, WorldState } from "./contracts.js";
import { MidLayerClient } from "./gatewayClient.js";

export function buildCoaApp(client: MidLayerClient): Express {
  let world: WorldState | undefined;
  const requests: Request[] = [];
  const decisions: Decision[] = [];
  const reflected = new Map<string, string>();
  const raisedKeys = new Set<string>();
  const sectionOrder = ["AJJ-SHU", "SHU-WJR", "WJR-MCN", "MCN-KPD", "KPD-GYM", "GYM-AB", "AB-VN", "VN-JTJ"];
  const sectionLengths = new Map([["AJJ-SHU", 21.3], ["SHU-WJR", 14.9], ["WJR-MCN", 7.7], ["MCN-KPD", 17], ["KPD-GYM", 24.7], ["GYM-AB", 27.4], ["AB-VN", 16.1], ["VN-JTJ", 15.4]]);
  const app = express();
  app.use(express.json());
  app.use((_req, res, next) => { res.setHeader("Access-Control-Allow-Origin", "*"); res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS"); res.setHeader("Access-Control-Allow-Headers", "Content-Type"); if (_req.method === "OPTIONS") { res.sendStatus(204); return; } next(); });

  async function poll(): Promise<void> {
    try {
      world = await client.worldState();
      await raiseDepartmentRequests(world);
      const latest = await client.decisions();
      for (const decision of latest) { if (!decisions.some((item) => item.request_id === decision.request_id)) decisions.push(decision); reflected.set(decision.section_id, decision.resulting_state); }
    } catch (error) { console.warn(`[member-b] mid-layer unavailable: ${String(error)}`); }
  }

  async function raiseDepartmentRequests(snapshot: WorldState): Promise<void> {
    for (const train of snapshot.trains) {
      if (train.delay_min >= 10) await raise({ train_id: train.train_id, section_id: train.section_id, department: "TMS", type: "running_status", description: `Train ${train.train_id} requests priority handling due to ${train.delay_min} min delay` }, `TMS:${train.train_id}`);
      const length = sectionLengths.get(train.section_id) ?? 1;
      if (train.position_km >= length * 0.8) {
        const index = sectionOrder.indexOf(train.section_id);
        const next = index >= 0 ? sectionOrder[(Number(train.train_id) % 2 === 0 ? index + 1 : index - 1 + sectionOrder.length) % sectionOrder.length] : undefined;
        if (next) await raise({ train_id: train.train_id, section_id: next, department: "TDMS", type: "section_entry", description: `Train ${train.train_id} requests block entry into section ${next}` }, `TDMS:${train.train_id}:${next}`);
      }
    }
    for (const section of snapshot.sections) if (section.fault_reason) await raise({ train_id: null, section_id: section.section_id, department: "SMMS", type: "maintenance_block", description: `Section ${section.section_id} requires emergency maintenance block` }, `SMMS:${section.section_id}:${section.fault_reason}`);
  }

  async function raise(input: Omit<Request, "request_id" | "raised_at">, key: string): Promise<void> {
    if (raisedKeys.has(key)) return;
    raisedKeys.add(key);
    const request: Request = { ...input, request_id: randomUUID(), raised_at: new Date().toISOString() };
    requests.push(request);
    try { const decision = await client.submit(request); decisions.push(decision); reflected.set(decision.section_id, decision.resulting_state); }
    catch (error) { console.warn(`[member-b] request ${request.request_id} failed: ${String(error)}`); raisedKeys.delete(key); }
  }

  app.get("/health", (_req, res) => res.json({ ok: true, service: "member-b-coa", corridor: "Arakkonam-Jolarpettai trained corridor", midLayer: "http" }));
  app.get("/world-state", (_req, res) => world ? res.json(world) : res.status(503).json({ error: "world_unavailable" }));
  app.get("/decisions", (_req, res) => res.json(decisions));
  app.get("/state", (_req, res) => res.json({ timestamp: new Date().toISOString(), corridor: "Arakkonam-Jolarpettai, Southern Railway (SR_CHENNAI)", world, requests, decisions, reflectedSections: Object.fromEntries(reflected) }));
  app.get("/api/state", (_req, res) => res.json(compatibilityState(world, requests, decisions, reflected)));
  app.post("/requests", async (req, res) => { try { const request = requestSchema.parse(req.body); requests.push(request); const decision = await client.submit(request); decisions.push(decision); reflected.set(decision.section_id, decision.resulting_state); res.status(202).json(decision); } catch (error) { res.status(400).json({ error: "invalid_or_rejected_request", message: String(error) }); } });
  app.post("/api/inject", async (req, res) => { try { const input = req.body as { department: Request["department"]; type: Request["type"]; sectionId: string; trainId?: string; description?: string }; const request: Request = { request_id: randomUUID(), department: input.department, type: input.type, train_id: input.trainId ?? null, section_id: input.sectionId, description: input.description ?? `Request for ${input.sectionId}`, raised_at: new Date().toISOString() }; const decision = await client.submit(request); requests.push(request); decisions.push(decision); reflected.set(decision.section_id, decision.resulting_state); res.status(201).json({ request, decision }); } catch (error) { res.status(400).json({ error: "invalid_or_rejected_request", message: String(error) }); } });
  void poll(); setInterval(() => void poll(), Number(process.env.FEED_POLL_MS ?? 2000));
  return app;
}

function compatibilityState(world: WorldState | undefined, requests: Request[], decisions: Decision[], reflected: Map<string, string>) {
  const sections = world?.sections ?? [];
  const state = (section: WorldState["sections"][number]) => reflected.get(section.section_id) ?? section.state;
  return { timestamp: new Date().toISOString(), corridor: "Arakkonam-Jolarpettai, Southern Railway (SR_CHENNAI)", sections: sections.map((section) => ({ id: section.section_id, fromStation: section.section_id.split("-")[0], toStation: section.section_id.split("-")[1], fromKm: 0, toKm: 0, state: state(section), fault: section.fault_reason ?? undefined, occupiedBy: section.occupant_train_id ?? undefined })), departments: { TMS: { requests: requests.filter((request) => request.department === "TMS") }, TDMS: { requests: requests.filter((request) => request.department === "TDMS") }, SMMS: { requests: requests.filter((request) => request.department === "SMMS") } }, decisions, feed: { source: "mid-layer:/world-state", lastSeenAt: world?.timestamp } };
}
