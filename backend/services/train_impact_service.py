from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.database.models.train import TmsMovement


def recent_section_delay(db: Session, section_id: str) -> float:
    movements = db.scalars(
        select(TmsMovement).where(TmsMovement.section_id == section_id).order_by(TmsMovement.movement_date.desc()).limit(50)
    )
    values = [movement.delay_minutes for movement in movements]
    return round(sum(values) / len(values), 2) if values else 0.0
