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

export interface MLPrediction {
  failureRiskProbability: number;
  priorityScore: number;
  urgencyLevel: string;
  predictedDurationMinutes: number;
  overrunProbability: number;
  trainsAffected: number;
  totalDelayMinutes: number;
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
  mlPrediction?: MLPrediction;
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
  status?: "scheduled" | "diverted";
  delayMinutes?: number;
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

// ─── Core Backend API Schemas (Phase 6 / 7 Integration) ───────────────

export interface MaintenanceCreatePayload {
  id?: string;
  asset_id?: string | null;
  section_id: string;
  department: string;
  work_type: string;
  location_km: number;
  priority?: string;
  safety_critical?: boolean;
  deadline_minutes?: number | null;
  model_features?: Record<string, unknown>;
  requires_power_isolation?: boolean;
  requires_disconnection?: boolean;
  earliest_start_minute?: number | null;
  latest_end_minute?: number | null;
}

export interface MaintenanceRequestRecord {
  id: string;
  asset_id: string | null;
  section_id: string;
  department: string;
  work_type: string;
  location_km: number;
  priority: string;
  safety_critical: boolean;
  deadline_minutes: number | null;
  model_features: Record<string, unknown>;
  status: string;
  created_at: string;
  source_system?: string | null;
  external_id?: string | null;
}

export interface ApprovalProposalRecord {
  id: string;
  run_id: string;
  section_id: string;
  lead_department?: string;
  departments: string[];
  maintenance_request_ids: string[];
  proposed_start_time: string;
  proposed_end_time: string;
  predicted_duration_minutes: number;
  possession_saving_minutes: number;
  train_impact_minutes: number;
  trains_affected_count: number;
  confidence_score: number;
  status: string;
  operational_block_id?: string | null;
  operational_block_status?: string | null;
  has_conflicts?: boolean;
  conflicts_count?: number;
  has_blocking_conflicts?: boolean;
  blocking_conflict_count?: number;
  top_factors_json?: Record<string, unknown>;
  safety_cautions?: unknown[];
  created_at: string;
}

export interface OperationalBlockRecord {
  id: string;
  section_id: string;
  track_line?: string;
  start_km?: number;
  end_km?: number;
  scheduled_start?: string;
  scheduled_end?: string;
  actual_start?: string | null;
  actual_end?: string | null;
  origin_proposal_id?: string | null;
  proposal_id?: string | null;
  run_id?: string | null;
  override_id?: string | null;
  lead_department: string;
  status: string;
  approved_by?: string | null;
  approved_at?: string | null;
  revision_number?: number;
  parent_block_id?: string | null;
  is_current: boolean;
  created_at: string;
  allocated_start_time?: string;
  allocated_end_time?: string;
  departments?: string[];
  maintenance_request_ids?: string[];
}

export interface ServerConflictRecord {
  id: string;
  run_id: string;
  proposal_id?: string | null;
  proposal_a_id?: string | null;
  proposal_b_id?: string | null;
  conflict_type: "TRAIN_CROSSING" | "SECTION_OCCUPATION" | "RESOURCE_COLLISION" | "POWER_INTERLOCK";
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  section_id?: string | null;
  window_start_time: string;
  window_end_time: string;
  overlap_duration_minutes: number;
  status: "UNRESOLVED" | "RESOLVED" | "ESCALATED";
  train_number?: string | null;
  train_direction?: string | null;
  description: string;
  resolution_details?: {
    action: string;
    resolved_by: string;
    resolved_at: string;
    reason: string;
    rescheduled_start_minute?: number | null;
    rescheduled_end_minute?: number | null;
  } | null;
  created_at: string;
}

export interface ConflictResolutionPayload {
  resolution_action: string;
  actor_id: string;
  actor_role: string;
  rationale_notes: string;
  resulting_block_id?: string | null;
}

export interface ProposalApprovePayload {
  block_id: string;
  approved_by: string;
  lead_department: string;
  start_km: number;
  end_km: number;
  track_line?: string;
  override_justification?: string | null;
  override_code?: string | null;
  operator_role?: string | null;
  custom_scheduled_start?: string | null;
  custom_scheduled_end?: string | null;
}

export interface ProposalRejectPayload {
  rejected_by: string;
  rejection_reason: string;
  operator_role?: string | null;
}

export interface ConflictDetectPayload {
  run_id: string;
  proposal_ids?: string[] | null;
  check_train_movements?: boolean;
}
