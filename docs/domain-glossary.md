# Domain Glossary — RailNexus ABP
### Living document. Check and update before encoding any domain assumption into code.

Last updated: 2026-09-04

---

## IMR
- **Full form:** Immediate Removal
- **Meaning:** A rail/weld defect classified as serious, with potential for sudden rail failure or fracture. Detected via USFD (Ultrasonic Flaw Detection) testing.
- **Source:** IRPWM (Indian Railways Permanent Way Manual); USFD Manual — Tier 1
- **Confidence:** ✅ Confirmed
- **Last checked:** 2026-09-04
- **Drives logic?** Yes — category badge colour (red/critical), but NOT priority ordering. Priority ordering is driven by the separate Urgency field.
- **Key rules from source:**
  - Speed restriction of 30 km/h must be imposed immediately on detection
  - Clamped joggled fish plates must be provided within 24 hours
  - Defective rail must be replaced with sound-tested rail (min 6m length) within **3 days**
  - Marked with three crosses in red paint on both faces of the web
  - If two or more OBS defects are within 4.0m of each other, they are **upgraded to IMR**
- **What our code does:** Uses "IMR" as a category label with critical (red) styling. Does NOT derive the 3-day SLA from the label — the SLA is a separate urgency field.
- **⚠️ Correction needed in code:** Our mock data says "2 days to SLA breach" — this implies a 3-day SLA, which aligns with the USFD Manual's "replaced within 3 days" rule. This is correct.

---

## OBS
- **Full form:** Observe
- **Meaning:** A rail/weld defect that is not currently critical and does not require immediate removal. The rail is kept under observation.
- **Source:** IRPWM; USFD Manual — Tier 1
- **Confidence:** ✅ Confirmed
- **Last checked:** 2026-09-04
- **Drives logic?** Yes — category badge colour (amber/warning), but NOT priority ordering.
- **Key rules from source:**
  - Clamped joggled fish plates must be provided within **3 days**
  - Marked with one cross in red paint on both faces of the web
  - Sub-categories exist: OBS-E (fish-plated zone), OBS-B (major bridges/approaches)
  - If two or more OBS defects are within 4.0m of each other → upgraded to IMR
- **What our code does:** Uses "OBS" as a category label with warning (amber) styling. Correct.

---

## PM (Predictive Maintenance)
- **Full form:** Predictive Maintenance
- **Meaning:** Maintenance scheduled based on predicted remaining useful life (RUL) of an asset, typically from sensor data or trend analysis.
- **Source:** Project-defined — **needs team ratification**
- **Confidence:** ⚠️ Project-defined
- **Last checked:** 2026-09-04
- **Drives logic?** Yes — category badge colour (blue/info). Does NOT drive priority ordering.
- **Notes:** "PM" is not an official IR USFD classification. The real USFD system uses only IMR and OBS (and historically REM, now deprecated). "PM" in our system represents a **project-defined category** for defects/tasks that originate from predictive analytics (e.g., TDMS sensor data predicting relay failure in 14 days) rather than from physical inspection. This is a valid concept for the product but should be clearly labeled as a RailNexus system category, not an IR standard classification.
- **Action:** When presenting to evaluators, clarify that IMR/OBS come from IR's USFD classification, while PM is a system-generated predictive category.

---

## REM (Remove) — NOT USED IN OUR SYSTEM
- **Full form:** Remove
- **Meaning:** Historical IR classification between IMR and OBS — defects serious enough for early removal but not immediate.
- **Source:** Older versions of IRPWM/USFD Manual — Tier 1
- **Confidence:** ✅ Confirmed (as a historical term)
- **Last checked:** 2026-09-04
- **Notes:** Under the modern "Need-Based" USFD testing concept, IR has simplified classification to just **IMR and OBS**. REM is deprecated. Our system correctly does not use it.

---

## TMS
- **Full form:** Track Management System
- **Meaning:** CRIS-built centralized web platform for managing track assets, inspections, and maintenance activities. Replaces paper-based track records.
- **Source:** cris.org.in, ircep.gov.in — Tier 2
- **Confidence:** ✅ Confirmed
- **Last checked:** 2026-09-04
- **Drives logic?** Yes — shown as data provenance source ("TMS · synced 2m ago") on backlog items originating from track/P.Way department.
- **Key facts:** Modules for asset tracking, maintenance planning, USFD test results, track geometry monitoring. Data flows from Section Engineer level up to Railway Board.

