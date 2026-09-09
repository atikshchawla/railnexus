import { describe, expect, it } from "vitest";
import { sections } from "../src/network.js";
import { WorldSimulator } from "../src/simulator.js";

describe("Member A world simulator", () => {
  it("publishes the trained AJJ-JTJ topology", () => {
    const snapshot = new WorldSimulator().snapshot();
    expect(snapshot.sections.map((section) => section.id)).toEqual(sections.map((section) => section.id));
    expect(snapshot.trains).toHaveLength(3);
    expect(snapshot.trains.every((train) => train.nextSectionId)).toBe(true);
  });

  it("advances trains and reports physical occupancy", () => {
    const simulator = new WorldSimulator();
    const before = simulator.snapshot();
    const after = simulator.tick(60);
    expect(after.trains.some((train, index) => train.km !== before.trains[index]!.km)).toBe(true);
    expect(after.sections.some((section) => section.occupiedBy)).toBe(true);
  });

  it("stops a train on a physically faulted section", () => {
    const simulator = new WorldSimulator();
    simulator.setFault("MCN-KPD", "OHE isolator failure");
    const snapshot = simulator.tick(1);
    expect(snapshot.sections.find((section) => section.id === "MCN-KPD")).toMatchObject({ status: "Caution", fault: "OHE isolator failure" });
  });
});
