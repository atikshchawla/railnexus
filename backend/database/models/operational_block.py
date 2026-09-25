from datetime import datetime
from uuid import uuid4
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, CheckConstraint, DateTime, Float, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database.connection import Base

if TYPE_CHECKING:
    from backend.database.models.topology import Section
    from backend.database.models.optimization import BlockProposal
    from backend.database.models.conflict import Conflict


class ManualOverride(Base):
    __tablename__ = "manual_overrides"
    __table_args__ = (
        CheckConstraint("length(trim(justification_notes)) > 0", name="chk_override_justification"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    proposal_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("block_proposals.id", ondelete="RESTRICT"), index=True, nullable=False
    )
    operator_id: Mapped[str] = mapped_column(String(50), nullable=False)
    operator_role: Mapped[str] = mapped_column(String(50), nullable=False)
    field_modified: Mapped[str] = mapped_column(String(50), nullable=False)
    original_start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    original_end_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    adjusted_start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    adjusted_end_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    dissolved_group: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    justification_code: Mapped[str] = mapped_column(String(50), nullable=False)
    justification_notes: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    proposal: Mapped["BlockProposal"] = relationship("BlockProposal", back_populates="manual_overrides")
    operational_blocks: Mapped[list["OperationalBlock"]] = relationship("OperationalBlock", back_populates="override")


class OperationalBlock(Base):
    __tablename__ = "operational_blocks"
    __table_args__ = (
        CheckConstraint("scheduled_end > scheduled_start", name="chk_block_window"),
        Index(
            "uq_proposal_root_operational_block",
            "origin_proposal_id",
            unique=True,
            sqlite_where=text("revision_number = 1"),
            postgresql_where=text("revision_number = 1"),
        ),
    )

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    section_id: Mapped[str] = mapped_column(String(50), ForeignKey("sections.id"), index=True, nullable=False)
    track_line: Mapped[str] = mapped_column(String(10), default="UP", nullable=False)
    start_km: Mapped[float] = mapped_column(Float, nullable=False)
    end_km: Mapped[float] = mapped_column(Float, nullable=False)
    scheduled_start: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    scheduled_end: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    actual_start: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    actual_end: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    origin_proposal_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("block_proposals.id", ondelete="SET NULL"), index=True, nullable=True
    )
    override_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("manual_overrides.id", ondelete="SET NULL"), index=True, nullable=True
    )
    lead_department: Mapped[str] = mapped_column(String(20), nullable=False)
    power_isolation_granted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    snt_disconnection_granted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    private_number_authority: Mapped[str | None] = mapped_column(String(50), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="PROPOSED", nullable=False)
    approved_by: Mapped[str | None] = mapped_column(String(50), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    revision_number: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    parent_block_id: Mapped[str | None] = mapped_column(
        String(50), ForeignKey("operational_blocks.id"), index=True, nullable=True
    )
    is_current: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    section: Mapped["Section"] = relationship("Section", back_populates="operational_blocks")
    origin_proposal: Mapped["BlockProposal | None"] = relationship(
        "BlockProposal", foreign_keys=[origin_proposal_id], back_populates="operational_blocks"
    )
    override: Mapped["ManualOverride | None"] = relationship(
        "ManualOverride", foreign_keys=[override_id], back_populates="operational_blocks"
    )
    parent_block: Mapped["OperationalBlock | None"] = relationship(
        "OperationalBlock", remote_side=[id], back_populates="child_revisions"
    )
    child_revisions: Mapped[list["OperationalBlock"]] = relationship(
        "OperationalBlock", back_populates="parent_block"
    )
    departments: Mapped[list["BlockDepartment"]] = relationship(
        "BlockDepartment", back_populates="block", cascade="all, delete-orphan"
    )
    conflicts: Mapped[list["Conflict"]] = relationship(
        "Conflict", foreign_keys="[Conflict.resulting_block_id]", back_populates="resulting_block"
    )


class BlockDepartment(Base):
    __tablename__ = "block_departments"

    block_id: Mapped[str] = mapped_column(
        String(50), ForeignKey("operational_blocks.id", ondelete="CASCADE"), primary_key=True
    )
    department: Mapped[str] = mapped_column(String(20), primary_key=True)
    sse_in_charge: Mapped[str | None] = mapped_column(String(50), nullable=True)
    permit_status: Mapped[str] = mapped_column(String(30), default="PENDING", nullable=False)
    permit_issued_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    cleared_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    clearance_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    block: Mapped["OperationalBlock"] = relationship("OperationalBlock", back_populates="departments")
