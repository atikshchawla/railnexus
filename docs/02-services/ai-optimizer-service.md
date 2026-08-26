# 🤖 AI Optimizer Service

> **Module Path:** `lib/services/ai-optimizer/` (Node.js client) + `ai/` (Python backend)
> **Owner:** AI/ML Team
> **Priority:** Critical

---

## Purpose

The AI Optimizer Service is the **computational brain** of RailNexus. It receives block requests and scheduling constraints, and produces mathematically optimized block schedules using MILP and RL algorithms. The Node.js client communicates with the Python AI backend via gRPC/REST.

---

## Architecture Split

```
┌──────────────────────────┐     gRPC/REST      ┌────────────────────────────┐
│  Node.js Client          │ ◄─────────────────► │  Python AI Backend         │
│  lib/services/ai-optimizer│                     │  ai/                       │
│                          │                     │                            │
│  • Proposal management   │                     │  • MILP Solver (OR-Tools)  │
│  • Request formatting    │                     │  • RL Agent (Stable-B3)    │
│  • Result caching        │                     │  • Shadow Block Algorithm  │
│  • Event emission        │                     │  • Corridor Analyzer       │
│                          │                     │  • PINN RUL Predictor      │
└──────────────────────────┘                     └────────────────────────────┘
```

---

## Optimization Objectives

The MILP solver minimizes a **multi-objective function**:

```
Minimize:
    w₁ × TotalAssetDowntime +
    w₂ × UnscheduledIMRPenalty +
    w₃ × TrainDelayImpact -
    w₄ × ShadowBlockUtilization -
    w₅ × CorridorEfficiency

Subject to:
    C₁: All IMR defects scheduled within 3 days of detection
    C₂: No block overlaps with passenger express paths
    C₃: Shadow blocks fit within parent block spatial boundaries
    C₄: TRD power blocks require OHE de-energization sequence
    C₅: Total daily block hours ≤ configurable maximum per section
    C₆: Machinery physical collision avoidance constraints
    C₇: S&T disconnection sequencing constraints
```

### Weight Configuration

| Weight | Default | Adjustable By | Rationale |
|--------|---------|---------------|-----------|
| w₁ (Downtime) | 1.0 | System Admin | Primary objective |
| w₂ (IMR Penalty) | 10.0 | **Non-adjustable** | Safety-critical, must always dominate |
| w₃ (Train Delay) | 3.0 | Controller | Balance maintenance vs operations |
| w₄ (Shadow Blocks) | 2.0 | System Admin | Efficiency incentive |
| w₅ (Corridor Efficiency) | 1.5 | System Admin | Utilization incentive |

> [!CAUTION]
> **w₂ (IMR Penalty) is hardcoded at 10.0 and MUST NEVER be reduced.** This ensures IMR defects always take scheduling priority. Reducing this weight could lead to safety-critical delays.

---

## PINN RUL Prediction Model

The Physics-Informed Neural Network predicts Remaining Useful Life for S&T equipment:

| Input Features | Source |
|---------------|--------|
| Point machine current draw (time series) | SMMS data loggers |
| Track circuit impedance (time series) | SMMS data loggers |
| Relay contact resistance | SMMS |
| Environmental temperature/humidity | IoT sensors |
| Operational cycles count | SMMS |
| Age of equipment (days) | Asset registry |

| Output | Format |
|--------|--------|
| RUL in days | Float |
| Confidence interval | [lower, upper] at 95% CI |
| Failure mode | Categorical (electrical, mechanical, environmental) |
| Urgency classification | CRITICAL / HIGH / MEDIUM / LOW |

**Target Accuracy:** ≥ 98% (as demonstrated in reference PINN architecture).

---

## API Surface

### Node.js Client

```typescript
export class AIOptimizerClient {
  // Schedule optimization
  static async optimizeSchedule(request: OptimizationRequest): Promise<OptimizationResult>;
  static async identifyShadowBlocks(blocks: Block[]): Promise<ShadowOpportunity[]>;
  static async analyzeCorridors(timetable: Timetable, section: Section): Promise<Corridor[]>;
  
  // Predictive maintenance
  static async predictRUL(equipmentId: string): Promise<RULPrediction>;
  static async batchPredictRUL(equipmentIds: string[]): Promise<RULPrediction[]>;
  
  // Proposals
  static async generateProposal(blockId: string): Promise<AIProposal>;
  static async scoreProposal(proposal: AIProposal): Promise<ProposalScore>;
}
```

### Python API (FastAPI)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/optimize` | Run MILP optimization on a set of blocks |
| `POST` | `/shadow-blocks` | Identify shadow block opportunities |
| `POST` | `/corridors/analyze` | Analyze timetable for available corridors |
| `POST` | `/predict/rul` | Single equipment RUL prediction |
| `POST` | `/predict/rul/batch` | Batch RUL prediction |
| `GET` | `/model/status` | Health check for ML models |
| `POST` | `/model/retrain` | Trigger model retraining pipeline |

---

## Model Lifecycle

```
Data Collection → Feature Engineering → Training → Validation → Deployment → Monitoring
      │                                                                          │
      └──────────────────────── Feedback Loop ──────────────────────────────────┘
```

| Phase | Tool | Cadence |
|-------|------|---------|
| Data Collection | Kafka consumers + Airflow | Continuous |
| Feature Engineering | Feast feature store | Daily batch + real-time |
| Training | PyTorch on GPU workers | Weekly (or on data drift) |
| Validation | Hold-out test set + domain expert review | Before deployment |
| Deployment | ONNX Runtime on FastAPI | Blue-green deployment |
| Monitoring | Prometheus metrics + data drift detection | Continuous |

---

## Version

| Field | Value |
|-------|-------|
| Version | `1.0.0` |
| Last Updated | `2026-08-24` |
| Author | RailNexus Architecture Team |
