# Domain Assumptions & Governance Ledger — RailNexus ABP
### Reference: SIH 2026 PS 26027 | Protocol: .agents/rules/domain-governance.md
### Date: 2026-09-26

This document registers all domain rules, parameters, and operational thresholds used within RailNexus ABP, explicitly classifying them into **VERIFIED**, **INFERRED**, **CONFLICTING**, or **UNVERIFIED**.

In accordance with the Domain Governance Protocol, **no UNVERIFIED or INFERRED rule may be hardcoded as an immutable safety law**. Configurable policy parameters are provided with documented defaults.

---

## Domain Rules Inventory

| Rule ID | Domain Rule Description | Source & Reference | Classification | Type | Implementation Location |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **BR-001** | **IMR Replacement SLA:** Defective rail detected as IMR must be replaced within 3 days (72 hours); 30 km/h speed restriction imposed immediately. | IRPWM / USFD Manual (RDSO 2022) / `docs/references/usfd-rail-defect-classification.md` | **VERIFIED** | Statutory Safety Rule (Tier 1) | `backend/domain/rules/urgency_rules.py` |
| **BR-002** | **OBS Proximity Upgrade:** If two or more OBS defects are located within 4.0 metres of each other, they are upgraded to IMR. | USFD Manual (RDSO 2022) / `docs/domain-glossary.md` | **VERIFIED** | Statutory Classification Rule (Tier 1) | `backend/domain/rules/urgency_rules.py` |
| **BR-003** | **Unresolved Conflict Approval Invariant:** An operational block must NOT be approved while it has an active, unresolved blocking conflict. | `frontend/lib/rules.ts` / Architecture Spec | **VERIFIED** | Hard Safety Invariant | `backend/domain/rules/safety_invariants.py` |
| **BR-004** | **Urgency Tier Derivation:** Time to breach: <24h = Critical, 24-72h = Warning, 72-168h = Caution, >168h or null = Routine. | `frontend/lib/rules.ts` / `frontend/lib/types.ts` | **VERIFIED** | System Operational Rule | `backend/domain/rules/urgency_rules.py` |
| **BR-005** | **Source System Provenance:** Engg (P.Way) $\rightarrow$ TMS; S&T $\rightarrow$ SMMS; TRD $\rightarrow$ TDMS; Operating $\rightarrow$ COA/BDMS. | `docs/references/cris-source-systems.md` | **VERIFIED** | Architecture Integration Mapping (Tier 2) | `backend/domain/enums.py` |
| **BR-006** | **Spatial Clustering Boundary (5.0 km / 10.0 km):** Maximum spatial gap between maintenance activities on the same section to be integrated into a single block. | `ai_ml/optimizer.py` (5.0 km) vs legacy `backend/main.py` (10.0 km) | **MULTIPLE VALUES** | Configurable Policy (`default = 5.0 km`) | `backend/domain/rules/policy_config.py` |
| **BR-007** | **TRD De-Energization Buffer (15 min):** Power isolation setup & restoration safety buffer for 25 kV AC OHE possessions. | Proposed in Phase 2 Architecture | **UNVERIFIED** | Configurable Policy (`default = 15 min`) | `backend/domain/rules/policy_config.py` |
| **BR-008** | **S&T Disconnection Interlock:** Work on interlocking/track circuits requires disconnection memo authorization. | `docs/references/block-working-reference.md` / Signal Manual | **VERIFIED** (Requirement) / **INFERRED** (Form T/351 code) | Domain Safety Guard | `backend/domain/rules/safety_invariants.py` |
| **BR-009** | **Setup & Clearance Overhead:** 10 min setup + 10 min clearance + 3 min per extra machine for multi-machine blocks. | `ai_ml/optimizer.py#L158-L161` | **INFERRED** | Configurable Calculation Helper | `backend/domain/rules/policy_config.py` |
| **BR-010** | **Manual Override Justification:** Any operator modification to an AI recommendation requires non-empty justification notes. | Phase 2 Architecture / Audit Requirement | **VERIFIED** | System Audit Invariant | `backend/domain/entities/override.py` |
| **BR-011** | **Goods-Train Forecast Integration:** Maintenance block planning must integrate dynamic goods trains forecast from the Control Office (COA/FOIS). | SIH26027 Problem Statement / COA Practice | **VERIFIED (Mandate) / CONFIGURABLE (Weights)** | Operational Traffic Constraint | `docs/phase-4-persistence-architecture.md` |
| **BR-012** | **Defect vs Work Order Distinction:** Defects represent physical flaws (TMS/SMMS/TDMS); Maintenance Requests represent block possession work applications. | Indian Railways Operating Practice | **VERIFIED** | Domain Entity Separation | `docs/phase-4-persistence-architecture.md` |

