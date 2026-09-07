# 🏗️ System Architecture — RailNexus ABP + Digital Twin

---

## High-Level Architecture Overview

RailNexus follows an **Edge-Cloud Collaborative Architecture** with strict separation between three planes:

1. **AI Optimization Plane** (Cloud) — Proposes schedules, predicts failures, optimizes blocks.
2. **Operational Plane** (Cloud + Edge) — Manages user interactions, approvals, Digital Twin visualization.
3. **Safety Execution Plane** (Edge / On-Premise) — Controls interlocking, signals, Kavach integration. **SIL-4 isolated.**

> [!CAUTION]
> The AI Optimization Plane **MUST NEVER** directly command safety-critical hardware.
> All safety actions flow through the Safety Execution Plane, which is physically and logically decoupled.

---

## Architecture Diagram (Conceptual)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                              CLOUD TIER                                          │
│  ┌─────────────────────┐  ┌───────────────────────┐  ┌────────────────────────┐ │
│  │  AI OPTIMIZATION    │  │  OPERATIONAL SERVICES  │  │  DATA LAKE / WAREHOUSE │ │
│  │  ENGINE             │  │                        │  │                        │ │
│  │  ┌───────────────┐  │  │  ┌──────────────────┐ │  │  ┌──────────────────┐ │ │
│  │  │ MILP Solver   │  │  │  │ Block Planning   │ │  │  │ TMS Data Store   │ │ │
│  │  │ RL Heuristics │  │  │  │ Service          │ │  │  │ SMMS Data Store  │ │ │
│  │  │ Shadow Block  │  │  │  │                  │ │  │  │ TDMS Data Store  │ │ │
│  │  │ Optimizer     │  │  │  ├──────────────────┤ │  │  │ COA Data Store   │ │ │
│  │  └───────────────┘  │  │  │ Approval &       │ │  │  │ Telemetry Store  │ │ │
│  │  ┌───────────────┐  │  │  │ Workflow Engine  │ │  │  └──────────────────┘ │ │
│  │  │ PINN RUL      │  │  │  ├──────────────────┤ │  │  ┌──────────────────┐ │ │
│  │  │ Predictor     │  │  │  │ Notification &   │ │  │  │ Block Schedule   │ │ │
│  │  └───────────────┘  │  │  │ Alert Service    │ │  │  │ History          │ │ │
│  │  ┌───────────────┐  │  │  ├──────────────────┤ │  │  └──────────────────┘ │ │
│  │  │ Corridor      │  │  │  │ Auth & RBAC      │ │  │                        │ │
│  │  │ Analyzer      │  │  │  │ Service          │ │  │                        │ │
│  │  └───────────────┘  │  │  └──────────────────┘ │  │                        │ │
│  └─────────────────────┘  └───────────────────────┘  └────────────────────────┘ │
│         │                          │                          │                  │
│         └──────────────────────────┼──────────────────────────┘                  │
│                                    │                                             │
│                    ┌───────────────┴───────────────────┐                         │
│                    │  API GATEWAY / MESSAGE BROKER     │                         │
│                    │  (REST + Kafka/MQTT Pub/Sub)      │                         │
│                    └───────────────┬───────────────────┘                         │
└────────────────────────────────────┼────────────────────────────────────────────┘
                                     │
                    ┌────────────────┴─────────────────┐
                    │          EDGE TIER                │
                    │  ┌──────────────────────────────┐│
                    │  │  Edge Gateway                ││
                    │  │  ┌────────────┐ ┌──────────┐ ││
                    │  │  │ Protocol   │ │ Real-time││ ││
                    │  │  │ Converters │ │ Telemetry││ ││
                    │  │  └────────────┘ └──────────┘ ││
                    │  └──────────────────────────────┘│
                    │                                   │
                    │  ┌──────────────────────────────┐│
                    │  │  SAFETY EXECUTION PLANE      ││
                    │  │  (SIL-4 Isolated)             ││
                    │  │  ┌─────────────────────────┐ ││
                    │  │  │ EI Interface (Read-Only) │ ││
                    │  │  │ Kavach Feed              │ ││
                    │  │  │ Track Circuit Monitor    │ ││
                    │  │  │ Signal State Observer    │ ││
                    │  │  └─────────────────────────┘ ││
                    │  └──────────────────────────────┘│
                    └──────────────────────────────────┘
                                     │
                    ┌────────────────┴─────────────────┐
                    │        FIELD TIER                 │
                    │  IoT Sensors │ Track Circuits │   │
                    │  Point Machines │ Signal Heads │  │
                    │  GPS Telematics │ OHE Sensors  │  │
                    └──────────────────────────────────┘
