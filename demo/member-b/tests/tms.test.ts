import { describe, expect, it } from "vitest";
import { buildTmsEngine, DELAY_THRESHOLD_MINUTES } from "../src/departments/tms.js";
import { engineCtx, makeStore, makeTrain } from "./helpers.js";

const engine = buildTmsEngine();

function snapshotWith(trains: ReturnType<typeof makeTrain>[]) {
  return { timestamp: "2026-09-09T10:00:00.000Z", trains, sections: [] };
}

describe("TMS department", () => {
  it("raises a running-status request for a delayed train past the threshold", () => {
    const store = makeStore();
    const requests = engine.raise(
      snapshotWith([makeTrain("12005", { status: "delayed", delayMinutes: DELAY_THRESHOLD_MINUTES + 2 })]),
      engineCtx(),
      store,
    );
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      department: "TMS",
      type: "running_status",
      trainId: "12005",
      sectionId: "BAR-YJ",
      status: "submitted",
    });
    expect(requests[0]!.payload.delayMinutes).toBe(DELAY_THRESHOLD_MINUTES + 2);
  });

  it("does not raise below the delay threshold", () => {
    const store = makeStore();
    const requests = engine.raise(
      snapshotWith([makeTrain("12005", { status: "delayed", delayMinutes: DELAY_THRESHOLD_MINUTES - 1 })]),
      engineCtx(),
      store,
    );
    expect(requests).toHaveLength(0);
  });

  it("does not raise for running trains", () => {
    const store = makeStore();
    const requests = engine.raise(
      snapshotWith([makeTrain("12005", { status: "running" })]),
      engineCtx(),
      store,
    );
    expect(requests).toHaveLength(0);
  });

  it("raises once per delayed episode (dedupe across frames)", () => {
    const store = makeStore();
    const ctx = engineCtx();
    const snapshot = () => snapshotWith([makeTrain("12005", { status: "delayed", delayMinutes: 15 })]);
    const first = engine.raise(snapshot(), ctx, store);
    for (const request of first) store.addRequest(request);
    const second = engine.raise(snapshot(), ctx, store);
    expect(second).toHaveLength(0);
  });
});