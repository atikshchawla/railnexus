import type {
  AISuggestion,
  ApprovalProposalRecord,
  BlockRecord,
  BlockStatus,
  ConflictDetectPayload,
  ConflictRecord,
  ConflictResolutionPayload,
  Department,
  MaintenanceCreatePayload,
  MaintenanceRequestRecord,
  OperationalBlockRecord,
  ProposalApprovePayload,
  ProposalRejectPayload,
  ServerConflictRecord,
  Station,
  TrainPath,
} from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

export type MaintenanceResponse = MaintenanceRequestRecord;

export type PredictionResponse = {
  maintenance_request_id: string;
  failure_risk_probability: number;
  priority_score: number;
  urgency_level: string;
  predicted_duration_minutes: number;
  overrun_probability: number;
  trains_affected: number;
  total_delay_minutes: number;
  created_at: string;
};

export type TopologyResponse = {
  section_id: string;
  start_station: string;
  end_station: string;
  start_km: number;
  end_km: number;
  distance_km: number;
  mps_kmh?: number;
  department?: string;
};

export type TrainResponse = {
  id: string;
  train_number: string;
  service_type: string;
  origin: string | null;
  destination: string | null;
  active: boolean;
};

export type MovementResponse = {
  train_id: string;
  section_id: string;
  scheduled_minute: number;
  delay_minutes: number;
};

export interface OptimizedBlockResponse {
  request_ids: string[];
  section_id: string;
  predicted_duration_minutes: number;
  possession_saving_minutes: number;
  train_impact_minutes: number;
  corridor_id: string | null;
  scheduled_start_minute: number | null;
  scheduled_end_minute: number | null;
  priority_score: number;
  urgency_level: string;
  explanation: string[];
}

export interface OptimizerResponse {
  selected_blocks: OptimizedBlockResponse[];
  ungrouped_request_ids: string[];
  totals: Record<string, number | string>;
  model_outputs: Record<string, Record<string, number | string>>;
  skipped_request_ids?: string[];
  // Cache metadata — present when result is served from DB cache
  _cache_id?: string;
  _run_id?: string;
  _operator_overrides?: Record<string, OperatorOverride>;
}

export interface OperatorOverride {
  start_minute?: number;
  end_minute?: number;
  dissolved?: boolean; // user broke the group apart
  notes?: string;
}

export interface DashboardData {
  blocks: BlockRecord[];
  conflicts: ConflictRecord[];
  serverConflicts: ServerConflictRecord[];
  proposals: ApprovalProposalRecord[];
  operationalBlocks: OperationalBlockRecord[];
  trains: TrainPath[];
  stations: Station[];
  topology: TopologyResponse[];
  movements?: MovementResponse[];
  rawTrains?: TrainResponse[];
  syncedAt: string;
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { cache: "no-store" });
  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`RailNexus API returned ${response.status} for ${path}: ${errorText || response.statusText}`);
  }
  return response.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    let errorDetail = errorText;
    try {
      const parsed = JSON.parse(errorText);
      if (parsed.detail) errorDetail = typeof parsed.detail === "string" ? parsed.detail : JSON.stringify(parsed.detail);
    } catch {
      // use raw text
    }
    throw new Error(errorDetail || `RailNexus API returned ${response.status} for ${path}`);
  }
  return response.json() as Promise<T>;
}

function department(value: string): Department {
  const normalized = (value || "").toUpperCase();
  if (normalized === "TRD" || normalized === "TRACTION") return "TRD";
  if (normalized === "S&T" || normalized === "SNT" || normalized === "SIGNAL") return "S&T";
  return "Engg";
}

function status(value: string): BlockStatus {
  const normalized = (value || "").toLowerCase();
  const statuses: Record<string, BlockStatus> = {
    pending: "Submitted",
    submitted: "Submitted",
    validated: "Under review",
    proposed: "Under review",
    approved: "Approved",
    scheduled: "Approved",
    active: "Active",
    in_progress: "Active",
    completed: "Closed",
    closed: "Closed",
    cancelled: "Rejected",
    rejected: "Rejected",
    deferred: "Draft",
  };
  return statuses[normalized] ?? "Under review";
}

