# 🛡️ Safety Mechanisms & Fail-Safe Architecture

> **Priority:** ABSOLUTE — Safety is non-negotiable and supersedes all other system concerns.
> **Compliance:** EN 50126, EN 50128, EN 50129 (SIL-4)

---

> [!CAUTION]
> **THIS DOCUMENT IS THE MOST CRITICAL DOCUMENT IN THE ENTIRE PROJECT.**
> Every engineer MUST read and understand this before writing any code that interacts with safety-related data or systems. Violations of the principles here can result in loss of life.

---

## Fundamental Safety Axiom

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                   │
│   The AI PROPOSES.  The Human REVIEWS.  The Safety System GUARDS. │
│                                                                   │
│   Under NO circumstances can the AI optimization layer           │
│   directly command safety-critical hardware.                      │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Three-Layer Safety Model

```
Layer 1: AI Optimization Plane (ADVISORY ONLY)
    │
    │  Proposes schedules, identifies corridors, predicts failures
    │  CAN: Read safety state, propose actions
    │  CANNOT: Write to EI, control signals, move points
    │
    ▼
Layer 2: Human-in-the-Loop (DECISION AUTHORITY)
    │
    │  Reviews AI proposals, applies tacit knowledge, approves/rejects
    │  CAN: Approve blocks, exchange PNs, override AI
    │  CANNOT: Bypass EI safety interlocking logic
    │
    ▼
Layer 3: Safety Execution Plane (SIL-4 AUTONOMOUS)
    │
    │  Electronic Interlocking, Kavach, Track Circuits
    │  CAN: Prevent ALL unsafe movements regardless of human/AI commands
    │  CANNOT: Be overridden by software — hardware fail-safe
    │
    ▼
Physical Railway (trains, track, signals, people)
```

---

## Safety Mechanism 1: Absolute Block Working & Electronic Interlocking

### How It Works

When a maintenance block is activated (via Private Number exchange):

1. **Signal Fettering**: The EI digitally locks ALL signals protecting the block section to their most restrictive aspect (RED/DANGER).
2. **Route Locking**: All routes leading INTO the block section are logically locked. The Station Master **physically cannot** clear a signal into the section.
3. **Track Circuit Occupation**: Maintenance vehicles occupy track circuits, which the EI interprets as "train present" — providing an additional layer of protection.
4. **Point Locking**: All points within the block section are clamped in their current position.

### EI Inviolability Guarantee

```
IF block_section.status == ACTIVE:
    FOR ALL signals protecting this section:
        signal.aspect = DANGER (RED)
        signal.clearance = BLOCKED
        
    Even if the AI system sends erroneous "clear" commands:
        → EI IGNORES the command (hardware logic)
        → EI logs the erroneous command for audit
        → Alert sent to safety monitoring
    
    Even if the Station Master attempts to clear the signal:
        → EI physically prevents route setting
        → EI displays "ROUTE LOCKED - MAINTENANCE BLOCK ACTIVE"
```

> [!IMPORTANT]
> The EI's safety logic operates on **certified hardware** that is **independent of the RailNexus software stack**. Even if the entire RailNexus cloud infrastructure fails, the EI continues to enforce safety. This is by design.

---

## Safety Mechanism 2: Kavach (TCAS) Integration

### Collision Avoidance for Block Zones

Kavach provides the **final safety net** against human error (e.g., Signal Passed at Danger):

```
RailNexus                    Kavach Network
    │                              │
    │  block.activated event       │
    │  (block_zone coordinates)    │
    ├─────────────────────────────►│
    │                              │
    │                              │  Broadcasts block zone to
    │                              │  all locomotives in area
    │                              │
    │                              │  IF locomotive approaches block zone:
    │                              │      Kavach onboard unit detects proximity
    │                              │      
    │                              │      IF speed > 0 AND distance < braking_distance:
    │                              │          → AUTOMATIC EMERGENCY BRAKE
    │                              │          → Independent of driver action
    │                              │          → Train stops before entering block zone
    │                              │
    │  block.completed event       │
    │  (clear block zone)          │
    ├─────────────────────────────►│
    │                              │  Removes block zone from Kavach network
```

### Kavach Data Feed Format

| Field | Type | Description |
|-------|------|-------------|
| `zone_id` | String | Unique block zone identifier |
| `section` | String | Railway section code |
| `from_km` | Float | Start kilometer |
| `to_km` | Float | End kilometer |
| `line` | Enum | UP / DOWN / BOTH |
| `status` | Enum | ACTIVE / CLEARED |
| `activated_at` | DateTime | UTC timestamp |
| `private_number_hash` | String | SHA-256 hash of PN for verification |

---

## Safety Mechanism 3: Out-of-Correspondence (OOC) Detection

### The Hazard

A point machine may be commanded to move to REVERSE but physically fail to reach or lock in that position. This creates an **out-of-correspondence** state — the most dangerous condition in railway signalling.

### Detection and Response

