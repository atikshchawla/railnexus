import { decisionSchema, requestSchema, worldStateSchema } from "./contracts.js";
import type { Decision, Request, WorldState } from "./contracts.js";

export class MidLayerClient {
  constructor(private readonly baseUrl: string, private readonly fetchImpl: typeof fetch = fetch) {}
  async worldState(): Promise<WorldState> { const response = await this.fetchImpl(`${this.baseUrl}/world-state`); if (!response.ok) throw new Error(`mid-layer world-state ${response.status}`); return worldStateSchema.parse(await response.json()); }
  async submit(request: Request): Promise<Decision> { const response = await this.fetchImpl(`${this.baseUrl}/requests`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request) }); if (!response.ok) throw new Error(`mid-layer request ${response.status}`); return decisionSchema.parse(await response.json()); }
  async decisions(): Promise<Decision[]> { const response = await this.fetchImpl(`${this.baseUrl}/decisions`); if (!response.ok) throw new Error(`mid-layer decisions ${response.status}`); return decisionSchema.array().parse(await response.json()); }
}
