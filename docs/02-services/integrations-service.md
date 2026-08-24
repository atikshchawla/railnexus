# 🔌 Integrations Service — External System Adapters

> **Module Path:** `lib/services/integrations/`
> **Owner:** Platform Engineering Team
> **Priority:** Critical (data foundation for all AI/scheduling)

---

## Purpose

The Integrations Service provides **standardized adapters** for all four legacy railway data systems. Each sub-module encapsulates the complexity of communicating with proprietary railway protocols, transforming raw data into the RailNexus domain model.

---

> [!CAUTION]
> **NEVER expose raw external system data to other services.** All data MUST pass through the transformer layer before entering the RailNexus domain. External system schemas are unstable and may change without notice.

> [!WARNING]
> **NEVER couple integration sub-modules to each other.** TMS adapter must not import from SMMS adapter. Cross-integration logic belongs in the service layer above (e.g., Block Planning Service).

---

## Sub-Module Architecture

```
lib/services/integrations/
├── tms/                    # Track Management System
│   ├── index.ts            # Public exports
│   ├── tms.client.ts       # HTTP client for TMS REST API
│   ├── tms.transformer.ts  # Raw TMS data → RailNexus domain model
│   └── types.ts            # TMS-specific raw types
├── smms/                   # Signal Maintenance & Management System
│   ├── index.ts
│   ├── smms.client.ts      # Protocol converter client for SMMS data loggers
│   ├── smms.transformer.ts
│   └── types.ts
├── tdms/                   # Traction Distribution Management System
│   ├── index.ts
│   ├── tdms.client.ts
│   ├── tdms.transformer.ts
│   └── types.ts
└── coa/                    # Control Office Application
    ├── index.ts
    ├── coa.client.ts       # Kafka/MQTT consumer for real-time operations data
    ├── coa.transformer.ts
    └── types.ts
```

---

## TMS Integration (Track Management System)

### Data Endpoints

| Endpoint | Method | Data Returned | Polling Interval |
|----------|--------|---------------|-----------------|
| `/api/tms/defects` | GET | Rail defects (IMR, OBS) with location | 5 minutes |
| `/api/tms/geometry` | GET | TGI values, OMS acceleration peaks | 15 minutes |
| `/api/tms/renewals` | GET | Planned track renewal schedules | Daily |
| `/api/tms/defects/:id/resolve` | POST | Mark defect as resolved | On completion |

### Data Transformation

```typescript
// Raw TMS format
interface TmsRawDefect {
  defect_id: string;
  rail_section: string;
  km_from: string;      // "1234/5" chainage format
  km_to: string;
  defect_type: 'IMR' | 'OBS' | 'AWT';
  detected_date: string; // DD-MM-YYYY
  severity_code: number;
  usfd_reading?: number;
}

// RailNexus domain format
interface TrackDefect {
  id: string;
  source: 'TMS';
  type: 'IMR' | 'OBS';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  location: {
    section: string;
    fromKm: number;     // Decimal km
    toKm: number;
    line: 'UP' | 'DOWN';
  };
  detectedAt: Date;
  deadline: Date;       // Computed: IMR = detectedAt + 3 days
  isOverdue: boolean;
  rawData: TmsRawDefect; // Preserved for audit
}
```

### Constraint Rules

| Rule | Constraint |
|------|-----------|
| IMR Defect | **MUST** trigger forced block allocation within 72 hours of `detectedAt` |
| OMS Peak > 0.15g | Flags section for tamping in tactical schedule |
| TGI < threshold | Escalates to strategic schedule for track renewal |

---

## SMMS Integration (Signal Maintenance & Management System)

### Data Endpoints

| Source | Protocol | Data Returned | Latency |
|--------|----------|---------------|---------|
| Data Loggers (Relay Room) | Proprietary → MQTT bridge | Relay states, EI health, point machine current | < 500ms |
| SMMS Database | REST API | Maintenance history, equipment registry | 5 minutes |
| Field Sensors | MQTT | Track circuit impedance, signal lamp status | < 200ms |

### PINN Integration

The SMMS data feeds directly into the PINN RUL prediction model:

```
SMMS Data Logger → Edge Gateway → Kafka → Feature Store → PINN Model
                                                              │
                                              Predictive Alert ─┘
                                                              │
                                              Scheduling Engine ◄──┘
```

### Security Concern

> [!CAUTION]
> SMMS protocol converters interface with **safety-critical signalling hardware**. The integration is **strictly read-only**. The RailNexus system MUST NEVER write commands to SMMS data loggers or EI systems. Any write capability would violate SIL-4 requirements and G&SR regulations.

---

## TDMS Integration (Traction Distribution Management System)

### Data Endpoints

| Endpoint | Method | Data Returned | Polling Interval |
|----------|--------|---------------|-----------------|
| `/api/tdms/power-blocks` | GET | Scheduled power block requisitions | 15 minutes |
| `/api/tdms/ohe-inspections` | GET | Contact wire height, stagger, wear metrics | Daily |
| `/api/tdms/neutral-sections` | GET | Neutral section locations and status | Weekly |

### Shadow Block Logic

TDMS is the **primary beneficiary** of shadow blocks. When Engineering has a traffic block:

1. Query TDMS for pending OHE work in the same geographic zone.
2. If OHE work exists → propose TRD shadow block.
3. Verify OHE de-energization is compatible with Engineering block safety plan.
4. If compatible → bundle as shadow block, saving a separate power block request.

---

## COA Integration (Control Office Application)

### Data Streams

| Stream | Protocol | Content | Volume |
|--------|----------|---------|--------|
| Master Timetable | REST (batch) | Fixed passenger train schedules | Daily refresh |
| Dynamic Freight Forecast | Kafka (streaming) | Predicted freight train movements | Continuous |
| Delay Telemetry | Kafka (streaming) | Real-time passenger train delay updates | Continuous |
| Locomotive GPS | MQTT (streaming) | Real-time train position telemetry | Every 30 seconds |

### Corridor Analysis

The COA integration is the **foundation** for corridor analysis:

```
Master Timetable + Dynamic Freight → Available Corridors
                                           │
                              Block Scheduling Engine ◄──┘
```

A corridor is a gap between two consecutive train movements on the same section where a maintenance block can be safely inserted without causing delays.

---

## Integration Health Monitoring

| Metric | Threshold | Alert Level |
|--------|-----------|-------------|
| TMS API response time | > 5 seconds | WARNING |
| TMS API unavailable | > 5 minutes | CRITICAL |
| SMMS data logger silent | > 2 minutes | CRITICAL (safety) |
| TDMS API response time | > 5 seconds | WARNING |
| COA Kafka consumer lag | > 1000 messages | HIGH |
| COA GPS telemetry gap | > 2 minutes | WARNING |

---

## Version

| Field | Value |
|-------|-------|
| Version | `1.0.0` |
| Last Updated | `2026-08-24` |
| Author | RailNexus Architecture Team |
