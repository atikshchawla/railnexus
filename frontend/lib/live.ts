export type Department = "TMS" | "TDMS" | "SMMS";

export type SectionState =
  | "Clear"
  | "Caution"
  | "Block active"
  | "Approved"
  | "Reserved"
  | "Queued"
  | "Rerouted";

export type RequestType = "running_status" | "section_entry" | "maintenance_block";

export type RequestStatus = "submitted" | "decided";

export type DecisionValue = "approved" | "reserved" | "queued" | "rerouted" | "rejected";

export interface AbpRequest {
  id: string;
  department: Department;
  type: RequestType;
  trainId?: string;
  sectionId: string;
  km: number;
  payload: Record<string, unknown>;
  description: string;
  raisedAt: string;
  status: RequestStatus;
}

export interface AbpDecision {
  id: string;
  requestId: string;
  decision: DecisionValue;
  sectionId: string;
  grantedWindow?: { startMin: number; endMin: number };
  sectionState: SectionState;
  decidedAt: string;
}

export interface SectionReflection {
  id: string;
  fromStation: string;
  toStation: string;
  fromKm: number;
  toKm: number;
  state: SectionState;
  fault?: string;
  occupiedBy?: string;
}

export interface LiveState {
  timestamp: string;
  corridor: string;
  sections: SectionReflection[];
  departments: Record<Department, { requests: AbpRequest[] }>;
  decisions: AbpDecision[];
  feed: { source: string; lastSeenAt?: string };
}

export const LIVE_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8787";

export async function fetchLiveState(signal?: AbortSignal): Promise<LiveState> {
  const response = await fetch(`${LIVE_API_BASE}/api/state`, {
    signal,
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Live API responded with ${response.status}`);
  }
  return (await response.json()) as LiveState;
}

export interface InjectInput {
  department: Department;
  type: RequestType;
  sectionId: string;
  trainId?: string;
  description?: string;
  km?: number;
  payload?: Record<string, unknown>;
}

export interface InjectResult {
  request: AbpRequest;
  decision: AbpDecision;
}

export async function injectRequest(input: InjectInput): Promise<InjectResult> {
  const response = await fetch(`${LIVE_API_BASE}/api/inject`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
  if (!response.ok) {
    let message = `Inject API responded with ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string; message?: string };
      if (body.message) message = body.message;
      else if (body.error) message = body.error;
    } catch {
      // keep the status-based message
    }
    throw new Error(message);
  }
  return (await response.json()) as InjectResult;
}

export function formatClock(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}