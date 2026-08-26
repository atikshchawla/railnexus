export type Pt = [number, number];

export type MetroLine = {
  id: string;
  name: string;
  color: string;
  path: Pt[];
  stations: { name: string; at: number; interchange?: boolean }[]; // at = index in path
};

/**
 * Hand-authored Delhi Metro network, drawn as 45/90-degree transit-diagram
 * polylines inside a 1000 x 720 viewBox. Not tied to any raster source.
 */
export const LINES: MetroLine[] = [
  {
    id: "red",
    name: "Red Line",
    color: "var(--color-line-red)",
    path: [
      [90, 150],
      [180, 150],
      [250, 120],
      [400, 120],
      [470, 150],
      [600, 150],
      [700, 130],
      [830, 130],
      [910, 170],
    ],
    stations: [
      { name: "Rithala", at: 0 },
      { name: "Netaji Subhash Place", at: 2, interchange: true },
      { name: "Kashmere Gate", at: 4, interchange: true },
      { name: "Welcome", at: 6, interchange: true },
      { name: "Shaheed Sthal", at: 8 },
    ],
  },
  {
    id: "yellow",
    name: "Yellow Line",
    color: "var(--color-line-yellow)",
    path: [
      [430, 60],
      [430, 150],
      [470, 200],
      [470, 300],
      [450, 330],
      [450, 420],
      [480, 460],
      [480, 560],
      [520, 620],
      [560, 680],
    ],
    stations: [
      { name: "Samaypur Badli", at: 0 },
      { name: "Kashmere Gate", at: 1, interchange: true },
      { name: "Rajiv Chowk", at: 3, interchange: true },
      { name: "INA", at: 5, interchange: true },
      { name: "Hauz Khas", at: 6, interchange: true },
      { name: "HUDA City Centre", at: 9 },
    ],
  },
  {
    id: "blue",
    name: "Blue Line",
    color: "var(--color-line-blue)",
    path: [
      [80, 400],
      [200, 400],
      [280, 350],
      [400, 350],
      [470, 300],
      [560, 300],
      [640, 260],
      [780, 260],
      [900, 300],
    ],
    stations: [
      { name: "Dwarka Sec-21", at: 0 },
      { name: "Janakpuri West", at: 2, interchange: true },
      { name: "Rajouri Garden", at: 3, interchange: true },
      { name: "Rajiv Chowk", at: 4, interchange: true },
      { name: "Yamuna Bank", at: 6, interchange: true },
      { name: "Noida Electronic City", at: 8 },
    ],
  },
  {
    id: "blue-branch",
    name: "Blue Line (Branch)",
    color: "var(--color-line-blue)",
    path: [
      [640, 260],
      [700, 210],
      [800, 210],
      [880, 170],
    ],
    stations: [
      { name: "Yamuna Bank", at: 0, interchange: true },
      { name: "Vaishali", at: 3 },
    ],
  },
  {
    id: "green",
    name: "Green Line",
    color: "var(--color-line-green)",
    path: [
      [60, 250],
      [140, 250],
      [200, 290],
      [200, 400],
    ],
    stations: [
      { name: "Brig. Hoshiar Singh", at: 0 },
      { name: "Inderlok", at: 2, interchange: true },
      { name: "Kirti Nagar", at: 3, interchange: true },
    ],
  },
  {
    id: "violet",
    name: "Violet Line",
    color: "var(--color-line-violet)",
    path: [
      [470, 200],
      [530, 250],
      [560, 300],
      [600, 380],
      [600, 480],
      [660, 540],
      [700, 620],
    ],
    stations: [
      { name: "Kashmere Gate", at: 0, interchange: true },
      { name: "Central Secretariat", at: 1, interchange: true },
      { name: "Lajpat Nagar", at: 3, interchange: true },
      { name: "Badarpur", at: 5 },
      { name: "Raja Nahar Singh", at: 6 },
    ],
  },
  {
    id: "pink",
    name: "Pink Line",
    color: "var(--color-line-pink)",
    path: [
      [180, 150],
      [140, 250],
      [160, 340],
      [230, 470],
      [340, 540],
      [470, 560],
      [580, 520],
      [660, 440],
      [700, 340],
      [700, 210],
    ],
    stations: [
      { name: "Majlis Park", at: 0, interchange: true },
      { name: "Inderlok", at: 1, interchange: true },
      { name: "Dhaula Kuan", at: 3 },
      { name: "INA", at: 4, interchange: true },
      { name: "Lajpat Nagar", at: 5, interchange: true },
      { name: "Mayur Vihar", at: 8, interchange: true },
      { name: "Shiv Vihar", at: 9 },
    ],
  },
  {
    id: "magenta",
    name: "Magenta Line",
    color: "var(--color-line-magenta)",
    path: [
      [280, 350],
      [300, 440],
      [380, 500],
      [450, 520],
      [520, 470],
      [600, 480],
      [660, 440],
    ],
    stations: [
      { name: "Janakpuri West", at: 0, interchange: true },
      { name: "Hauz Khas", at: 3, interchange: true },
      { name: "Kalkaji Mandir", at: 5, interchange: true },
      { name: "Botanical Garden", at: 6, interchange: true },
    ],
  },
  {
    id: "grey",
    name: "Grey Line",
    color: "var(--color-line-grey)",
    path: [
      [80, 330],
      [140, 340],
      [160, 340],
    ],
    stations: [
      { name: "Dhansa Bus Stand", at: 0 },
      { name: "Najafgarh", at: 2 },
    ],
  },
  {
    id: "airport",
    name: "Airport Express",
    color: "var(--color-line-orange)",
    path: [
      [200, 400],
      [300, 440],
      [380, 430],
      [430, 380],
      [470, 300],
    ],
    stations: [
      { name: "Dwarka Sec-21", at: 0 },
      { name: "IGI Airport T3", at: 2 },
      { name: "New Delhi", at: 4, interchange: true },
    ],
  },
  {
    id: "aqua",
    name: "Aqua Line",
    color: "var(--color-line-aqua)",
    path: [
      [660, 440],
      [740, 470],
      [820, 470],
      [880, 520],
    ],
    stations: [
      { name: "Sector 51", at: 0, interchange: true },
      { name: "Depot Station", at: 3 },
    ],
  },
];

