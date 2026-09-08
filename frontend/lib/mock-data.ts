import type { BlockRecord, ConflictRecord, AnalyticsMetric, Station, TrainPath } from "./types";

const TODAY_BASE = new Date().toISOString().split("T")[0]; // e.g. "2026-09-09"

export const mockBlocks: BlockRecord[] = [
  {
    id: "BLK-4521",
    department: "Engg",
    category: "IMR",
    description: "Rail fracture repair",
    location: { kmStart: 244, kmEnd: 248, line: "UP" },
    scheduledWindow: { start: `${TODAY_BASE}T14:00:00Z`, end: `${TODAY_BASE}T16:00:00Z` },
    urgency: { timeToBreachHours: 18, tier: "critical" }, // < 24h
    status: "Under review",
    source: { system: "TMS", lastUpdated: "2m ago" },
    conflict: { conflictId: "CONF-001", severity: "high", status: "Unresolved" },
    aiSuggestion: {
      confidence: 82,
      confidenceBasis: "resolves the fracture within SLA without delaying passenger trains",
      topFactors: [
        "No passenger trains in window",
        "TRD OHE inspection bundled (saves 45m)",
        "Freight rake FRT-4422 can be held at loop"
      ],
      recommendedAction: "Approve as proposed"
    },
    auditTrail: [
      { actor: "R. Sharma", role: "JE/PWay", timestamp: `${TODAY_BASE}T10:15:00Z`, action: "Acknowledged", agreedWithAI: null }
    ]
  },
  {
    id: "BLK-4520",
    department: "S&T",
    category: "PM",
    description: "Track circuit relay replacement",
    location: { kmStart: 250, kmEnd: 252, line: "DN" },
    scheduledWindow: { start: `${TODAY_BASE}T10:00:00Z`, end: `${TODAY_BASE}T12:30:00Z` },
    urgency: { timeToBreachHours: 336, tier: "routine" }, // 14 days
    status: "Submitted",
    source: { system: "TDMS", lastUpdated: "8m ago" },
    conflict: null,
    aiSuggestion: null,
    auditTrail: []
  },
  {
    id: "BLK-4519",
    department: "TRD",
    category: "OBS",
    description: "OHE mast foundation inspection",
    location: { kmStart: 238, kmEnd: 241, line: "UP" },
    scheduledWindow: { start: `${TODAY_BASE}T11:00:00Z`, end: `${TODAY_BASE}T13:00:00Z` },
    urgency: { timeToBreachHours: null, tier: "routine" },
    status: "Approved",
    source: { system: "SMMS", lastUpdated: "1h ago" },
    conflict: null,
    aiSuggestion: null,
    auditTrail: [
      { actor: "S. Mehta", role: "SSE/TRD", timestamp: `${TODAY_BASE}T09:00:00Z`, action: "Approved", agreedWithAI: null }
    ]
  },
  {
    id: "BLK-4518",
    department: "Engg",
    category: "IMR",
    description: "OHE dropper repair (power block required)",
    location: { kmStart: 239.2, kmEnd: 239.2, line: "UP" },
    scheduledWindow: { start: `${TODAY_BASE}T08:00:00Z`, end: `${TODAY_BASE}T09:30:00Z` },
    urgency: { timeToBreachHours: 2, tier: "critical" },
    status: "Active",
    source: { system: "SMMS", lastUpdated: "5m ago" },
    conflict: null,
    aiSuggestion: null,
    auditTrail: [
      { actor: "A. Kumar", role: "AEN", timestamp: `${TODAY_BASE}T07:45:00Z`, action: "Approved", agreedWithAI: null }
    ]
  },
  {
    id: "BLK-4517",
    department: "Engg",
    category: "OBS",
    description: "Ballast deficiency rectification at LC approach",
    location: { kmStart: 241.5, kmEnd: 241.5, line: "DN" },
    scheduledWindow: { start: `${TODAY_BASE}T14:00:00Z`, end: `${TODAY_BASE}T16:00:00Z` },
    urgency: { timeToBreachHours: 48, tier: "warning" },
    status: "Under review",
    source: { system: "TMS", lastUpdated: "1h ago" },
    conflict: { conflictId: "CONF-002", severity: "medium", status: "Unresolved" },
    aiSuggestion: {
      confidence: 79,
      confidenceBasis: "shifts block to avoid overlapping with TRD maintenance",
      topFactors: ["Shared km point with TRD block", "Can be sequenced safely"],
      recommendedAction: "Shift start by 2 hrs"
    },
    auditTrail: []
  },
  {
    id: "BLK-4523",
    department: "TRD",
    category: "OBS",
    description: "OHE mast inspection",
    location: { kmStart: 238, kmEnd: 241, line: "UP" },
    scheduledWindow: { start: `${TODAY_BASE}T14:30:00Z`, end: `${TODAY_BASE}T16:30:00Z` },
    urgency: { timeToBreachHours: 120, tier: "caution" },
    status: "Under review",
    source: { system: "SMMS", lastUpdated: "2h ago" },
    conflict: { conflictId: "CONF-002", severity: "medium", status: "Unresolved" },
    aiSuggestion: null,
    auditTrail: []
  }
];

