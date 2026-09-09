import { describe, expect, it } from "vitest";
import { buildSmmsEngine } from "../src/departments/smms.js";
import { engineCtx, makeSection, makeStore } from "./helpers.js";

const engine = buildSmmsEngine();

function snapshotWith(sections: ReturnType<typeof makeSection>[]) {
  return { timestamp: "2026-09-09T10:00:00.000Z", trains: [], sections };
}

describe("SMMS department — raising", () => {
  it("raises a maintenance-block request for a section with a fault", () => {
    const store = makeStore();
    const requests = engine.raise(
      snapshotWith([makeSection({ id: "BAR-YJ", fault: "OHE dropper snapped" })]),
      engineCtx(),
      store,
    );
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      department: "SMMS",
      type: "maintenance_block",
      sectionId: "BAR-YJ",
      status: "submitted",
    });
    expect(requests[0]!.description).toBe("Section BAR-YJ requires emergency maintenance block");
  });

  it("does not raise when there is no fault", () => {
    const store = makeStore();
    const requests = engine.raise(snapshotWith([makeSection({ id: "BAR-YJ" })]), engineCtx(), store);
    expect(requests).toHaveLength(0);
  });

  it("does not raise while the section is already under a block", () => {
    const store = makeStore();
    store.addRequest({
      id: "R1",
      department: "SMMS",
      type: "maintenance_block",
      sectionId: "BAR-YJ",
      km: 243,
      payload: { fault: "OHE dropper snapped" },
      description: "Section BAR-YJ requires emergency maintenance block",
      raisedAt: "2026-09-09T10:00:00.000Z",
      status: "submitted",
    });
    store.applyDecision({
      id: "D1",
      requestId: "R1",
      decision: "approved",
      sectionId: "BAR-YJ",
      sectionState: "Block active",
      decidedAt: "2026-09-09T10:00:00.000Z",
    });
    const requests = engine.raise(
      snapshotWith([makeSection({ id: "BAR-YJ", fault: "OHE dropper snapped" })]),
      engineCtx(),
      store,
    );
    expect(requests).toHaveLength(0);
  });

  it("dedupes while an identical request is unresolved", () => {
    const store = makeStore();
    const ctx = engineCtx();
    const snapshot = () => snapshotWith([makeSection({ id: "BAR-YJ", fault: "OHE dropper snapped" })]);
    const first = engine.raise(snapshot(), ctx, store);
    for (const request of first) store.addRequest(request);
    expect(engine.raise(snapshot(), ctx, store)).toHaveLength(0);
  });
});