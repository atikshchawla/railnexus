# 🌐 Digital Twin Visual Simulator — Design Specification

> **Module Path:** `lib/services/digital-twin/` (state) + `components/digital-twin/` (UI)
> **Owner:** Frontend / Visualization Team
> **Priority:** Critical (primary operator interface for situational awareness)

---

## Purpose

The Digital Twin is a **real-time virtual replica** of the physical railway infrastructure. It serves as the primary visual interface for operators to understand the current network state, simulate the impact of proposed blocks, and monitor active maintenance possessions.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    DIGITAL TWIN STACK                             │
│                                                                   │
│  ┌────────────────────┐    ┌──────────────────────────────────┐ │
│  │  STATE LAYER       │    │  RENDERING LAYER                  │ │
│  │  (Server)           │    │  (Client)                         │ │
│  │                     │    │                                    │ │
│  │  ├ Network Graph    │◄──►│  ├ MapRenderer (Mapbox GL JS)    │ │
│  │  ├ Train Positions  │    │  ├ TrainMarker (animated dots)   │ │
│  │  ├ Signal States    │    │  ├ SignalNode (color aspects)    │ │
│  │  ├ TC Occupancies   │    │  ├ PointSwitchAnimation          │ │
│  │  ├ Block Zones      │    │  ├ BlockOverlay (amber/blue)     │ │
│  │  └ Point Positions  │    │  └ TimelineSlider (drag-drop)    │ │
│  │                     │    │                                    │ │
│  │  WebSocket Server   │────│  WebSocket Client                 │ │
│  └────────────────────┘    └──────────────────────────────────┘ │
│           │                                                       │
│  ┌────────▼──────────┐    ┌──────────────────────────────────┐ │
│  │  SIMULATION LAYER │    │  INTERACTION LAYER                │ │
│  │                    │    │                                    │ │
│  │  ├ Forward sim     │    │  ├ Timeline scrubbing             │ │
│  │  ├ Backward sim    │    │  ├ Block drag-and-drop            │ │
│  │  ├ Delay impact    │    │  ├ Element selection               │ │
│  │  └ What-if analysis│    │  └ Detail panels                  │ │
│  └────────────────────┘    └──────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## Visual Elements Catalog

### 1. Infrastructure Layer

| Element | Visual Representation | Data Source | Update Frequency |
|---------|----------------------|-------------|-----------------|
| **Track Line** | Solid colored line on map (Up = blue, Down = green) | Static geometry data | On load |
| **Station Node** | Circle with label, sized by importance | Static station data | On load |
| **Yard/Siding** | Branching lines from main track | Static geometry data | On load |
| **Kilometer Markers** | Small ticks along track line, labeled every 5 km | Static | On load |
| **Neutral Section** | Dashed segment on track | TDMS | Daily |
| **Level Crossing** | X symbol on track | Static | On load |

### 2. Signalling Layer

| Element | Visual Representation | States | Data Source |
|---------|----------------------|--------|------------|
| **Color Light Signal** | Circle node with colored fill | 🔴 Red, 🟡 Yellow, 🟡🟡 Double Yellow, 🟢 Green | SMMS (< 500ms) |
| **Point Switch** | Animated Y-shape | Normal (straight), Reverse (diverging) | SMMS (< 500ms) |
| **Track Circuit** | Segment highlight on track | Clear (default), Occupied (pulsing red) | SMMS (< 500ms) |
| **Out of Correspondence** | Flashing red X on point | OOC detected | SMMS (< 200ms) |

### 3. Live Operations Layer

| Element | Visual Representation | Behavior |
|---------|----------------------|----------|
| **Passenger Train** | Blue pulsing chevron | Smooth interpolated movement along track |
| **Freight Train** | Orange pulsing chevron | Smooth interpolated movement along track |
| **Maintenance Vehicle** | Yellow diamond | Static in block zone during possession |
| **Train Label** | Tooltip on hover | Train number, speed, delay status |
| **Speed Indicator** | Size of chevron | Faster = larger chevron |
| **Delayed Train** | Red glow around chevron | Highlights trains running > 15 min late |

### 4. Block Overlay Layer

| Overlay | Visual Style | Meaning |
|---------|-------------|---------|
| **Engineering Block** | Solid amber pulse | Track section closed for P.Way work |
| **TRD Power Block** | Striped blue | OHE de-energized for TRD maintenance |
| **S&T Disconnection** | Green hatching | Signalling equipment disconnected |
| **Shadow Block** | Semi-transparent overlay on parent | Secondary department working in shadow |
| **Proposed Block** | Dotted outline (amber) | AI proposal, not yet approved |
| **Conflict Zone** | Red flashing | Block overlaps with train path |

---

## Timeline Slider Component

### Specifications