---

## Detailed Assumption Records (DA)

### DA-001 — Spatial Integration Threshold
- **Status:** MULTIPLE VALUES (Reconciled Codebase Finding)
- **Codebase Locations & Values:**
  - `ai_ml/optimizer.py#L124` & `#L321`: Defaults to `max_spatial_gap_km = 5.0` in `check_compatibility()` and `optimize_requests()`.
  - `backend/api/schemas/prediction.py#L23`: Defaults to `max_spatial_gap_km = 5.0` for `POST /api/optimizer/optimize`.
  - `backend/api/schemas/shadow_block.py#L6`: Defaults to `max_spatial_gap_km = 5.0` for `POST /api/shadow-blocks`.
  - `ai_ml/scripts/test_full_pipeline.py#L391`: Uses `max_spatial_gap_km = 5.0`.
  - `backend/main.py#L73`: Legacy root endpoint `/api/shadow-opportunities` defaulted to `max_spatial_gap_km = 10.0`.
  - `frontend/lib/api.ts#L258`: Omits spatial gap in `POST /optimizer/optimize` payload, thereby defaulting to the backend's 5.0 km.
- **Domain Context:** Indian Railways block sections typically range between 5 km and 15 km in absolute length. A 5.0 km or 10.0 km threshold represents an operational clustering parameter for gang protection and machine travel, not a universal statutory safety law from G&SR.
- **Production Decision:** Treat as a **Configurable Policy Parameter** (`DomainPolicyConfig.max_spatial_gap_km = 5.0`). Retain 5.0 km as the canonical domain default (aligning with the active CP-SAT optimizer engine and primary API schema), but allow runtime divisional configuration.
- **Action:** Documented discrepancy between legacy `backend/main.py` (10 km) and core `ai_ml/optimizer.py` (5 km). When unifying legacy routes in Phase 5, all endpoints will reference `DomainPolicyConfig.max_spatial_gap_km`.

---

### DA-002 — TRD Power Isolation Buffer
- **Status:** UNVERIFIED
- **Current implementation:** Proposed 15-minute de-energization buffer before block start and 15-minute restoration buffer after work.
- **Domain Context:** Traction Power Controller (TPC) switching operations, earthing discharge rod placement, and Permit to Work (PTW) issuance take between 10 and 20 minutes depending on remote supervisory control (SCADA) vs manual isolator switches.
- **Production Decision:** Treat as a **Configurable Policy Parameter** (`PolicyConfig.power_isolation_buffer_minutes = 15`).
- **Action:** Expose parameter in domain policy config rather than hardcoding into safety validation.

---

### DA-003 — S&T Disconnection Documentation
- **Status:** INFERRED
- **Current implementation:** `cautions.append("S&T_disconnection_sequence_required")` in `ai_ml/optimizer.py#L142`.
- **Domain Context:** Indian Railways Block Working Rules require that before interfering with any point machine, signal, or track circuit, a written or digital Disconnection Memo must be acknowledged by the Station Master. Form S&T (T/351) is standard IR practice.
- **Production Decision:** The domain model verifies that `requires_disconnection` is flagged and tracks digital acknowledgment. Form code is treated as metadata, not an algorithmic prerequisite.
- **Action:** Provide `snt_disconnection_granted: bool` guard on operational blocks.

---

