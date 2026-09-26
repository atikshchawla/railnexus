"""Optimization service orchestrating CP-SAT block planning and relational persistence."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import hashlib
import time
from typing import Any
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy.orm import Session

from ai_ml.optimizer import OptimizerWeights
from backend.api.schemas.prediction import PipelineOptimizeRequest
from backend.database.models.maintenance import MaintenanceRequest
from backend.database.models.optimization import (
    BlockProposal,
    OptimizationRun,
    ProposalDepartment,
    ProposalItem,
)
from backend.repositories.maintenance_repository import MaintenanceRepository
from backend.repositories.optimization_repository import OptimizationRepository
from backend.repositories.optimized_block_repository import OptimizedBlockRepository
from backend.repositories.topology_repository import TopologyRepository
from backend.services.maintenance_service import MaintenanceService
from backend.services.prediction_service import get_pipeline


_REQUIRED_FEATURES = {
    # Failure risk features
    "asset_age_days",
    "days_since_last_maintenance",
    "previous_failure_count",
    "lifetime_tonnage_mgt",
    "tonnage_since_last_maintenance_mgt",
    "daily_train_count",
    "daily_tonnage_mgt",
    "inspection_score",
    "rainfall_mm",
    "temperature_mean_c",
    "max_wind_speed_kmh",
    "is_heavy_rain_day",
    "asset_type",
    "department",
    "section_id",
    # Duration features
    "planned_duration_minutes",
    "severity_score",
    "workers_required",
    "equipment_count",
    "workload_per_worker",
    "weather_risk",
    "congestion_score",
    "current_delay_minutes",
    "window_average_delay_minutes",
    "window_peak_delay_minutes",
    "accumulated_tonnage_mgt",
    "trains_in_section",
    "section_complexity",
    "traffic_density",
    "safety_critical",
    "is_heatwave_day",
    "is_rain_day",
    "request_hour",
    "request_day_of_week",
    "request_month",
    "request_is_weekend",
    "work_type",
    "priority",
    # Overrun risk features
    "location_km_marker",
    "window_train_count",
    # Train impact features
    "planned_start_hour",
}


def is_pipeline_ready(pipeline_dict: dict[str, Any]) -> bool:
    """Return True if the normalized pipeline dict carries all required ML features."""
    features = pipeline_dict.get("model_features") or {}
    return _REQUIRED_FEATURES.issubset(features.keys())


class OptimizationService:
    """Coordinates CP-SAT optimizer execution and transactional persistence into Phase 5 models."""

    def __init__(
        self,
        optimization_repository: OptimizationRepository | None = None,
        maintenance_repository: MaintenanceRepository | None = None,
        topology_repository: TopologyRepository | None = None,
        cache_repository: OptimizedBlockRepository | None = None,
        maintenance_service: MaintenanceService | None = None,
    ):
        self.optimization_repo = optimization_repository or OptimizationRepository()
        self.maintenance_repo = maintenance_repository or MaintenanceRepository()
        self.topology_repo = topology_repository or TopologyRepository()
        self.cache_repo = cache_repository or OptimizedBlockRepository()
        self.maintenance_service = maintenance_service or MaintenanceService(self.maintenance_repo)

    def optimize(self, db: Session, payload: PipelineOptimizeRequest) -> dict[str, Any]:
        """Execute CP-SAT optimizer, persist relational OptimizationRun & proposals, and cache legacy result."""
        requests = [self.maintenance_repo.get(db, request_id) for request_id in payload.request_ids]
        if any(request is None for request in requests):
            raise HTTPException(status_code=404, detail="one or more maintenance requests not found")

        # ── Serve cached result if available and not forced ─────────────
        if not payload.force_rerun:
            cached = self.cache_repo.get_cached(db, payload.request_ids)
            if cached:
                return cached

        # ── Normalize and filter to ML-ready requests ───────────────────
        all_pipeline = [(r, self.maintenance_service.to_pipeline_request(r)) for r in requests if r is not None]
        initial_ready = [(r, p) for r, p in all_pipeline if is_pipeline_ready(p)]
        skipped = [r.id for r, p in all_pipeline if not is_pipeline_ready(p)]

        # Pre-score to ensure every passed request cleanly evaluates in the ML models
        pipeline = get_pipeline()
        pipeline_ready = []
        for r, p in initial_ready:
            try:
                pipeline.score_request(p)
                pipeline_ready.append((r, p))
            except (KeyError, ValueError, TypeError):
                skipped.append(r.id)

        if not pipeline_ready:
            raise HTTPException(
                status_code=422,
                detail="No requests carry the required ML model features. Run /api/demo/seed first.",
            )

        section_ids = [r.section_id for r, _ in pipeline_ready]
        if not self.topology_repo.sections_exist(db, section_ids):
            raise HTTPException(status_code=422, detail="one or more maintenance requests use an unknown section_id")

        raw_requests = [p for _, p in pipeline_ready]
        try:
            t0 = time.perf_counter()
            result = get_pipeline().optimize(
                raw_requests,
                max_group_size=payload.max_group_size,
                max_spatial_gap_km=payload.max_spatial_gap_km,
                weights=OptimizerWeights(**payload.weights) if payload.weights else OptimizerWeights(),
            )
            duration_ms = max(1, int((time.perf_counter() - t0) * 1000))

            if skipped:
                result["skipped_request_ids"] = skipped

            # ── Authoritative Phase 5 Relational Persistence ───────────
            ready_maintenance_requests = [r for r, _ in pipeline_ready]
            opt_run = self.persist_optimization_run(
                db,
                payload=payload,
                requests=ready_maintenance_requests,
                result=result,
                duration_ms=duration_ms,
            )
            result["_run_id"] = opt_run.id

            # ── Legacy Cache Persistence (Backward Compatibility) ──────
            legacy_row = self.cache_repo.save(db, payload.request_ids, result)
            result["_cache_id"] = legacy_row.id

            return result

        except (KeyError, TypeError, ValueError) as error:
            raise HTTPException(status_code=422, detail=str(error)) from error

    def persist_optimization_run(
        self,
        db: Session,
        payload: PipelineOptimizeRequest,
        requests: list[MaintenanceRequest],
        result: dict[str, Any],
        duration_ms: int = 0,
    ) -> OptimizationRun:
        """Construct and transactionally persist an OptimizationRun and its child proposals."""
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        req_map: dict[str, MaintenanceRequest] = {r.id: r for r in requests}
        input_hash = hashlib.sha256(",".join(sorted(payload.request_ids)).encode()).hexdigest()

        corridor_id = "AJJ-JTJ"

        run = OptimizationRun(
            id=str(uuid4()),
            planning_horizon="WEEKLY",
            planning_cycle_label=f"{now.year}-W{now.isocalendar().week:02d}",
            effective_date_start=now.date(),
            effective_date_end=now.date() + timedelta(days=7),
            corridor_id=corridor_id,
            input_requests_hash=input_hash,
            input_snapshot_json={
                "request_ids": payload.request_ids,
                "max_group_size": payload.max_group_size,
                "max_spatial_gap_km": payload.max_spatial_gap_km,
                "weights": payload.weights,
            },
            algorithm_version=f"cp_sat_{result.get('totals', {}).get('solver', 'v2.1')}",
            weights_json=payload.weights or {},
            solver_status=str(result.get("totals", {}).get("solver", "OPTIMAL")).upper(),
            solver_duration_ms=duration_ms,
            total_possession_saving_minutes=float(result.get("totals", {}).get("possession_saving_minutes", 0.0)),
            total_train_impact_minutes=float(
                sum(float(b.get("train_impact_minutes", 0.0)) for b in result.get("selected_blocks", []))
            ),
            created_at=now,
        )

        base_datetime = datetime(now.year, now.month, now.day)
        model_outputs = result.get("model_outputs", {})

        for block in result.get("selected_blocks", []):
            block_req_ids: list[str] = block.get("request_ids", [])
            sec_id = block.get("section_id") or (req_map[block_req_ids[0]].section_id if block_req_ids and block_req_ids[0] in req_map else "AJJ-SHU")

            start_min = block.get("scheduled_start_minute")
            end_min = block.get("scheduled_end_minute")
            duration_minutes = max(1.0, float(block.get("predicted_duration_minutes", 60.0)))

            if start_min is not None and start_min >= 0:
                proposed_start = base_datetime + timedelta(minutes=start_min)
            else:
                proposed_start = now

            if end_min is not None and start_min is not None and end_min > start_min:
                proposed_end = base_datetime + timedelta(minutes=end_min)
            else:
                proposed_end = proposed_start + timedelta(minutes=duration_minutes)

            trains_affected = int(
                round(sum(float(model_outputs.get(r_id, {}).get("trains_affected", 0.0)) for r_id in block_req_ids))
            )

            overrun_probs = [
                float(model_outputs.get(r_id, {}).get("overrun_probability", 0.0))
                for r_id in block_req_ids
                if r_id in model_outputs
            ]
            if overrun_probs:
                avg_overrun = sum(overrun_probs) / len(overrun_probs)
                confidence_score = round(max(0.0, min(1.0, 1.0 - avg_overrun)), 2)
            else:
                confidence_score = round(max(0.0, min(1.0, float(block.get("priority_score", 0.0)) / 100.0)), 2)

            proposal = BlockProposal(
                id=str(uuid4()),
                run_id=run.id,
                section_id=sec_id,
                proposed_start_time=proposed_start,
                proposed_end_time=proposed_end,
                predicted_duration_minutes=float(block.get("predicted_duration_minutes", 0.0)),
                possession_saving_minutes=float(block.get("possession_saving_minutes", 0.0)),
                train_impact_minutes=float(block.get("train_impact_minutes", 0.0)),
                trains_affected_count=trains_affected,
                confidence_score=confidence_score,
                top_factors_json={
                    "explanation": block.get("explanation", []),
                    "priority_score": block.get("priority_score"),
                    "urgency_level": block.get("urgency_level"),
                    "separate_duration_minutes": block.get("separate_duration_minutes"),
                    "expected_overrun_minutes": block.get("expected_overrun_minutes"),
                },
                safety_cautions=list(block.get("compatibility_cautions", [])),
                status="PROPOSED",
                created_at=now,
            )

            # ── ProposalItems ───────────────────────────────────────────
            for seq_idx, req_id in enumerate(block_req_ids):
                item = ProposalItem(
                    proposal_id=proposal.id,
                    maintenance_request_id=req_id,
                    sequence_order=seq_idx + 1,
                )
                proposal.items.append(item)

            # ── ProposalDepartments ─────────────────────────────────────
            dept_groups: dict[str, list[str]] = block.get("department_groups", {})
            for dept_name, dept_req_ids in dept_groups.items():
                dept_reqs = [req_map[r_id] for r_id in dept_req_ids if r_id in req_map]
                work_desc = ", ".join(sorted({r.work_type for r in dept_reqs})) if dept_reqs else None
                demanded_dur = int(round(sum(
                    float(r.demanded_duration_minutes or (r.request_data or {}).get("planned_duration_minutes", 0))
                    for r in dept_reqs
                ))) if dept_reqs else None
                power_iso = any(
                    bool(getattr(r, "requires_power_isolation", False) or (r.request_data or {}).get("requires_power_isolation", False))
                    for r in dept_reqs
                )
                disconnect = any(
                    bool(getattr(r, "requires_disconnection", False) or (r.request_data or {}).get("requires_disconnection", False))
                    for r in dept_reqs
                )

                dept_entry = ProposalDepartment(
                    proposal_id=proposal.id,
                    department=dept_name,
                    work_description=work_desc,
                    demanded_duration_minutes=demanded_dur,
                    requires_power_isolation=power_iso,
                    requires_disconnection=disconnect,
                )
                proposal.departments.append(dept_entry)

            run.proposals.append(proposal)

        return self.optimization_repo.create_run(db, run)

    def save_legacy_overrides(self, db: Session, cache_id: str, overrides: dict[str, Any]) -> bool:
        """Persist operator overrides to legacy cache."""
        return self.cache_repo.save_overrides(db, cache_id, overrides)
