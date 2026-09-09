import { worldSnapshotSchema } from "./types.js";
import type { MidLayerState, WorldSnapshot } from "./types.js";

export interface BridgeConfig {
  worldUrl: string;
  memberBUrl?: string;
  fetchImpl?: typeof fetch;
}

export class WorldBridge {
  private readonly fetchImpl: typeof fetch;
  private readonly state: MidLayerState;

  constructor(private readonly config: BridgeConfig) {
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.state = { source: config.worldUrl };
  }

  async pullAndForward(): Promise<WorldSnapshot> {
    const response = await this.fetchImpl(this.config.worldUrl);
    if (!response.ok) throw new Error(`world source returned ${response.status}`);
    const snapshot = worldSnapshotSchema.parse(await response.json());
    this.state.snapshot = snapshot;
    this.state.lastSeenAt = snapshot.timestamp;
    delete this.state.lastForwardError;
    if (this.config.memberBUrl) {
      try {
        const forwarded = await this.fetchImpl(this.config.memberBUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(snapshot),
        });
        if (!forwarded.ok) throw new Error(`member B returned ${forwarded.status}`);
        this.state.lastForwardedAt = new Date().toISOString();
      } catch (error) {
        this.state.lastForwardError = String(error);
        console.warn(`[mid-layer] forward failed: ${String(error)}`);
      }
    }
    return snapshot;
  }

  current(): MidLayerState {
    return { ...this.state };
  }
}
