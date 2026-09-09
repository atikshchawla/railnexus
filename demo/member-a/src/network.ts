import type { LevelCrossing, NetworkSection, Station } from "./types.js";

export const corridorLabel = "Arakkonam–Jolarpettai, Southern Railway (SR_CHENNAI)";

export const stations: Station[] = [
  { code: "AJJ", name: "Arakkonam Junction", km: 0, latitude: 13.0846, longitude: 79.6705 },
  { code: "SHU", name: "Sholinghur", km: 21.3, latitude: 13.1192, longitude: 79.4201 },
  { code: "WJR", name: "Walajah Road", km: 36.2, latitude: 12.9368, longitude: 79.3354 },
  { code: "MCN", name: "Mukundarayapuram", km: 43.9, latitude: 12.9241, longitude: 79.2484 },
  { code: "KPD", name: "Katpadi Junction", km: 60.9, latitude: 12.969, longitude: 79.140 },
  { code: "GYM", name: "Gudiyattam", km: 85.6, latitude: 12.9463, longitude: 78.8723 },
  { code: "AB", name: "Ambur", km: 113, latitude: 12.7916, longitude: 78.7162 },
  { code: "VN", name: "Vaniyambadi", km: 129.1, latitude: 12.6816, longitude: 78.6204 },
  { code: "JTJ", name: "Jolarpettai Junction", km: 144.5, latitude: 12.5707, longitude: 78.5736 },
];

export const sections: NetworkSection[] = stations.slice(0, -1).map((from, index) => {
  const to = stations[index + 1]!;
  return {
    id: `${from.code}-${to.code}`,
    from,
    to,
    distanceKm: Number((to.km - from.km).toFixed(1)),
    mpsKmh: 130,
  };
});

export const crossings: LevelCrossing[] = [
  { id: "LC-AJJ-01", sectionId: "AJJ-SHU", km: 8.7, name: "Melpakkam level crossing" },
  { id: "LC-SHU-01", sectionId: "SHU-WJR", km: 29.8, name: "Sholinghur road crossing" },
  { id: "LC-KPD-01", sectionId: "KPD-GYM", km: 71.4, name: "Katpadi east crossing" },
  { id: "LC-VN-01", sectionId: "VN-JTJ", km: 137.6, name: "Vaniyambadi road crossing" },
];

export function sectionAt(km: number): NetworkSection | undefined {
  return sections.find((section) => km >= section.from.km && km <= section.to.km);
}

export function sectionById(id: string): NetworkSection | undefined {
  return sections.find((section) => section.id === id);
}