---

## SMMS
- **Full form:** Signalling Maintenance Management System
- **Meaning:** CRIS-built digital platform for S&T (Signal & Telecommunication) department to manage signalling asset maintenance.
- **Source:** cris.org.in — Tier 2
- **Confidence:** ✅ Confirmed
- **Last checked:** 2026-09-04
- **Drives logic?** Yes — shown as data provenance source on backlog items from S&T department.
- **Key facts:** Digital asset register replacing paper registers. Records asset failures, tracks codal life, schedules maintenance, digital field surveys.
- **⚠️ Note:** Our mock data currently attributes some TRD (traction) items to SMMS. This is **incorrect** — SMMS is specifically for **S&T (signalling)**, not TRD. TRD items should be attributed to TDMS.

---

## TDMS
- **Full form:** Traction Distribution Management System
- **Meaning:** CRIS-built platform for TRD (Traction Distribution) department — manages OHE (Overhead Electrification) and PSI (Power Supply Installation) assets.
- **Source:** cris.org.in, railsaver.gov.in — Tier 2
- **Confidence:** ✅ Confirmed
- **Last checked:** 2026-09-04
- **Drives logic?** Yes — shown as data provenance source on backlog items from TRD department.
- **Key facts:** GPS-based foot patrolling for real-time defect capture, digital maintenance logs, tower wagon operation management. Integrates with other CRIS platforms.
- **⚠️ Correction:** In our mock data, we attribute S&T relay predictions to TDMS. This should be SMMS (signalling), not TDMS (traction). Fix needed.

---

## COA
- **Full form:** Control Office Application
- **Meaning:** CRIS-built software used in divisional railway control rooms. Automates train control charting, provides real-time train position tracking, manages corridor blocks.
- **Source:** CRIS documentation, FOIS integration docs — Tier 2
- **Confidence:** ✅ Confirmed
- **Last checked:** 2026-09-04
- **Drives logic?** Yes — referenced as the source for corridor availability data.
- **Key facts:**
  - Replaced manual train control charts (coloured pencils on paper)
  - Acts as Decision Support System for controllers
  - Integrates with FOIS and NTES
  - **BDMS is a module within COA** — not a separate system
  - Manages corridor blocks, caution orders, train diversions

---

## BDMS
- **Full form:** Block & Disconnection Management System
- **Meaning:** A module within COA (not a standalone system) that digitizes the process of requesting, processing, monitoring, and approving maintenance blocks (Traffic, Power, and Disconnection blocks).
- **Source:** CRIS documentation, Central Railway pilot — Tier 2
- **Confidence:** ✅ Confirmed
- **Last checked:** 2026-09-04
- **Drives logic?** Contextual — referenced in the problem statement as the existing (decentralized) system our product aims to improve upon.
- **Key facts:**
  - Integrates with TMS, TDMS, SMMS
  - Coordinates across Engineering, TRD, S&T, and Operating departments
  - Initially piloted on Central Railway divisions
  - Being rolled out across all Zonal Railways
  - Our product (RailNexus ABP) proposes AI-driven optimization on top of this existing workflow

---

## Shadow block
- **Meaning:** Maintenance work carried out "in the shadow" of a main block — either in the same or adjacent block section during the same traffic closure period.
- **Source:** Railway maintenance practice documentation, Rolling Block Programme circulars — Tier 1/2
- **Confidence:** ✅ Confirmed
- **Last checked:** 2026-09-04
- **Drives logic?** Yes — shadow blocks are shown as a merged indicator on block suggestions and in the timeline.
- **Key facts:**
  - Allows multiple departments to work during a single traffic disruption
  - Distinct from "Integrated Block" (same section, same time) — shadow block can be adjacent section
  - Key benefit: reduces total number of traffic disruptions
  - Part of the 26-week Rolling Block Programme (RBP)

---

