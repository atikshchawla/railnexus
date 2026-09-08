from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.database.connection import Base


class Train(Base):
    __tablename__ = "trains"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    train_number: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    service_type: Mapped[str] = mapped_column(String(30), default="passenger")
    origin: Mapped[str | None] = mapped_column(String(80), nullable=True)
    destination: Mapped[str | None] = mapped_column(String(80), nullable=True)
    active: Mapped[bool] = mapped_column(Integer, default=1)


class TmsMovement(Base):
    __tablename__ = "tms_movements"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    train_id: Mapped[str] = mapped_column(String(36), index=True)
    section_id: Mapped[str] = mapped_column(String(80), index=True)
    movement_date: Mapped[datetime] = mapped_column(DateTime, index=True)
    scheduled_minute: Mapped[int] = mapped_column(Integer)
    actual_minute: Mapped[int | None] = mapped_column(Integer, nullable=True)
    delay_minutes: Mapped[float] = mapped_column(Float, default=0.0)
