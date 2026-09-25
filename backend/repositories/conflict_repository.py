from sqlalchemy import or_, select, update
from sqlalchemy.orm import Session, selectinload

from backend.database.models.conflict import Conflict, ConflictResolutionEvent


class ConflictRepository:
    """Repository for pre-approval candidate conflicts and resolution events."""

    def create(self, db: Session, conflict: Conflict) -> Conflict:
        db.add(conflict)
        db.commit()
        db.refresh(conflict)
        return conflict

    def get(self, db: Session, conflict_id: str) -> Conflict | None:
        statement = (
            select(Conflict)
            .where(Conflict.id == conflict_id)
            .options(
                selectinload(Conflict.proposal_a),
                selectinload(Conflict.proposal_b),
                selectinload(Conflict.train_movement),
                selectinload(Conflict.resolution_events),
            )
        )
        return db.scalar(statement)

    def list_for_proposal(self, db: Session, proposal_id: str) -> list[Conflict]:
        statement = (
            select(Conflict)
            .where(
                or_(
                    Conflict.proposal_a_id == proposal_id,
                    Conflict.proposal_b_id == proposal_id,
                )
            )
            .options(selectinload(Conflict.resolution_events))
            .order_by(Conflict.temporal_start)
        )
        return list(db.scalars(statement))

    def has_unresolved_blocking_conflicts(self, db: Session, proposal_id: str) -> bool:
        """Safety invariant query: checks if proposal is obstructed by any active blocking conflict."""
        return len(self.get_unresolved_blocking_conflicts(db, proposal_id)) > 0

    def get_unresolved_blocking_conflicts(self, db: Session, proposal_id: str) -> list[Conflict]:
        statement = select(Conflict).where(
            or_(
                Conflict.proposal_a_id == proposal_id,
                Conflict.proposal_b_id == proposal_id,
            ),
            Conflict.is_blocking == True,
            Conflict.status == "UNRESOLVED",
        )
        return list(db.scalars(statement))

    def add_resolution_event(
        self, db: Session, event: ConflictResolutionEvent
    ) -> ConflictResolutionEvent:
        """Persist a resolution event, managing the single-current-resolution invariant."""
        if event.is_current_resolution:
            # Demote existing current resolutions for this conflict
            db.execute(
                update(ConflictResolutionEvent)
                .where(
                    ConflictResolutionEvent.conflict_id == event.conflict_id,
                    ConflictResolutionEvent.is_current_resolution == True,
                )
                .values(is_current_resolution=False)
            )
            event.is_current_resolution = True

        db.add(event)

        # Update conflict status to RESOLVED
        conflict = db.get(Conflict, event.conflict_id)
        if conflict:
            conflict.status = "RESOLVED"
            if event.resulting_block_id:
                conflict.resulting_block_id = event.resulting_block_id

        db.commit()
        db.refresh(event)
        return event

    def list_resolution_history(self, db: Session, conflict_id: str) -> list[ConflictResolutionEvent]:
        statement = (
            select(ConflictResolutionEvent)
            .where(ConflictResolutionEvent.conflict_id == conflict_id)
            .order_by(ConflictResolutionEvent.event_sequence.desc(), ConflictResolutionEvent.created_at.desc())
        )
        return list(db.scalars(statement))
