from datetime import date, datetime
from uuid import uuid4
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database.connection import Base

if TYPE_CHECKING:
    from backend.database.models.topology import Section
    from backend.database.models.maintenance import MaintenanceRequest
    from backend.database.models.conflict import Conflict
    from backend.database.models.operational_block import ManualOverride, OperationalBlock


class OptimizationRun(Base):
    __tablename__ = "optimization_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    planning_horizon: Mapped[str] = mapped_column(String(20), default="WEEKLY", nullable=False)
    planning_cycle_label: Mapped[str] = mapped_column(String(50), default="2026-W39", nullable=False)
    effective_date_start: Mapped[date] = mapped_column(Date, nullable=False)
    effective_date_end: Mapped[date] = mapped_column(Date, nullable=False)
    corridor_id: Mapped[str] = mapped_column(String(50), default="AJJ-JTJ", nullable=False)
    input_requests_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    input_snapshot_json: Mapped[dict] = mapped_column(JSON, default=dict)
    algorithm_version: Mapped[str] = mapped_column(String(50), default="cp_sat_v2.1", nullable=False)
    weights_json: Mapped[dict] = mapped_column(JSON, default=dict)
    solver_status: Mapped[str] = mapped_column(String(30), nullable=False)
    solver_duration_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_possession_saving_minutes: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_train_impact_minutes: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    proposals: Mapped[list["BlockProposal"]] = relationship(
        "BlockProposal", back_populates="run", cascade="all, delete-orphan"
    )


class BlockProposal(Base):
    __tablename__ = "block_proposals"
    __table_args__ = (
        CheckConstraint("proposed_end_time > proposed_start_time", name="chk_proposal_window"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    run_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("optimization_runs.id", ondelete="CASCADE"), index=True, nullable=False
    )
    section_id: Mapped[str] = mapped_column(String(50), ForeignKey("sections.id"), index=True, nullable=False)
    proposed_start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    proposed_end_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    predicted_duration_minutes: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    possession_saving_minutes: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    train_impact_minutes: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    trains_affected_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    confidence_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    top_factors_json: Mapped[dict] = mapped_column(JSON, default=dict)
    safety_cautions: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(30), default="PROPOSED", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    run: Mapped["OptimizationRun"] = relationship("OptimizationRun", back_populates="proposals")
    section: Mapped["Section"] = relationship("Section", back_populates="block_proposals")
    items: Mapped[list["ProposalItem"]] = relationship(
        "ProposalItem", back_populates="proposal", cascade="all, delete-orphan"
    )
    departments: Mapped[list["ProposalDepartment"]] = relationship(
        "ProposalDepartment", back_populates="proposal", cascade="all, delete-orphan"
    )
    conflicts_as_a: Mapped[list["Conflict"]] = relationship(
        "Conflict", foreign_keys="[Conflict.proposal_a_id]", back_populates="proposal_a", cascade="all, delete-orphan"
    )
    conflicts_as_b: Mapped[list["Conflict"]] = relationship(
        "Conflict", foreign_keys="[Conflict.proposal_b_id]", back_populates="proposal_b", cascade="all, delete-orphan"
    )
    manual_overrides: Mapped[list["ManualOverride"]] = relationship(
        "ManualOverride", back_populates="proposal"
    )
    operational_blocks: Mapped[list["OperationalBlock"]] = relationship(
        "OperationalBlock", foreign_keys="[OperationalBlock.origin_proposal_id]", back_populates="origin_proposal"
    )


class ProposalItem(Base):
    __tablename__ = "proposal_items"

    proposal_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("block_proposals.id", ondelete="CASCADE"), primary_key=True
    )
    maintenance_request_id: Mapped[str] = mapped_column(
        String(80), ForeignKey("maintenance_requests.id", ondelete="RESTRICT"), primary_key=True
    )
    sequence_order: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    proposal: Mapped["BlockProposal"] = relationship("BlockProposal", back_populates="items")
    maintenance_request: Mapped["MaintenanceRequest"] = relationship("MaintenanceRequest", back_populates="proposal_items")


class ProposalDepartment(Base):
    __tablename__ = "proposal_departments"

    proposal_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("block_proposals.id", ondelete="CASCADE"), primary_key=True
    )
    department: Mapped[str] = mapped_column(String(20), primary_key=True)
    work_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    demanded_duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    requires_power_isolation: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    requires_disconnection: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    proposal: Mapped["BlockProposal"] = relationship("BlockProposal", back_populates="departments")
