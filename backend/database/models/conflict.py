from datetime import datetime
from uuid import uuid4
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database.connection import Base

if TYPE_CHECKING:
    from backend.database.models.optimization import BlockProposal
    from backend.database.models.train import TrainMovement
    from backend.database.models.operational_block import OperationalBlock


class Conflict(Base):
    __tablename__ = "conflicts"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    conflict_type: Mapped[str] = mapped_column(String(50), nullable=False)
    severity: Mapped[str] = mapped_column(String(20), nullable=False)
    proposal_a_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("block_proposals.id", ondelete="CASCADE"), index=True, nullable=False
    )
    proposal_b_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("block_proposals.id", ondelete="CASCADE"), index=True, nullable=True
    )
    train_movement_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("train_movements.id", ondelete="CASCADE"), index=True, nullable=True
    )
    resulting_block_id: Mapped[str | None] = mapped_column(
        String(50), ForeignKey("operational_blocks.id", ondelete="SET NULL"), index=True, nullable=True
    )
    track_line: Mapped[str] = mapped_column(String(10), default="UP", nullable=False)
    overlap_description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    spatial_km_start: Mapped[float] = mapped_column(Float, nullable=False)
    spatial_km_end: Mapped[float] = mapped_column(Float, nullable=False)
    temporal_start: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    temporal_end: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="UNRESOLVED", nullable=False)
    is_blocking: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    proposal_a: Mapped["BlockProposal"] = relationship(
        "BlockProposal", foreign_keys=[proposal_a_id], back_populates="conflicts_as_a"
    )
    proposal_b: Mapped["BlockProposal | None"] = relationship(
        "BlockProposal", foreign_keys=[proposal_b_id], back_populates="conflicts_as_b"
    )
    train_movement: Mapped["TrainMovement | None"] = relationship(
        "TrainMovement", foreign_keys=[train_movement_id], back_populates="conflicts"
    )
    resulting_block: Mapped["OperationalBlock | None"] = relationship(
        "OperationalBlock", foreign_keys=[resulting_block_id], back_populates="conflicts"
    )
    resolution_events: Mapped[list["ConflictResolutionEvent"]] = relationship(
        "ConflictResolutionEvent", back_populates="conflict", cascade="all, delete-orphan"
    )


class ConflictResolutionEvent(Base):
    __tablename__ = "conflict_resolution_events"
    __table_args__ = (
        Index(
            "uq_conflict_current_resolution",
            "conflict_id",
            unique=True,
            sqlite_where=text("is_current_resolution = 1"),
            postgresql_where=text("is_current_resolution = true"),
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    conflict_id: Mapped[str] = mapped_column(
        String(50), ForeignKey("conflicts.id", ondelete="CASCADE"), index=True, nullable=False
    )
    event_sequence: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    resolution_action: Mapped[str] = mapped_column(String(30), nullable=False)
    actor_id: Mapped[str] = mapped_column(String(50), nullable=False)
    actor_role: Mapped[str] = mapped_column(String(50), nullable=False)
    resulting_block_id: Mapped[str | None] = mapped_column(
        String(50), ForeignKey("operational_blocks.id", ondelete="SET NULL"), index=True, nullable=True
    )
    rationale_notes: Mapped[str] = mapped_column(Text, nullable=False)
    is_current_resolution: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    conflict: Mapped["Conflict"] = relationship("Conflict", back_populates="resolution_events")
    resulting_block: Mapped["OperationalBlock | None"] = relationship(
        "OperationalBlock", foreign_keys=[resulting_block_id]
    )
