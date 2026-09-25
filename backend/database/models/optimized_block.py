from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, Float, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.database.connection import Base


class OptimizedBlock(Base):
    __tablename__ = "optimized_blocks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    # Hash of sorted request IDs — used as cache key
    request_ids_hash: Mapped[str] = mapped_column(String(64), index=True, default="")
    request_ids: Mapped[list] = mapped_column(JSON, default=list)
    section_id: Mapped[str] = mapped_column(String(80), index=True)
    predicted_duration_minutes: Mapped[float] = mapped_column(Float)
    priority_score: Mapped[float] = mapped_column(Float, default=0.0)
    urgency_level: Mapped[str] = mapped_column(String(20), default="medium")
    schedule_data: Mapped[dict] = mapped_column(JSON, default=dict)
    # Full optimizer result payload for frontend caching
    result_json: Mapped[dict] = mapped_column(JSON, default=dict)
    # Operator overrides: {group_id: {start_minute, end_minute, dissolved, notes}}
    operator_overrides: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
