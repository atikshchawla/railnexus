import { describe, expect, it, vi } from "vitest";
import { Gateway } from "../src/bridge.js";

const snapshot = {
  tick: 1,
  timestamp: "2026-09-09T10:00:00.000Z",
  trains: [],
  sections: [{ section_id: "AJJ-SHU", occupant_train_id: null, state: "clear", fault_reason: null }],
};

describe("mid-layer world bridge", () => {
  it("validates and forwards the shared world feed over HTTP", async () => {
    const calls: RequestInit[] = [];
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      if (init) calls.push(init);
      return new Response(JSON.stringify(snapshot), { status: 200 });
    });
    const gateway = new Gateway({ worldUrl: "http://world/world-state", mockAbp: true, fetchImpl });
    await gateway.syncWorld();
    const decision = await gateway.submit({ request_id: "00000000-0000-4000-8000-000000000001", department: "TDMS", type: "section_entry", train_id: null, section_id: "AJJ-SHU", description: "test", raised_at: snapshot.timestamp });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(0);
    expect(decision.request_id).toBe("00000000-0000-4000-8000-000000000001");
    expect(gateway.getDecisions()).toHaveLength(1);
  });

  it("forwards requests to external ABP API when mockAbp is false", async () => {
    const postCalls: { url: string; body: unknown }[] = [];
    const abpDecision = {
      request_id: "00000000-0000-4000-8000-000000000002",
      status: "queued",
      section_id: "AJJ-SHU",
      resulting_state: "clear",
      decided_at: snapshot.timestamp,
      notes: "Queued for RailNexus AI optimization",
    };
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = String(url);
      if (urlStr.includes("world-state")) {
        return new Response(JSON.stringify(snapshot), { status: 200 });
      }
      if (init && init.method === "POST") {
        postCalls.push({ url: urlStr, body: JSON.parse(init.body as string) });
        return new Response(JSON.stringify(abpDecision), { status: 202 });
      }
      return new Response("not found", { status: 404 });
    });
    const gateway = new Gateway({
      worldUrl: "http://world/world-state",
      abpApiUrl: "http://railnexus:8000/api/demo-gateway/requests",
      mockAbp: false,
      fetchImpl,
    });
    await gateway.syncWorld();
    const decision = await gateway.submit({
      request_id: "00000000-0000-4000-8000-000000000002",
      department: "TMS",
      type: "maintenance_block",
      train_id: null,
      section_id: "AJJ-SHU",
      description: "Emergency rail repair",
      raised_at: snapshot.timestamp,
    });
    expect(postCalls).toHaveLength(1);
    expect(postCalls[0]?.url).toBe("http://railnexus:8000/api/demo-gateway/requests");
    expect(decision.status).toBe("queued");
    expect(decision.notes).toBe("Queued for RailNexus AI optimization");
  });
});
