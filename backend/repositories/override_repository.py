from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from backend.database.models.operational_block import ManualOverride
from backend.domain.rules.safety_invariants import assert_valid_manual_override


class ManualOverrideRepository:
    """Repository for human operator modifications and deliberations."""

    def create(self, db: Session, override: ManualOverride) -> ManualOverride:
        # Enforce Audit Invariant BR-010 before persisting
        assert_valid_manual_override(
            proposal_id=override.proposal_id,
            field_name=override.field_modified,
            justification_reason=override.justification_notes,
        )

        db.add(override)
        db.commit()
        db.refresh(override)
        return override

    def get(self, db: Session, override_id: str) -> ManualOverride | None:
        stmt = (
            select(ManualOverride)
            .where(ManualOverride.id == override_id)
            .options(selectinload(ManualOverride.proposal), selectinload(ManualOverride.operational_blocks))
        )
        return db.scalar(stmt)

    def list_for_proposal(self, db: Session, proposal_id: str) -> list[ManualOverride]:
        stmt = (
            select(ManualOverride)
            .where(ManualOverride.proposal_id == proposal_id)
            .order_by(ManualOverride.created_at.desc())
        )
        return list(db.scalars(stmt))