function urgency(level: string): BlockRecord["urgency"]["tier"] {
  if (level === "critical") return "critical";
  if (level === "high" || level === "warning") return "warning";
  if (level === "medium" || level === "caution") return "caution";
  return "routine";
}

function minutesToIso(minutes: number | undefined, base: string): string {
  const date = new Date(base);
  if (isNaN(date.getTime())) {
    const now = new Date();
    if (minutes !== undefined) now.setHours(0, minutes, 0, 0);
    return now.toISOString();
  }
  if (minutes !== undefined) {
    date.setHours(0, minutes, 0, 0);
  }
  return date.toISOString();
}

function toBlock(
  request: MaintenanceResponse,
  prediction: PredictionResponse | undefined,
  topology: TopologyResponse | undefined,
): BlockRecord {
  const metadata = request.model_features ?? {};
  const startMinute = typeof metadata.earliest_start_minute === "number" ? metadata.earliest_start_minute : undefined;
  const duration = prediction?.predicted_duration_minutes ?? Number(metadata.planned_duration_minutes ?? 60);
  const start = minutesToIso(startMinute, request.created_at);
  const end = minutesToIso((startMinute ?? 0) + duration, request.created_at);
  const suggestion: AISuggestion | null = prediction
    ? {
        confidence: Math.round(Math.max(0, Math.min(1, 1 - (prediction.overrun_probability || 0))) * 100),
        confidenceBasis: `predicted ${Math.round(prediction.predicted_duration_minutes)} min possession with ${Math.round(prediction.trains_affected)} trains affected`,
        topFactors: [
          `Failure risk ${((prediction.failure_risk_probability || 0) * 100).toFixed(1)}%`,
          `Overrun risk ${((prediction.overrun_probability || 0) * 100).toFixed(1)}%`,
          `${(prediction.total_delay_minutes || 0).toFixed(1)} min predicted delay`,
        ],
        recommendedAction: prediction.urgency_level === "critical" ? "Prioritize for controller review" : "Approve as proposed",
      }
    : null;

  return {
    id: request.id,
    department: department(request.department),
    category: (request.work_type || "").toUpperCase().includes("PM")
      ? "PM"
      : (request.work_type || "").toUpperCase().includes("OBS")
      ? "OBS"
      : "IMR",
    description: topology
      ? `${request.work_type} on ${topology.start_station} - ${topology.end_station}`
      : request.work_type || "Maintenance Block",
    location: {
      kmStart: request.location_km,
      kmEnd: request.location_km,
      line: (metadata.line === "DN" ? "DN" : metadata.line === "UP/DN" ? "UP/DN" : "UP"),
      section: request.section_id,
    },
    work_type: request.work_type,
    scheduledWindow: { start, end },
    urgency: {
      timeToBreachHours: request.deadline_minutes === null ? null : request.deadline_minutes / 60,
      tier: urgency(prediction?.urgency_level ?? "low"),
    },
    status: status(request.status),
    source: {
      system: (request.source_system as any) ?? "TMS",
      lastUpdated: new Date(request.created_at).toLocaleString(),
    },
    conflict: null,
    aiSuggestion: suggestion,
    mlPrediction: prediction
      ? {
          failureRiskProbability: prediction.failure_risk_probability,
          priorityScore: prediction.priority_score,
          urgencyLevel: prediction.urgency_level,
          predictedDurationMinutes: prediction.predicted_duration_minutes,
          overrunProbability: prediction.overrun_probability,
          trainsAffected: prediction.trains_affected,
          totalDelayMinutes: prediction.total_delay_minutes,
          severityScore: (prediction as any).severity_score ?? prediction.priority_score,
        }
      : undefined,
    features: metadata,
    demandedDurationMinutes: request.demanded_duration_minutes,
    safetyCritical: request.safety_critical,
    rawRequest: request,
    auditTrail: [],
  };
}

// ─── Maintenance Endpoints ───────────────────────────────────────────

export async function listMaintenance(statusFilter?: string): Promise<MaintenanceRequestRecord[]> {
  const query = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";
  return get<MaintenanceRequestRecord[]>(`/maintenance${query}`);
}

export async function createMaintenance(payload: MaintenanceCreatePayload): Promise<MaintenanceRequestRecord> {
  return post<MaintenanceRequestRecord>("/maintenance", payload);
}

