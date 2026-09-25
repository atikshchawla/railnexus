from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.orm import Session, selectinload

from backend.database.models.conflict import Conflict, ConflictResolutionEvent
from backend.database.models.optimization import BlockProposal
from backend.database.models.train import TrainMovement


class ConflictRepository:
    """Repository for pre-approval candidate conflicts and resolution events."""

    def create(self, db: Session, conflict: Conflict) -> Conflict:
        db.add(conflict)
        db.commit()
        db.refresh(conflict)
        return conflict

    def save_all(self, db: Session, conflicts: list[Conflict]) -> list[Conflict]:
        """Persist multiple conflicts transactionally."""
        db.add_all(conflicts)
        db.commit()
        for c in conflicts:
            db.refresh(c)
        return conflicts

    def get(self, db: Session, conflict_id: str) -> Conflict | None:
        statement = (
            select(Conflict)
            .where(Conflict.id == conflict_id)
            .options(
                selectinload(Conflict.proposal_a),
                selectinload(Conflict.proposal_b),
                selectinload(Conflict.train_movement).selectinload(TrainMovement.train),
                selectinload(Conflict.resolution_events),
            )
        )
        return db.scalar(statement)

    def list_for_run(self, db: Session, run_id: str, status: str | None = None) -> list[Conflict]:
        """List all conflicts involving block proposals in a specific optimization run."""
        run_prop_ids = select(BlockProposal.id).where(BlockProposal.run_id == run_id)
        statement = (
            select(Conflict)
            .where(
                or_(
                    Conflict.proposal_a_id.in_(run_prop_ids),
                    Conflict.proposal_b_id.in_(run_prop_ids),
                )
            )
        )
        if status:
            statement = statement.where(Conflict.status == status)
        statement = statement.options(
            selectinload(Conflict.proposal_a),
            selectinload(Conflict.proposal_b),
            selectinload(Conflict.train_movement).selectinload(TrainMovement.train),
            selectinload(Conflict.resolution_events),
        ).order_by(Conflict.temporal_start)
        return list(db.scalars(statement))

    def get_for_proposal_pair(
        self,
        db: Session,
        proposal_a_id: str,
        proposal_b_id: str,
        conflict_type: str | None = None,
    ) -> Conflict | None:
        """Find conflict for a pair of proposals in canonical or reverse order."""
        min_id, max_id = (
            (proposal_a_id, proposal_b_id)
            if proposal_a_id <= proposal_b_id
            else (proposal_b_id, proposal_a_id)
        )
        statement = select(Conflict).where(
            or_(
                and_(Conflict.proposal_a_id == min_id, Conflict.proposal_b_id == max_id),
                and_(Conflict.proposal_a_id == max_id, Conflict.proposal_b_id == min_id),
            )
        )
        if conflict_type:
            statement = statement.where(Conflict.conflict_type == conflict_type)
        statement = statement.options(
            selectinload(Conflict.proposal_a),
            selectinload(Conflict.proposal_b),
            selectinload(Conflict.resolution_events),
        ).order_by(Conflict.created_at.desc())
        return db.scalars(statement).first()

    def get_for_proposal_train(
        self,
        db: Session,
        proposal_id: str,
        train_movement_id: str,
        conflict_type: str | None = None,
    ) -> Conflict | None:
        """Find conflict between a block proposal and a train movement."""
        statement = select(Conflict).where(
            Conflict.proposal_a_id == proposal_id,
            Conflict.train_movement_id == train_movement_id,
        )
        if conflict_type:
            statement = statement.where(Conflict.conflict_type == conflict_type)
        statement = statement.options(
            selectinload(Conflict.proposal_a),
            selectinload(Conflict.train_movement).selectinload(TrainMovement.train),
            selectinload(Conflict.resolution_events),
        ).order_by(Conflict.created_at.desc())
        return db.scalars(statement).first()

    def list_conflicts(
        self,
        db: Session,
        *,
        run_id: str | None = None,
        proposal_id: str | None = None,
        status: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[Conflict]:
        """List conflicts with optional filters for run, proposal, or status."""
        statement = select(Conflict)
        if run_id and isinstance(run_id, str):
            run_prop_ids = select(BlockProposal.id).where(BlockProposal.run_id == run_id)
            statement = statement.where(
                or_(
                    Conflict.proposal_a_id.in_(run_prop_ids),
                    Conflict.proposal_b_id.in_(run_prop_ids),
                )
            )
        if proposal_id and isinstance(proposal_id, str):
            statement = statement.where(
                or_(
                    Conflict.proposal_a_id == proposal_id,
                    Conflict.proposal_b_id == proposal_id,
                )
            )
        if status and isinstance(status, str):
            statement = statement.where(Conflict.status == status)

        statement = (
            statement.options(
                selectinload(Conflict.proposal_a),
                selectinload(Conflict.proposal_b),
                selectinload(Conflict.train_movement).selectinload(TrainMovement.train),
                selectinload(Conflict.resolution_events),
            )
            .order_by(Conflict.temporal_start)
            .limit(limit)
            .offset(offset)
        )
        return list(db.scalars(statement))

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
        if not event.event_sequence or event.event_sequence == 1:
            count = db.scalar(
                select(func.count(ConflictResolutionEvent.id)).where(
                    ConflictResolutionEvent.conflict_id == event.conflict_id
                )
            ) or 0
            if count > 0:
                event.event_sequence = count + 1

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
