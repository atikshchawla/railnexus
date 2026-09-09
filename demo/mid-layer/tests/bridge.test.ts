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
});
