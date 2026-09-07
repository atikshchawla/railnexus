# 🌐 Digital Twin Service (State Management)

> **Module Path:** `lib/services/digital-twin/`
> **Owner:** Frontend / Visualization Team
> **Priority:** Critical

---

## Purpose

Manages the server-side state of the Digital Twin. Aggregates real-time data from multiple sources, maintains the authoritative network state, and pushes updates to connected clients via WebSocket.

---

## Responsibilities

| # | Responsibility | Description |
|---|---------------|-------------|
| 1 | **State Aggregation** | Merge data from SMMS (signals, TCs, points), COA (trains), and Block Service (active blocks) into a unified state. |
| 2 | **WebSocket Management** | Maintain persistent connections with all Digital Twin clients. Push state diffs (not full state) for bandwidth efficiency. |
| 3 | **Simulation Engine** | Run forward/backward time simulations for "what-if" analysis on block proposals. |
| 4 | **Conflict Visualization Data** | Compute and push conflict zones when blocks overlap with train paths. |
| 5 | **Historical Replay** | Load and replay historical state for post-incident analysis. |

---

## State Model

```typescript
interface DigitalTwinState {
  // Infrastructure (mostly static, updated on load)
  stations: Station[];
  sections: Section[];
  trackGeometry: TrackSegment[];
  
  // Dynamic - Signals (< 500ms update)
  signals: Map<string, SignalState>;
  // { signalId → { aspect: 'RED'|'YELLOW'|'DOUBLE_YELLOW'|'GREEN', updatedAt } }
  
  // Dynamic - Track Circuits (< 500ms update)
  trackCircuits: Map<string, TrackCircuitState>;
  // { tcId → { isOccupied: boolean, impedance: number, updatedAt } }
  
  // Dynamic - Points (< 500ms update)
  points: Map<string, PointState>;
  // { pointId → { position: 'NORMAL'|'REVERSE'|'OOC', updatedAt } }
  
  // Dynamic - Trains (< 1s update)
  trains: Map<string, TrainPosition>;
  // { trainId → { lat, lng, speed, section, km, delay, updatedAt } }
  
  // Dynamic - Blocks (event-driven)
  activeBlocks: Map<string, ActiveBlock>;
  proposedBlocks: Map<string, ProposedBlock>;
  
  // Metadata
  lastSync: Date;
  connectionStatus: 'CONNECTED' | 'DEGRADED' | 'DISCONNECTED';
}
```

---

## WebSocket Protocol

### Connection

```
Client → Server: WS CONNECT /api/digital-twin/ws?section=BZA-TEL&token=<jwt>
Server → Client: { type: 'INIT', state: <full_state_for_section> }
```

### State Diffs

```typescript
// Server pushes only changes, not full state
interface StateDiff {
  type: 'DIFF';
  timestamp: Date;
  changes: {
    signals?: { [signalId: string]: Partial<SignalState> };
    trackCircuits?: { [tcId: string]: Partial<TrackCircuitState> };
    points?: { [pointId: string]: Partial<PointState> };
    trains?: { [trainId: string]: Partial<TrainPosition> };
    blocks?: { [blockId: string]: Partial<ActiveBlock> };
  };
}
```

### Client Commands

```typescript
// Client can request simulation
interface SimulationRequest {
  type: 'SIMULATE';
  blockId: string;
  timeRange: { start: Date; end: Date };
  speed: number; // 1x, 2x, 5x, 10x
}
```

---

## API Surface

```typescript
export class DigitalTwinStateService {
  // State management
  static async getFullState(section: string): Promise<DigitalTwinState>;
  static async getStateDiff(section: string, since: Date): Promise<StateDiff>;
  
  // Simulation
  static async runForwardSimulation(params: SimulationParams): Promise<SimulationResult>;
  static async calculateDelayImpact(block: Block): Promise<DelayImpactResult>;
  
  // Historical
  static async replayState(section: string, from: Date, to: Date): Promise<DigitalTwinState[]>;
}
```

---

## Events Consumed

| Event Source | Event | Action |
|-------------|-------|--------|
| SMMS (Kafka) | `signal.state_changed` | Update signal in state, push diff |
| SMMS (Kafka) | `tc.occupancy_changed` | Update TC in state, push diff |
| SMMS (Kafka) | `point.position_changed` | Update point in state, push diff |
| SMMS (Kafka) | `point.ooc_detected` | **CRITICAL**: Update point, push diff + audible alarm trigger |
| COA (Kafka) | `train.position_updated` | Update train in state, push diff |
| Block Service | `block.activated` | Add to active blocks, push diff with overlay data |
| Block Service | `block.completed` | Remove from active blocks, push diff |
| AI Optimizer | `proposal.generated` | Add to proposed blocks, push diff |

---

## Version

| Field | Value |
|-------|-------|
| Version | `1.0.0` |
| Last Updated | `2026-08-24` |
| Author | RailNexus Architecture Team |
