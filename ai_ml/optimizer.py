"""Safety-aware maintenance request grouping and block optimization."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from functools import lru_cache
from itertools import combinations
from math import ceil
from typing import Any, Iterable

try:
    from ortools.sat.python import cp_model
except ImportError:
    cp_model = None


@dataclass(frozen=True)
class MaintenanceRequest:
    id: str
    section_id: str
    department: str
    work_type: str
    location_km: float
    predicted_duration_minutes: float
    overrun_probability: float = 0.0
    trains_affected: float = 0.0
    train_impact_minutes: float = 0.0
    priority: str = "MEDIUM"
    safety_critical: bool = False
    equipment_ids: tuple[str, ...] = ()
    requires_power_isolation: bool = False
    requires_disconnection: bool = False
    earliest_start_minute: int | None = None
    latest_end_minute: int | None = None
    failure_risk_probability: float = 0.0
    deadline_minutes: int | None = None


@dataclass(frozen=True)
class OptimizerWeights:
    possession_minute: float = 1.0
    train_impact_minute: float = 0.08
    separate_block_penalty: float = 35.0
    overrun_minute: float = 18.0
    critical_wait_penalty: float = 1000.0


@dataclass
class Compatibility:
    compatible: bool
    reasons: list[str] = field(default_factory=list)
    cautions: list[str] = field(default_factory=list)


@dataclass
class BlockCandidate:
    request_ids: list[str]
    section_id: str
    department_groups: dict[str, list[str]]
    predicted_duration_minutes: float
    separate_duration_minutes: float
    possession_saving_minutes: float
    expected_overrun_minutes: float
    train_impact_minutes: float
    objective_cost: float
    compatibility_cautions: list[str]
    explanation: list[str]
    priority_score: float = 0.0
    urgency_level: str = "medium"
    corridor_id: str | None = None
    scheduled_start_minute: int | None = None
    scheduled_end_minute: int | None = None


@dataclass(frozen=True)
class CorridorWindow:
    id: str
    section_id: str
    start_minute: int
    end_minute: int


@dataclass
class OptimizationResult:
    selected_blocks: list[BlockCandidate]
    ungrouped_request_ids: list[str]
    rejected_pairs: list[dict[str, Any]]
    totals: dict[str, float | str]
    unscheduled_block_ids: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "selected_blocks": [asdict(block) for block in self.selected_blocks],
            "ungrouped_request_ids": self.ungrouped_request_ids,
            "rejected_pairs": self.rejected_pairs,
            "totals": self.totals,
            "unscheduled_block_ids": self.unscheduled_block_ids,
        }


DEPARTMENT_ALIASES = {
    "ENGG": "ENGG", "ENGINEERING": "ENGG", "S&T": "S&T", "SNT": "S&T", "TRD": "TRD",
}


def _normal_department(value: str) -> str:
    return DEPARTMENT_ALIASES.get(value.upper(), value.upper())


def derive_priority(request: MaintenanceRequest) -> tuple[float, str]:
    """Derive urgency from model outputs and safety constraints."""
    risk = max(0.0, min(1.0, request.failure_risk_probability))
    deadline_score = 0.0
    if request.deadline_minutes is not None:
        deadline_score = max(0.0, min(1.0, 1.0 - request.deadline_minutes / (14 * 24 * 60)))
    safety_score = 1.0 if request.safety_critical else 0.0
    score = 60.0 * risk + 25.0 * safety_score + 15.0 * deadline_score
    if score == 0.0:
        score = {"CRITICAL": 95.0, "HIGH": 75.0, "MEDIUM": 50.0, "LOW": 25.0}.get(request.priority.upper(), 50.0)
    level = "critical" if score >= 80 else "high" if score >= 60 else "medium" if score >= 35 else "low"
    return round(score, 2), level


def check_compatibility(left: MaintenanceRequest, right: MaintenanceRequest, *, max_spatial_gap_km: float = 5.0) -> Compatibility:
    reasons: list[str] = []
    cautions: list[str] = []
    if left.section_id != right.section_id:
        reasons.append("different_sections")
    if abs(left.location_km - right.location_km) > max_spatial_gap_km:
        reasons.append("outside_spatial_window")
    if set(left.equipment_ids) & set(right.equipment_ids):
        reasons.append("shared_equipment_collision")
    if left.earliest_start_minute is not None and right.latest_end_minute is not None and left.earliest_start_minute > right.latest_end_minute:
        reasons.append("time_windows_do_not_overlap")
    if right.earliest_start_minute is not None and left.latest_end_minute is not None and right.earliest_start_minute > left.latest_end_minute:
        reasons.append("time_windows_do_not_overlap")
    if _normal_department(left.department) == "TRD" and right.requires_power_isolation:
        cautions.append("power_isolation_sequence_required")
    if _normal_department(right.department) == "TRD" and left.requires_power_isolation:
        cautions.append("power_isolation_sequence_required")
    if left.requires_disconnection or right.requires_disconnection:
        cautions.append("S&T_disconnection_sequence_required")
    if left.safety_critical or right.safety_critical:
        cautions.append("safety_critical_work_requires_controller_approval")
    return Compatibility(not reasons, reasons, sorted(set(cautions)))


def _combined_duration(requests: list[MaintenanceRequest]) -> tuple[float, list[str]]:
    totals: dict[str, float] = {}
    longest: dict[str, float] = {}
    for request in requests:
        department = _normal_department(request.department)
        totals[department] = totals.get(department, 0.0) + request.predicted_duration_minutes
        longest[department] = max(longest.get(department, 0.0), request.predicted_duration_minutes)
    workstreams = {department: longest[department] + 0.5 * (total - longest[department]) for department, total in totals.items()}
    longest_workstream = max(workstreams.values())
    parallel_work = max(0.0, sum(workstreams.values()) - longest_workstream)
    setup = 10.0
    clearance = 10.0 + max(0, len(requests) - 2) * 3.0
    coordination = parallel_work * 0.35
    duration = setup + longest_workstream + coordination + clearance
    return round(duration, 2), [
        f"shared possession setup: {setup:.0f} min",
        f"longest department workstream: {longest_workstream:.1f} min",
        f"parallel work coordination: {coordination:.1f} min",
        f"safety clearance: {clearance:.0f} min",
    ]


def _candidate(requests: list[MaintenanceRequest], weights: OptimizerWeights) -> BlockCandidate:
    duration, explanation = _combined_duration(requests)
    separate = sum(request.predicted_duration_minutes for request in requests)
    expected_overrun = sum(request.predicted_duration_minutes * max(0.0, min(1.0, request.overrun_probability)) for request in requests)
    train_impact = sum(max(0.0, request.train_impact_minutes) for request in requests)
    cautions = sorted({caution for left, right in combinations(requests, 2) for caution in check_compatibility(left, right).cautions})
    request_priorities = [derive_priority(request) for request in requests]
    priority_score = max(score for score, _ in request_priorities)
    urgency_level = max(request_priorities, key=lambda item: item[0])[1]
    objective = (
        weights.possession_minute * duration
        + weights.train_impact_minute * train_impact
        + weights.overrun_minute * expected_overrun / max(1, len(requests))
        - weights.separate_block_penalty * (len(requests) - 1)
        + weights.critical_wait_penalty * max(0, sum(request.safety_critical for request in requests) - 1)
    )
    departments: dict[str, list[str]] = {}
    for request in requests:
        departments.setdefault(_normal_department(request.department), []).append(request.id)
    if len(departments) > 1:
        explanation.append("compatible department workstreams are consolidated into one possession")
    explanation.append(f"avoids {len(requests) - 1} additional possession(s)")
    return BlockCandidate(
        request_ids=[request.id for request in requests], section_id=requests[0].section_id,
        department_groups=departments, predicted_duration_minutes=duration,
        separate_duration_minutes=round(separate, 2), possession_saving_minutes=round(max(0.0, separate - duration), 2),
        expected_overrun_minutes=round(expected_overrun, 2), train_impact_minutes=round(train_impact, 2),
        objective_cost=round(objective, 2), compatibility_cautions=cautions, explanation=explanation,
        priority_score=priority_score, urgency_level=urgency_level,
    )


def _single_cost(request: MaintenanceRequest, weights: OptimizerWeights) -> float:
    overrun = request.predicted_duration_minutes * max(0.0, min(1.0, request.overrun_probability))
    return weights.possession_minute * request.predicted_duration_minutes + weights.train_impact_minute * max(0.0, request.train_impact_minutes) + weights.overrun_minute * overrun


def _select_with_cp_sat(requests: list[MaintenanceRequest], candidates: list[BlockCandidate], weights: OptimizerWeights) -> list[BlockCandidate] | None:
    if cp_model is None:
        return None
    model = cp_model.CpModel()
    usable: list[tuple[BlockCandidate, Any, int]] = []
    for candidate in candidates:
        separate_cost = sum(_single_cost(request, weights) for request in requests if request.id in candidate.request_ids) + weights.separate_block_penalty * (len(candidate.request_ids) - 1)
        saving = separate_cost - candidate.objective_cost
        if saving > 0:
            usable.append((candidate, model.NewBoolVar(f"select_{len(usable)}"), int(round(saving * 100))))
    for request in requests:
        model.Add(sum(variable for candidate, variable, _ in usable if request.id in candidate.request_ids) <= 1)
    model.Maximize(sum(variable * saving for _, variable, saving in usable))
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 5.0
    solver.parameters.num_search_workers = 8
    if solver.Solve(model) not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return []
    return [candidate for candidate, variable, _ in usable if solver.Value(variable)]


def _schedule_blocks(
    blocks: list[BlockCandidate],
    requests: list[MaintenanceRequest],
    corridors: list[CorridorWindow],
) -> list[str]:
    request_by_id = {request.id: request for request in requests}
    placements: dict[tuple[int, int], tuple[Any, Any, Any]] = {}
    model = cp_model.CpModel() if cp_model is not None else None
    if model is not None:
        intervals_by_corridor: dict[int, list[Any]] = {index: [] for index in range(len(corridors))}
        for block_index, block in enumerate(blocks):
            members = [request_by_id[request_id] for request_id in block.request_ids]
            earliest = max((request.earliest_start_minute or 0) for request in members)
            latest = min((request.latest_end_minute or 1440) for request in members)
            duration = int(ceil(block.predicted_duration_minutes))
            eligible = []
            for corridor_index, corridor in enumerate(corridors):
                if corridor.section_id != block.section_id:
                    continue
                lower = max(earliest, corridor.start_minute)
                upper = min(latest - duration, corridor.end_minute - duration)
                if lower > upper:
                    continue
                presence = model.NewBoolVar(f"block_{block_index}_corridor_{corridor_index}")
                start = model.NewIntVar(lower, upper, f"block_{block_index}_start_{corridor_index}")
                end = model.NewIntVar(lower + duration, upper + duration, f"block_{block_index}_end_{corridor_index}")
                interval = model.NewOptionalIntervalVar(start, duration, end, presence, f"block_{block_index}_interval_{corridor_index}")
                placements[(block_index, corridor_index)] = (presence, start, end)
                intervals_by_corridor[corridor_index].append(interval)
                eligible.append(presence)
            if eligible:
                model.AddExactlyOne(eligible)
            else:
                model.AddBoolOr([])
        for intervals in intervals_by_corridor.values():
            if intervals:
                model.AddNoOverlap(intervals)
        model.Minimize(sum(
            start * max(1, int(round(100 - block.priority_score)))
            for (block_index, _), (_, start, _) in placements.items()
            for block in [blocks[block_index]]
        ))
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = 5.0
        solver.parameters.num_search_workers = 8
        if solver.Solve(model) in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            unscheduled = []
            for block_index, block in enumerate(blocks):
                placed = False
                for corridor_index, corridor in enumerate(corridors):
                    values = placements.get((block_index, corridor_index))
                    if values and solver.Value(values[0]):
                        block.corridor_id = corridor.id
                        block.scheduled_start_minute = solver.Value(values[1])
                        block.scheduled_end_minute = solver.Value(values[2])
                        placed = True
                        break
                if not placed:
                    unscheduled.append("+".join(block.request_ids))
            return unscheduled
    unscheduled: list[str] = []
    occupied: dict[str, list[tuple[int, int]]] = {corridor.id: [] for corridor in corridors}
    for block in sorted(blocks, key=lambda item: -item.priority_score):
        members = [request_by_id[request_id] for request_id in block.request_ids]
        earliest = max((request.earliest_start_minute or 0) for request in members)
        latest = min((request.latest_end_minute or 1440) for request in members)
        duration = int(ceil(block.predicted_duration_minutes))
        placed = False
        for corridor in corridors:
            if corridor.section_id != block.section_id:
                continue
            start = max(earliest, corridor.start_minute)
            while start + duration <= min(latest, corridor.end_minute):
                if all(start >= end or start + duration <= begin for begin, end in occupied[corridor.id]):
                    occupied[corridor.id].append((start, start + duration))
                    block.corridor_id = corridor.id
                    block.scheduled_start_minute = start
                    block.scheduled_end_minute = start + duration
                    placed = True
                    break
                start += 1
            if placed:
                break
        if not placed:
            unscheduled.append("+".join(block.request_ids))
    return unscheduled


def optimize_requests(
    requests: Iterable[MaintenanceRequest],
    *,
    weights: OptimizerWeights | None = None,
    max_group_size: int = 4,
    max_spatial_gap_km: float = 5.0,
    corridors: Iterable[CorridorWindow] | None = None,
) -> OptimizationResult:
    requests = list(requests)
    weights = weights or OptimizerWeights()
    by_section: dict[str, list[MaintenanceRequest]] = {}
    for request in requests:
        if request.predicted_duration_minutes <= 0:
            raise ValueError(f"{request.id}: predicted duration must be positive")
        by_section.setdefault(request.section_id, []).append(request)
    oversized = {section: len(items) for section, items in by_section.items() if len(items) > 32}
    if oversized:
        raise ValueError(f"Optimization is limited to 32 requests per section; batch oversized sections first: {oversized}")
    rejected_pairs: list[dict[str, Any]] = []
    candidates: list[BlockCandidate] = []
    for section_requests in by_section.values():
        for left, right in combinations(section_requests, 2):
            compatibility = check_compatibility(left, right, max_spatial_gap_km=max_spatial_gap_km)
            if not compatibility.compatible:
                rejected_pairs.append({"request_ids": [left.id, right.id], "reasons": compatibility.reasons})
        for size in range(2, min(max_group_size, len(section_requests)) + 1):
            for group in combinations(section_requests, size):
                if all(check_compatibility(left, right, max_spatial_gap_km=max_spatial_gap_km).compatible for left, right in combinations(group, 2)):
                    candidates.append(_candidate(list(group), weights))
    selected = _select_with_cp_sat(requests, candidates, weights)
    if selected is None:
        selected = []
        selected_ids: set[str] = set()
        for section_requests in by_section.values():
            index = {request.id: position for position, request in enumerate(section_requests)}
            section_candidates = [candidate for candidate in candidates if candidate.section_id == section_requests[0].section_id]
            first_candidates: dict[int, list[BlockCandidate]] = {}
            for candidate in section_candidates:
                first = min(index[request_id] for request_id in candidate.request_ids)
                first_candidates.setdefault(first, []).append(candidate)

            @lru_cache(maxsize=None)
            def best(mask: int) -> tuple[float, tuple[tuple[str, ...], ...]]:
                if mask == 0:
                    return 0.0, ()
                first = (mask & -mask).bit_length() - 1
                rest_cost, rest_groups = best(mask & ~(1 << first))
                best_cost = rest_cost + _single_cost(section_requests[first], weights)
                best_groups = ((section_requests[first].id,),) + rest_groups
                for candidate in first_candidates.get(first, []):
                    candidate_mask = sum(1 << index[request_id] for request_id in candidate.request_ids)
                    if candidate_mask & mask != candidate_mask:
                        continue
                    candidate_cost, candidate_groups = best(mask ^ candidate_mask)
                    if candidate.objective_cost + candidate_cost < best_cost:
                        best_cost = candidate.objective_cost + candidate_cost
                        best_groups = (tuple(candidate.request_ids),) + candidate_groups
                return best_cost, best_groups

            _, partition = best((1 << len(section_requests)) - 1)
            for group_ids in partition:
                if len(group_ids) > 1:
                    selected.append(next(candidate for candidate in section_candidates if tuple(candidate.request_ids) == group_ids))
                    selected_ids.update(group_ids)
    else:
        selected_ids = {request_id for candidate in selected for request_id in candidate.request_ids}
    if corridors is None:
        corridors = [
            CorridorWindow(f"{section_id}-default", section_id, 0, 1440)
            for section_id in by_section
        ]
    corridor_list = list(corridors)
    unscheduled_block_ids = _schedule_blocks(selected, requests, corridor_list) if selected else []
    ungrouped = [request.id for request in requests if request.id not in selected_ids]
    separate_total = sum(request.predicted_duration_minutes for request in requests)
    optimized_total = sum(block.predicted_duration_minutes for block in selected) + sum(request.predicted_duration_minutes for request in requests if request.id in ungrouped)
    return OptimizationResult(
        selected_blocks=selected, ungrouped_request_ids=ungrouped, rejected_pairs=rejected_pairs,
        totals={
            "separate_duration_minutes": round(separate_total, 2),
            "optimized_duration_minutes": round(optimized_total, 2),
            "possession_saving_minutes": round(max(0.0, separate_total - optimized_total), 2),
            "separate_block_count": float(len(requests)),
            "optimized_block_count": float(len(selected) + len(ungrouped)),
            "solver": "cp_sat" if cp_model is not None else "exact_partition_fallback",
            "scheduled_block_count": float(len(selected) - len(unscheduled_block_ids)),
        },
        unscheduled_block_ids=unscheduled_block_ids,
    )
