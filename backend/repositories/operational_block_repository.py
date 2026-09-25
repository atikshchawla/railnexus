from datetime import datetime, timezone
from sqlalchemy import or_, select, update
from sqlalchemy.orm import Session, selectinload

from backend.database.models.conflict import Conflict
from backend.database.models.operational_block import BlockDepartment, OperationalBlock
from backend.database.models.optimization import BlockProposal
from backend.domain.exceptions import ApprovalBlockedByConflictError


class OperationalBlockRepository:
    """Repository for official OperationalBlocks, revisions, and department permits."""

    def promote_from_proposal(
        self,
        db: Session,
        *,
        proposal_id: str,
        block_id: str,
        lead_department: str,
        approved_by: str,
        start_km: float,
        end_km: float,
        track_line: str = "UP",
        override_id: str | None = None,
        custom_scheduled_start: datetime | None = None,
        custom_scheduled_end: datetime | None = None,
        auto_commit: bool = True,
    ) -> OperationalBlock:
        """Promote a candidate BlockProposal to an official OperationalBlock.

        SAFETY INVARIANT (BR-003 / Phase 4 Section 13):
        A block proposal with an unresolved blocking conflict CANNOT be promoted to an approved
        operational block. Raises ApprovalBlockedByConflictError.
        """
        # 1. Enforce safety invariant against active blocking conflicts
        blocking_conflicts = list(
            db.scalars(
                select(Conflict).where(
                    or_(
                        Conflict.proposal_a_id == proposal_id,
                        Conflict.proposal_b_id == proposal_id,
                    ),
                    Conflict.is_blocking == True,
                    Conflict.status == "UNRESOLVED",
                )
            )
        )
        if blocking_conflicts:
            raise ApprovalBlockedByConflictError(
                block_id=proposal_id,
                unresolved_conflict_ids=[c.id for c in blocking_conflicts],
            )

        # 2. Retrieve proposal
        proposal = db.get(BlockProposal, proposal_id)
        if not proposal:
            raise ValueError(f"BlockProposal {proposal_id} not found")

        scheduled_start = custom_scheduled_start or proposal.proposed_start_time
        scheduled_end = custom_scheduled_end or proposal.proposed_end_time

        # 3. Create root operational block (revision_number = 1)
        block = OperationalBlock(
            id=block_id,
            section_id=proposal.section_id,
            track_line=track_line,
            start_km=start_km,
            end_km=end_km,
            scheduled_start=scheduled_start,
            scheduled_end=scheduled_end,
            origin_proposal_id=proposal_id,
            override_id=override_id,
            lead_department=lead_department,
            status="APPROVED",
            approved_by=approved_by,
            approved_at=datetime.now(timezone.utc),
            revision_number=1,
            parent_block_id=None,
            is_current=True,
        )
        db.add(block)

        # 4. Associate participating departments from proposal
        proposal_with_deps = db.scalar(
            select(BlockProposal)
            .where(BlockProposal.id == proposal_id)
            .options(selectinload(BlockProposal.departments))
        )
        departments_to_add = set()
        if proposal_with_deps and proposal_with_deps.departments:
            for pdept in proposal_with_deps.departments:
                departments_to_add.add(pdept.department)
        departments_to_add.add(lead_department)

        for dept in sorted(departments_to_add):
            block_dept = BlockDepartment(
                block_id=block_id,
                department=dept,
                permit_status="PENDING",
            )
            db.add(block_dept)

        # 5. Update proposal status
        proposal.status = "OVERRIDDEN" if override_id else "ACCEPTED"

        if auto_commit:
            db.commit()
            db.refresh(block)
        else:
            db.flush()

        return block

    def get_for_proposal(self, db: Session, proposal_id: str) -> OperationalBlock | None:
        """Retrieve the existing current/root OperationalBlock for a given BlockProposal."""
        stmt = (
            select(OperationalBlock)
            .where(OperationalBlock.origin_proposal_id == proposal_id)
            .order_by(OperationalBlock.is_current.desc(), OperationalBlock.revision_number.desc())
            .options(
                selectinload(OperationalBlock.section),
                selectinload(OperationalBlock.origin_proposal),
                selectinload(OperationalBlock.override),
                selectinload(OperationalBlock.departments),
                selectinload(OperationalBlock.child_revisions),
            )
        )
        return db.scalar(stmt)

    def create_revision(
        self,
        db: Session,
        *,
        parent_block_id: str,
        new_block_id: str,
        scheduled_start: datetime,
        scheduled_end: datetime,
        start_km: float,
        end_km: float,
        approved_by: str,
        override_id: str | None = None,
    ) -> OperationalBlock:
        """Create a new revision for an existing operational block, maintaining revision chaining."""
        parent = db.get(OperationalBlock, parent_block_id)
        if not parent:
            raise ValueError(f"Parent OperationalBlock {parent_block_id} not found")

        # Mark parent as historical
        parent.is_current = False

        new_revision = OperationalBlock(
            id=new_block_id,
            section_id=parent.section_id,
            track_line=parent.track_line,
            start_km=start_km,
            end_km=end_km,
            scheduled_start=scheduled_start,
            scheduled_end=scheduled_end,
            origin_proposal_id=parent.origin_proposal_id,
            override_id=override_id,
            lead_department=parent.lead_department,
            status="APPROVED",
            approved_by=approved_by,
            approved_at=datetime.now(timezone.utc),
            revision_number=parent.revision_number + 1,
            parent_block_id=parent.id,
            is_current=True,
        )
        db.add(new_revision)
        db.commit()
        db.refresh(new_revision)
        return new_revision

    def get(self, db: Session, block_id: str) -> OperationalBlock | None:
        stmt = (
            select(OperationalBlock)
            .where(OperationalBlock.id == block_id)
            .options(
                selectinload(OperationalBlock.section),
                selectinload(OperationalBlock.origin_proposal),
                selectinload(OperationalBlock.override),
                selectinload(OperationalBlock.departments),
                selectinload(OperationalBlock.child_revisions),
            )
        )
        return db.scalar(stmt)

    def list(
        self,
        db: Session,
        *,
        section_id: str | None = None,
        status: str | None = None,
        is_current: bool = True,
    ) -> list[OperationalBlock]:
        stmt = select(OperationalBlock).order_by(OperationalBlock.scheduled_start)
        if is_current is not None:
            stmt = stmt.where(OperationalBlock.is_current == is_current)
        if section_id:
            stmt = stmt.where(OperationalBlock.section_id == section_id)
        if status:
            stmt = stmt.where(OperationalBlock.status == status)
        return list(db.scalars(stmt))

    def update_status(self, db: Session, block_id: str, status: str) -> OperationalBlock:
        block = db.get(OperationalBlock, block_id)
        if not block:
            raise ValueError(f"OperationalBlock {block_id} not found")
        block.status = status
        db.commit()
        db.refresh(block)
        return block

    def update_department_permit(
        self,
        db: Session,
        *,
        block_id: str,
        department: str,
        permit_status: str,
        clearance_notes: str | None = None,
    ) -> BlockDepartment:
        stmt = select(BlockDepartment).where(
            BlockDepartment.block_id == block_id,
            BlockDepartment.department == department,
        )
        bdept = db.scalar(stmt)
        if not bdept:
            bdept = BlockDepartment(
                block_id=block_id,
                department=department,
                permit_status=permit_status,
                clearance_notes=clearance_notes,
            )
            db.add(bdept)
        else:
            bdept.permit_status = permit_status
            if clearance_notes:
                bdept.clearance_notes = clearance_notes
            if permit_status == "PERMIT_ISSUED":
                bdept.permit_issued_at = datetime.now(timezone.utc)
            elif permit_status in ["CLEARED", "CLOSED"]:
                bdept.cleared_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(bdept)
        return bdept