## Integrated block
- **Meaning:** Multiple departments (Engg, TRD, S&T) carry out maintenance simultaneously within a single traffic block on the same section.
- **Source:** Railway maintenance circulars, RBP documentation — Tier 1/2
- **Confidence:** ✅ Confirmed
- **Last checked:** 2026-09-04
- **Drives logic?** Contextual — our AI suggestions propose integrated/shadow blocks.
- **Distinction from shadow block:** Integrated = same section, same time. Shadow = same/adjacent section, leveraging an existing block's traffic stoppage.

---

## Private Number (PN)
- **Meaning:** A pseudo-random number from a pre-printed secured book, exchanged between Station Master and Section Controller to authenticate safety-critical communications (granting Line Clear, block working, abnormal operations).
- **Source:** General & Subsidiary Rules (G&SR) — Tier 1
- **Confidence:** ✅ Confirmed
- **Last checked:** 2026-09-04
- **Drives logic?** Not currently — referenced in the UX flows (Step 6: Private Number Exchange) but not yet implemented.
- **Key rules:**
  - SM is primary custodian of the PN book
  - Must be recorded on relevant forms (T/369(3b), Line Clear tickets)
  - If a number is repeated or questionable → cancel and issue fresh number
  - Used for: Line Clear, block back/forward, wrong-line running, signal defects, speed restrictions, power blocks

---

## Rolling Block Programme (RBP)
- **Meaning:** A 26-week (or up to 52-week) advance plan for maintenance blocks, coordinated across departments.
- **Source:** Railway Board circulars, pib.gov.in — Tier 2
- **Confidence:** ✅ Confirmed
- **Last checked:** 2026-09-04
- **Drives logic?** Contextual — our Block Plan month view is essentially a simplified RBP view.
- **Key facts:** Requires divisions to plan blocks in advance on a rolling basis. Materials and manpower must be pre-positioned.

---

## Engg / TRD / S&T (Department abbreviations)
- **Engg:** Engineering (Civil) — responsible for track, bridges, earthwork, buildings. P.Way (Permanent Way) is the sub-department for track.
- **TRD:** Traction Distribution — responsible for OHE, PSI, power supply for electric traction.
- **S&T:** Signal & Telecommunication — responsible for signalling gear, interlocking, track circuits, telecom.
- **Source:** Indian Railways organizational structure — Tier 1
- **Confidence:** ✅ Confirmed
- **Last checked:** 2026-09-04
- **Drives logic?** Yes — department badges, filter dropdowns, colour coding throughout.

---

## SSE
- **Full form:** Senior Section Engineer
- **Source:** Indian Railways cadre structure — Tier 1
- **Confidence:** ✅ Confirmed
- **Last checked:** 2026-09-04
- **Notes:** Field-level supervisor responsible for a section (~30-50 km). Reports to ADEN/ADTE/ADSTE depending on department. Our TopBar shows "SSE / Ambala" as the logged-in user context.

---

## Kavach
- **Meaning:** Indian Railways' indigenously developed Automatic Train Protection (ATP) system. Prevents collisions and enforces speed restrictions automatically.
- **Source:** indianrailways.gov.in, RDSO — Tier 2
- **Confidence:** ✅ Confirmed
- **Last checked:** 2026-09-04
- **Drives logic?** Not currently — mentioned in UX flows (Step 7: Block Execution View) but not yet implemented.

---

## CRIS
- **Full form:** Centre for Railway Information Systems
- **Meaning:** The IT arm of Indian Railways. Develops and maintains FOIS, NTES, COA, TMS, SMMS, TDMS, BDMS, and other systems.
- **Source:** cris.org.in — Tier 2
- **Confidence:** ✅ Confirmed
- **Last checked:** 2026-09-04
- **Drives logic?** Contextual — CRIS-built systems are our visual design precedent and our data source systems.

---

## FOIS
- **Full form:** Freight Operations Information System
- **Meaning:** CRIS-built system for freight train operations — rake management, wagon tracking, freight revenue.
- **Source:** cris.org.in — Tier 2
- **Confidence:** ✅ Confirmed
- **Drives logic?** Not directly — referenced as an integration point for goods train forecasting.

---

## NTES
- **Full form:** National Train Enquiry System
- **Source:** cris.org.in — Tier 2
- **Confidence:** ✅ Confirmed
- **Drives logic?** Not directly — referenced as an integration point for train timetable data.