```

---

## Tier Descriptions

### Cloud Tier

The cloud tier hosts all computationally intensive services that do not require sub-second latency to field devices.

| Component | Responsibility | Scaling Model |
|-----------|---------------|---------------|
| **AI Optimization Engine** | MILP solving, RL heuristics, shadow block identification, corridor analysis | Horizontal (GPU workers) |
| **PINN RUL Predictor** | Physics-informed neural network for S&T/TRD asset remaining useful life | Horizontal (GPU inference) |
| **Block Planning Service** | CRUD for block requests, schedule management, 26-week RBP maintenance | Horizontal (stateless) |
| **Approval & Workflow Engine** | Multi-role approval chains (SSE → Controller → DRM) | Horizontal (stateless) |
| **Notification Service** | Push notifications, SMS, email alerts for block proposals and emergencies | Horizontal (queue-based) |
| **Auth & RBAC Service** | Authentication, authorization, role management | Horizontal (stateless) |
| **Data Lake** | Unified storage for TMS, SMMS, TDMS, COA data ingestion | Vertical (storage scaling) |
| **Digital Twin Renderer** | Server-side computation for Digital Twin state synchronization | Horizontal (WebSocket servers) |

### Edge Tier

The edge tier provides low-latency processing for real-time operations. Deployed at **divisional control offices** and **major stations**.

| Component | Responsibility | Latency Target |
|-----------|---------------|----------------|
| **Edge Gateway** | Protocol conversion, data aggregation, local caching | < 100ms |
| **Protocol Converters** | Translate proprietary railway protocols (relay data loggers, EI interfaces) to standard formats | < 50ms |
| **Real-time Telemetry Processor** | Interpolate train positions, detect track circuit changes | < 200ms |

### Safety Execution Plane (SIL-4)

> [!CAUTION]
> This plane operates under **EN 50126/50128/50129** certification requirements.
> It is **read-only** from the AI perspective — AI can observe state but NEVER command changes.

| Component | Responsibility | Integrity Level |
|-----------|---------------|-----------------|
| **EI Interface** | Read current interlocking state (route settings, signal aspects, point positions) | SIL-4 |
| **Kavach Feed** | Push active block zone data to TCAS network for collision avoidance | SIL-4 |
| **Track Circuit Monitor** | Observe track circuit occupancy states | SIL-4 |
| **Signal State Observer** | Mirror physical signal aspects into the Digital Twin | SIL-4 |

### Field Tier

Physical assets and IoT sensors deployed along the railway infrastructure. These are not software components but data sources.

---

## Communication Patterns

| From → To | Protocol | Pattern | Use Case |
|-----------|----------|---------|----------|
| Field → Edge | Proprietary / MQTT | Pub/Sub (streaming) | Sensor telemetry, track circuit states |
| Edge → Cloud | MQTT / Kafka | Pub/Sub (streaming) | Aggregated telemetry, event notifications |
| Cloud → Edge | MQTT / Kafka | Pub/Sub (push) | Block activation commands, schedule updates |
| Cloud ↔ Client | REST / WebSocket | Request-Response / Streaming | UI dashboards, Digital Twin real-time updates |
| AI Engine → Block Service | gRPC | Request-Response | Schedule proposals, optimization results |
| Block Service → Approval Engine | Event Bus (Kafka) | Event-Driven | Workflow state transitions |
| Safety Plane → Cloud | Read-Only MQTT | Pub/Sub (one-way) | EI state, track circuit status — **never bidirectional** |

---

## Key Architectural Principles

### 1. Strict Safety-AI Decoupling
The AI optimization layer is **never** permitted to issue commands to safety-critical hardware. It can only:
- **Read** safety state (via the Safety Execution Plane observers).
- **Propose** schedules (to human operators via the Operational Plane).
- **React** to safety events (by recalculating schedules when safety state changes).

### 2. Edge-Cloud Symbiosis
- **Latency-sensitive** operations (train detection, signal state mirroring) run at the **edge**.
- **Compute-intensive** operations (MILP optimization, PINN inference) run in the **cloud**.
- Both tiers maintain **eventual consistency** with a maximum synchronization lag of 500ms.

### 3. Event-Driven Architecture
All inter-service communication follows an event-driven pattern using Apache Kafka as the central message broker. This ensures:
- **Loose coupling** between services.
- **Replay capability** for audit trails.
- **Scalability** through partition-based parallelism.

### 4. Human-in-the-Loop (HITL) by Design
Every AI-generated output passes through a mandatory human review gate. The system is designed so that:
- AI **proposes** → Human **reviews** → Human **approves/rejects** → System **executes**.
- No automated execution of block schedules without explicit human authorization.

### 5. Modular Monolith → Microservices Migration Path
The initial deployment uses a **modular monolith** pattern within the Next.js application:
- Each service is a self-contained module with clear API boundaries.
- Modules communicate through well-defined internal interfaces.
- The architecture supports future extraction into independent microservices without code restructuring.

---

## Deployment Architecture

```
┌────────────────────────────────────────────────┐
│               PRODUCTION CLUSTER               │
│                                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐│
│  │ Next.js  │  │ Kafka    │  │ PostgreSQL   ││
│  │ App      │  │ Cluster  │  │ (Primary +   ││
│  │ (3 pods) │  │ (3 nodes)│  │  Replicas)   ││
│  └──────────┘  └──────────┘  └──────────────┘│
│                                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐│
│  │ Redis    │  │ AI/ML    │  │ TimescaleDB  ││
│  │ Cache    │  │ Workers  │  │ (Telemetry)  ││
│  │          │  │ (GPU)    │  │              ││
│  └──────────┘  └──────────┘  └──────────────┘│
└────────────────────────────────────────────────┘
```

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Application Server** | Next.js 16 + Node.js | UI rendering, API routes, WebSocket server |
| **Database (Primary)** | PostgreSQL 16 via Prisma | Relational data (users, blocks, schedules, approvals) |
| **Database (Telemetry)** | TimescaleDB | Time-series data (sensor readings, train positions, signal states) |
| **Cache** | Redis | Session management, real-time state caching, pub/sub for WebSocket |
| **Message Broker** | Apache Kafka | Event streaming, inter-service communication, audit log |
| **AI/ML Workers** | Python (PyTorch) on GPU | MILP solving, PINN inference, RL training |
| **Object Storage** | S3-compatible | Model artifacts, report archives, document storage |

---

## Version

| Field | Value |
|-------|-------|
| Version | `1.0.0` |
| Last Updated | `2026-08-24` |
| Author | RailNexus Architecture Team |