export const mockConflicts: ConflictRecord[] = [
  {
    id: "CONF-001",
    blockAId: "BLK-4521",
    blockBId: "BLK-4520", // Note: mock data artificially creates overlap for UI testing
    overlapDescription: "Km 248-250 (adjacent, corridor constraint)",
    status: "Unresolved",
    windowStart: `${TODAY_BASE}T10:00:00Z`
  },
  {
    id: "CONF-002",
    blockAId: "BLK-4517",
    blockBId: "BLK-4523",
    overlapDescription: "Km 241 (shared point, overlapping time window)",
    status: "Unresolved",
    windowStart: `${TODAY_BASE}T14:00:00Z`
  },
  {
    id: "CONF-003",
    blockAId: "BLK-4518",
    blockBId: "BLK-4519",
    overlapDescription: "Km 239-241 (shared section)",
    status: "Resolved",
    windowStart: `${TODAY_BASE}T08:00:00Z`,
    resolution: { action: "Merged", actor: "S. Mehta", timestamp: `${TODAY_BASE}T07:30:00Z` }
  }
];

export const mockMetrics: AnalyticsMetric[] = [
  {
    name: "Shadow block utilization",
    currentValue: 42,
    baselineValue: 28,
    unit: "%",
    goodDirection: "up",
    weeklySeries: [
      { weekLabel: "W1", value: 25 },
      { weekLabel: "W2", value: 30 },
      { weekLabel: "W3", value: 35 },
      { weekLabel: "W4", value: 42 }
    ],
    dateRangeCurrent: { start: "01 Aug 2026", end: "31 Aug 2026" },
    dateRangeBaseline: { start: "01 Jul 2026", end: "31 Jul 2026" },
    sampleSizeCurrent: 450,
    sampleSizeBaseline: 420
  },
  {
    name: "Average block downtime",
    currentValue: 2.1,
    baselineValue: 3.4,
    unit: "hrs",
    goodDirection: "down",
    weeklySeries: [
      { weekLabel: "W1", value: 3.2 },
      { weekLabel: "W2", value: 2.8 },
      { weekLabel: "W3", value: 2.5 },
      { weekLabel: "W4", value: 2.1 }
    ],
    dateRangeCurrent: { start: "01 Aug 2026", end: "31 Aug 2026" },
    dateRangeBaseline: { start: "01 Jul 2026", end: "31 Jul 2026" },
    sampleSizeCurrent: 450,
    sampleSizeBaseline: 420
  },
  {
    name: "Cross-dept conflict rate",
    currentValue: 8,
    baselineValue: 34,
    unit: "%",
    goodDirection: "down",
    weeklySeries: [
      { weekLabel: "W1", value: 30 },
      { weekLabel: "W2", value: 22 },
      { weekLabel: "W3", value: 15 },
      { weekLabel: "W4", value: 8 }
    ],
    dateRangeCurrent: { start: "01 Aug 2026", end: "31 Aug 2026" },
    dateRangeBaseline: { start: "01 Jul 2026", end: "31 Jul 2026" },
    sampleSizeCurrent: 450,
    sampleSizeBaseline: 420
  }
];

export const mockStations: Station[] = [
  { id: "umb", name: "Ambala Cantt", km: 238, lines: ["UP", "DN"] },
  { id: "srs", name: "Sarsehri", km: 241, lines: ["UP", "DN", "Loop"] },
  { id: "nrg", name: "Naraingarh", km: 244, lines: ["UP", "DN", "Loop"] },
  { id: "bra", name: "Barara", km: 248, lines: ["UP", "DN"] },
  { id: "sre", name: "Saharanpur", km: 252, lines: ["UP", "DN", "Loop"] },
];

export const mockTrainPaths: TrainPath[] = [
  {
    id: "12005", name: "Kalka Shatabdi", type: "Passenger",
    stops: [
      { stationId: "umb", km: 238, time: 6 * 3600000 },
      { stationId: "srs", km: 241, time: 6.12 * 3600000 },
      { stationId: "nrg", km: 244, time: 6.22 * 3600000 },
      { stationId: "bra", km: 248, time: 6.38 * 3600000 },
      { stationId: "sre", km: 252, time: 6.55 * 3600000 },
    ],
  },
  {
    id: "FRT-4422", name: "BOXN Rake", type: "Freight",
    stops: [
      { stationId: "srs", km: 241, time: 14.5 * 3600000 },
      { stationId: "nrg", km: 244, time: 14.75 * 3600000 },
      { stationId: "bra", km: 248, time: 15.25 * 3600000 },
      { stationId: "sre", km: 252, time: 15.6 * 3600000 },
    ],
  }
];
