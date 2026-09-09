import type { Department } from "../src/types.js";
import { corridorSections } from "../src/corridor.js";
import type { EngineContext } from "../src/departments/base.js";
import { Store } from "../src/store.js";

export const NOW = "2026-09-09T10:00:00.000Z";

export function makeStore(): Store {
  return new Store("test corridor", corridorSections());
}

export function engineCtx(): EngineContext {
  let seq = 0;
  return {
    now: () => NOW,
    nextRequestId: (department: Department) => `REQ-${department}-${++seq}`,
  };
}

export function makeSection(
  overloads: Partial<{
    id: string;
    fromStation: string;
    toStation: string;
    fromKm: number;
    toKm: number;
    status: "Clear" | "Caution";
    fault: string;
  }> = {},
): {
  id: string;
  fromStation: string;
  toStation: string;
  fromKm: number;
  toKm: number;
  status: "Clear" | "Caution";
  fault?: string;
} {
  return {
    id: "AJJ-SHU",
    fromStation: "Arakkonam Junction",
    toStation: "Sholinghur",
    fromKm: 0,
    toKm: 21.3,
    status: "Clear",
    ...overloads,
  };
}

export function makeTrain(
  id: string,
  overloads: Partial<{
    name: string;
    line: "UP" | "DN";
    km: number;
    speedKmh: number;
    status: "running" | "delayed" | "stopped";
    delayMinutes: number;
    nextSectionId: string;
    heldSectionIds: string[];
  }> = {},
): {
  id: string;
  name: string;
  line: "UP" | "DN";
  km: number;
  speedKmh: number;
  status: "running" | "delayed" | "stopped";
  delayMinutes?: number;
  nextSectionId: string;
  heldSectionIds: string[];
} {
  return {
    id,
    name: `Train ${id}`,
    line: "UP",
    km: 240,
    speedKmh: 80,
    status: "running",
    nextSectionId: "SHU-WJR",
    heldSectionIds: ["AJJ-SHU"],
    ...overloads,
  };
}