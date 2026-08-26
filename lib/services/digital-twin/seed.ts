import { makeTrack } from "./network.service";
import type { RailwayNetwork, Track, Vec2 } from "./types";

/**
 * Simplified schematic demo network: 5 coloured lines, 3 trains.
 * Designed so a line disruption produces one clear, followable
 * diversion story (e.g. Red Express diverted via Yellow to Green).
 * All geometry is octilinear; nothing here is hardcoded elsewhere.
 */

export const LINE_COLORS = {
  red: "#dc2626",
  yellow: "#eab308",
  blue: "#2563eb",
  green: "#16a34a",
  orange: "#ea580c",
} as const;

const RED_LINE: Vec2[] = [
  { x: 140, y: 200 },
  { x: 1460, y: 200 },
];

const YELLOW_LINE: Vec2[] = [
  { x: 700, y: 90 },
  { x: 700, y: 880 },
];

const BLUE_LINE: Vec2[] = [
  { x: 140, y: 560 },
  { x: 560, y: 560 },
  { x: 700, y: 420 },
  { x: 920, y: 200 },
  { x: 1000, y: 120 },
  { x: 1240, y: 360 },
  { x: 1440, y: 360 },
];

const GREEN_LINE: Vec2[] = [
  { x: 220, y: 750 },
  { x: 1180, y: 750 },
];

const ORANGE_LINE: Vec2[] = [
  { x: 240, y: 80 },
  { x: 360, y: 200 },
  { x: 560, y: 400 },
  { x: 700, y: 540 },
  { x: 820, y: 660 },
  { x: 820, y: 900 },
];

interface StationSeed {
  id: string;
  name: string;
  x: number;
  y: number;
  platforms: number;
}

const STATIONS: StationSeed[] = [
  { id: "stn_shastri", name: "Shastri Nagar", x: 260, y: 200, platforms: 2 },
  { id: "stn_ashok_v", name: "Ashok Vihar", x: 360, y: 200, platforms: 2 },
  { id: "stn_inderlok", name: "Inderlok", x: 480, y: 200, platforms: 2 },
  { id: "stn_sarai", name: "Sarai Rohilla", x: 700, y: 200, platforms: 4 },
  { id: "stn_newdelhi", name: "New Delhi", x: 920, y: 200, platforms: 6 },
  { id: "stn_seelampur", name: "Seelampur", x: 1140, y: 200, platforms: 2 },
  { id: "stn_shahdara", name: "Shahdara", x: 1360, y: 200, platforms: 2 },
  { id: "stn_jahangirpuri", name: "Jahangirpuri", x: 700, y: 90, platforms: 2 },
  { id: "stn_chandni", name: "Chandni Chowk", x: 700, y: 320, platforms: 2 },
  { id: "stn_rajiv", name: "Rajiv Chowk", x: 700, y: 420, platforms: 6 },
  { id: "stn_central", name: "Central Sec.", x: 700, y: 540, platforms: 4 },
  { id: "stn_saket", name: "Saket", x: 700, y: 750, platforms: 4 },
  { id: "stn_chhatarpur", name: "Chhatarpur", x: 700, y: 880, platforms: 2 },
  { id: "stn_nangloi", name: "Nangloi", x: 140, y: 560, platforms: 2 },
  { id: "stn_kirti", name: "Kirti Nagar", x: 360, y: 560, platforms: 2 },
  { id: "stn_ashok", name: "Ashok Park", x: 560, y: 560, platforms: 2 },
  { id: "stn_indra", name: "Indraprastha", x: 1120, y: 240, platforms: 2 },
  { id: "stn_akshardham", name: "Akshardham", x: 1240, y: 360, platforms: 2 },
  { id: "stn_mayur", name: "Mayur Vihar", x: 1360, y: 360, platforms: 2 },
  { id: "stn_noida", name: "Noida City", x: 1440, y: 360, platforms: 1 },
  { id: "stn_mundka", name: "Mundka", x: 220, y: 750, platforms: 2 },
  { id: "stn_punjabi", name: "Punjabi Bagh", x: 460, y: 750, platforms: 2 },
  { id: "stn_kalkaji", name: "Kalkaji", x: 940, y: 750, platforms: 2 },
  { id: "stn_okhla", name: "Okhla", x: 1180, y: 750, platforms: 2 },
  { id: "stn_rohini_w", name: "Rohini West", x: 240, y: 80, platforms: 2 },
  { id: "stn_patel", name: "Patel Nagar", x: 560, y: 400, platforms: 2 },
  { id: "stn_tughlak", name: "Tughlakabad", x: 820, y: 750, platforms: 3 },
  { id: "stn_faridabad", name: "Faridabad", x: 820, y: 900, platforms: 2 },
];