```
┌────────────────────────────────────────────────────────────────────┐
│  ◄  │ 06:00 │ 08:00 │ 10:00 │ 12:00 │ 14:00 │ 16:00 │ 18:00 │ ► │
│     │       │       │       │       │       │       │       │     │
│     │  ▬▬▬▬▬│▬▬▬▬▬▬ │       │       │ ▓▓▓▓▓▓│▓▓▓▓▓▓ │       │     │
│     │  Engg │Block  │       │       │ TRD   │Block  │       │     │
│     │       │       │       │       │       │       │       │     │
│  ───┼───────┼───────┼───────┼───────┼───────┼───────┼───────┼──── │
│     │ 🚃──►│  🚃──►│       │       │       │       │ 🚃──►│     │
│     │ Train │ paths │       │       │       │       │       │     │
│     │       │       │       │       │       │       │       │     │
│  [NOW ●]                                                          │
│  ◄════════════════════════ SCRUB ══════════════════════════════►   │
└────────────────────────────────────────────────────────────────────┘
```

| Feature | Behavior |
|---------|----------|
| **Scrub forward** | Plays sped-up animation of future schedule |
| **Scrub backward** | Shows historical block execution |
| **Block bars** | Draggable start/end handles for temporal adjustment |
| **Train paths** | Thin lines showing train movement through the section |
| **Now indicator** | Red vertical line at current time |
| **Zoom** | Pinch or scroll to zoom between 1-hour, 4-hour, 12-hour, 24-hour views |
| **Conflict flash** | Red glow where block bar overlaps with train path |

---

## Simulation Capabilities

### Forward Simulation (What-If)

Operators can project the network state up to **24 hours into the future**:

1. Select a proposed block.
2. Scrub the timeline forward.
3. The Twin animates:
   - Trains approaching the block zone.
   - Trains being held at loop lines.
   - Maintenance vehicles deploying.
   - Signals fettering to red.
   - Estimated cascading delay propagation.

### Delay Impact Simulation

When a train delay is detected:

1. The Twin highlights the affected corridor in yellow.
2. Shows the projected delay propagation across the network.
3. Visualizes the impact on scheduled blocks.
4. Suggests corridor adjustments with animation.

---

## Performance Requirements

| Metric | Target | Measurement |
|--------|--------|-------------|
| Initial map load | < 3 seconds | Time to interactive |
| State sync latency | < 500ms | Edge event → visual update |
| Animation frame rate | ≥ 30 FPS | During train movement |
| Max concurrent elements | 10,000 | Signals + track circuits + trains |
| Timeline scrub response | < 100ms | Drag to visual update |
| Memory usage | < 512 MB | Browser tab |
| WebSocket reconnection | < 2 seconds | On connection drop |

---

## Data Flow

```
Field Sensors → Edge Gateway → Kafka → Digital Twin State Service
                                              │
                                    ┌─────────┼─────────┐
                                    │         │         │
                                    ▼         ▼         ▼
                              Train State  Signal   TC State
                              Cache (Redis) State    Cache
                                    │         │         │
                                    └─────────┼─────────┘
                                              │
                                     WebSocket Push
                                              │
                                              ▼
                                    Browser Rendering
                                    (Mapbox + D3 + React)
```

---

## Component Hierarchy

```typescript
// components/digital-twin/

<DigitalTwinPage>
  ├── <MapRenderer>                    // Mapbox GL JS canvas
  │   ├── <InfrastructureLayer>        // Static track geometry
  │   ├── <SignallingLayer>            // Dynamic signal nodes
  │   │   ├── <SignalNode />           // Individual signal
  │   │   └── <PointSwitchAnimation /> // Animated point switch
  │   ├── <TrainLayer>                 // Moving trains
  │   │   └── <TrainMarker />          // Individual train chevron
  │   ├── <BlockOverlayLayer>          // Block zone overlays
  │   │   └── <BlockOverlay />         // Single block overlay
  │   └── <InteractionLayer>           // Click handlers, tooltips
  │
  ├── <TimelineSlider>                 // Bottom timeline component
  │   ├── <TimeAxis />                 // Time labels
  │   ├── <BlockBar />                 // Draggable block bars
  │   ├── <TrainPathLine />            // Train path indicators
  │   └── <NowIndicator />            // Current time marker
  │
  ├── <DetailPanel>                    // Right-side detail panel
  │   ├── <TrainDetail />
  │   ├── <SignalDetail />
  │   ├── <BlockDetail />
  │   └── <StationDetail />
  │
  └── <ControlBar>                     // Top control bar
      ├── <ZoomControls />
      ├── <LayerToggle />              // Show/hide layers
      ├── <SimulationControls />       // Play/pause/speed
      └── <SearchBar />               // Search stations/km
```

---

## Version

| Field | Value |
|-------|-------|
| Version | `1.0.0` |
| Last Updated | `2026-08-24` |
| Author | RailNexus Architecture Team |
