# 🧠 AI/ML Engine Specification

> **Module Path:** `ai/` (Python backend) + `lib/services/ai-optimizer/` (Node.js client)
> **Owner:** AI/ML Team

---

## Overview

The AI/ML engine consists of two primary algorithmic systems:

1. **Optimization Engine** — MILP + RL for block schedule optimization
2. **Predictive Engine** — PINN for equipment RUL prediction

---

## 1. Optimization Engine

### Problem Formulation

The block scheduling problem is formulated as a **Multi-Objective Constrained Optimization**:

```
Given:
  - B = Set of pending maintenance blocks {b₁, b₂, ..., bₙ}
  - C = Set of available corridors {c₁, c₂, ..., cₘ}  
  - T = Train timetable (fixed passenger + dynamic freight)
  - S = Safety constraints (IMR deadlines, signal states)

Find:
  - Assignment: B → C (each block assigned to a corridor)
  - Shadow bundling: which blocks can share a corridor
  - Temporal positioning: exact start/end within each corridor

Minimize:
  f(x) = w₁·Σ(downtime_i) + w₂·Σ(imr_penalty_i) + w₃·Σ(delay_impact_i)
         - w₄·Σ(shadow_utilization_i) - w₅·Σ(corridor_efficiency_i)

Subject to:
  1. ∀ imr ∈ B_imr: scheduled_time(imr) ≤ detected_time(imr) + 72h
  2. ∀ b ∈ B: no_overlap(b, T_passenger_express)
  3. ∀ shadow ∈ B_shadow: spatial_within(shadow, parent_block)
  4. ∀ trd ∈ B_trd: power_isolation_sequenced(trd)
  5. ∀ section: daily_block_hours(section) ≤ MAX_HOURS
  6. ∀ machine_pair: no_physical_collision(machine_pair)
  7. ∀ s&t ∈ B_s&t: disconnection_sequenced(s&t)
```

### MILP Solver Configuration

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Solver | Google OR-Tools CP-SAT | Handles large integer programs efficiently |
| Max solve time | 60 seconds (operational), 5 min (strategic) | Real-time responsiveness |
| Gap tolerance | 1% (operational), 0.1% (strategic) | Optimality vs speed tradeoff |
| Variables per section | ~500-2000 | Binary assignment variables + integer time variables |

### Reinforcement Learning Heuristic

When the MILP state space is too large (>50,000 variables for full-network optimization), an RL agent provides heuristic guidance:

| Component | Specification |
|-----------|--------------|
| Algorithm | PPO (Proximal Policy Optimization) |
| Framework | Stable-Baselines3 (PyTorch) |
| State space | Section states, block queue, corridor availability, time |
| Action space | Block-corridor assignment, shadow bundling decisions |
| Reward | Negative of objective function f(x) |
| Training | Offline on historical block data, online fine-tuning |
| Episode | One day of scheduling for a division |

---

## 2. Predictive Engine — PINN RUL Model

### Architecture

```
Input Layer (n features)
    │
    ▼
Physics-Informed Layer
├── Electromechanical degradation equations
├── Thermal stress models
└── Fatigue accumulation models
    │
    ▼
LSTM Layer (temporal patterns)
    │
    ▼
Dense Layer (128 → 64 → 32)
    │
    ▼
Output Layer
├── RUL (continuous, days)
├── Confidence (0-1)
└── Failure Mode (categorical)
```

### Physics Constraints Embedded

| Physical Law | Equation | Application |
|-------------|----------|-------------|
| Archard's wear law | V = K·F·s/H | Point machine mechanical wear |
| Coffin-Manson fatigue | Nf = C·(Δε)^(-β) | Relay contact fatigue cycles |
| Arrhenius degradation | k = A·exp(-Ea/RT) | Insulation degradation (temperature) |
| Ohm's law deviation | ΔR = f(I, t, corrosion) | Track circuit impedance drift |

### Training Pipeline

```
Historical SMMS Data (3+ years)
        │
        ▼
Feature Engineering (Feast)
├── Rolling statistics (mean, std, trend)
├── Frequency domain features (FFT)
├── Operational cycle counts
└── Environmental correlates
        │
        ▼
Train/Val/Test Split (70/15/15, temporal)
        │
        ▼
PINN Training (PyTorch)
├── Loss = MSE_RUL + λ·Physics_Loss + μ·Confidence_Loss
├── Epochs: 200
├── Batch size: 64
├── Learning rate: 1e-4 with cosine annealing
        │
        ▼
Validation (≥ 98% accuracy target)
        │
        ▼
Export to ONNX Runtime
        │
        ▼
Deploy via FastAPI
```

