# CRIS Source Systems — Reference
## Source: cris.org.in, ircep.gov.in, railsaver.gov.in
## Retrieved: 2026-09-04 | Tier 2 source

---

## TMS — Track Management System
- **Owner:** CRIS
- **Department:** Engineering (P.Way)
- **Purpose:** Centralized web platform for managing track assets, inspections,
  and maintenance activities
- **Key modules:** Asset tracking, maintenance planning, USFD test results,
  track geometry monitoring
- **Replaces:** Paper-based track maintenance records
- **Data flows:** Section Engineer → ADEN → DEN → Railway Board
- **Defect types produced:** IMR, OBS (from USFD testing), track geometry defects

## SMMS — Signalling Maintenance Management System
- **Owner:** CRIS
- **Department:** S&T (Signal & Telecommunication)
- **Purpose:** Digital platform for S&T department to manage signalling assets
- **Key modules:** Digital asset register, failure recording, codal life tracking,
  maintenance scheduling, digital field surveys
- **Replaces:** Paper signal maintenance registers
- **Defect types produced:** Signal failures, relay degradation, interlocking faults

## TDMS — Traction Distribution Management System
- **Owner:** CRIS
- **Department:** TRD (Traction Distribution)
- **Purpose:** Management of OHE (Overhead Electrification) and PSI (Power
  Supply Installation) assets
- **Key modules:** GPS-based foot patrolling, digital maintenance logs,
  tower wagon operations
- **Replaces:** Manual TRD maintenance records
- **Defect types produced:** OHE dropper failures, mast foundation defects,
  catenary wire wear

## COA — Control Office Application
- **Owner:** CRIS
- **Department:** Operating / Traffic
- **Purpose:** Automates divisional control office functions — real-time
  train tracking, corridor management, block planning
- **Key modules:** Train control charting, caution order management,
  corridor block management, BDMS module
- **Integrates with:** FOIS (freight), NTES (passenger enquiry)
- **Data produced:** Train paths, corridor availability, block schedules

## BDMS — Block & Disconnection Management System
- **Status:** Module within COA (not a standalone system)
- **Purpose:** Digitizes the process of requesting, processing, monitoring,
  and approving maintenance blocks
- **Block types managed:** Traffic blocks, Power blocks, Disconnection blocks
- **Integrates with:** TMS, TDMS, SMMS
- **Cross-department:** Engineering, TRD, S&T, Operating
- **Pilot:** Central Railway divisions
- **Rollout:** Being expanded to all Zonal Railways
- **Note:** This is the existing system our product (RailNexus ABP) proposes
  to enhance with AI-driven optimization

---

## Department → Source System Mapping (for data provenance)

| Department | Primary source system | Defect types |
|---|---|---|
| Engg (P.Way) | **TMS** | Rail fractures (IMR/OBS), track geometry, ballast, weld defects |
| S&T | **SMMS** | Signal failures, relay degradation, interlocking, telecom |
| TRD | **TDMS** | OHE dropper, mast foundation, catenary, power supply |
| Operating | **COA** | Corridor availability, train paths, block schedules |

⚠️ **Important:** Never attribute S&T defects to TDMS, or TRD defects to SMMS.
Each department has its own dedicated CRIS system.
