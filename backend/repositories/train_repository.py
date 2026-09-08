from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.database.models.train import TmsMovement, Train


class TrainRepository:
    def list(self, db: Session) -> list[Train]:
        return list(db.scalars(select(Train).order_by(Train.train_number)))

    def create(self, db: Session, train: Train) -> Train:
        db.add(train)
        db.commit()
        db.refresh(train)
        return train

    def add_movement(self, db: Session, movement: TmsMovement) -> TmsMovement:
        db.add(movement)
        db.commit()
        db.refresh(movement)
        return movement