### Inference Specifications

| Metric | Target |
|--------|--------|
| Single prediction latency | < 100ms |
| Batch prediction (100 items) | < 2 seconds |
| Model size (ONNX) | < 50 MB |
| Retraining frequency | Weekly (or on data drift detection) |
| Data drift detection | KL divergence on feature distributions |

---

## 3. Shadow Block Identification Algorithm

### Detailed Algorithm

```python
def identify_shadow_blocks(primary_block, pending_tasks_db, constraints):
    """
    Given a primary block, find all tasks that can execute
    simultaneously within its shadow.
    """
    
    # Step 1: Spatial query — find tasks in the same km range
    candidates = pending_tasks_db.query(
        section=primary_block.section,
        km_range=(primary_block.from_km - BUFFER, primary_block.to_km + BUFFER),
        status='PENDING',
        department__ne=primary_block.department
    )
    
    # Step 2: Temporal feasibility — can the task complete within the block?
    feasible = []
    for task in candidates:
        if task.estimated_duration <= primary_block.duration * 0.9:  # 10% safety margin
            feasible.append(task)
    
    # Step 3: Physical collision check
    safe = []
    for task in feasible:
        if not has_machinery_collision(
            primary_block.machinery,
            task.machinery,
            primary_block.from_km, primary_block.to_km,
            task.from_km, task.to_km
        ):
            safe.append(task)
    
    # Step 4: Power isolation compatibility (TRD specific)
    compatible = []
    for task in safe:
        if task.department == 'TRD':
            if primary_block.requires_power_isolation or can_isolate_safely(task):
                task.power_isolation_status = 'COMPATIBLE'
                compatible.append(task)
        else:
            compatible.append(task)
    
    # Step 5: S&T disconnection sequencing
    for task in compatible:
        if task.department == 'S&T' and task.requires_disconnection:
            task.disconnection_sequence = calculate_sequence(
                task, primary_block, constraints
            )
    
    # Step 6: Score and rank
    scored = []
    for task in compatible:
        score = calculate_shadow_score(
            time_saved=task.estimated_duration,
            priority=task.priority,
            spatial_overlap=calculate_overlap(task, primary_block),
            department_diversity=1 if task.department != primary_block.department else 0
        )
        scored.append((task, score))
    
    return sorted(scored, key=lambda x: x[1], reverse=True)
```

### Scoring Function

```
ShadowScore = (0.4 × TimeSaved/MaxPossibleSaved) 
            + (0.3 × PriorityWeight)
            + (0.2 × SpatialOverlapRatio)
            + (0.1 × DepartmentDiversityBonus)
```

| Priority | Weight |
|----------|--------|
| IMR | 1.0 |
| PREDICTIVE | 0.8 |
| PREVENTIVE | 0.5 |
| ROUTINE | 0.3 |

---

## 4. Corridor Analysis Engine

### Algorithm

```python
def find_corridors(section, date, timetable, freight_forecast):
    """
    Parse the timetable to find gaps where blocks can be inserted.
    """
    
    # Merge fixed passenger timetable with dynamic freight forecast
    all_movements = merge_and_sort(
        timetable.get_movements(section, date),
        freight_forecast.get_predicted_movements(section, date)
    )
    
    corridors = []
    for i in range(len(all_movements) - 1):
        gap_start = all_movements[i].exit_time + SAFETY_BUFFER  # 5 min buffer
        gap_end = all_movements[i+1].entry_time - SAFETY_BUFFER
        gap_duration = (gap_end - gap_start).total_minutes()
        
        if gap_duration >= MIN_CORRIDOR_DURATION:  # 30 minutes minimum
            corridors.append(Corridor(
                section=section,
                start=gap_start,
                end=gap_end,
                duration=gap_duration,
                preceding_train=all_movements[i],
                following_train=all_movements[i+1],
                confidence=calculate_corridor_confidence(
                    all_movements[i], all_movements[i+1]
                )
            ))
    
    return corridors
```

### Corridor Confidence Scoring

| Factor | Weight | Rationale |
|--------|--------|-----------|
| Preceding train on-time history | 0.3 | Historically late trains reduce corridor reliability |
| Following train type | 0.3 | Express trains are immovable; freight is flexible |
| Buffer adequacy | 0.2 | Larger buffers = higher confidence |
| Day of week | 0.1 | Weekends have different traffic patterns |
| Season | 0.1 | Festival season = higher uncertainty |

---

## Version

| Field | Value |
|-------|-------|
| Version | `1.0.0` |
| Last Updated | `2026-08-24` |
| Author | RailNexus Architecture Team |