function spacedPoles(track: Track, everyM: number) {
  const poles: { trackId: string; positionM: number }[] = [];
  for (let m = everyM / 2; m < track.lengthM; m += everyM) {
    poles.push({ trackId: track.id, positionM: Math.round(m) });
  }
  return poles;
}

export function buildDemoNetwork(): RailwayNetwork {
  const red = makeTrack("trk_red", "Red Line", "up", RED_LINE, LINE_COLORS.red);
  const yellow = makeTrack("trk_yellow", "Yellow Line", "up", YELLOW_LINE, LINE_COLORS.yellow);
  const blue = makeTrack("trk_blue", "Blue Line", "down", BLUE_LINE, LINE_COLORS.blue);
  const green = makeTrack("trk_green", "Green Line", "down", GREEN_LINE, LINE_COLORS.green);
  const orange = makeTrack("trk_orange", "Orange Line", "siding", ORANGE_LINE, LINE_COLORS.orange);

  const signals = [
    { id: "sig_r1", trackId: red.id, positionM: 300, aspect: "GREEN" as const },
    { id: "sig_r2", trackId: red.id, positionM: 760, aspect: "YELLOW" as const },
    { id: "sig_r3", trackId: red.id, positionM: 1100, aspect: "GREEN" as const },
    { id: "sig_y1", trackId: yellow.id, positionM: 250, aspect: "GREEN" as const },
    { id: "sig_y2", trackId: yellow.id, positionM: 620, aspect: "YELLOW" as const },
    { id: "sig_y3", trackId: yellow.id, positionM: 800, aspect: "GREEN" as const },
    { id: "sig_b1", trackId: blue.id, positionM: 400, aspect: "GREEN" as const },
    { id: "sig_b2", trackId: blue.id, positionM: 900, aspect: "YELLOW" as const },
    { id: "sig_g1", trackId: green.id, positionM: 350, aspect: "YELLOW" as const },
    { id: "sig_g2", trackId: green.id, positionM: 750, aspect: "GREEN" as const },
    { id: "sig_o1", trackId: orange.id, positionM: 500, aspect: "GREEN" as const },
  ];

  const crossings = [
    { id: "lc_1", trackId: red.id, positionM: 900 },
    { id: "lc_2", trackId: green.id, positionM: 550 },
    { id: "lc_3", trackId: orange.id, positionM: 500 },
  ].map((c, i) => ({ ...c, name: `Level Crossing ${i + 1}` }));

  const poleSeeds = [
    ...spacedPoles(red, 220),
    ...spacedPoles(yellow, 220),
    ...spacedPoles(blue, 260),
  ];

  return {
    id: "net_demo",
    name: "Demo Network",
    tracks: Object.fromEntries(
      [red, yellow, blue, green, orange].map((t) => [t.id, t])
    ),
    stations: Object.fromEntries(
      STATIONS.map(({ id, name, x, y, platforms }) => [
        id,
        { id, name, position: { x, y }, platforms },
      ])
    ),
    signals: Object.fromEntries(signals.map((s, i) => [s.id, { ...s, name: `SIG ${i + 1}` }])),
    poles: Object.fromEntries(
      poleSeeds.map((p, i) => [
        `pole_${i}`,
        { id: `pole_${i}`, name: `OHE ${i + 1}`, trackId: p.trackId, positionM: p.positionM },
      ])
    ),
    crossings: Object.fromEntries(
      crossings.map((c) => [c.id, { ...c, id: c.id, name: c.name }])
    ),
    trains: {
      trn_red_exp: {
        id: "trn_red_exp",
        name: "Red Express",
        kind: "EXPRESS",
        status: "RUNNING",
        trackId: red.id,
        positionM: 200,
        direction: 1,
        speedKmph: 140,
        color: "#8b5cf6",
        destinationStationId: "stn_noida",
        route: [],
        originalRoute: [],
      },
      trn_yel_loc: {
        id: "trn_yel_loc",
        name: "Yellow Local",
        kind: "PASSENGER",
        status: "RUNNING",
        trackId: yellow.id,
        positionM: 120,
        direction: 1,
        speedKmph: 110,
        color: "#06b6d4",
        destinationStationId: "stn_chhatarpur",
        route: [],
        originalRoute: [],
      },
      trn_grn_loc: {
        id: "trn_grn_loc",
        name: "Green Local",
        kind: "PASSENGER",
        status: "RUNNING",
        trackId: green.id,
        positionM: 500,
        direction: 1,
        speedKmph: 100,
        color: "#ec4899",
        destinationStationId: "stn_mundka",
        route: [],
        originalRoute: [],
      },
    },
  };
}
