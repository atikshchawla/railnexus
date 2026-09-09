import { describe, expect, it, vi } from "vitest";
import { WorldBridge } from "../src/bridge.js";

const snapshot = {
  timestamp: "2026-09-09T10:00:00.000Z",
  trains: [],
  sections: [],
};

describe("mid-layer world bridge", () => {
  it("validates and forwards the shared world feed over HTTP", async () => {
    const calls: RequestInit[] = [];
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      if (init) calls.push(init);
      return new Response(JSON.stringify(snapshot), { status: 200 });
    });
    const bridge = new WorldBridge({ worldUrl: "http://world/feed", memberBUrl: "http://member-b/api/ingest", fetchImpl });
    await bridge.pullAndForward();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(calls[0]?.method).toBe("POST");
    expect(JSON.parse(String(calls[0]?.body))).toEqual(snapshot);
    expect(bridge.current().lastSeenAt).toBe(snapshot.timestamp);
  });
});
