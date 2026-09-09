import { describe, expect, it } from "vitest";
import { buildTdmsEngine } from "../src/departments/tdms.js";
import { engineCtx, makeStore, makeTrain } from "./helpers.js";

const engine = buildTdmsEngine();

function snapshotWith(trains: ReturnType<typeof makeTrain>[]) {
  return { timestamp: "2026-09-09T10:00:00.000Z", trains, sections: [] };
}

describe("TDMS department", () => {
  it("raises a section-entry request for a section the train does not hold", () => {
    const store = makeStore();
    const requests = engine.raise(
      snapshotWith([makeTrain("12005", { nextSectionId: "SHU-WJR", heldSectionIds: ["AJJ-SHU"] })]),
      engineCtx(),
      store,
    );
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      department: "TDMS",
      type: "section_entry",
      trainId: "12005",
      sectionId: "SHU-WJR",
      status: "submitted",
    });
  });

  it("does not raise when the train already holds the next section", () => {
    const store = makeStore();
    const requests = engine.raise(
      snapshotWith([makeTrain("12005", { nextSectionId: "SHU-WJR", heldSectionIds: ["AJJ-SHU", "SHU-WJR"] })]),
      engineCtx(),
      store,
    );
    expect(requests).toHaveLength(0);
  });

  it("dedupes per (train, section) pair across frames", () => {
    const store = makeStore();
    const ctx = engineCtx();
    const snapshot = () =>
      snapshotWith([makeTrain("12005", { nextSectionId: "SHU-WJR", heldSectionIds: ["AJJ-SHU"] })]);
    const first = engine.raise(snapshot(), ctx, store);
    for (const request of first) store.addRequest(request);
    expect(engine.raise(snapshot(), ctx, store)).toHaveLength(0);
  });

  it("raises for a different pair once the train advances", () => {
    const store = makeStore();
    const ctx = engineCtx();
    const requests = engine.raise(
      snapshotWith([makeTrain("12005", { nextSectionId: "SHU-WJR", heldSectionIds: ["AJJ-SHU"] })]),
      ctx,
      store,
    );
    for (const request of requests) store.addRequest(request);

    const advanced = engine.raise(
      snapshotWith([
        makeTrain("12005", { km: 35, nextSectionId: "WJR-MCN", heldSectionIds: ["AJJ-SHU", "SHU-WJR"] }),
      ]),
      ctx,
      store,
    );
    expect(advanced).toHaveLength(1);
    expect(advanced[0]!.sectionId).toBe("WJR-MCN");
  });
});