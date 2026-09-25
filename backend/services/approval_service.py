"""Phase 6C — Authoritative Approval Service.

Implements the BlockProposal → OperationalBlock promotion lifecycle.

Canonical flow:
    OptimizationRun → BlockProposal → Conflict Detection
    → [Conflicts Resolved] → ApprovalService.approve_proposal()
    → ManualOverride (if override) → OperationalBlock (APPROVED)

Safety invariant (BR-003):
    A proposal with at least one UNRESOLVED BLOCKING conflict MUST NOT be
    promoted. ApprovalBlockedByConflictError is raised before any mutation.

Idempotency:
    Repeated approval of an already ACCEPTED or OVERRIDDEN proposal locates
    and returns the existing OperationalBlock without creating duplicate
    blocks, duplicate root revisions, or duplicate audit logs.

Rejection flow:
    ApprovalService.reject_proposal() → BlockProposal.status = "REJECTED"
    From "PROPOSED" status only; no conflict gating required for rejection.

Transactionality:
    ApprovalService is the transaction owner for approval and rejection.
    Repository methods stage/flush changes without committing independently.
    ApprovalService owns final db.commit() and db.rollback().

Scope boundaries (Phase 6C):
    - DO NOT implement authentication / RBAC.
    - DO NOT modify Demo Gateway or Integration/Tunnel layers.
    - DO NOT auto-approve anything.
    - DO NOT promote without passing Phase 6B conflict gate.
"""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from backend.api.schemas.approval import (
    ApprovalProposalRead,
    ProposalApproveRequest,
    ProposalRejectRequest,
)
from backend.database.models.conflict import Conflict
from backend.database.models.maintenance import MaintenanceRequest
from backend.database.models.operational_block import ManualOverride, OperationalBlock
from backend.database.models.optimization import BlockProposal
from backend.domain.enums import MaintenanceStatus
from backend.domain.exceptions import ApprovalBlockedByConflictError
from backend.domain.state_machines.maintenance_lifecycle import can_transition_maintenance
from backend.repositories.audit_repository import AuditRepository
from backend.repositories.operational_block_repository import OperationalBlockRepository
from backend.repositories.optimization_repository import OptimizationRepository


