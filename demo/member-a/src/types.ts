import type { WorldState } from "./contracts.js";
export type { WorldState } from "./contracts.js";
export type Train = WorldState["trains"][number];
export type Section = WorldState["sections"][number];

export interface Station {
  code: string;
  name: string;
  km: number;
  latitude: number;
  longitude: number;
}

export interface NetworkSection {
  id: string;
  from: Station;
  to: Station;
  distanceKm: number;
  mpsKmh: number;
}

export interface LevelCrossing {
  id: string;
  sectionId: string;
  km: number;
  name: string;
}
