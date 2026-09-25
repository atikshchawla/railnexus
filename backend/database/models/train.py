from datetime import date, datetime
from uuid import uuid4
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database.connection import Base

if TYPE_CHECKING:
    from backend.database.models.topology import Section
    from backend.database.models.conflict import Conflict


class Train(Base):
    __tablename__ = "trains"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    train_number: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    service_type: Mapped[str] = mapped_column(String(30), default="passenger", nullable=False)
    priority_tier: Mapped[str] = mapped_column(String(20), default="EXPRESS", nullable=False)
    origin: Mapped[str | None] = mapped_column(String(80), nullable=True)
    destination: Mapped[str | None] = mapped_column(String(80), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    movements: Mapped[list["TrainMovement"]] = relationship(
        "TrainMovement", back_populates="train", cascade="all, delete-orphan"
    )


class TrainMovement(Base):
    __tablename__ = "train_movements"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    train_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("trains.id", ondelete="CASCADE"), index=True, nullable=False
    )
    section_id: Mapped[str] = mapped_column(String(50), ForeignKey("sections.id"), index=True, nullable=False)
    movement_type: Mapped[str] = mapped_column(String(30), default="SCHEDULED", nullable=False)
    traffic_source: Mapped[str] = mapped_column(String(30), default="COA_TIMETABLE", nullable=False)
    movement_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    scheduled_minute: Mapped[int] = mapped_column(Integer, nullable=False)
    actual_minute: Mapped[int | None] = mapped_column(Integer, nullable=True)
    delay_minutes: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    forecast_window_start: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    forecast_window_end: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    expected_tonnage_mgt: Mapped[float | None] = mapped_column(Float, nullable=True)
    confidence_weight: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    commodity_or_rake_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    train: Mapped["Train"] = relationship("Train", back_populates="movements")
    section: Mapped["Section"] = relationship("Section", back_populates="train_movements")
    conflicts: Mapped[list["Conflict"]] = relationship("Conflict", back_populates="train_movement")


class LegacyTmsMovement(Base):
    """Legacy model for backward compatibility with pre-Phase-5 TMS movements table."""
    __tablename__ = "tms_movements"
    __table_args__ = (
        Index("ix_tms_movements_train_id", "train_id"),
        Index("ix_tms_movements_section_id", "section_id"),
        Index("ix_tms_movements_movement_date", "movement_date"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    train_id: Mapped[str] = mapped_column(String(36), nullable=False)
    section_id: Mapped[str] = mapped_column(String(80), nullable=False)
    movement_date: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    scheduled_minute: Mapped[int] = mapped_column(Integer, nullable=False)
    actual_minute: Mapped[int | None] = mapped_column(Integer, nullable=True)
    delay_minutes: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)


# Backward compatibility alias
TmsMovement = TrainMovement
