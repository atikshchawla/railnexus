import type {
  BacklogItem,
  BlockRequest,
  AiSuggestion,
  Conflict,
  TrainPath,
  TimelineBlock,
} from "./types";

/**
 * All mock data uses the corrected data model:
 * - Category (IMR/OBS/PM) — from source system
 * - Urgency — AI-computed, separate field
 * - Status — workflow state, separate field
 * - Provenance — source system + sync time
 */

// ─── Maintenance backlog (auto-populated from TMS/SMMS/TDMS) ─────────

export const mockBacklog: BacklogItem[] = [
  {
    id: "DEF-4521",
    category: "IMR",
    urgency: { score: 95, deadline: "2 days to SLA breach", level: "critical" },
    status: "Under review",
    department: "Engg",
    description: "Rail fracture detected at Km 245/3 — urgent repair required",
    location: "Km 245/3, UP",
    provenance: { system: "TMS", lastSynced: "2m ago" },
    hasConflict: true,
    conflictWith: "BLK-4520 (S&T)",
  },
  {
    id: "DEF-4520",
    category: "OBS",
    urgency: { score: 45, deadline: "Routine patrol finding", level: "medium" },
    status: "Submitted",
    department: "Engg",
    description: "Weld defect observed during routine patrol",
    location: "Km 248/1, UP",
    provenance: { system: "TMS", lastSynced: "15m ago" },
    hasConflict: false,
  },
  {
    id: "DEF-4519",
    category: "PM",
    urgency: { score: 60, deadline: "14 days to predicted failure", level: "high" },
    status: "Submitted",
    department: "S&T",
    description: "Track circuit relay degradation — RUL prediction: 14 days",
    location: "Km 252/7, DN",
    provenance: { system: "TDMS", lastSynced: "8m ago" },
    hasConflict: false,
  },
  {
    id: "DEF-4518",
    category: "IMR",
    urgency: { score: 92, deadline: "1 day to SLA breach", level: "critical" },
    status: "Approved",
    department: "TRD",
    description: "OHE dropper snapped — power block needed",
    location: "Km 239/2, UP",
    provenance: { system: "SMMS", lastSynced: "5m ago" },
    hasConflict: false,
  },
  {
    id: "DEF-4517",
    category: "OBS",
    urgency: { score: 35, deadline: "7 days remaining", level: "medium" },
    status: "Draft",
    department: "Engg",
    description: "Ballast deficiency at level crossing approach",
    location: "Km 241/5, DN",
    provenance: { system: "TMS", lastSynced: "1h ago" },
    hasConflict: false,
  },
  {
    id: "DEF-4516",
    category: "PM",
    urgency: { score: 40, deadline: "21 days to predicted failure", level: "low" },
    status: "Submitted",
    department: "S&T",
    description: "Signal relay response time increasing — predicted failure in 21 days",
    location: "Km 250/0, DN",
    provenance: { system: "TDMS", lastSynced: "12m ago" },
    hasConflict: false,
  },
  {
    id: "DEF-4515",
    category: "OBS",
    urgency: { score: 50, deadline: "5 days remaining", level: "medium" },
    status: "Submitted",
    department: "TRD",
    description: "OHE mast foundation showing minor cracks",
    location: "Km 238/4, UP",
    provenance: { system: "SMMS", lastSynced: "30m ago" },
    hasConflict: true,
    conflictWith: "BLK-4523 (Engg)",
  },
  {
    id: "DEF-4514",
    category: "IMR",
    urgency: { score: 88, deadline: "3 days to SLA breach", level: "critical" },
    status: "Under review",
    department: "Engg",
    description: "Point machine malfunction at Km 243 junction",
    location: "Km 243/0, UP/DN",
    provenance: { system: "TMS", lastSynced: "1m ago" },
    hasConflict: false,
  },
];

// ─── Block requests (for approvals) ──────────────────────────────────

