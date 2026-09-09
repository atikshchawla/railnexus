import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import snapshot1 from "../fixtures/world/snapshot-1.json";
import { buildMockAbp } from "../src/abp/mock.js";
import { corridorLabel, corridorSections } from "../src/corridor.js";
import { buildTmsEngine } from "../src/departments/tms.js";
import { buildTdmsEngine } from "../src/departments/tdms.js";
import { buildSmmsEngine } from "../src/departments/smms.js";
import { buildPipeline } from "../src/pipeline.js";
import { buildApp } from "../src/server.js";
import { Store } from "../src/store.js";

async function startTestServer() {
  const store = new Store(corridorLabel, corridorSections());
  const pipeline = buildPipeline({
    store,
    engines: [buildTmsEngine(), buildTdmsEngine(), buildSmmsEngine()],
    abp: buildMockAbp(),
  });
const app = buildApp({
    store,
    process: (snapshot) => pipeline.process(snapshot),
    inject: (input) => pipeline.inject(input),
  });
  const server = app.listen(0);
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}`, close: () => server.close() };
}

describe("Member B HTTP API", () => {
  it("ingests a snapshot and returns raised requests + decisions", async () => {
    const testServer = await startTestServer();
    try {
      const response = await fetch(`${testServer.url}/api/ingest`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(snapshot1),
      });
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        requests: { department: string }[];
        decisions: { decision: string }[];
      };
      expect(body.requests).toHaveLength(3);
      expect(body.decisions).toHaveLength(3);
      expect(body.decisions.every((d) => d.decision === "approved")).toBe(true);
    } finally {
      testServer.close();
    }
  });

  it("rejects invalid snapshots with 400", async () => {
    const testServer = await startTestServer();
    try {
      const response = await fetch(`${testServer.url}/api/ingest`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ timestamp: "nope", trains: "not-an-array" }),
      });
      expect(response.status).toBe(400);
    } finally {
      testServer.close();
    }
  });

  it("serves the combined state and per-department views", async () => {
    const testServer = await startTestServer();
    try {
      await fetch(`${testServer.url}/api/ingest`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(snapshot1),
      });

      const stateResponse = await fetch(`${testServer.url}/api/state`);
      const state = (await stateResponse.json()) as {
        sections: unknown[];
        departments: { TDMS: { requests: unknown[] } };
        corridor: string;
      };
      expect(state.sections).toHaveLength(8);
      expect(state.departments.TDMS.requests).toHaveLength(3);
      expect(state.corridor).toContain("Arakkonam");

      const tms = await fetch(`${testServer.url}/api/departments/TMS/requests`);
      expect((await tms.json()) as { requests: unknown[] }).toEqual({
        department: "TMS",
        requests: [],
      });

      const unknown = await fetch(`${testServer.url}/api/departments/NOPE/requests`);
      expect(unknown.status).toBe(400);

const health = await fetch(`${testServer.url}/health`);
      expect((await health.json()) as { ok: boolean; corridor: string }).toEqual({
        ok: true,
        corridor: corridorLabel,
      });
    } finally {
      testServer.close();
    }
  });

  it("injects a judge request end-to-end and reflects the ABP decision", async () => {
    const testServer = await startTestServer();
    try {
      const response = await fetch(`${testServer.url}/api/inject`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          department: "TDMS",
          type: "section_entry",
          sectionId: "SHU-WJR",
          trainId: "JUDGE-1",
        }),
      });
      expect(response.status).toBe(201);
      const body = (await response.json()) as {
        request: {
          id: string;
          department: string;
          type: string;
          sectionId: string;
          trainId?: string;
        };
        decision: { decision: string; sectionState: string };
      };
      expect(body.request.id).toMatch(/^REQ-TDMS-\d+$/);
      expect(body.request.department).toBe("TDMS");
      expect(body.request.trainId).toBe("JUDGE-1");
      expect(body.request.sectionId).toBe("SHU-WJR");
      expect(body.decision.decision).toBe("approved");

      const state = (await (
        await fetch(`${testServer.url}/api/state`)
      ).json()) as {
        sections: { id: string; state: string }[];
        departments: { TDMS: { requests: { id: string }[] } };
      };
      const barYj = state.sections.find((section) => section.id === "SHU-WJR");
      expect(barYj?.state).toBe("Approved");
      expect(state.departments.TDMS.requests).toHaveLength(1);
    } finally {
      testServer.close();
    }
  });

  it("injects running_status without disturbing section state", async () => {
    const testServer = await startTestServer();
    try {
      const response = await fetch(`${testServer.url}/api/inject`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          department: "TMS",
          type: "running_status",
          sectionId: "MCN-KPD",
          trainId: "SPL-9",
          payload: { delayMinutes: 22, line: "UP" },
        }),
      });
      expect(response.status).toBe(201);
      const state = (await (
        await fetch(`${testServer.url}/api/state`)
      ).json()) as { sections: { id: string; state: string }[] };
      const ywsSre = state.sections.find((section) => section.id === "MCN-KPD");
      expect(ywsSre?.state).toBe("Clear");
    } finally {
      testServer.close();
    }
  });

  it("injects maintenance_block into Block active with sequential ids", async () => {
    const testServer = await startTestServer();
    try {
      const first = await fetch(`${testServer.url}/api/inject`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          department: "SMMS",
          type: "maintenance_block",
          sectionId: "AJJ-SHU",
          payload: { fault: "OHE dropper snapped" },
        }),
      });
      const second = await fetch(`${testServer.url}/api/inject`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          department: "SMMS",
          type: "maintenance_block",
          sectionId: "SHU-WJR",
        }),
      });
      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      const firstId = ((await first.json()) as { request: { id: string } }).request.id;
      const secondId = ((await second.json()) as { request: { id: string } }).request.id;
      expect(firstId).not.toBe(secondId);

      const state = (await (
        await fetch(`${testServer.url}/api/state`)
      ).json()) as { sections: { id: string; state: string }[] };
      const umbBar = state.sections.find((section) => section.id === "AJJ-SHU");
      expect(umbBar?.state).toBe("Block active");
    } finally {
      testServer.close();
    }
  });

  it("rejects unknown sections and malformed bodies with 400", async () => {
    const testServer = await startTestServer();
    try {
      const unknown = await fetch(`${testServer.url}/api/inject`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          department: "TDMS",
          type: "section_entry",
          sectionId: "NOPE-X",
        }),
      });
      expect(unknown.status).toBe(400);
      expect(((await unknown.json()) as { error: string }).error).toBe(
        "unknown_section",
      );

      const malformed = await fetch(`${testServer.url}/api/inject`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ department: "TDMS" }),
      });
      expect(malformed.status).toBe(400);
      expect(((await malformed.json()) as { error: string }).error).toBe(
        "invalid_inject",
      );
    } finally {
      testServer.close();
    }
  });
});
