from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from backend.database.models.train import TmsMovement, Train, TrainMovement


class TrainRepository:
    def list(self, db: Session, *, service_type: str | None = None) -> list[Train]:
        stmt = select(Train).order_by(Train.train_number)
        if service_type:
            stmt = stmt.where(Train.service_type == service_type)
        return list(db.scalars(stmt))

    def get(self, db: Session, train_id: str) -> Train | None:
        return db.get(Train, train_id)

    def get_by_number(self, db: Session, train_number: str) -> Train | None:
        stmt = select(Train).where(Train.train_number == train_number)
        return db.scalar(stmt)

    def create(self, db: Session, train: Train) -> Train:
        db.add(train)
        db.commit()
        db.refresh(train)
        return train

    def add_movement(self, db: Session, movement: TrainMovement) -> TrainMovement:
        """Backward compatible helper to add a train movement."""
        db.add(movement)
        db.commit()
        db.refresh(movement)
        return movement


class TrainMovementRepository:
    """Repository for train movements (both SCHEDULED and GOODS_FORECAST)."""

    def create(self, db: Session, movement: TrainMovement) -> TrainMovement:
        db.add(movement)
        db.commit()
        db.refresh(movement)
        return movement

    def get(self, db: Session, movement_id: str) -> TrainMovement | None:
        stmt = select(TrainMovement).where(TrainMovement.id == movement_id).options(selectinload(TrainMovement.train))
        return db.scalar(stmt)

    def list(
        self,
        db: Session,
        *,
        section_id: str | None = None,
        movement_type: str | None = None,
        traffic_source: str | None = None,
    ) -> list[TrainMovement]:
        stmt = select(TrainMovement).order_by(TrainMovement.scheduled_minute)
        if section_id:
            stmt = stmt.where(TrainMovement.section_id == section_id)
        if movement_type:
            stmt = stmt.where(TrainMovement.movement_type == movement_type)
        if traffic_source:
            stmt = stmt.where(TrainMovement.traffic_source == traffic_source)
        return list(db.scalars(stmt))

    def list_in_window(
        self,
        db: Session,
        section_id: str,
        start_minute: int,
        end_minute: int,
    ) -> list[TrainMovement]:
        stmt = (
            select(TrainMovement)
            .where(
                TrainMovement.section_id == section_id,
                TrainMovement.scheduled_minute >= start_minute,
                TrainMovement.scheduled_minute <= end_minute,
            )
            .order_by(TrainMovement.scheduled_minute)
        )
        return list(db.scalars(stmt))