```
Point Machine Command: REVERSE
    │
    ▼
Physical Position Sensor: NEITHER NORMAL NOR REVERSE
    │
    ▼
EI detects: OUT OF CORRESPONDENCE
    │
    ├──► EI immediately locks ALL routes through this point to BLOCKED
    ├──► ALL protecting signals forced to RED
    ├──► Track circuits in vicinity flagged as UNSAFE
    │
    ▼
Digital Twin receives OOC event (< 200ms)
    │
    ├──► Point icon changes to FLASHING RED X
    ├──► Zone highlighted in red on map
    ├──► Audible alarm on all operator dashboards
    │
    ▼
AI Scheduler receives OOC event
    │
    ├──► HALTS all automated scheduling in the affected zone
    ├──► Defaults to MANUAL CONTROL mode
    ├──► Generates emergency S&T maintenance block request
    │
    ▼
Human Station Master takes ABSOLUTE CONTROL
    │
    ├──► Manual point operation procedures (G&SR)
    └──► S&T maintenance team dispatched
```

---

## Safety Mechanism 4: Emergency Block Cancellation

### Scenario
A Medical Relief Van (MRV) must be dispatched through a section where a maintenance block is active.

### Protocol

```
1. Traffic Controller initiates EMERGENCY BLOCK CANCELLATION
2. System sends immediate alert to ALL maintenance crews via:
   ├── Mobile IoT devices (push notification + alarm)
   ├── Field radio (backup)
   └── Digital Twin visual alert
3. On-site SSE receives alert
4. SSE ensures:
   ├── All heavy machinery is CLEAR of running lines
   ├── All staff are CLEAR of running lines
   └── Track is physically safe for passage
5. SSE digitally signs RECONNECTION MEMO
6. SSE confirms: "Track clear, safe for passage"
7. ONLY THEN: Signals can be cleared for MRV passage
8. After MRV passes: Block can be reactivated (new PN exchange)
```

> [!WARNING]
> **Signals CANNOT be cleared until the Reconnection Memo is digitally signed.** This ensures no scenario where an emergency cancellation results in a train entering a section with maintenance crews still on the track.

---

## Safety Mechanism 5: Digital Twin State Verification

The Digital Twin continuously monitors for discrepancies between:
- **Commanded state** (what the system thinks should be happening)
- **Physical state** (what sensors report is actually happening)

| Discrepancy | Severity | Automatic Response |
|-------------|----------|-------------------|
| Signal aspect mismatch | CRITICAL | Alert safety team, flag in Twin |
| Point position mismatch | CRITICAL | OOC protocol (see above) |
| Track circuit showing occupied when expected clear | HIGH | Verify with adjacent circuits |
| Block zone active but no PN exchanged | CRITICAL | Halt all operations in zone |
| PN exchanged but signals not fettered | CRITICAL | Force-fetter signals, alert EI maintenance |

---

## Safety Coding Rules

> [!CAUTION]
> Every developer MUST follow these rules. Violations trigger mandatory code review by the Safety Team.

### Rule 1: NEVER Write to Safety Hardware
```typescript
// ❌ ABSOLUTELY FORBIDDEN
eiInterface.setSignal(signalId, 'GREEN');
eiInterface.movePoint(pointId, 'REVERSE');
kavachSystem.clearZone(zoneId);

// ✅ CORRECT — Read Only
const signalState = await eiInterface.getSignalState(signalId);
const pointPosition = await eiInterface.getPointPosition(pointId);
```

### Rule 2: NEVER Skip the Human-in-the-Loop
```typescript
// ❌ ABSOLUTELY FORBIDDEN
if (aiProposal.confidence > 0.95) {
  await blockService.activate(blockId); // Auto-activation without human!
}

// ✅ CORRECT — Always route through approval
await approvalService.submitForApproval(blockId);
// Human reviews and clicks "Approve"
```

### Rule 3: NEVER Suppress Safety Alerts
```typescript
// ❌ ABSOLUTELY FORBIDDEN
try {
  await processBlock(block);
} catch (SafetyAlert) {
  // Silently ignore
}

// ✅ CORRECT — Escalate immediately
try {
  await processBlock(block);
} catch (error) {
  if (error instanceof SafetyAlert) {
    await safetyService.escalate(error);
    await notificationService.alertAll(error);
    throw error; // ALWAYS re-throw safety errors
  }
}
```

### Rule 4: NEVER Modify Safety Constants
```typescript
// ❌ ABSOLUTELY FORBIDDEN
const IMR_DEADLINE_HOURS = 96; // Extended from 72!

// ✅ CORRECT — Use immutable constants
const IMR_DEADLINE_HOURS = 72 as const; // 3 days, per railway regulations
// This value is set by G&SR and CANNOT be modified by software
```

### Rule 5: ALWAYS Log Safety-Related Actions
```typescript
// Every safety-relevant action must be logged to the immutable audit trail
await auditLog.logSafetyAction({
  action: 'BLOCK_ACTIVATED',
  blockId,
  privateNumber: hashPN(pn),
  userId,
  timestamp: new Date(),
  ipAddress: req.ip,
  metadata: { ... }
});
```

---

## Safety Testing Requirements

| Test Type | Scope | Frequency | Standard |
|-----------|-------|-----------|----------|
| Unit tests on safety modules | All safety service methods | Every commit | 100% coverage mandatory |
| Integration tests | Safety service ↔ EI mock | Every PR | All scenarios covered |
| Failure mode testing | What happens when X fails? | Weekly | FMEA analysis |
| Penetration testing | Can safety be bypassed? | Monthly | OWASP + railway-specific |
| SIL-4 certification audit | Entire safety execution plane | Annually | EN 50126/50128/50129 |

---

## Version

| Field | Value |
|-------|-------|
| Version | `1.0.0` |
| Last Updated | `2026-08-24` |
| Author | RailNexus Safety Engineering Team |
