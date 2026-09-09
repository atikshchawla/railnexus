import { decisionSchema, requestSchema, worldStateSchema } from "./contracts.js";
import type { Decision, Request, WorldState } from "./contracts.js";

export interface GatewayConfig {
  worldUrl: string;
  abpApiUrl?: string;
  mockAbp: boolean;
  fetchImpl?: typeof fetch;
}

export interface GatewayLogEntry {
  at: string;
  kind: "world" | "request" | "decision" | "error";
  payload: unknown;
}

export class Gateway {
  private readonly fetchImpl: typeof fetch;
  private readonly logs: GatewayLogEntry[] = [];
  private readonly decisions: Decision[] = [];
  private snapshot?: WorldState;
  private queue: Promise<Decision> = Promise.resolve(undefined as never);

  constructor(private readonly config: GatewayConfig) { this.fetchImpl = config.fetchImpl ?? fetch; }

  async syncWorld(): Promise<WorldState> {
    const response = await this.fetchImpl(this.config.worldUrl);
    if (!response.ok) throw new Error(`world source returned ${response.status}`);
    const snapshot = worldStateSchema.parse(await response.json());
    this.snapshot = snapshot; this.record("world", snapshot); return snapshot;
  }

  currentWorld(): WorldState | undefined { return this.snapshot; }
  logsSince(limit = 100): GatewayLogEntry[] { return this.logs.slice(-limit); }
  getDecisions(limit = 100): Decision[] { return this.decisions.slice(-limit); }

  submit(raw: unknown): Promise<Decision> {
    const request = requestSchema.parse(raw);
    if (!this.snapshot?.sections.some((section) => section.section_id === request.section_id)) {
      throw new Error(`unknown section: ${request.section_id}`);
    }
    this.record("request", request);
    const result = this.queue.then(() => this.decide(request));
    this.queue = result.catch(() => undefined as never);
    return result;
  }

  private async decide(request: Request): Promise<Decision> {
    let decision: Decision;
    if (this.config.mockAbp || !this.config.abpApiUrl) {
      const faulted = this.snapshot?.sections.find((section) => section.section_id === request.section_id)?.state === "maintenance";
      decision = {
        request_id: request.request_id,
        status: faulted ? "queued" : request.type === "maintenance_block" ? "approved" : "approved",
        section_id: request.section_id,
        resulting_state: faulted ? "maintenance" : request.type === "maintenance_block" ? "maintenance" : "reserved",
        decided_at: new Date().toISOString(),
        notes: faulted ? "Queued behind physical maintenance fault" : "Mock ABP allocation",
      };
    } else {
      const response = await this.fetchImpl(this.config.abpApiUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request) });
      if (!response.ok) throw new Error(`ABP returned ${response.status}`);
      decision = decisionSchema.parse(await response.json());
    }
    this.decisions.push(decision); this.record("decision", decision); return decision;
  }

  private record(kind: GatewayLogEntry["kind"], payload: unknown): void {
    this.logs.push({ at: new Date().toISOString(), kind, payload });
    if (this.logs.length > 500) this.logs.shift();
  }
}
