# 📖 Domain Glossary — RailNexus

> Canonical reference for all domain-specific terminology used across the project.
> **If a term is not here, add it before using it in any document or codebase.**

---

## Railway Operations

| Term | Abbreviation | Definition |
|------|-------------|------------|
| **Absolute Block System** | ABS | A signalling system where only one train is permitted on a block section at any time. The block section is bounded by block signals controlled by Station Masters. |
| **Block Section** | — | The section of track between two consecutive block stations, governed by the Absolute Block System. |
| **Block** (Maintenance) | — | A period during which a section of track is explicitly closed to train movements to allow maintenance work. |
| **Shadow Block** | — | A window within an existing primary block where additional departments can execute maintenance simultaneously, without requiring a separate traffic block. |
| **Integrated Block** | — | A pre-planned block that coordinates multiple departments (Engg + TRD + S&T) under a single traffic possession from inception. |
| **Rolling Block Programme** | RBP | A 26-week rolling schedule of planned block works, updated weekly by appending one new week. Mandated by Railway Board. |
| **Track Possession** | — | The act of occupying a block section for maintenance, formally authorized by Private Number exchange. |
| **Private Number** | PN | A unique, cryptographic procedural code exchanged between the Station Master and Section Engineer to authorize/de-authorize track occupation. |
| **Disconnection Memo** | DM | A formal document authorizing S&T staff to disconnect signalling gear for maintenance, as per G&SR rules. |
| **Reconnection Memo** | RM | A formal document confirming S&T gear has been restored and the track is safe for train passage. |

---

## Infrastructure Departments

| Term | Abbreviation | Definition |
|------|-------------|------------|
| **Permanent Way** | P.Way | The track structure including rails, sleepers, ballast, and formation. Managed by the Engineering department. |
| **Track Management System** | TMS | The software system storing track geometry data, rail defects, and maintenance history for the Engineering department. |
| **Track Geometry Index** | TGI | A composite numerical index derived from track recording car measurements, indicating overall track quality. |
| **Oscillograph Measuring System** | OMS | An instrument measuring lateral and vertical accelerations on the track. Peaks > 0.15g indicate significant defects. |
| **Ultrasonic Flaw Detection** | USFD | A technique using ultrasonic waves to detect internal rail and weld defects invisible to visual inspection. |
| **IMR Defect** | IMR | "Immediate Removal" — A critical rail defect requiring replacement within 3 days of detection. **Hard constraint** in scheduling. |
| **OBS Defect** | OBS | "Observation" — A less severe rail defect that is monitored and scheduled for routine maintenance. |
| **Track Relaying Train** | TRT | A specialized heavy machine for mechanized track renewal (replacing rails, sleepers, and ballast). |
| **Ballast Cleaning Machine** | BCM | A machine that excavates, cleans, and re-lays ballast under the track. |

---

## Signal & Telecommunication

| Term | Abbreviation | Definition |
|------|-------------|------------|
| **Signal Maintenance & Management System** | SMMS | The software system housing S&T maintenance data, including relay logs, EI health, and point machine metrics. |
| **Electronic Interlocking** | EI | A computer-based system that controls the setting and locking of routes through a station, ensuring conflicting movements are physically impossible. |
| **Point Machine** | — | An electromechanical device that moves a railway switch (turnout) between Normal and Reverse positions. |
| **Track Circuit** | TC | An electrical circuit using the rails as conductors to detect the presence of a train on a section of track. |
| **Signal Passed at Danger** | SPAD | An incident where a locomotive passes a signal displaying a red (danger) aspect without authorization. |
| **Out of Correspondence** | OOC | A hazardous state where the commanded position of a point machine differs from its actual physical position. |
| **Remaining Useful Life** | RUL | The predicted time remaining before an asset (e.g., point machine) will fail, computed by predictive models. |

---

## Traction Distribution

| Term | Abbreviation | Definition |
|------|-------------|------------|
| **Traction Distribution Management System** | TDMS | The software system managing OHE inspection data, power block schedules, and catenary wear metrics. |
| **Overhead Electrical Equipment** | OHE | The 25kV AC overhead catenary system providing power to electric locomotives. |
| **Power Block** | — | A maintenance block requiring the complete de-energization and earthing of the OHE in a section. |
| **Contact Wire** | CW | The lower wire of the catenary system that directly contacts the locomotive's pantograph. |
| **Tower Wagon** | TW | A rail-mounted vehicle with an elevated platform for OHE inspection and maintenance. |

---

## Operations

| Term | Abbreviation | Definition |
|------|-------------|------------|
| **Control Office Application** | COA | The master software system governing all train operations — timetables, freight forecasting, delay telemetry. |
| **Section Controller** | SC | The officer in the divisional control office responsible for regulating train movements across multiple stations. |
| **Station Master** | SM | The officer responsible for governing train movements within station limits, controlling the interlocking system. |
| **Loop Line** | — | A secondary track at a station where trains can be held or crossed past one another. |
| **Corridor** | — | A window of time between scheduled train movements where a maintenance block can be inserted. |

---

## Safety Systems

| Term | Abbreviation | Definition |
|------|-------------|------------|
| **Kavach** | TCAS | The Indian Railways Train Collision Avoidance System. Automatically applies emergency brakes if a train attempts to enter an occupied/unsafe section. |
| **System Integrity Level** | SIL | A measure of safety integrity defined by EN 50126/50128/50129. SIL-4 is the highest level, required for safety-critical railway systems. |
| **General & Subsidiary Rules** | G&SR | The statutory operating rules governing all train movements and maintenance procedures on Indian Railways. |
| **Fettering** | — | The act of digitally or physically locking signals at their most restrictive (Danger) aspect to prevent train entry into a block section. |

---

## Technology

| Term | Abbreviation | Definition |
|------|-------------|------------|
| **Physics-Informed Neural Network** | PINN | A neural network architecture that embeds known physical laws as constraints, used for RUL prediction of electromechanical assets. |
| **Mixed-Integer Linear Programming** | MILP | A mathematical optimization technique where some variables are constrained to integer values. Used for block scheduling. |
| **Digital Twin** | DT | A real-time virtual replica of the physical railway infrastructure, continuously synchronized via IoT telemetry. |
| **Edge-Cloud Architecture** | — | A computing paradigm where latency-sensitive processing occurs at network edge devices, while heavy computation runs on centralized cloud servers. |
| **Role-Based Access Control** | RBAC | A security model where permissions are assigned to roles (e.g., Controller, SSE) rather than individual users. |

---

## Version

| Field | Value |
|-------|-------|
| Version | `1.0.0` |
| Last Updated | `2026-08-24` |
| Maintained By | RailNexus Architecture Team |
