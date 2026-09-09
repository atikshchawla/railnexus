/**
 * Canonical Data Schema for RailNexus ABP
 * Do not invent parallel fields. Use exact types provided in the spec.
 */

export type Department = "Engg" | "TRD" | "S&T";
export type Category = "IMR" | "OBS" | "PM"; // Immediate Repair, Observation, Preventive Maintenance
export type UrgencyTier = "critical" | "warning" | "caution" | "routine";
export type BlockStatus = "Draft" | "Submitted" | "Under review" | "Approved" | "Active" | "Closed" | "Rejected";
export type SourceSystem = "TMS" | "SMMS" | "TDMS" | "Manual";

export interface Location {
  kmStart: number;
  kmEnd: number;
  line: "UP" | "DN" | "UP/DN";
}

export interface Urgency {
  timeToBreachHours: number | null; // null = no SLA/breach clock (e.g. routine PM)
  tier: UrgencyTier; // derived: <24h="critical", 24-72h="warning", 72-168h="caution", else/null="routine"
}

export interface AISuggestion {
  confidence: number;              // 0-100
  confidenceBasis: string;         // one sentence: what the % is a confidence IN (e.g. "resolves the corridor conflict without delaying scheduled trains")
  topFactors: string[];            // ordered, most influential first, 2-4 items
  recommendedAction: string;       // e.g. "Approve as proposed" / "Shift start by 30 min"
}

export interface ConflictRef {
  conflictId: string;   // "CONF-001"
  severity: "high" | "medium" | "low";
  status: "Unresolved" | "Resolved";
}

export interface AuditEntry {
  actor: string;              // display name
  role: string;               // e.g. "SSE/Ambala"
  timestamp: string;          // ISO 8601
  action: "Acknowledged" | "Approved" | "Rejected" | "Merged" | "Sequenced" | "Escalated" | "Promoted to proposal";
  agreedWithAI: boolean | null; // null if no AI suggestion was involved
  notes?: string;
}

export interface BlockRecord {
  id: string;                 // "BLK-4521"
  department: Department;
  category: Category;
  description: string;
  location: Location;
  scheduledWindow: { start: string; end: string }; // ISO 8601
  urgency: Urgency;
  status: BlockStatus;
  source: { system: SourceSystem; lastUpdated: string };
  conflict: ConflictRef | null;
  aiSuggestion: AISuggestion | null;
  evidence?: { photoUrls: string[]; fieldSurveyId?: string };
  auditTrail: AuditEntry[];
}

export interface ConflictRecord {
  id: string;                 // "CONF-001"
  blockAId: string;
  blockBId: string;
  overlapDescription: string; // "Km 248-250 (adjacent, corridor constraint)"
  status: "Unresolved" | "Resolved";
  windowStart: string;        // earliest of the two blocks' start times, for urgency ranking
  resolution?: { action: "Merged" | "Sequenced" | "Escalated"; actor: string; timestamp: string };
}

export interface AnalyticsMetric {
  name: string;
  currentValue: number;
  baselineValue: number;
  unit: "%" | "hrs" | "count";
  goodDirection: "up" | "down";   // defines what "improvement" means for this metric
  weeklySeries: { weekLabel: string; value: number }[]; // required, min 4 points
  dateRangeCurrent: { start: string; end: string };
  dateRangeBaseline: { start: string; end: string };
  sampleSizeCurrent: number;      // e.g. number of blocks/conflicts this metric is computed over
  sampleSizeBaseline: number;
}

// ─── Legacy Chart Types (Adapted for BlockPlanChart) ─────────────────
// These remain ONLY for the chart's internal rendering math.
// They are populated from BlockRecord.
export interface Station {
  id: string;
  name: string;
  km: number;
  lines: string[];
}

export interface TrainStop {
  stationId: string;
  km: number;
  time: number;
}

export interface TrainPath {
  id: string;
  name: string;
  type: "Passenger" | "Freight";
  stops: TrainStop[];
}

export interface ChartBlock {
  id: string;
  department: string;
  km_start: number;
  km_end: number;
  time_start: number; // relative to midnight in ms
  time_end: number;
  status: string;
  isShadow: boolean;
  label: string;
  priorityTier: any; // "P1-critical" | "P2-high" | "P3-medium" | "P4-low"
  [key: string]: any;
}

export interface DerivedConflict {
  id: string;
  trainId?: string;
  blockId: string;
  intersectionTime: number; // ms since midnight
  intersectionKm: number;
  overlapMinutes: number;
  [key: string]: any;
}