### DA-004 — Setup and Clearance Time Model
- **Status:** INFERRED
- **Current implementation:** `setup = 10.0`, `clearance = 10.0 + max(0, len(requests) - 2) * 3.0` in `ai_ml/optimizer.py#L158-L159`.
- **Domain Context:** Derived from field practice for banner flag placement, detonator protection (1200m / 600m), and machine travel from block station to work site.
- **Production Decision:** Maintained as a calculation policy helper within `backend/domain/rules/policy_config.py`.
- **Action:** Can be adjusted per machine type in future phases.

---

### DA-005 — PM (Predictive Maintenance) Category Status
- **Status:** VERIFIED (Project-defined, documented in glossary)
- **Reference:** `docs/domain-glossary.md#L42-L52`
- **Domain Context:** Real USFD testing only recognizes IMR and OBS (REM is deprecated). PM represents tasks generated by AI/sensor predictions (TDMS/SMMS telemetric trends).
- **Production Decision:** Retained as a valid `Category` enum value, strictly labeled as a system-defined predictive category.
- **Action:** Never confuse PM with USFD defect classifications; keep separate from physical flaw urgency.

---

### DA-006 — Goods-Train Forecast Traffic Window Model
- **Status:** VERIFIED (Core Requirement) / CONFIGURABLE POLICY & INFERRED (Parameters)
- **Reference:** SIH 2026 Problem Statement PS 26027 ("goods trains forecast from the Control Office")
- **Domain Context:** Freight / goods trains in Indian Railways do not run according to fixed, published public timetables. Instead, the Control Office (Chief Controller / Freight Controller) issues rolling operational forecasts based on rake availability, loading siding readiness, and crew ordering.
- **Classification Breakdown:**
  1. *Core Requirement (VERIFIED):* Integrating dynamic goods-train forecasts from the Control Office into maintenance block planning is an explicit, verified SIH26027 requirement.
  2. *Confidence Weights (CONFIGURABLE POLICY):* The specific default confidence weight (e.g. 0.80 for freight vs 1.0 for passenger) is a configurable policy parameter (`DomainPolicyConfig.goods_forecast_default_confidence = 0.80`), not an IR statutory standard or SIH-mandated number.
  3. *Forecast Horizon (INFERRED):* The 8-hour to 24-hour forecast window is an inferred operational design matching standard IR divisional shift ordering cycles.
  4. *Penalty Formula (INFERRED):* The exact delay penalty formula (delay × confidence × priority) is an inferred implementation heuristic for the CP-SAT optimizer objective function.
  5. *Tonnage & Commodity (OPTIONAL / INFERRED):* Gross tonnage (`expected_tonnage_mgt`) and commodity/rake type are optional metadata fields for future track degradation modeling, not mandatory SIH inputs.
- **Production Decision:** Represent goods traffic in `train_movements` with `movement_type = 'GOODS_FORECAST'`, `forecast_window_start`, `forecast_window_end`, and `confidence_weight`. Do not build a large enterprise freight-dispatch system; supply only the corridor traffic constraint intervals required by the block optimizer.
- **Action:** Implemented in Phase 4 persistence specification.

---

### DA-007 — Defect vs Maintenance Work Order Distinction & Cardinality
- **Status:** VERIFIED (Domain Entity Separation)
- **Reference:** Indian Railways P-Way / S&T / TRD Maintenance Practice
- **Domain Context:** A defect is a physical flaw on railway infrastructure (e.g., an ultrasonic rail flaw detected by a USFD trolley, a cracked fishplate, or a drooping contact wire). A maintenance request is a work application submitted by a Senior Section Engineer (SSE) demanding track possession time, personnel, and machine resources. In `railnexus.db`, all 15 existing records represent maintenance work applications (`work_type = "RAIL_REPLACEMENT"`, `"Track Maintenance"`), not raw defect flaw readings.
- **Production Decision:** Preserve all 15 existing records as `maintenance_requests`. Create the `defects` table for genuine CRIS feeds. Do not manufacture synthetic defect records merely to populate the new table. Model the relationship as an $M:N$ join table `request_defects`.
- **Action:** Implemented in Phase 4 persistence specification.
