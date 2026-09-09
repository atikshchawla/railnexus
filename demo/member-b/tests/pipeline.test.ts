import { describe, expect, it } from "vitest";
import snapshot1 from "../fixtures/world/snapshot-1.json";
import snapshot2 from "../fixtures/world/snapshot-2.json";
import snapshot3 from "../fixtures/world/snapshot-3.json";
import { buildMockAbp } from "../src/abp/mock.js";
import { buildTmsEngine } from "../src/departments/tms.js";
import { buildTdmsEngine } from "../src/departments/tdms.js";
import { buildSmmsEngine } from "../src/departments/smms.js";
import { buildPipeline } from "../src/pipeline.js";
import { corridorSections } from "../src/corridor.js";
import { Store } from "../src/store.js";

describe("end-to-end loop over the replay fixtures", () => {
  it("moves a snapshot through engines → mock ABP → reflected sections", async () => {
    const store = new Store("test corridor", corridorSections());
    const pipeline = buildPipeline({
      store,
      engines: [buildTmsEngine(), buildTdmsEngine(), buildSmmsEngine()],
      abp: buildMockAbp(),
    });

    const frame1 = await pipeline.process(snapshot1 as never);
    expect(frame1.requests.filter((r) => r.department === "TDMS")).toHaveLength(3);
    expect(frame1.decisions).toHaveLength(3);
    expect(frame1.decisions.every((d) => d.decision === "approved")).toBe(true);
    expect(store.getSectionState("SHU-WJR")).toBe("Approved");

    const frame2 = await pipeline.process(snapshot2 as never);
    const tms = frame2.requests.filter((r) => r.department === "TMS");
    const smms = frame2.requests.filter((r) => r.department === "SMMS");
    expect(tms).toHaveLength(1);
    expect(tms[0]!.trainId).toBe("12005");
    expect(smms).toHaveLength(1);
    expect(smms[0]!.sectionId).toBe("MCN-KPD");
    expect(store.getSectionState("MCN-KPD")).toBe("Block active");

    const frame3 = await pipeline.process(snapshot3 as never);
    const rerouted = frame3.decisions.find((d) => d.decision === "rerouted");
    expect(rerouted).toBeDefined();
    expect(rerouted?.sectionId).toBe("MCN-KPD");
    expect(store.getSectionState("MCN-KPD")).toBe("Rerouted");

    // No new SMMS request while the section already sits under a block.
    expect(frame3.requests.filter((r) => r.department === "SMMS")).toHaveLength(0);

    const state = store.snapshotState();
    expect(state.sections).toHaveLength(4);
    expect(state.departments.TDMS.requests.length).toBeGreaterThan(0);
  });

  it("keeps requests deduplicated as the replay loops (one per pair)", async () => {
    const store = new Store("test corridor", corridorSections());
    const pipeline = buildPipeline({
      store,
      engines: [buildTmsEngine(), buildTdmsEngine(), buildSmmsEngine()],
      abp: buildMockAbp(),
    });

    for (let pass = 0; pass < 3; pass += 1) {
      await pipeline.process(snapshot1 as never);
      await pipeline.process(snapshot2 as never);
      await pipeline.process(snapshot3 as never);
    }

    const tdmsPairs = new Set(
      store
        .requestsFor("TDMS")
        .map((r) => `${r.trainId}->${r.sectionId}`),
    );
    expect(store.requestsFor("TDMS").length).toBe(tdmsPairs.size);
    expect(store.requestsFor("TMS")).toHaveLength(1);
  });
});