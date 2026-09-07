# 🎯 UX Flows — Operator Journey Design

> **Owner:** UX / Frontend Team
> **Target Users:** Non-technical railway operators (SSE, SM, Controllers)
> **Design Principle:** ≤ 3 clicks to review and approve an AI-generated block proposal (NFR-03)

---

> [!IMPORTANT]
> Every screen, interaction, and flow described here is designed for **non-technical operators** who may have limited software literacy. Cognitive load must be minimized at every step. Prefer spatial/visual representations over textual data.

---

## Primary User Journeys

### Journey 1: Block Request → AI Proposal → Approval → Execution

This is the **core daily workflow** — the most critical UX flow in the entire system.

```
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 1: SSE Logs In → Dashboard                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  🔔 Alert Banner: "2 new defects detected in your section"    │  │
│  │                                                                │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │  │
│  │  │ Pending     │  │ Active      │  │ Today's Schedule    │  │  │
│  │  │ Blocks: 5   │  │ Blocks: 2   │  │ ████░░░░░░░ 45%    │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘  │  │
│  │                                                                │  │
│  │  📋 Recent Defects:                                            │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │ ⚠️ IMR #4521 | Km 245/3 | Rail fracture | 2 days left │  │  │
│  │  │ ℹ️ OBS #4520 | Km 248/1 | Weld defect  | Routine      │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                    SSE taps on IMR defect
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 2: AI Proposal Card                                           │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  🤖 AI Recommendation                                        │  │
│  │  ──────────────────────────────────────────────────────────   │  │
│  │  "AI proposes a 2-hour integrated block tomorrow at           │  │
│  │   14:00 hrs between Km 244 and Km 248.                       │  │
│  │                                                                │  │
│  │   This utilizes an existing S&T corridor, saving              │  │
│  │   45 minutes of total downtime."                              │  │
│  │                                                                │  │
│  │  Confidence: ████████░░ 82%                                   │  │
│  │  Shadow blocks available: 1 (TRD OHE inspection)              │  │
│  │  Trains affected: 0 passenger, 1 freight (can be held)        │  │
│  │                                                                │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐     │  │
│  │  │ 🗺️ View in   │  │ ✏️ Adjust    │  │ ✅ Request     │     │  │
│  │  │   Twin       │  │   Timing     │  │   Block        │     │  │
│  │  └──────────────┘  └──────────────┘  └────────────────┘     │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                    SSE taps "View in Twin"
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 3: Digital Twin Simulation                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  [═══════════════ MAP VIEW ═══════════════════════════════]  │  │
│  │  ┌─────────────────────────────────────────────────────────┐│  │
│  │  │   Stn A ──────●──────── Km 245 ────────●──── Stn B    ││  │
│  │  │              🔴                         🔴              ││  │
│  │  │         ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                    ││  │
│  │  │         ▓ PROPOSED BLOCK (amber) ▓                    ││  │
│  │  │         ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                    ││  │
│  │  │    🚃→                                                 ││  │
│  │  │    (freight held at loop)                              ││  │
│  │  └─────────────────────────────────────────────────────────┘│  │
│  │                                                                │  │
│  │  ┌─ TIMELINE SLIDER ─────────────────────────────────────┐  │  │
│  │  │  12:00  13:00  [14:00═══BLOCK═══16:00]  17:00  18:00 │  │  │
│  │  │          ◄═══════════●══════════════►                  │  │  │
│  │  │                   (drag to adjust)                     │  │  │
│  │  └───────────────────────────────────────────────────────┘  │  │
│  │                                                                │  │
│  │  Status: ✅ GREEN — No conflicts detected                     │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                    SSE drags timeline to extend by 30 min
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 4: Temporal Adjustment with Live Recalculation               │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  TIMELINE:                                                     │  │
│  │  12:00  13:00  [14:00═══BLOCK════16:30]  17:00  18:00        │  │
│  │                                    ▲                           │  │
│  │                              Extended by 30 min               │  │
│  │                                                                │  │
│  │  ⚠️ WARNING: Extension overlaps with Rajdhani Express          │  │
│  │     path at 16:15. Block section turns RED.                    │  │
│  │                                                                │  │
│  │  💡 Suggestion: Start 30 min earlier (13:30-16:00)            │  │
│  │     to avoid conflict.                                         │  │
│  │                                                                │  │
│  │  ┌──────────────────┐  ┌──────────────────┐                   │  │
│  │  │ ↩️ Revert        │  │ 🕐 Apply         │                   │  │
│  │  │   to Original    │  │   Suggestion     │                   │  │
│  │  └──────────────────┘  └──────────────────┘                   │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                    SSE applies suggestion → GREEN
                    SSE clicks "Request Block"
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 5: Controller's Approval Dashboard                           │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  📥 Pending Approvals (3)                                     │  │
│  │                                                                │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │ #BLK-4521 | Engg | IMR Rail Fracture | Km 244-248     │  │  │
│  │  │ Tomorrow 13:30-16:00 | AI Confidence: 82%              │  │  │
│  │  │ Shadow: TRD OHE inspection bundled                      │  │  │
│  │  │ Impact: 1 freight held 15 min at loop                   │  │  │
│  │  │                                                          │  │  │
│  │  │  ┌────────────┐  ┌──────────────┐  ┌────────────────┐ │  │  │
│  │  │  │ 🗺️ Simulate │  │ ✅ Approve   │  │ ❌ Reject     │ │  │  │
│  │  │  └────────────┘  └──────────────┘  └────────────────┘ │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                    Controller approves
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 6: Private Number Exchange                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  🔐 Secure Authorization                                      │  │
│  │                                                                │  │
│  │  Block #BLK-4521 approved. Track possession requires          │  │
│  │  Private Number exchange.                                      │  │
│  │                                                                │  │
│  │  Private Number: ██████ (visible only to SM & SSE)             │  │
│  │                                                                │  │
│  │  ☐ Station Master acknowledged                                 │  │
│  │  ☐ Section Engineer acknowledged                               │  │
│  │                                                                │  │
│  │  ⏳ Waiting for dual acknowledgment...                         │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                    Both parties acknowledge
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 7: Block Execution View                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  🟢 BLOCK ACTIVE — BLK-4521                                   │  │
│  │  Section: Km 244-248 | Line: UP                               │  │
│  │  Signals: FETTERED (RED) 🔴                                    │  │
│  │  Kavach: Block zone ACTIVE                                     │  │
│  │                                                                │  │
│  │  Time remaining: 1:45:00 ████████████░░░                      │  │
│  │                                                                │  │
│  │  Active work:                                                  │  │
│  │  ├── 🟠 Engg: Rail replacement at Km 245/3                    │  │
│  │  └── 🔵 TRD: OHE inspection (shadow) at Km 246               │  │
│  │                                                                │  │
│  │  ┌──────────────────────────────────────────────────────┐     │  │
│  │  │ ⚡ Emergency Cancel │ 🕐 Request Extension │ ✅ Complete │ │  │
│  │  └──────────────────────────────────────────────────────┘     │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Journey 2: Emergency IMR Override

When an IMR defect is detected with ≤ 24 hours remaining before the 3-day deadline:

```
TMS detects IMR defect
        │
        ▼
