# 📋 Software Requirements Specification (SRS)

> **Document ID:** RAILNEXUS-SRS-001
> **Compliance:** IEEE 830-1998 (Modified for Railway Safety)
> **Classification:** Confidential

---

## 1. Introduction

### 1.1 Purpose
This SRS defines the complete functional, non-functional, and interface requirements for the RailNexus AI-Driven Automatic Block Planning and Digital Twin System.

### 1.2 Scope
The system encompasses:
- AI-driven block schedule optimization
- Digital Twin visual simulator
- Multi-horizon scheduling (26-week, monthly, daily)
- Human-in-the-Loop approval workflows
- External system integrations (TMS, SMMS, TDMS, COA)
- Safety-critical interfaces (EI, Kavach)

### 1.3 Definitions
See [Glossary](../00-overview/glossary.md) for all domain-specific terms.

---

## 2. Functional Requirements (FR)

### Critical Priority

| ID | Requirement | Sub-System | Acceptance Criteria |
|----|------------|------------|---------------------|
| **FR-01** | The system must ingest real-time maintenance defect data (IMR, OBS, TGI) from the TMS and classify tasks by urgency. | Data Integration | IMR defects reflected in system within 5 minutes of TMS entry. Classification matches TMS severity. |
| **FR-02** | The system shall automatically identify and bundle overlapping spatial maintenance tasks into consolidated "Shadow Blocks." | AI Optimizer | Given 2+ pending tasks within ±2km, system proposes at least one shadow block combination. |
| **FR-03** | The system must generate 26-week rolling, monthly, and weekly block schedules aligned with dynamic COA timetables. | AI Optimizer | 26-week schedule generated successfully. No approved block conflicts with passenger express timetable. |
| **FR-04** | The Digital Twin must visually render the live status of all signals, track circuits, and train movements on a spatial map. | Digital Twin | Signal aspect changes reflected within 500ms. Train positions updated within 1 second. |
| **FR-06** | The system shall digitize, log, and cryptographically secure the issuance of Disconnection Memos and Private Number exchanges. | Safety / Auth | All PNs encrypted at rest (AES-256). Dual acknowledgment required. Immutable audit log maintained. |

### High Priority

| ID | Requirement | Sub-System | Acceptance Criteria |
|----|------------|------------|---------------------|
| **FR-05** | The UI must allow drag-and-drop temporal adjustment of block windows, instantly calculating safety and timetable impacts. | HITL / UX | Block adjustment with visual feedback within 500ms. Conflict detection on every adjustment. |
| **FR-07** | The system must utilize PINN models to predict the Remaining Useful Life (RUL) of S&T point machines and track circuits. | Predictive AI | RUL predictions with ≥ 95% accuracy. Predictions available for all monitored equipment. |
| **FR-08** | The system must support multi-role approval workflows with role-based access control. | Approval Engine | SSE cannot approve blocks. Controllers cannot sign Disconnection Memos. DRM signs off on 26-week RBP. |
| **FR-09** | The system must detect and alert on Out-of-Correspondence (OOC) conditions for point machines. | Safety | OOC detection within 200ms. All signals in zone forced to RED. Human alerted immediately. |
| **FR-10** | The system must integrate with Kavach to feed active block zone data for collision avoidance. | Safety | Block zone data transmitted to Kavach within 1 second of activation. |

### Medium Priority

| ID | Requirement | Sub-System | Acceptance Criteria |
|----|------------|------------|---------------------|
| **FR-11** | The system must support emergency block cancellation with Reconnection Memo workflow. | Safety / Auth | Emergency cancellation completes within 2 minutes. Signals cleared only after Reconnection Memo. |
| **FR-12** | The system must provide forward simulation (up to 24 hours) showing cascading delay impact. | Digital Twin | Simulation runs at ≥ 10x real-time speed. Delay propagation visible on map. |
| **FR-13** | The system must dynamically recalculate schedules when freight train delays exceed 30 minutes. | Scheduling | Recalculation triggered within 1 minute of delay threshold. Alternative corridors proposed. |
| **FR-14** | The system must generate audit reports for all safety-critical actions. | Audit | Reports exportable as PDF. All PN exchanges, block activations, and overrides logged. |
| **FR-15** | The system must support seasonal maintenance calendar integration (pre-monsoon, winter). | Scheduling | Seasonal tasks auto-inserted into tactical schedule. |

---

## 3. Non-Functional Requirements (NFR)

### NFR-01: Reliability & Availability

| Component | Uptime Target | Recovery Time | Standard |
|-----------|--------------|---------------|----------|
| Cloud AI Engine | 99.99% | < 5 minutes | — |
| Safety Execution Plane | 99.999% | < 10 seconds | SIL-4 (EN 50126) |
| Edge Gateway | 99.99% | < 30 seconds | — |
| Digital Twin WebSocket | 99.9% | < 30 seconds | — |
| Database (PostgreSQL) | 99.99% | < 1 minute | — |

### NFR-02: Latency

| Operation | Maximum Latency |
|-----------|----------------|
| Signal state change → Digital Twin update | 500ms |
| Track circuit occupancy → Twin update | 500ms |
| Block drag-and-drop → conflict recalculation | 500ms |
| AI proposal generation (single block) | 5 seconds |
| AI full schedule optimization (daily) | 60 seconds |
| AI full schedule optimization (26-week) | 5 minutes |
| Page load (dashboard) | 2 seconds |
| Page load (Digital Twin) | 3 seconds |