export function pathLengths(path: Pt[]) {
  const segs: number[] = [];
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    segs.push(d);
    total += d;
  }
  return { segs, total };
}

/** Point at normalized progress t (0..1) along a polyline. */
export function pointAt(path: Pt[], t: number): Pt {
  const { segs, total } = pathLengths(path);
  let d = Math.max(0, Math.min(1, t)) * total;
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i]!;
    if (d <= seg) {
      const r = seg === 0 ? 0 : d / seg;
      const a = path[i]!;
      const b = path[i + 1]!;
      return [a[0] + (b[0] - a[0]) * r, a[1] + (b[1] - a[1]) * r];
    }
    d -= seg;
  }
  return path[path.length - 1]!;
}

/** Normalized progress of a path vertex index. */
export function progressOfIndex(path: Pt[], index: number) {
  const { segs, total } = pathLengths(path);
  let d = 0;
  for (let i = 0; i < index && i < segs.length; i++) d += segs[i]!;
  return total === 0 ? 0 : d / total;
}

export function subPath(path: Pt[], t0: number, t1: number): Pt[] {
  const a = Math.min(t0, t1);
  const b = Math.max(t0, t1);
  const pts: Pt[] = [pointAt(path, a)];
  const { segs, total } = pathLengths(path);
  let acc = 0;
  for (let i = 0; i < segs.length; i++) {
    acc += segs[i]!;
    const tv = acc / total;
    if (tv > a && tv < b) pts.push(path[i + 1]!);
  }
  pts.push(pointAt(path, b));
  return pts;
}


export function toPoints(path: Pt[]) {
  return path.map((p) => `${p[0]},${p[1]}`).join(" ");
}

export function nextStation(line: MetroLine, t: number, dir: 1 | -1) {
  const ordered = line.stations
    .map((s) => ({ ...s, t: progressOfIndex(line.path, s.at) }))
    .sort((a, b) => a.t - b.t);
  if (dir === 1) return ordered.find((s) => s.t > t) ?? ordered[ordered.length - 1]!;
  return [...ordered].reverse().find((s) => s.t < t) ?? ordered[0]!;
}