export async function predictMaintenance(requestId: string): Promise<PredictionResponse> {
  return post<PredictionResponse>(`/maintenance/${encodeURIComponent(requestId)}/predict`, {});
}

export async function listPredictions(): Promise<PredictionResponse[]> {
  return get<PredictionResponse[]>("/predictions");
}

// ─── Optimization Endpoints ──────────────────────────────────────────

export async function optimizeRequests(
  requestIds: string[],
  forceRerun = false,
  options?: { maxGroupSize?: number; maxSpatialGapKm?: number; weights?: Record<string, number> },
): Promise<OptimizerResponse> {
  return post<OptimizerResponse>("/optimizer/optimize", {
    request_ids: requestIds,
    force_rerun: forceRerun,
    max_group_size: options?.maxGroupSize ?? 4,
    max_spatial_gap_km: options?.maxSpatialGapKm ?? 10.0,
    weights: options?.weights ?? {},
  });
}

export async function saveOptimizerOverrides(
  cacheId: string,
  overrides: Record<string, OperatorOverride>,
): Promise<void> {
  await post<{ ok: boolean }>(`/optimizer/overrides/${encodeURIComponent(cacheId)}`, overrides);
}

// ─── Approval Endpoints (Phase 6C Authoritative) ──────────────────────

export async function listApprovals(params?: {
  section_id?: string;
  status?: string;
  run_id?: string;
  limit?: number;
}): Promise<ApprovalProposalRecord[]> {
  const query = new URLSearchParams();
  if (params?.section_id) query.set("section_id", params.section_id);
  if (params?.status) query.set("status", params.status);
  if (params?.run_id) query.set("run_id", params.run_id);
  if (params?.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return get<ApprovalProposalRecord[]>(`/approvals${qs ? `?${qs}` : ""}`);
}

export async function getApproval(proposalId: string): Promise<ApprovalProposalRecord> {
  return get<ApprovalProposalRecord>(`/approvals/${encodeURIComponent(proposalId)}`);
}

export async function approveProposal(
  proposalId: string,
  payload: ProposalApprovePayload,
): Promise<OperationalBlockRecord> {
  return post<OperationalBlockRecord>(`/approvals/${encodeURIComponent(proposalId)}/approve`, payload);
}

export async function rejectProposal(
  proposalId: string,
  payload: ProposalRejectPayload,
): Promise<{ proposal_id: string; status: string; reason: string }> {
  return post<{ proposal_id: string; status: string; reason: string }>(
    `/approvals/${encodeURIComponent(proposalId)}/reject`,
    payload,
  );
}

// ─── Operational Block Endpoints ─────────────────────────────────────

export async function listOperationalBlocks(params?: {
  section_id?: string;
  status?: string;
}): Promise<OperationalBlockRecord[]> {
  const query = new URLSearchParams();
  if (params?.section_id) query.set("section_id", params.section_id);
  if (params?.status) query.set("status", params.status);
  const qs = query.toString();
  return get<OperationalBlockRecord[]>(`/operational-blocks${qs ? `?${qs}` : ""}`);
}

export async function getOperationalBlock(blockId: string): Promise<OperationalBlockRecord> {
  return get<OperationalBlockRecord>(`/operational-blocks/${encodeURIComponent(blockId)}`);
}

// ─── Server Conflict Endpoints (Phase 6B Authoritative) ───────────────

export async function listConflicts(params?: {
  run_id?: string;
  proposal_id?: string;
  status?: string;
}): Promise<ServerConflictRecord[]> {
  const query = new URLSearchParams();
  if (params?.run_id) query.set("run_id", params.run_id);
  if (params?.proposal_id) query.set("proposal_id", params.proposal_id);
  if (params?.status) query.set("status", params.status);
  const qs = query.toString();
  return get<ServerConflictRecord[]>(`/conflicts${qs ? `?${qs}` : ""}`);
}

export async function detectConflicts(payload: ConflictDetectPayload): Promise<ServerConflictRecord[]> {
  return post<ServerConflictRecord[]>("/conflicts/detect", payload);
}

export async function resolveConflict(
  conflictId: string,
  payload: ConflictResolutionPayload,
): Promise<unknown> {
  return post<unknown>(`/conflicts/${encodeURIComponent(conflictId)}/resolve`, payload);
}

// ─── Topology & Trains Endpoints ─────────────────────────────────────

export async function listTopology(): Promise<TopologyResponse[]> {
  return get<TopologyResponse[]>("/topology");
}

export async function listTrains(): Promise<TrainResponse[]> {
  return get<TrainResponse[]>("/trains");
}

export async function listMovements(): Promise<MovementResponse[]> {
  return get<MovementResponse[]>("/trains/movements");
}

// ─── Combined Dashboard Data Loader ──────────────────────────────────

export async function loadDashboardData(): Promise<DashboardData> {
  const [requests, predictions, topology, trains, movements, serverConflicts, proposals, operationalBlocks] =
    await Promise.all([
      get<MaintenanceResponse[]>("/maintenance"),
      get<PredictionResponse[]>("/predictions").catch(() => []),
      get<TopologyResponse[]>("/topology").catch(() => []),
      get<TrainResponse[]>("/trains").catch(() => []),
      get<MovementResponse[]>("/trains/movements").catch(() => []),
      get<ServerConflictRecord[]>("/conflicts").catch(() => []),
      get<ApprovalProposalRecord[]>("/approvals"),
      get<OperationalBlockRecord[]>("/operational-blocks").catch(() => []),
    ]);

  const predictionByRequest = new Map(predictions.map((item) => [item.maintenance_request_id, item]));
  const topologyBySection = new Map(topology.map((item) => [item.section_id, item]));
  const stationMap = new Map<string, Station>();

  topology.forEach((item) => {
    stationMap.set(item.start_station, {
      id: item.start_station,
      name: item.start_station,
      km: item.start_km,
      lines: ["UP", "DN"],
    });
    stationMap.set(item.end_station, {
      id: item.end_station,
      name: item.end_station,
      km: item.end_km,
      lines: ["UP", "DN"],
    });
  });

  const movementsByTrain = new Map<string, MovementResponse[]>();
  movements.forEach((movement) =>
    movementsByTrain.set(movement.train_id, [...(movementsByTrain.get(movement.train_id) ?? []), movement]),
  );

  const mappedConflicts: ConflictRecord[] = serverConflicts.map((c) => ({
    id: c.id,
    blockAId: c.proposal_a_id || c.proposal_id || "",
    blockBId: c.proposal_b_id || c.train_number || "",
    overlapDescription: c.description || `${c.conflict_type} on ${c.section_id ?? "corridor"}`,
    status: c.status === "RESOLVED" ? "Resolved" : "Unresolved",
    windowStart: c.window_start_time,
    resolution: c.resolution_details
      ? {
          action: (c.resolution_details.action as any) ?? "Merged",
          actor: c.resolution_details.resolved_by,
          timestamp: c.resolution_details.resolved_at,
        }
      : undefined,
  }));

  return {
    blocks: requests.map((request) =>
      toBlock(request, predictionByRequest.get(request.id), topologyBySection.get(request.section_id)),
    ),
    conflicts: mappedConflicts,
    serverConflicts,
    proposals,
    operationalBlocks,
    trains: trains
      .filter((train) => train.active)
      .map((train) => ({
        id: train.train_number,
        name: `${train.origin ?? "Chennai"} - ${train.destination ?? "service"}`,
        type: train.service_type.toLowerCase() === "freight" ? "Freight" : "Passenger",
        status: "scheduled",
        delayMinutes: movementsByTrain.get(train.id)?.[0]?.delay_minutes ?? 0,
        stops: (movementsByTrain.get(train.id) ?? []).flatMap((movement) => {
          const section = topologyBySection.get(movement.section_id);
          if (!section) return [];
          return [
            { stationId: section.start_station, km: section.start_km, time: movement.scheduled_minute * 60_000 },
            {
              stationId: section.end_station,
              km: section.end_km,
              time: (movement.scheduled_minute + Math.max(10, Math.round(section.distance_km / 2))) * 60_000,
            },
          ];
        }),
      })),
    stations: [...stationMap.values()],
    topology,
    movements,
    rawTrains: trains,
    syncedAt: new Date().toISOString(),
  };
}