### NFR-03: Usability

| Requirement | Specification |
|-------------|--------------|
| Maximum clicks to approve a block | **3** |
| WCAG compliance | 2.1 AA |
| Language support | English + Hindi |
| Touch target minimum | 44 × 44 pixels |
| Color contrast ratio | ≥ 4.5:1 |
| Offline mode | Graceful degradation with clear indicator |
| Tablet support | Fully responsive for 10" tablets |

### NFR-04: Security

| Requirement | Specification |
|-------------|--------------|
| Data in transit | TLS 1.3 mandatory |
| Data at rest | AES-256 encryption |
| Authentication | Multi-factor for Controller and above |
| Authorization | RBAC with principle of least privilege |
| Session management | 8-hour max session, 30-minute idle timeout |
| Audit trail | Immutable (Kafka-backed), 7-year retention |
| API security | Rate limiting (100 req/min per user), JWT tokens |
| Password policy | 12+ chars, complexity requirements, 90-day rotation |

### NFR-05: Scalability

| Metric | Target |
|--------|--------|
| Concurrent users | 500 per division |
| Concurrent WebSocket connections | 1,000 per cluster |
| Blocks processed per day | 10,000 across the network |
| Kafka message throughput | 50,000 messages/second |
| Database rows (Block table) | 10 million+ (5-year retention) |
| TimescaleDB ingestion | 100,000 data points/second |

### NFR-06: Data Retention

| Data Type | Retention Period | Storage |
|-----------|-----------------|---------|
| Block records | 7 years | PostgreSQL (archived to cold storage after 2 years) |
| Audit logs | 7 years | Kafka + PostgreSQL |
| Telemetry data | 2 years | TimescaleDB (downsampled after 90 days) |
| AI model artifacts | 2 years | Object storage |
| PN records | 7 years | PostgreSQL (encrypted) |

---

## 4. Interface Requirements (IR)

### IR-01: TMS API

| Aspect | Specification |
|--------|--------------|
| Protocol | RESTful HTTPS |
| Direction | Bidirectional |
| Authentication | API Key + Mutual TLS |
| Data format | JSON |
| Inbound | Defects (IMR/OBS), OMS data, TGI values, renewal schedules |
| Outbound | Completed maintenance task logs, block execution confirmations |
| Error handling | Circuit breaker (5 failures/min threshold) |
| Fallback | Cache last known data (max 1 hour stale) |

### IR-02: SMMS & Data Logger Protocol

| Aspect | Specification |
|--------|--------------|
| Protocol | Proprietary → MQTT bridge via protocol converter |
| Direction | **Inbound only (READ-ONLY)** |
| Authentication | Certificate-based mutual TLS |
| Data format | Binary (proprietary) → JSON (after conversion) |
| Inbound | Relay states, EI health, point machine current, TC impedance |
| Security | Galvanic isolation required to prevent electrical interference |
| Error handling | Reconnect with exponential backoff |
| Fallback | **CRITICAL ALERT** — manual monitoring required |

### IR-03: COA & Telemetry Interface

| Aspect | Specification |
|--------|--------------|
| Protocol | Apache Kafka (streaming) + REST (batch) |
| Direction | Inbound only |
| Authentication | SASL/SCRAM-SHA-256 + API Key |
| Data format | Avro (Kafka), JSON (REST) |
| Inbound streams | Freight forecasts, passenger delays, locomotive GPS |
| Inbound batch | Master timetable (daily refresh) |
| Consumer groups | `railnexus-coa-consumer` (3 consumers) |
| Error handling | Consumer lag monitoring, auto-rebalance |

### IR-04: Kavach Interface

| Aspect | Specification |
|--------|--------------|
| Protocol | Dedicated secure channel (specification per RDSO) |
| Direction | **Outbound only** (RailNexus → Kavach) |
| Authentication | Certificate-based + hash verification |
| Data format | Block zone coordinates + PN hash |
| Latency | < 1 second from block activation to Kavach receipt |
| Reliability | Guaranteed delivery with acknowledgment |
| Fallback | If Kavach unavailable, block CANNOT be activated |

---

## 5. Constraints

### Regulatory Constraints
- Must comply with Indian Railways General & Subsidiary Rules (G&SR)
- Must comply with Indian Railway Signal Engineering Manual (IRSEM)
- Must comply with EN 50126/50128/50129 for safety-critical components
- Must support the Railway Board's 26-week Rolling Block Programme mandate

### Technical Constraints
- Must operate on Indian Railways' existing network infrastructure
- Must support low-bandwidth conditions at remote stations
- Must function in high-temperature environments (up to 50°C)
- Must support bilingual interface (English + Hindi)

### Organizational Constraints
- All safety-critical changes require Safety Team approval
- All schema changes require Architecture Team review
- Deployment to production requires DRM sign-off

---

## Version

| Field | Value |
|-------|-------|
| Document Version | `1.0.0` |
| Last Updated | `2026-08-24` |
| Reviewed By | (Pending) |
| Approved By | (Pending) |
| Next Review | `2026-09-24` |
