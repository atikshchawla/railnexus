from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Float, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.database.connection import Base


class MaintenanceRequest(Base):
    __tablename__ = "maintenance_requests"

    id: Mapped[str] = mapped_column(String(80), primary_key=True, default=lambda: str(uuid4()))
    asset_id: Mapped[str | None] = mapped_column(String(36), index=True, nullable=True)
    section_id: Mapped[str] = mapped_column(String(80), index=True)
    department: Mapped[str] = mapped_column(String(40))
    work_type: Mapped[str] = mapped_column(String(80))
    location_km: Mapped[float] = mapped_column(Float)
    priority: Mapped[str] = mapped_column(String(20), default="MEDIUM")
    safety_critical: Mapped[bool] = mapped_column(Boolean, default=False)
    deadline_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    request_data: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(30), default="pending", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class MaintenanceHistory(Base):
    __tablename__ = "maintenance_history"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    maintenance_request_id: Mapped[str] = mapped_column(String(80), index=True)
    asset_id: Mapped[str | None] = mapped_column(String(36), index=True, nullable=True)
    action: Mapped[str] = mapped_column(String(50))
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