🚨 System-wide alert to SSE + Controller + SM
        │
        ▼
AI force-generates block (bypasses normal queue)
        │
        ▼
Controller receives emergency approval request
(highlighted in RED, with countdown timer)
        │
        ▼
Fast-track approval (single click)
        │
        ▼
Immediate PN exchange → Block activation
```

---

## Journey 3: 26-Week RBP Review

```
DRM opens Strategic Schedule view
        │
        ▼
Gantt-style view of next 26 weeks
(color-coded by department, major works highlighted)
        │
        ▼
Drill-down into any week → see daily blocks
        │
        ▼
Review AI-generated schedule
(shadow utilization %, corridor usage %)
        │
        ▼
DRM signs off or requests modifications
```

---

## UI Component Specifications

### 1. Block Proposal Card

| Element | Specification |
|---------|--------------|
| **Layout** | Card with header (priority badge), body (AI summary), footer (action buttons) |
| **Priority Badge** | IMR = Red pulse, Predictive = Orange, Preventive = Blue, Routine = Gray |
| **AI Summary** | Natural language description of the proposal, ≤ 3 sentences |
| **Confidence Bar** | Horizontal progress bar (0-100%), color-coded (red < 50, yellow 50-75, green > 75) |
| **Shadow Block Indicator** | Chip/badge showing "Shadow: TRD" or "Integrated: Engg + S&T" |
| **Action Buttons** | "View in Twin" (secondary), "Adjust Timing" (secondary), "Request Block" (primary) |

### 2. Timeline Slider

| Element | Specification |
|---------|--------------|
| **Range** | 24-hour view (default) with zoom to 4-hour and 1-hour |
| **Block Display** | Colored rectangles on the timeline, draggable start/end handles |
| **Train Overlay** | Thin lines showing scheduled train paths crossing the section |
| **Conflict Indicator** | Red glow on timeline where block overlaps with train path |
| **Drag Behavior** | On drag, instant recalculation of conflicts (< 500ms feedback) |

### 3. Digital Twin Map

| Element | Specification |
|---------|--------------|
| **Base Map** | Dark-mode geospatial map (Mapbox/Deck.gl) |
| **Track Lines** | Precise geometric representation, color-coded by section |
| **Signals** | Circle nodes with color-light aspects (Red/Yellow/Double Yellow/Green) |
| **Points** | Animated switch indicators (Normal ↔ Reverse) |
| **Trains** | Pulsing chevrons/dots moving along track, with speed indicator |
| **Block Overlay** | Amber pulse = Engg block, Striped blue = TRD power block, Green hatch = S&T |
| **Interaction** | Click on any element for detail panel, pinch-zoom, pan |

### 4. Approval Queue

| Element | Specification |
|---------|--------------|
| **Layout** | List view, sorted by priority (IMR first), then chronological |
| **Filters** | Department, Priority, Date Range, Status |
| **Quick Actions** | One-click approve/reject with confirmation dialog |
| **Batch Operations** | Select multiple routine blocks for batch approval |

---

## Accessibility Requirements (WCAG 2.1 AA)

| Requirement | Implementation |
|-------------|---------------|
| Color contrast ratio ≥ 4.5:1 | All text meets contrast requirements |
| Keyboard navigation | Full tab-order support, focus indicators |
| Screen reader support | All interactive elements have ARIA labels |
| Touch targets ≥ 44×44px | Critical for tablet usage by field engineers |
| Language | Hindi + English bilingual support |
| Offline indicator | Clear banner when connection to edge gateway is lost |

---

## Version

| Field | Value |
|-------|-------|
| Version | `1.0.0` |
| Last Updated | `2026-08-24` |
| Author | RailNexus Architecture Team |
