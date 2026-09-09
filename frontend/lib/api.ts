import type {
  AISuggestion,
  BlockRecord,
  BlockStatus,
  ConflictRecord,
  Department,
  Station,
  TrainPath,
} from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

type MaintenanceResponse = {
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
};

type PredictionResponse = {
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

type TopologyResponse = {
  section_id: string;
  start_station: string;
  end_station: string;
  start_km: number;
  end_km: number;
  distance_km: number;
  department: string;
};

type TrainResponse = {
  id: string;
  train_number: string;
  service_type: string;
  origin: string | null;
  destination: string | null;
  active: boolean;
};

type MovementResponse = {
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
}

export interface DashboardData {
  blocks: BlockRecord[];
  conflicts: ConflictRecord[];
  trains: TrainPath[];
  stations: Station[];
  syncedAt: string;
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`RailNexus API returned ${response.status} for ${path}`);
  }
  return response.json() as Promise<T>;
}

function department(value: string): Department {
  const normalized = value.toUpperCase();
  if (normalized === "TRD") return "TRD";
  if (normalized === "S&T" || normalized === "SNT") return "S&T";
  return "Engg";
}

function status(value: string): BlockStatus {
  const normalized = value.toLowerCase();
  const statuses: Record<string, BlockStatus> = {
    pending: "Submitted",
    approved: "Approved",
    scheduled: "Approved",
    in_progress: "Active",
    completed: "Closed",
    cancelled: "Rejected",
    rejected: "Rejected",
  };
  return statuses[normalized] ?? "Under review";
}

function urgency(level: string): BlockRecord["urgency"]["tier"] {
  if (level === "critical") return "critical";
  if (level === "high") return "warning";
  if (level === "medium") return "caution";
  return "routine";
}

function minutesToIso(minutes: number | undefined, base: string): string {
  const date = new Date(base);
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
        confidence: Math.round(Math.max(0, Math.min(1, 1 - prediction.overrun_probability)) * 100),
        confidenceBasis: `predicted ${Math.round(prediction.predicted_duration_minutes)} minute possession with ${Math.round(prediction.trains_affected)} trains affected`,
        topFactors: [
          `Failure risk ${(prediction.failure_risk_probability * 100).toFixed(1)}%`,
          `Overrun risk ${(prediction.overrun_probability * 100).toFixed(1)}%`,
          `${prediction.total_delay_minutes.toFixed(1)} minutes predicted train delay`,
        ],
        recommendedAction: prediction.urgency_level === "critical" ? "Prioritize for controller review" : "Approve as proposed",
      }
    : null;

  return {
    id: request.id,
    department: department(request.department),
    category: request.work_type.toUpperCase().includes("PM") ? "PM" : request.work_type.toUpperCase().includes("OBS") ? "OBS" : "IMR",
    description: topology
      ? `${request.work_type} on ${topology.start_station} - ${topology.end_station}`
      : request.work_type,
    location: {
      kmStart: request.location_km,
      kmEnd: request.location_km,
      line: (metadata.line === "DN" ? "DN" : metadata.line === "UP/DN" ? "UP/DN" : "UP"),
    },
    scheduledWindow: { start, end },
    urgency: {
      timeToBreachHours: request.deadline_minutes === null ? null : request.deadline_minutes / 60,
      tier: urgency(prediction?.urgency_level ?? "low"),
    },
    status: status(request.status),
    source: { system: "TMS", lastUpdated: new Date(request.created_at).toLocaleString() },
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
        }
      : undefined,
    auditTrail: [],
  };
}

export async function loadDashboardData(): Promise<DashboardData> {
  const [requests, predictions, topology, trains] = await Promise.all([
    get<MaintenanceResponse[]>("/maintenance"),
    get<PredictionResponse[]>("/predictions"),
    get<TopologyResponse[]>("/topology"),
    get<TrainResponse[]>("/trains"),
  ]);
  const movements = await get<MovementResponse[]>("/trains/movements");
  const predictionByRequest = new Map(predictions.map((item) => [item.maintenance_request_id, item]));
  const topologyBySection = new Map(topology.map((item) => [item.section_id, item]));
  const stationMap = new Map<string, Station>();

  topology.forEach((item) => {
    stationMap.set(item.start_station, { id: item.start_station, name: item.start_station, km: item.start_km, lines: ["UP", "DN"] });
    stationMap.set(item.end_station, { id: item.end_station, name: item.end_station, km: item.end_km, lines: ["UP", "DN"] });
  });

  const movementsByTrain = new Map<string, MovementResponse[]>();
  movements.forEach((movement) => movementsByTrain.set(movement.train_id, [...(movementsByTrain.get(movement.train_id) ?? []), movement]));
  return {
    blocks: requests.map((request) => toBlock(request, predictionByRequest.get(request.id), topologyBySection.get(request.section_id))),
    conflicts: [],
    trains: trains.filter((train) => train.active).map((train) => ({
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
          { stationId: section.end_station, km: section.end_km, time: (movement.scheduled_minute + Math.max(10, Math.round(section.distance_km / 2))) * 60_000 },
        ];
      }),
    })),
    stations: [...stationMap.values()],
    syncedAt: new Date().toISOString(),
  };
}

export async function optimizeRequests(requestIds: string[]): Promise<OptimizerResponse> {
  return fetch(`${API_BASE_URL}/optimizer/optimize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ request_ids: requestIds }),
    cache: "no-store",
  }).then(async (response) => {
    if (!response.ok) throw new Error(`RailNexus optimizer returned ${response.status}`);
    return response.json() as Promise<OptimizerResponse>;
  });
}
