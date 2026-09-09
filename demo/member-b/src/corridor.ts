/**
 * Frozen corridor contract — Member B reasoning ground.
 *
 * Arakkonam–Jolarpettai, Southern Railway (SR_CHENNAI), the corridor used by
 * the training topology and model feature artifacts.
 */

import type { InitialSection } from "./types.js";

export const corridorLabel = "Arakkonam–Jolarpettai, Southern Railway (SR_CHENNAI)";

export interface CorridorStation {
  code: string;
  name: string;
  km: number;
}

export const corridorStations: CorridorStation[] = [
  { code: "AJJ", name: "Arakkonam Junction", km: 0 },
  { code: "SHU", name: "Sholinghur", km: 21.3 },
  { code: "WJR", name: "Walajah Road", km: 36.2 },
  { code: "MCN", name: "Mukundarayapuram", km: 43.9 },
  { code: "KPD", name: "Katpadi Junction", km: 60.9 },
  { code: "GYM", name: "Gudiyattam", km: 85.6 },
  { code: "AB", name: "Ambur", km: 113 },
  { code: "VN", name: "Vaniyambadi", km: 129.1 },
  { code: "JTJ", name: "Jolarpettai Junction", km: 144.5 },
];

export function corridorSections(): InitialSection[] {
  const sections: InitialSection[] = [];
  for (let index = 0; index < corridorStations.length - 1; index += 1) {
    const from = corridorStations[index]!;
    const to = corridorStations[index + 1]!;
    sections.push({
      id: `${from.code}-${to.code}`,
      fromStation: from.name,
      toStation: to.name,
      fromKm: from.km,
      toKm: to.km,
    });
  }
  return sections;
}