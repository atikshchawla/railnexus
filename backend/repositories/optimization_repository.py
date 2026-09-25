from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from backend.database.models.optimization import BlockProposal, OptimizationRun, ProposalDepartment, ProposalItem


class OptimizationRepository:
    """Repository for OptimizationRuns and BlockProposals.

    Note: Historical optimization runs are NEVER deleted on rerunning with matching hashes.
    Full provenance is preserved across planning cycles.
    """

    def create_run(self, db: Session, run: OptimizationRun) -> OptimizationRun:
        """Persist a new optimization run and its candidate block proposals (append-only)."""
        try:
            db.add(run)
            db.commit()
            db.refresh(run)
            return run
        except Exception:
            db.rollback()
            raise

    def get_run(self, db: Session, run_id: str) -> OptimizationRun | None:
        statement = (
            select(OptimizationRun)
            .where(OptimizationRun.id == run_id)
            .options(
                selectinload(OptimizationRun.proposals)
                .selectinload(BlockProposal.items),
                selectinload(OptimizationRun.proposals)
                .selectinload(BlockProposal.departments),
            )
        )
        return db.scalar(statement)

    def get_latest_run(self, db: Session, corridor_id: str | None = None) -> OptimizationRun | None:
        statement = select(OptimizationRun).order_by(OptimizationRun.created_at.desc())
        if corridor_id:
            statement = statement.where(OptimizationRun.corridor_id == corridor_id)
        statement = statement.options(
            selectinload(OptimizationRun.proposals).selectinload(BlockProposal.items),
            selectinload(OptimizationRun.proposals).selectinload(BlockProposal.departments),
        )
        return db.scalar(statement)

    def get_latest_run_by_hash(self, db: Session, input_hash: str) -> OptimizationRun | None:
        statement = (
            select(OptimizationRun)
            .where(OptimizationRun.input_requests_hash == input_hash)
            .order_by(OptimizationRun.created_at.desc())
            .options(
                selectinload(OptimizationRun.proposals).selectinload(BlockProposal.items),
                selectinload(OptimizationRun.proposals).selectinload(BlockProposal.departments),
            )
        )
        return db.scalar(statement)

    def list_runs(
        self, db: Session, corridor_id: str | None = None, *, limit: int = 50
    ) -> list[OptimizationRun]:
        statement = select(OptimizationRun).order_by(OptimizationRun.created_at.desc()).limit(limit)
        if corridor_id:
            statement = statement.where(OptimizationRun.corridor_id == corridor_id)
        return list(db.scalars(statement))

    def get_proposal(self, db: Session, proposal_id: str) -> BlockProposal | None:
        statement = (
            select(BlockProposal)
            .where(BlockProposal.id == proposal_id)
            .options(
                selectinload(BlockProposal.items).selectinload(ProposalItem.maintenance_request),
                selectinload(BlockProposal.departments),
                selectinload(BlockProposal.manual_overrides),
                selectinload(BlockProposal.operational_blocks),
            )
        )
        return db.scalar(statement)

    def list_proposals_for_run(self, db: Session, run_id: str) -> list[BlockProposal]:
        statement = (
            select(BlockProposal)
            .where(BlockProposal.run_id == run_id)
            .options(
                selectinload(BlockProposal.items),
                selectinload(BlockProposal.departments),
            )
            .order_by(BlockProposal.proposed_start_time)
        )
        return list(db.scalars(statement))

    def update_proposal_status(self, db: Session, proposal_id: str, status: str) -> BlockProposal:
        proposal = db.get(BlockProposal, proposal_id)
        if not proposal:
            raise ValueError(f"BlockProposal {proposal_id} not found")
        proposal.status = status
        db.commit()
        db.refresh(proposal)
        return proposal
