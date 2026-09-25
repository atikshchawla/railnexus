"""Authoritative Server-Side Conflict Detection Service.

Implements detection, idempotency, and resolution recording for candidate BlockProposals
in accordance with Phase 6B architecture boundaries.

Rules Implemented:
1. SECTION_OCCUPATION (Proposal vs Proposal):
   Simultaneous occupation of the same track section by two distinct block proposals.
   Default severity: CRITICAL (direct collision/occupation hazard).
   Idempotency key: Canonical ordered pair (min(proposal_a_id, proposal_b_id), max(proposal_a_id, proposal_b_id)).

2. TRAIN_CROSSING (Proposal vs Train Movement):
   Intersection of a scheduled train path or freight forecast window with a block proposal on the same section.
   Default severity: HIGH (active train path intersecting maintenance possession window).
   Idempotency key: (proposal_id, train_movement_id).

Rules Deliberately Deferred (per Phase 6B specification):
- POWER_INTERLOCK: Deferred. The existing codebase does not establish an authoritative domain rule
  or compatibility invariant for power isolation conflicts between proposals. Only an advisory caution
  ('power_isolation_sequence_required') exists in the optimizer. Per Phase 6B requirements,
  railway safety rules must not be manufactured without domain backing.
- RESOURCE_COLLISION: Deferred. A populated resource/equipment assignment model does not yet exist
  in the persistence schema or optimizer output. Kept intact in domain enums for future phases.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.api.schemas.conflict import ConflictDetectRequest, ConflictResolutionCreate
from backend.database.models.conflict import Conflict, ConflictResolutionEvent
from backend.database.models.optimization import BlockProposal
from backend.domain.enums import (
    ConflictSeverity,
    ConflictStatus,
    ConflictType,
    ResolutionAction,
)
from backend.domain.value_objects.time_window import TimeWindow
from backend.repositories.conflict_repository import ConflictRepository
from backend.repositories.optimization_repository import OptimizationRepository
from backend.repositories.topology_repository import TopologyRepository
from backend.repositories.train_repository import TrainMovementRepository


class ConflictService:
    """Core domain service for conflict detection, query, and resolution audit."""

    def __init__(
        self,
        conflict_repository: ConflictRepository | None = None,
        optimization_repository: OptimizationRepository | None = None,
        topology_repository: TopologyRepository | None = None,
        train_movement_repository: TrainMovementRepository | None = None,
    ):
        self.conflict_repo = conflict_repository or ConflictRepository()
        self.optimization_repo = optimization_repository or OptimizationRepository()
        self.topology_repo = topology_repository or TopologyRepository()
        self.train_movement_repo = train_movement_repository or TrainMovementRepository()

    def detect_conflicts(
        self, db: Session, request: ConflictDetectRequest
    ) -> list[Conflict]:
        """Detect and persist all conflicts for proposals in an optimization run.

        Ensures full idempotency: Repeated detection runs over unchanged proposals
        reuse existing active or resolved conflicts and never produce duplicate records.
        """
        # 1. Validate OptimizationRun
        run = self.optimization_repo.get_run(db, request.run_id)
        if not run:
            raise HTTPException(
                status_code=404,
                detail=f"Optimization run '{request.run_id}' not found",
            )

        # 2. Validate and load proposals
        if request.proposal_ids is not None:
            proposals: list[BlockProposal] = []
            for pid in request.proposal_ids:
                prop = self.optimization_repo.get_proposal(db, pid)
                if not prop:
                    raise HTTPException(
                        status_code=404,
                        detail=f"Block proposal '{pid}' not found",
                    )
                if prop.run_id != request.run_id:
                    raise HTTPException(
                        status_code=422,
                        detail=f"Block proposal '{pid}' does not belong to run '{request.run_id}'",
                    )
                proposals.append(prop)
        else:
            proposals = list(run.proposals)

        # 3. Validate referenced sections exist in canonical topology
        for prop in proposals:
            section = self.topology_repo.get_section(db, prop.section_id)
            if not section:
                raise HTTPException(
                    status_code=422,
                    detail=f"Proposal '{prop.id}' references unknown section '{prop.section_id}'",
                )

        detected_conflicts: list[Conflict] = []
        new_conflicts: list[Conflict] = []

        # 4. RULE A — SECTION_OCCUPATION (Proposal vs Proposal)
        for i in range(len(proposals)):
            for j in range(i + 1, len(proposals)):
                p1 = proposals[i]
                p2 = proposals[j]

                if p1.section_id != p2.section_id:
                    continue

                tw1 = TimeWindow(p1.proposed_start_time, p1.proposed_end_time)
                tw2 = TimeWindow(p2.proposed_start_time, p2.proposed_end_time)
                if not tw1.overlaps(tw2):
                    continue

                prop_a_id = min(p1.id, p2.id)
                prop_b_id = max(p1.id, p2.id)
                prop_a = p1 if p1.id == prop_a_id else p2
                prop_b = p2 if p2.id == prop_b_id else p1

                existing = self.conflict_repo.get_for_proposal_pair(
                    db,
                    prop_a_id,
                    prop_b_id,
                    conflict_type=ConflictType.SECTION_OCCUPATION.value,
                )
                if existing:
                    detected_conflicts.append(existing)
                else:
                    t_start = max(prop_a.proposed_start_time, prop_b.proposed_start_time)
                    t_end = min(prop_a.proposed_end_time, prop_b.proposed_end_time)
                    overlap_min = round((t_end - t_start).total_seconds() / 60.0, 1)

                    sec = self.topology_repo.get_section(db, prop_a.section_id)
                    km_start = sec.start_km if sec else 0.0
                    km_end = sec.end_km if sec else 0.0

                    now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
                    conflict = Conflict(
                        id=f"CONF-{uuid4().hex[:12].upper()}",
                        conflict_type=ConflictType.SECTION_OCCUPATION.value,
                        severity=ConflictSeverity.CRITICAL.value,
                        proposal_a_id=prop_a_id,
                        proposal_b_id=prop_b_id,
                        train_movement_id=None,
                        resulting_block_id=None,
                        track_line="UP",
                        overlap_description=(
                            f"Simultaneous section occupation on {prop_a.section_id} between "
                            f"proposal {prop_a_id} and {prop_b_id} ({overlap_min} mins overlap)"
                        ),
                        spatial_km_start=km_start,
                        spatial_km_end=km_end,
                        temporal_start=t_start,
                        temporal_end=t_end,
                        status=ConflictStatus.UNRESOLVED.value,
                        is_blocking=True,
                        created_at=now_utc,
                    )
                    new_conflicts.append(conflict)
                    detected_conflicts.append(conflict)

        # 5. RULE B — TRAIN_CROSSING (Proposal vs Train Movement)
        if request.check_train_movements:
            for prop in proposals:
                movements = self.train_movement_repo.list(db, section_id=prop.section_id)
                for mov in movements:
                    has_overlap = False
                    t_start: datetime
                    t_end: datetime

                    if mov.forecast_window_start and mov.forecast_window_end:
                        if (
                            prop.proposed_start_time < mov.forecast_window_end
                            and mov.forecast_window_start < prop.proposed_end_time
                        ):
                            has_overlap = True
                            t_start = max(prop.proposed_start_time, mov.forecast_window_start)
                            t_end = min(prop.proposed_end_time, mov.forecast_window_end)
                            if t_end <= t_start:
                                t_end = t_start + timedelta(minutes=1)
                    else:
                        m_date = (
                            mov.movement_date.date()
                            if isinstance(mov.movement_date, datetime)
                            else mov.movement_date
                        )
                        prop_start_date = prop.proposed_start_time.date()
                        prop_end_date = prop.proposed_end_time.date()

                        if prop_start_date <= m_date <= prop_end_date:
                            day_midnight = datetime.combine(m_date, datetime.min.time())
                            train_dt = day_midnight + timedelta(minutes=mov.scheduled_minute)
                            if prop.proposed_start_time <= train_dt < prop.proposed_end_time:
                                has_overlap = True
                                t_start = train_dt
                                t_end = prop.proposed_end_time
                                if t_end <= t_start:
                                    t_end = t_start + timedelta(minutes=15)

                    if not has_overlap:
                        continue

                    existing = self.conflict_repo.get_for_proposal_train(
                        db,
                        prop.id,
                        mov.id,
                        conflict_type=ConflictType.TRAIN_CROSSING.value,
                    )
                    if existing:
                        detected_conflicts.append(existing)
                    else:
                        sec = self.topology_repo.get_section(db, prop.section_id)
                        km_start = sec.start_km if sec else 0.0
                        km_end = sec.end_km if sec else 0.0

                        train_num = (
                            mov.train.train_number if mov.train else f"TrainMovement-{mov.id[:8]}"
                        )
                        desc = (
                            f"Train movement (Train {train_num}) intersects block proposal "
                            f"{prop.id} on section {prop.section_id}"
                        )
                        now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
                        conflict = Conflict(
                            id=f"CONF-{uuid4().hex[:12].upper()}",
                            conflict_type=ConflictType.TRAIN_CROSSING.value,
                            severity=ConflictSeverity.HIGH.value,
                            proposal_a_id=prop.id,
                            proposal_b_id=None,
                            train_movement_id=mov.id,
                            resulting_block_id=None,
                            track_line="UP",
                            overlap_description=desc,
                            spatial_km_start=km_start,
                            spatial_km_end=km_end,
                            temporal_start=t_start,
                            temporal_end=t_end,
                            status=ConflictStatus.UNRESOLVED.value,
                            is_blocking=True,
                            created_at=now_utc,
                        )
                        new_conflicts.append(conflict)
                        detected_conflicts.append(conflict)

        # 6. Transactional persistence with atomic rollback on failure
        if new_conflicts:
            try:
                for c in new_conflicts:
                    db.add(c)
                db.commit()
                for c in new_conflicts:
                    db.refresh(c)
            except Exception:
                db.rollback()
                raise

        # 7. Deduplicate and order by temporal_start
        seen_ids: set[str] = set()
        unique_conflicts: list[Conflict] = []
        for c in detected_conflicts:
            if c.id not in seen_ids:
                seen_ids.add(c.id)
                unique_conflicts.append(c)

        unique_conflicts.sort(key=lambda c: c.temporal_start)
        return unique_conflicts

    def list_conflicts(
        self,
        db: Session,
        *,
        run_id: str | None = None,
        proposal_id: str | None = None,
        status: str | None = None,
    ) -> list[Conflict]:
        """List conflicts matching optional search filters."""
        return self.conflict_repo.list_conflicts(
            db, run_id=run_id, proposal_id=proposal_id, status=status
        )

    def get_conflict(self, db: Session, conflict_id: str) -> Conflict:
        """Fetch a single conflict with eager-loaded resolution events."""
        conflict = self.conflict_repo.get(db, conflict_id)
        if not conflict:
            raise HTTPException(
                status_code=404,
                detail=f"Conflict '{conflict_id}' not found",
            )
        return conflict

    def resolve_conflict(
        self, db: Session, conflict_id: str, payload: ConflictResolutionCreate
    ) -> ConflictResolutionEvent:
        """Record an authoritative resolution event on a conflict.

        Maintains single-current-resolution invariant. Does NOT promote
        block proposals to operational blocks (Phase 6C scope).
        """
        conflict = self.conflict_repo.get(db, conflict_id)
        if not conflict:
            raise HTTPException(
                status_code=404,
                detail=f"Conflict '{conflict_id}' not found",
            )

        valid_actions = {a.value for a in ResolutionAction}
        action_upper = payload.resolution_action.strip().upper()
        if action_upper not in valid_actions:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Invalid resolution action '{payload.resolution_action}'. "
                    f"Must be one of {sorted(valid_actions)}"
                ),
            )

        if not payload.actor_id or not payload.actor_id.strip():
            raise HTTPException(status_code=422, detail="actor_id cannot be empty")
        if not payload.rationale_notes or not payload.rationale_notes.strip():
            raise HTTPException(status_code=422, detail="rationale_notes cannot be empty")

        existing_seq = db.scalar(
            select(func.max(ConflictResolutionEvent.event_sequence)).where(
                ConflictResolutionEvent.conflict_id == conflict_id
            )
        ) or 0

        now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
        event = ConflictResolutionEvent(
            id=str(uuid4()),
            conflict_id=conflict_id,
            event_sequence=existing_seq + 1,
            resolution_action=action_upper,
            actor_id=payload.actor_id.strip(),
            actor_role=payload.actor_role.strip(),
            resulting_block_id=payload.resulting_block_id,
            rationale_notes=payload.rationale_notes.strip(),
            is_current_resolution=True,
            created_at=now_utc,
        )

        try:
            return self.conflict_repo.add_resolution_event(db, event)
        except Exception:
            db.rollback()
            raise
