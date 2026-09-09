import { describe, expect, it } from "vitest";
import { applyDecisionState } from "../src/abp/applyDecision.js";
import { makeStore } from "./helpers.js";

describe("SMMS reflecting role — applyDecisionState mapping", () => {
  it("maintenance approval puts the section under a block", () => {
    expect(applyDecisionState("maintenance_block", "approved", "Clear")).toBe("Block active");
  });

  it("section-entry approval grants the section", () => {
    expect(applyDecisionState("section_entry", "approved", "Clear")).toBe("Approved");
  });

  it("queued / reserved / rerouted set their reflected states", () => {
    expect(applyDecisionState("section_entry", "queued", "Clear")).toBe("Queued");
    expect(applyDecisionState("section_entry", "reserved", "Clear")).toBe("Reserved");
    expect(applyDecisionState("section_entry", "rerouted", "Clear")).toBe("Rerouted");
  });

  it("running-status decisions never change the section", () => {
    expect(applyDecisionState("running_status", "approved", "Clear")).toBe("Clear");
  });

  it("rejection leaves the section untouched", () => {
    expect(applyDecisionState("section_entry", "rejected", "Reserved")).toBe("Reserved");
  });
});

describe("Store.applyDecision", () => {
  it("reflects a decision onto the matching section and marks the request decided", () => {
    const store = makeStore();
    store.addRequest({
      id: "REQ-SMMS-1",
      department: "SMMS",
      type: "maintenance_block",
      sectionId: "BAR-YJ",
      km: 245,
      payload: { fault: "OHE dropper snapped" },
      description: "Section BAR-YJ requires emergency maintenance block",
      raisedAt: "2026-09-09T10:04:00.000Z",
      status: "submitted",
    });
    store.applyDecision({
      id: "DEC-REQ-SMMS-1",
      requestId: "REQ-SMMS-1",
      decision: "approved",
      sectionId: "BAR-YJ",
      sectionState: "Block active",
      decidedAt: "2026-09-09T10:04:00.000Z",
    });

    expect(store.getSectionState("BAR-YJ")).toBe("Block active");
    expect(store.requestsFor("SMMS")[0]!.status).toBe("decided");
  });

  it("department view exposes only that department's outcome history", () => {
    const store = makeStore();
    store.addRequest({
      id: "REQ-TDMS-1",
      department: "TDMS",
      type: "section_entry",
      trainId: "12005",
      sectionId: "BAR-YJ",
      km: 240,
      payload: {},
      description: "Train 12005 requests block entry into section BAR-YJ",
      raisedAt: "2026-09-09T10:00:00.000Z",
      status: "submitted",
    });
    expect(store.requestsFor("TDMS")).toHaveLength(1);
    expect(store.requestsFor("TMS")).toHaveLength(0);
    expect(store.requestsFor("SMMS")).toHaveLength(0);
  });
});