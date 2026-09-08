from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, Float, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.database.connection import Base


class OptimizedBlock(Base):
    __tablename__ = "optimized_blocks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    request_ids: Mapped[list] = mapped_column(JSON, default=list)
    section_id: Mapped[str] = mapped_column(String(80), index=True)
    predicted_duration_minutes: Mapped[float] = mapped_column(Float)
    priority_score: Mapped[float] = mapped_column(Float, default=0.0)
    urgency_level: Mapped[str] = mapped_column(String(20), default="medium")
    schedule_data: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
