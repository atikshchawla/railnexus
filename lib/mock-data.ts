export type Severity = "IMR" | "OBS";

export type Defect = {
  id: string;
  lineId: string;
  severity: Severity;
  type: string;
  km: string;
  section: string;
  detectedAt: string;
  minutesLeft: number;
  /** normalized position along the line path for the map pin */
  t: number;
};

export type TrainDot = {
  id: string;
  lineId: string;
  dir: 1 | -1;
  /** progress at t=0 */
  offset: number;
  /** progress per second */
  speed: number;
};

/** Mock train path occupancy for the target corridor (minutes from midnight). */
export type PathSlot = {
  id: string;
  service: string;
  from: number;
  to: number;
};

export const DEFECTS: Defect[] = [
  {
    id: "DF-2291",
    lineId: "yellow",
    severity: "IMR",
    type: "Rail fracture — weld zone",
    km: "KM 214/6",
    section: "Rajiv Chowk – INA (UP)",
    detectedAt: "11:42",
    minutesLeft: 138,
    t: 0.38,
  },
  {
    id: "DF-2288",
    lineId: "yellow",
    severity: "OBS",
    type: "Gauge widening",
    km: "KM 216/2",
    section: "INA – Hauz Khas",
    detectedAt: "10:05",
    minutesLeft: 610,
    t: 0.55,
  },
  {
    id: "DF-2286",
    lineId: "blue",
    severity: "IMR",
    type: "Loose fish plate",
    km: "KM 42/1",
    section: "Rajouri Garden – Rajiv Chowk",
    detectedAt: "09:51",
    minutesLeft: 92,
    t: 0.42,
  },
  {
    id: "DF-2280",
    lineId: "violet",
    severity: "OBS",
    type: "Ballast deficiency",
    km: "KM 08/4",
    section: "Lajpat Nagar – Badarpur",
    detectedAt: "08:20",
    minutesLeft: 480,
    t: 0.62,
  },
  {
    id: "DF-2274",
    lineId: "pink",
    severity: "OBS",
    type: "OHE dropper slack",
    km: "KM 61/0",
    section: "INA – Mayur Vihar",
    detectedAt: "07:58",
    minutesLeft: 320,
    t: 0.7,
  },
];

export const TRAINS: TrainDot[] = [
  { id: "RD-114", lineId: "red", dir: 1, offset: 0.1, speed: 0.012 },
  { id: "RD-207", lineId: "red", dir: -1, offset: 0.7, speed: 0.01 },
  { id: "YL-301", lineId: "yellow", dir: 1, offset: 0.05, speed: 0.014 },
  { id: "YL-318", lineId: "yellow", dir: -1, offset: 0.62, speed: 0.011 },
  { id: "YL-322", lineId: "yellow", dir: 1, offset: 0.4, speed: 0.013 },
  { id: "BL-408", lineId: "blue", dir: 1, offset: 0.2, speed: 0.012 },
  { id: "BL-433", lineId: "blue", dir: -1, offset: 0.8, speed: 0.015 },
  { id: "BL-451", lineId: "blue-branch", dir: 1, offset: 0.3, speed: 0.018 },
  { id: "GR-502", lineId: "green", dir: 1, offset: 0.5, speed: 0.02 },
  { id: "VL-611", lineId: "violet", dir: 1, offset: 0.15, speed: 0.011 },
  { id: "VL-627", lineId: "violet", dir: -1, offset: 0.75, speed: 0.012 },
  { id: "PK-703", lineId: "pink", dir: 1, offset: 0.25, speed: 0.009 },
  { id: "PK-742", lineId: "pink", dir: -1, offset: 0.66, speed: 0.008 },
  { id: "MG-806", lineId: "magenta", dir: 1, offset: 0.35, speed: 0.013 },
  { id: "GY-901", lineId: "grey", dir: 1, offset: 0.4, speed: 0.03 },
  { id: "AE-011", lineId: "airport", dir: 1, offset: 0.55, speed: 0.022 },
  { id: "AQ-120", lineId: "aqua", dir: -1, offset: 0.45, speed: 0.016 },
];

export const PATH_TABLE: PathSlot[] = [
  { id: "P-01", service: "Rajdhani Express 12951", from: 975, to: 1035 },
  { id: "P-02", service: "Suburban EMU 64012", from: 700, to: 730 },
  { id: "P-03", service: "Goods BOXN 5521 (held at loop)", from: 1050, to: 1110 },
  { id: "P-04", service: "Shatabdi 12002", from: 1065, to: 1095 },
];

export type Approval = {
  id: string;
  requester: string;
  section: string;
  window: string;
  confidence: number;
  shadowWork: string[];
  impact: string;
  status: "pending" | "approved" | "rejected";
};

export const APPROVALS: Approval[] = [
  {
    id: "BR-4471",
    requester: "SSE/P.Way/Rajiv Chowk",
    section: "Rajiv Chowk – INA (UP) · KM 214/6",
    window: "13:30 – 16:00",
    confidence: 82,
    shadowWork: ["TRD: OHE dropper replacement KM 214/8", "S&T: axle counter reset KM 215/1"],
    impact: "4 services rescheduled · 0 cancellations · max detention 12 min",
    status: "pending",
  },
  {
    id: "BR-4468",
    requester: "SSE/TRD/Yamuna Bank",
    section: "Yamuna Bank – Vaishali (DN) · KM 41/2",
    window: "23:10 – 03:40",
    confidence: 91,
    shadowWork: ["Engg: destressing KM 41/4"],
    impact: "Night block · 0 services affected",
    status: "pending",
  },
  {
    id: "BR-4465",
    requester: "SSE/P.Way/Badarpur",
    section: "Lajpat Nagar – Badarpur (UP) · KM 08/4",
    window: "14:00 – 15:15",
    confidence: 64,
    shadowWork: [],
    impact: "2 services rescheduled · 1 short-terminated",
    status: "pending",
  },
];

export const LINE_LABELS: Record<string, string> = {
  red: "Red",
  yellow: "Yellow",
  blue: "Blue",
  "blue-branch": "Blue Br.",
  green: "Green",
  violet: "Violet",
  pink: "Pink",
  magenta: "Magenta",
  grey: "Grey",
  airport: "Airport Exp.",
  aqua: "Aqua",
};

export function fmtTime(mins: number) {
  const h = Math.floor(mins / 60) % 24;
  const m = Math.floor(mins % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