class ApprovalService:
    """Core domain service for BlockProposal approval and rejection lifecycle."""

    def __init__(
        self,
        optimization_repository: OptimizationRepository | None = None,
        operational_block_repository: OperationalBlockRepository | None = None,
        audit_repository: AuditRepository | None = None,
    ):
        self.optimization_repo = optimization_repository or OptimizationRepository()
        self.ob_repo = operational_block_repository or OperationalBlockRepository()
        self.audit_repo = audit_repository or AuditRepository()

    # ------------------------------------------------------------------
    # Approve
    # ------------------------------------------------------------------

    def approve_proposal(
        self, db: Session, proposal_id: str, payload: ProposalApproveRequest
    ) -> OperationalBlock:
        """Promote a BlockProposal to an authoritative OperationalBlock.

        Required successful transaction:
        BEGIN
        → fetch proposal
        → validate PROPOSED / idempotent state
        → conflict gate
        → validate override
        → stage ManualOverride
        → stage OperationalBlock
        → stage BlockDepartments
        → update proposal
        → update valid MaintenanceRequest states if supported
        → stage AuditLog
        → COMMIT

        Any failure:
        → ROLLBACK everything.
        """
        # 1. Fetch proposal
        proposal = self._get_proposal_or_404(db, proposal_id)

        # 2. Idempotency validation: already approved/overridden proposals return existing block
        if proposal.status in ("ACCEPTED", "OVERRIDDEN"):
            existing_block = self.ob_repo.get_for_proposal(db, proposal_id)
            if existing_block:
                return existing_block
            raise HTTPException(
                status_code=409,
                detail=(
                    f"BlockProposal '{proposal.id}' is '{proposal.status}' "
                    f"but existing OperationalBlock was not found."
                ),
            )

        if proposal.status == "REJECTED":
            raise HTTPException(
                status_code=409,
                detail=f"BlockProposal '{proposal.id}' cannot be approved: current status is 'REJECTED'.",
            )

        if proposal.status != "PROPOSED":
            raise HTTPException(
                status_code=409,
                detail=(
                    f"BlockProposal '{proposal.id}' cannot be approved: "
                    f"current status is '{proposal.status}', expected 'PROPOSED'."
                ),
            )

        # 3. Spatial validation
        if payload.end_km <= payload.start_km:
            raise HTTPException(
                status_code=422,
                detail=f"end_km ({payload.end_km}) must be greater than start_km ({payload.start_km})",
            )

        # 4. Validate manual override (all-or-nothing fields)
        override_id: str | None = None
        has_override = any(
            [payload.override_justification, payload.override_code, payload.operator_role]
        )
        if has_override:
            missing = []
            if not payload.override_justification or not payload.override_justification.strip():
                missing.append("override_justification")
            if not payload.override_code or not payload.override_code.strip():
                missing.append("override_code")
            if not payload.operator_role or not payload.operator_role.strip():
                missing.append("operator_role")
            if missing:
                raise HTTPException(
                    status_code=422,
                    detail=(
                        f"Manual override requires all three fields: override_justification, "
                        f"override_code, operator_role. Missing: {missing}"
                    ),
                )
            override_id = str(uuid4())

        # 5. Transaction owned by ApprovalService
        try:
            # 5a. Stage ManualOverride if override fields are present
            if override_id:
                now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
                override = ManualOverride(
                    id=override_id,
                    proposal_id=proposal_id,
                    operator_id=payload.approved_by,
                    operator_role=payload.operator_role.strip(),
                    field_modified="schedule" if (payload.custom_scheduled_start or payload.custom_scheduled_end) else "approval",
                    original_start_time=proposal.proposed_start_time,
                    original_end_time=proposal.proposed_end_time,
                    adjusted_start_time=payload.custom_scheduled_start or proposal.proposed_start_time,
                    adjusted_end_time=payload.custom_scheduled_end or proposal.proposed_end_time,
                    dissolved_group=False,
                    justification_code=payload.override_code.strip(),
                    justification_notes=payload.override_justification.strip(),
                    created_at=now_utc,
                )
                db.add(override)
                db.flush()

            # 5b. Stage OperationalBlock + BlockDepartments + Proposal status update
            # promote_from_proposal enforces the Phase 6B conflict gate!
            block = self.ob_repo.promote_from_proposal(
                db,
                proposal_id=proposal_id,
                block_id=payload.block_id,
                lead_department=payload.lead_department,
                approved_by=payload.approved_by,
                start_km=payload.start_km,
                end_km=payload.end_km,
                track_line=payload.track_line,
                override_id=override_id,
                custom_scheduled_start=payload.custom_scheduled_start,
                custom_scheduled_end=payload.custom_scheduled_end,
                auto_commit=False,
            )

            # 5c. Update valid MaintenanceRequest states if supported
            if proposal.items:
                for item in proposal.items:
                    req = item.maintenance_request or db.get(MaintenanceRequest, item.maintenance_request_id)
                    if req:
                        try:
                            curr_status = MaintenanceStatus(req.status)
                            if can_transition_maintenance(curr_status, MaintenanceStatus.APPROVED):
                                req.status = MaintenanceStatus.APPROVED.value
                        except (ValueError, KeyError):
                            pass

            # 5d. Stage AuditLog
            audit_diff = {
                "block_id": block.id,
                "status": "OVERRIDDEN" if override_id else "ACCEPTED",
                "lead_department": payload.lead_department,
                "track_line": payload.track_line,
                "start_km": payload.start_km,
                "end_km": payload.end_km,
            }
            if override_id:
                audit_diff.update({
                    "override_id": override_id,
                    "override_code": payload.override_code.strip(),
                    "override_justification": payload.override_justification.strip(),
                    "operator_role": payload.operator_role.strip(),
                })

            self.audit_repo.log(
                db,
                entity_name="BlockProposal",
                entity_id=proposal_id,
                action="PROPOSAL_APPROVED",
                actor_id=payload.approved_by,
                actor_role=payload.operator_role.strip() if payload.operator_role else "SECTION_CONTROLLER",
                payload_diff=audit_diff,
                auto_commit=False,
            )

            # 5e. Final COMMIT
            db.commit()
            db.refresh(block)
            return block

        except ApprovalBlockedByConflictError as exc:
            db.rollback()
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        except HTTPException:
            db.rollback()
            raise
        except Exception:
            db.rollback()
            raise

    # ------------------------------------------------------------------
    # Reject
    # ------------------------------------------------------------------

    def reject_proposal(
        self, db: Session, proposal_id: str, payload: ProposalRejectRequest
    ) -> dict:
        """Reject a BlockProposal, marking it REJECTED without promotion.

        Canonical lifecycle:
        PROPOSED -> REJECTED (terminal)

        Only PROPOSED proposals can be rejected.
        Audit log is staged and committed within the same transaction.
        """
        proposal = self._get_proposal_or_404(db, proposal_id)
        self._assert_rejectable(proposal)

        rejected_at = datetime.now(timezone.utc).replace(tzinfo=None)
        proposal.status = "REJECTED"

        try:
            # Stage AuditLog within the same transaction
            self.audit_repo.log(
                db,
                entity_name="BlockProposal",
                entity_id=proposal_id,
                action="PROPOSAL_REJECTED",
                actor_id=payload.rejected_by,
                actor_role=getattr(payload, "operator_role", None) or "SECTION_CONTROLLER",
                payload_diff={
                    "status": "REJECTED",
                    "rejection_reason": payload.rejection_reason,
                },
                auto_commit=False,
            )
            db.commit()
        except Exception:
            db.rollback()
            raise

        return {
            "proposal_id": proposal_id,
            "status": proposal.status,
            "rejected_by": payload.rejected_by,
            "rejection_reason": payload.rejection_reason,
            "rejected_at": rejected_at,
        }

    # ------------------------------------------------------------------
    # Query views for human review
    # ------------------------------------------------------------------

    def get_proposal_view(self, db: Session, proposal_id: str) -> ApprovalProposalRead:
        """Get authoritative persisted proposal approval view."""
        proposal = self._get_proposal_or_404(db, proposal_id)
        return self._build_proposal_view(db, proposal)

    def list_proposals(
        self,
        db: Session,
        *,
        section_id: str | None = None,
        status: str | None = None,
        run_id: str | None = None,
        limit: int = 100,
    ) -> list[ApprovalProposalRead]:
        """List persisted BlockProposals for human review."""
        stmt = select(BlockProposal).order_by(BlockProposal.created_at.desc())
        if section_id:
            stmt = stmt.where(BlockProposal.section_id == section_id)
        if status:
            stmt = stmt.where(BlockProposal.status == status)
        if run_id:
            stmt = stmt.where(BlockProposal.run_id == run_id)
        stmt = stmt.limit(limit)
        stmt = stmt.options(
            selectinload(BlockProposal.departments),
            selectinload(BlockProposal.items),
            selectinload(BlockProposal.operational_blocks),
        )
        proposals = list(db.scalars(stmt))
        return [self._build_proposal_view(db, p) for p in proposals]

    def _build_proposal_view(self, db: Session, proposal: BlockProposal) -> ApprovalProposalRead:
        blocking_conflicts = list(
            db.scalars(
                select(Conflict).where(
                    or_(
                        Conflict.proposal_a_id == proposal.id,
                        Conflict.proposal_b_id == proposal.id,
                    ),
                    Conflict.is_blocking == True,
                    Conflict.status == "UNRESOLVED",
                )
            )
        )
        op_block = self.ob_repo.get_for_proposal(db, proposal.id)
        dept_names = [d.department for d in proposal.departments] if proposal.departments else []
        req_ids = [it.maintenance_request_id for it in proposal.items] if proposal.items else []

        return ApprovalProposalRead(
            id=proposal.id,
            run_id=proposal.run_id,
            section_id=proposal.section_id,
            status=proposal.status,
            proposed_start_time=proposal.proposed_start_time,
            proposed_end_time=proposal.proposed_end_time,
            predicted_duration_minutes=proposal.predicted_duration_minutes,
            possession_saving_minutes=proposal.possession_saving_minutes,
            train_impact_minutes=proposal.train_impact_minutes,
            trains_affected_count=proposal.trains_affected_count,
            confidence_score=proposal.confidence_score,
            top_factors_json=proposal.top_factors_json or {},
            safety_cautions=proposal.safety_cautions or [],
            created_at=proposal.created_at,
            departments=dept_names,
            maintenance_request_ids=req_ids,
            has_blocking_conflicts=len(blocking_conflicts) > 0,
            blocking_conflict_count=len(blocking_conflicts),
            operational_block_id=op_block.id if op_block else None,
            operational_block_status=op_block.status if op_block else None,
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _get_proposal_or_404(self, db: Session, proposal_id: str) -> BlockProposal:
        proposal = self.optimization_repo.get_proposal(db, proposal_id)
        if not proposal:
            raise HTTPException(
                status_code=404,
                detail=f"BlockProposal '{proposal_id}' not found",
            )
        return proposal

    def _assert_rejectable(self, proposal: BlockProposal) -> None:
        """For Phase 6C, only PROPOSED proposals may be rejected."""
        if proposal.status != "PROPOSED":
            raise HTTPException(
                status_code=409,
                detail=(
                    f"BlockProposal '{proposal.id}' cannot be rejected: "
                    f"current status is '{proposal.status}', expected 'PROPOSED'."
                ),
            )
