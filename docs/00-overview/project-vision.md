# 🔭 Project Vision — RailNexus ABP + Digital Twin

> **Architecting an AI-Driven Automatic Block Planning and Digital Twin System for Indian Railways Fixed Infrastructure**

---

## The Problem

Indian Railways operates one of the world's largest rail networks — carrying **23+ million passengers** and **3+ million tonnes of freight daily** across **68,000+ route-km**. The fixed infrastructure is maintained by three siloed departments:

| Department | Abbreviation | Responsibility |
|-----------|-------------|----------------|
| **Engineering** | Engg / P.Way | Track (rails, sleepers, ballast, formation) |
| **Traction Distribution** | TRD | Overhead Electrical Equipment (25kV AC OHE) |
| **Signal & Telecom** | S&T | Interlocking, points, track circuits, signals |

### The Block Planning Dilemma

Each department independently requests **"blocks"** — periods where a section of track is closed to train movements for maintenance. The current process:

1. **Siloed Requests** — Each department submits separate block requests via the legacy Block Data Management System (BDMS).
2. **Manual Coordination** — Operations Control manually sequences these against train timetables.
3. **Fragmented Possessions** — The same section may be blocked Monday (Engg), Wednesday (TRD), Friday (S&T) — **three separate traffic disruptions** for what could have been **one coordinated possession**.
4. **Zero Shadow Block Utilization** — When Engineering has a heavy block (e.g., Track Relaying Train), TRD and S&T teams sit idle instead of working simultaneously in the "shadow" of that block.
5. **Cascading Delays** — Uncoordinated blocks ripple through the timetable, delaying passenger and freight trains across divisions.

### The Cost

- **₹2,500+ Crore/year** estimated in lost freight revenue from infrastructure unavailability.
- **15-20% of block time wasted** due to poor coordination.
- **Safety incidents** from rushed maintenance when blocks are cut short.

---

## The Solution — RailNexus

RailNexus is a **centralized, AI-driven Automatic Block Planning (ABP) system** integrated with a **real-time Digital Twin visual simulator**. It:

1. **Breaks data silos** — Ingests data from TMS, SMMS, TDMS, and COA into a unified data lake.
2. **Optimizes mathematically** — Uses Mixed-Integer Linear Programming (MILP) + Reinforcement Learning to generate multi-horizon block schedules.
3. **Maximizes shadow blocks** — Automatically bundles overlapping spatial tasks into consolidated possessions.
4. **Visualizes impact** — Renders a real-time Digital Twin so operators can see exactly what happens when a block is granted or denied.
5. **Keeps humans in charge** — AI proposes, humans approve. Safety logic (SIL-4) remains physically separated from the AI layer.

---

## Core Objectives

| # | Objective | Metric |
|---|-----------|--------|
| O1 | Reduce total track possession time | ≥ 30% reduction in cumulative block hours |
| O2 | Maximize shadow block utilization | ≥ 60% of Engineering blocks include shadow work |
| O3 | Eliminate safety-critical scheduling failures | 0 missed IMR deadlines |
| O4 | Reduce operator cognitive load | ≤ 3 clicks to review and approve a block proposal |
| O5 | Enable predictive maintenance scheduling | ≥ 90% accuracy on S&T RUL predictions |
| O6 | Support 26-week rolling programme | Full compliance with Railway Board directives |

---

## Key Stakeholders

| Stakeholder | Role | System Interaction |
|-------------|------|--------------------|
| **Section Engineer (SSE/JE)** | Maintenance ground truth | Submits requests, verifies durations, adjusts proposals |
| **Station Master (SM)** | Governs station limits | Exchanges Private Numbers, controls interlocking |
| **Section Controller** | Divisional traffic oversight | Approves/denies blocks based on traffic impact |
| **Divisional Railway Manager (DRM)** | Strategic authority | Reviews 26-week rolling programmes |
| **Empowered Committee** | Cross-departmental governance | Signs off on long-term block plans |

---

## Document Version

| Field | Value |
|-------|-------|
| Version | `1.0.0` |
| Last Updated | `2026-08-24` |
| Author | RailNexus Architecture Team |
