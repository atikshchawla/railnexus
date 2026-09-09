import { describe, expect, it } from "vitest";
import { sections } from "../src/network.js";
import { WorldSimulator } from "../src/simulator.js";

describe("Member A world simulator", () => {
  it("publishes the trained AJJ-JTJ topology", () => {
    const snapshot = new WorldSimulator().snapshot();
    expect(snapshot.sections.map((section) => section.section_id)).toEqual(sections.map((section) => section.id));
    expect(snapshot.trains).toHaveLength(8);
    expect(snapshot.trains.every((train) => train.section_id)).toBe(true);
  });

  it("advances trains and reports physical occupancy", () => {
    const simulator = new WorldSimulator();
    const before = simulator.snapshot();
    const after = simulator.tick(60);
    expect(after.trains.some((train, index) => train.position_km !== before.trains[index]!.position_km)).toBe(true);
    expect(after.sections.some((section) => section.occupant_train_id)).toBe(true);
  });

  it("stops a train on a physically faulted section", () => {
    const simulator = new WorldSimulator();
    simulator.setFault("MCN-KPD", "OHE isolator failure", 10);
    const snapshot = simulator.tick(1);
    expect(snapshot.sections.find((section) => section.section_id === "MCN-KPD")).toMatchObject({ state: "maintenance", fault_reason: "OHE isolator failure" });
  });
});
