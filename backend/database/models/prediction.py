from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, Float, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.database.connection import Base


class Prediction(Base):
    __tablename__ = "predictions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    maintenance_request_id: Mapped[str] = mapped_column(String(80), index=True)
    failure_risk_probability: Mapped[float] = mapped_column(Float)
    priority_score: Mapped[float] = mapped_column(Float)
    urgency_level: Mapped[str] = mapped_column(String(20))
    predicted_duration_minutes: Mapped[float] = mapped_column(Float)
    overrun_probability: Mapped[float] = mapped_column(Float)
    trains_affected: Mapped[float] = mapped_column(Float, default=0.0)
    total_delay_minutes: Mapped[float] = mapped_column(Float, default=0.0)
    raw_output: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
