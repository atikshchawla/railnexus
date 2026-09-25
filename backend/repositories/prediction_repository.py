from sqlalchemy import select, update
from sqlalchemy.orm import Session

from backend.database.models.prediction import Prediction


class PredictionRepository:
    """Repository for AI failure and duration predictions with versioning support."""

    def save_prediction(
        self, db: Session, prediction: Prediction, *, set_as_current: bool = True
    ) -> Prediction:
        """Persist a prediction, demoting prior current predictions if set_as_current is True."""
        if set_as_current:
            # Demote any prior current prediction for this request to historical
            db.execute(
                update(Prediction)
                .where(
                    Prediction.maintenance_request_id == prediction.maintenance_request_id,
                    Prediction.is_current == True,
                )
                .values(is_current=False)
            )
            prediction.is_current = True

        db.add(prediction)
        db.commit()
        db.refresh(prediction)
        return prediction

    def get_current(self, db: Session, request_id: str) -> Prediction | None:
        statement = select(Prediction).where(
            Prediction.maintenance_request_id == request_id,
            Prediction.is_current == True,
        )
        return db.scalar(statement)

    def get_history(self, db: Session, request_id: str) -> list[Prediction]:
        statement = (
            select(Prediction)
            .where(Prediction.maintenance_request_id == request_id)
            .order_by(Prediction.prediction_timestamp.desc(), Prediction.created_at.desc())
        )
        return list(db.scalars(statement))

    def list_current_for_requests(self, db: Session, request_ids: list[str]) -> list[Prediction]:
        if not request_ids:
            return []
        statement = select(Prediction).where(
            Prediction.maintenance_request_id.in_(request_ids),
            Prediction.is_current == True,
        )
        return list(db.scalars(statement))