export const mockBlockRequests: BlockRequest[] = [
  {
    id: "BLK-4521",
    category: "IMR",
    urgency: { score: 95, deadline: "2 days to SLA breach", level: "critical" },
    status: "Under review",
    department: "Engg",
    description: "Rail fracture repair at Km 245/3",
    section: "Km 244–248, UP",
    scheduledDate: "05 Sep 2026",
    scheduledTime: "14:00–16:00",
    duration: "2h 00m",
    confidence: 82,
    shadow: "TRD OHE inspection",
    trainsAffected: { passenger: 0, freight: 1 },
    hasConflict: true,
    conflictWith: "BLK-4520 (S&T, same window)",
    provenance: { system: "TMS", lastSynced: "2m ago" },
  },
  {
    id: "BLK-4520",
    category: "PM",
    urgency: { score: 60, deadline: "14 days to predicted failure", level: "high" },
    status: "Under review",
    department: "S&T",
    description: "Track circuit relay replacement (predicted failure)",
    section: "Km 250–252, DN",
    scheduledDate: "06 Sep 2026",
    scheduledTime: "10:00–12:30",
    duration: "2h 30m",
    confidence: 74,
    shadow: null,
    trainsAffected: { passenger: 1, freight: 1 },
    hasConflict: false,
    provenance: { system: "TDMS", lastSynced: "8m ago" },
  },
  {
    id: "BLK-4519",
    category: "OBS",
    urgency: { score: 30, deadline: "Quarterly schedule", level: "low" },
    status: "Under review",
    department: "TRD",
    description: "OHE mast foundation inspection",
    section: "Km 238–241, UP",
    scheduledDate: "06 Sep 2026",
    scheduledTime: "11:00–13:00",
    duration: "2h 00m",
    confidence: 91,
    shadow: null,
    trainsAffected: { passenger: 0, freight: 0 },
    hasConflict: false,
    provenance: { system: "SMMS", lastSynced: "1h ago" },
  },
  {
    id: "BLK-4518",
    category: "IMR",
    urgency: { score: 92, deadline: "1 day to SLA breach", level: "critical" },
    status: "Approved",
    department: "Engg",
    description: "OHE dropper repair — power block required",
    section: "Km 239/2, UP",
    scheduledDate: "05 Sep 2026",
    scheduledTime: "08:00–09:30",
    duration: "1h 30m",
    confidence: 88,
    shadow: "S&T point machine lubrication",
    trainsAffected: { passenger: 0, freight: 1 },
    hasConflict: false,
    provenance: { system: "SMMS", lastSynced: "5m ago" },
  },
  {
    id: "BLK-4517",
    category: "OBS",
    urgency: { score: 35, deadline: "7 days remaining", level: "medium" },
    status: "Under review",
    department: "Engg",
    description: "Ballast deficiency rectification at LC approach",
    section: "Km 241/5, DN",
    scheduledDate: "07 Sep 2026",
    scheduledTime: "14:00–16:00",
    duration: "2h 00m",
    confidence: 79,
    shadow: null,
    trainsAffected: { passenger: 0, freight: 1 },
    hasConflict: true,
    conflictWith: "BLK-4523 (TRD, Km overlap)",
    provenance: { system: "TMS", lastSynced: "1h ago" },
  },
  {
    id: "BLK-4516",
    category: "PM",
    urgency: { score: 25, deadline: "Scheduled maintenance", level: "low" },
    status: "Under review",
    department: "S&T",
    description: "Signal lamp cleaning and replacement",
    section: "Km 243–246, UP/DN",
    scheduledDate: "08 Sep 2026",
    scheduledTime: "10:00–11:30",
    duration: "1h 30m",
    confidence: 95,
    shadow: null,
    trainsAffected: { passenger: 0, freight: 0 },
    hasConflict: false,
    provenance: { system: "TDMS", lastSynced: "20m ago" },
  },
];

// ─── AI suggestions ──────────────────────────────────────────────────

