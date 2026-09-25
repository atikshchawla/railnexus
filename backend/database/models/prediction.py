from datetime import datetime
from uuid import uuid4
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, JSON, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database.connection import Base

if TYPE_CHECKING:
    from backend.database.models.maintenance import MaintenanceRequest


class Prediction(Base):
    __tablename__ = "predictions"
    __table_args__ = (
        Index(
            "uq_current_request_prediction",
            "maintenance_request_id",
            unique=True,
            sqlite_where=text("is_current = 1"),
            postgresql_where=text("is_current = true"),
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    maintenance_request_id: Mapped[str] = mapped_column(
        String(80), ForeignKey("maintenance_requests.id", ondelete="CASCADE"), index=True, nullable=False
    )
    prediction_timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    model_version: Mapped[str] = mapped_column(String(50), default="xgboost_pipeline_v1.0", nullable=False)
    failure_risk_probability: Mapped[float] = mapped_column(Float, nullable=False)
    priority_score: Mapped[float] = mapped_column(Float, nullable=False)
    urgency_level: Mapped[str] = mapped_column(String(20), nullable=False)
    predicted_duration_minutes: Mapped[float] = mapped_column(Float, nullable=False)
    overrun_probability: Mapped[float] = mapped_column(Float, nullable=False)
    trains_affected: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_delay_minutes: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    raw_output: Mapped[dict] = mapped_column(JSON, default=dict)
    feature_snapshot_json: Mapped[dict] = mapped_column(JSON, default=dict)
    is_current: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    maintenance_request: Mapped["MaintenanceRequest"] = relationship("MaintenanceRequest", back_populates="predictions")
