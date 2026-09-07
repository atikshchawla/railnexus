# 🔌 External System Integration Architecture

> Detailed integration specifications for all four legacy railway data systems.

---

## Integration Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       EXTERNAL LEGACY SYSTEMS                           │
│                                                                         │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌──────────────────┐   │
│  │   TMS   │    │  SMMS   │    │  TDMS   │    │      COA         │   │
│  │ (REST)  │    │ (Proto) │    │ (REST)  │    │ (Kafka + REST)   │   │
│  └────┬────┘    └────┬────┘    └────┬────┘    └────────┬─────────┘   │
│       │              │              │                   │              │
└───────┼──────────────┼──────────────┼───────────────────┼──────────────┘
        │              │              │                   │
   ┌────▼────┐    ┌────▼────┐    ┌────▼────┐    ┌────────▼─────────┐
   │ TMS     │    │ SMMS    │    │ TDMS    │    │ COA Adapter      │
   │ Adapter │    │ Adapter │    │ Adapter │    │ (Kafka Consumer  │
   │ (Poll)  │    │ (Stream)│    │ (Poll)  │    │  + REST Client)  │
   └────┬────┘    └────┬────┘    └────┬────┘    └────────┬─────────┘
        │              │              │                   │
        └──────────────┼──────────────┼───────────────────┘
                       │              │
                ┌──────▼──────────────▼──────┐
                │    TRANSFORMER LAYER       │
                │    (Normalize → Validate   │
                │     → Map to Domain)       │
                └──────────────┬─────────────┘
                               │
                        ┌──────▼──────┐
                        │ DATA LAKE   │
                        │ (PostgreSQL │
                        │  + Timescale│
                        │  + Redis)   │
                        └─────────────┘
```

---

## Integration Protocol Matrix

| System | Protocol | Direction | Pattern | Auth | Retry Policy |
|--------|----------|-----------|---------|------|-------------|
| **TMS** | REST/HTTPS | Bidirectional | Polling (5 min) | API Key + mTLS | 3 retries, exponential backoff |
| **SMMS** | Proprietary → MQTT | Inbound only | Streaming | Certificate-based | Reconnect with backoff |
| **TDMS** | REST/HTTPS | Inbound only | Polling (15 min) | API Key + mTLS | 3 retries, exponential backoff |
| **COA** | Kafka + REST | Inbound only | Streaming + Polling | SASL/SCRAM + API Key | Consumer group auto-rebalance |

---

## Data Freshness Requirements

| Data Type | Source | Maximum Staleness | Consequence of Stale Data |
|-----------|--------|-------------------|--------------------------|
| IMR Defect Alerts | TMS | **5 minutes** | Missed safety-critical deadline |
| Train Position | COA GPS | **30 seconds** | Inaccurate Digital Twin |
| Signal Aspects | SMMS | **500 ms** | Safety display discrepancy |
| Track Circuit Occupancy | SMMS | **500 ms** | Safety-critical state mismatch |
| OHE Inspection Reports | TDMS | 24 hours | Acceptable for tactical scheduling |
| Freight Forecasts | COA | 15 minutes | Sub-optimal corridor analysis |
| TGI / OMS Data | TMS | 24 hours | Acceptable for strategic scheduling |

---

## Error Handling & Resilience

### Circuit Breaker Pattern

Each integration adapter implements a circuit breaker:

```
CLOSED (normal) ──── failures > threshold ────► OPEN (reject all)
     ▲                                                │
     │                                          timeout expires
     │                                                │
     └──── success ◄─── HALF-OPEN (try one request) ◄─┘
```

| Parameter | TMS | SMMS | TDMS | COA |
|-----------|-----|------|------|-----|
| Failure threshold | 5 failures in 1 min | 3 failures in 30s | 5 failures in 1 min | 10 failures in 5 min |
| Open duration | 30 seconds | 10 seconds | 30 seconds | 60 seconds |
| Half-open max attempts | 1 | 1 | 1 | 3 |

### Fallback Strategies

| System Down | Fallback Strategy |
|-------------|------------------|
| TMS unavailable | Use last cached defect data (max 1 hour stale), alert ops |
| SMMS disconnected | **CRITICAL**: Alert safety team immediately, degrade to manual monitoring |
| TDMS unavailable | Use cached OHE data (max 24 hours), proceed with Engg-only scheduling |
| COA unavailable | Freeze current timetable as baseline, disable dynamic corridor updates |

---

## Data Transformation Examples

### TMS Chainage Format Conversion

```typescript
// TMS uses "1234/5" format (kilometer/hectometer)
// RailNexus uses decimal km (1234.5)

function parseChainageToKm(chainage: string): number {
  const [km, hm] = chainage.split('/');
  return parseInt(km) + parseInt(hm || '0') / 10;
}

// Example: "1234/5" → 1234.5
// Example: "987/0" → 987.0
```

### COA Time Format Normalization

```typescript
// COA uses IST (UTC+5:30) with various formats
// RailNexus uses ISO 8601 UTC internally, displays in IST

function normalizeCoaTime(coaTime: string): Date {
  // COA may send "14:30" (today), "14:30 25-08-2026", or Unix timestamp
  // Always normalize to UTC Date object
}
```

---

## Version

| Field | Value |
|-------|-------|
| Version | `1.0.0` |
| Last Updated | `2026-08-24` |
| Author | RailNexus Architecture Team |