export const mockAiSuggestions: AiSuggestion[] = [
  {
    id: "BLK-4521",
    summary: "Proposes a 2-hour integrated block tomorrow 14:00–16:00 between Km 244–248 UP line, combining Engg rail repair with a shadow TRD OHE inspection.",
    constraints: [
      { label: "Passenger train path clear", met: true, detail: "No passenger trains in window" },
      { label: "Freight impact minimal", met: true, detail: "1 BOXN rake held 15 min at loop" },
      { label: "Shadow opportunity merged", met: true, detail: "TRD OHE inspection bundled, saving 45 min" },
      { label: "IMR SLA deadline met", met: true, detail: "2 days remaining, block within SLA" },
      { label: "Cross-department conflict resolved", met: false, detail: "S&T relay work at Km 250 not yet merged" },
    ],
    confidence: 82,
    section: "Km 244–248, UP line",
    scheduledTime: "Tomorrow, 14:00–16:00",
    department: "Engg",
    shadowDepts: ["TRD"],
    notifyDepts: ["TRD", "S&T"],
  },
  {
    id: "BLK-4518",
    summary: "Proposes 08:00–09:30 block at Km 239/2 for OHE dropper repair with shadow S&T point machine lubrication.",
    constraints: [
      { label: "Passenger train path clear", met: true },
      { label: "Freight impact minimal", met: true, detail: "1 container spl rerouted" },
      { label: "Shadow opportunity merged", met: true, detail: "S&T lubrication bundled" },
      { label: "IMR SLA deadline met", met: true, detail: "1 day remaining" },
      { label: "Cross-department conflict resolved", met: true },
    ],
    confidence: 88,
    section: "Km 239/2, UP line",
    scheduledTime: "Tomorrow, 08:00–09:30",
    department: "Engg",
    shadowDepts: ["S&T"],
    notifyDepts: ["S&T"],
  },
];

// ─── Conflicts ───────────────────────────────────────────────────────

export const mockConflicts: Conflict[] = [
  {
    id: "CONF-001",
    blockA: { id: "BLK-4521", department: "Engg", description: "Rail fracture repair", section: "Km 244–248, UP", time: "05 Sep, 14:00–16:00" },
    blockB: { id: "BLK-4520", department: "S&T", description: "Track circuit relay replacement", section: "Km 250–252, DN", time: "06 Sep, 10:00–12:30" },
    overlapKm: "Km 248–250 (adjacent, corridor constraint)",
    overlapTime: "Adjacent day, same corridor",
    resolved: false,
  },
  {
    id: "CONF-002",
    blockA: { id: "BLK-4517", department: "Engg", description: "Ballast deficiency rectification", section: "Km 241/5, DN", time: "07 Sep, 14:00–16:00" },
    blockB: { id: "BLK-4523", department: "TRD", description: "OHE mast inspection", section: "Km 238–241, UP", time: "06 Sep, 11:00–13:00" },
    overlapKm: "Km 241 (shared point)",
    overlapTime: "Adjacent time windows, same Km",
    resolved: false,
  },
  {
    id: "CONF-003",
    blockA: { id: "BLK-4518", department: "Engg", description: "OHE dropper repair", section: "Km 239/2, UP", time: "05 Sep, 08:00–09:30" },
    blockB: { id: "BLK-4519", department: "TRD", description: "OHE mast foundation inspection", section: "Km 238–241, UP", time: "06 Sep, 11:00–13:00" },
    overlapKm: "Km 239–241 (shared section)",
    overlapTime: "Consecutive day, can be merged",
    resolved: true,
  },
];

// ─── Train paths (passenger vs freight distinguished) ────────────────

export const mockTrainPaths: TrainPath[] = [
  { id: "12005", name: "Kalka Shatabdi", time: "06:00", km: [238, 252], type: "Superfast" },
  { id: "14095", name: "Himalayan Queen", time: "12:10", km: [238, 252], type: "Mail/Express" },
  { id: "22455", name: "Rajdhani Express", time: "16:15", km: [238, 252], type: "Rajdhani" },
  { id: "FRT-4421", name: "BCNA Rake", time: "09:30", km: [240, 248], type: "Freight" },
  { id: "FRT-4422", name: "BOXN Rake", time: "14:45", km: [239, 250], type: "Freight" },
  { id: "FRT-4423", name: "Container Spl", time: "21:00", km: [238, 252], type: "Freight" },
];

// ─── Timeline blocks (with row assignment to prevent overlap) ────────

export const mockTimelineBlocks: TimelineBlock[] = [
  { id: "BLK-4518", label: "Engg: OHE dropper repair", startHour: 8, endHour: 9.5, department: "Engg", row: 0 },
  { id: "BLK-4520", label: "S&T: Relay replacement", startHour: 10, endHour: 12.5, department: "S&T", row: 0 },
  { id: "BLK-4521", label: "Engg: Rail fracture repair", startHour: 14, endHour: 16, department: "Engg", row: 0 },
  { id: "BLK-SHADOW-1", label: "TRD: OHE inspection (shadow)", startHour: 14, endHour: 15.5, department: "TRD", row: 1 },
];
