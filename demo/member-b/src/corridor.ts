/**
 * Frozen corridor contract — Member B reasoning ground.
 *
 * Ambala Cantt–Saharanpur, Northern Railway (UP/DN), Km 238–252.
 * Station km markers are the demo's fictional segment (projects the existing
 * frontend mock geography); real-world spacing differs. Recorded in
 * docs/domain-glossary.md as "Project-defined — needs team ratification".
 */

import type { InitialSection } from "./types.js";

export const corridorLabel = "Ambala Cantt–Saharanpur, Northern Railway";

export interface CorridorStation {
  code: string;
  name: string;
  km: number;
}

export const corridorStations: CorridorStation[] = [
  { code: "UMB", name: "Ambala Cantt", km: 238 },
  { code: "BAR", name: "Barara", km: 243 },
  { code: "YJ", name: "Yamunanagar Jagadhri", km: 248 },
  { code: "YWS", name: "Jagadhri Workshop", km: 250 },
  { code: "SRE", name: "Saharanpur", km: 252 },
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