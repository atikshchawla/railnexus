from datetime import datetime
from uuid import uuid4
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database.connection import Base

if TYPE_CHECKING:
    from backend.database.models.topology import Section
    from backend.database.models.prediction import Prediction
    from backend.database.models.optimization import ProposalItem


class Defect(Base):
    __tablename__ = "defects"
    __table_args__ = (
        UniqueConstraint("source_system", "external_source_id", name="uq_defect_source"),
    )

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    source_system: Mapped[str] = mapped_column(String(30), nullable=False)
    external_source_id: Mapped[str] = mapped_column(String(100), nullable=False)
    section_id: Mapped[str] = mapped_column(String(50), ForeignKey("sections.id"), nullable=False, index=True)
    department: Mapped[str] = mapped_column(String(20), nullable=False)
    category: Mapped[str] = mapped_column(String(20), nullable=False)
    location_km: Mapped[float] = mapped_column(Float, nullable=False)
    track_line: Mapped[str] = mapped_column(String(10), default="UP", nullable=False)
    speed_restriction_kmh: Mapped[int | None] = mapped_column(Integer, nullable=True)
    safety_deadline: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="OPEN", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    section: Mapped["Section"] = relationship("Section", back_populates="defects")
    maintenance_requests: Mapped[list["MaintenanceRequest"]] = relationship(
        "MaintenanceRequest",
        secondary="request_defects",
        back_populates="defects",
        overlaps="defect_associations,request_associations",
    )
    request_associations: Mapped[list["RequestDefect"]] = relationship(
        "RequestDefect",
        back_populates="defect",
        overlaps="maintenance_requests,defects",
    )


class RequestDefect(Base):
    __tablename__ = "request_defects"

    maintenance_request_id: Mapped[str] = mapped_column(
        String(80), ForeignKey("maintenance_requests.id", ondelete="CASCADE"), primary_key=True
    )
    defect_id: Mapped[str] = mapped_column(
        String(50), ForeignKey("defects.id", ondelete="RESTRICT"), primary_key=True
    )

    maintenance_request: Mapped["MaintenanceRequest"] = relationship(
        "MaintenanceRequest", back_populates="defect_associations", overlaps="defects,maintenance_requests"
    )
    defect: Mapped["Defect"] = relationship(
        "Defect", back_populates="request_associations", overlaps="defects,maintenance_requests"
    )


class MaintenanceRequest(Base):
    __tablename__ = "maintenance_requests"

    id: Mapped[str] = mapped_column(String(80), primary_key=True, default=lambda: str(uuid4()))
    section_id: Mapped[str] = mapped_column(String(50), ForeignKey("sections.id"), index=True, nullable=False)
    department: Mapped[str] = mapped_column(String(40), nullable=False)
    work_type: Mapped[str] = mapped_column(String(100), nullable=False)
    location_km: Mapped[float] = mapped_column(Float, nullable=False)
    track_line: Mapped[str] = mapped_column(String(10), default="UP", nullable=False)
    demanded_duration_minutes: Mapped[int] = mapped_column(Integer, default=60, nullable=False)
    safety_critical: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    requires_power_isolation: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    requires_disconnection: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    equipment_ids: Mapped[list] = mapped_column(JSON, default=list)
    deadline_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    priority: Mapped[str] = mapped_column(String(20), default="MEDIUM", nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="pending", index=True, nullable=False)
    request_data: Mapped[dict] = mapped_column(JSON, default=dict)
    asset_id: Mapped[str | None] = mapped_column(String(36), index=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    section: Mapped["Section"] = relationship("Section", back_populates="maintenance_requests")
    defects: Mapped[list["Defect"]] = relationship(
        "Defect",
        secondary="request_defects",
        back_populates="maintenance_requests",
        overlaps="defect_associations,request_associations",
    )
    defect_associations: Mapped[list["RequestDefect"]] = relationship(
        "RequestDefect",
        back_populates="maintenance_request",
        cascade="all, delete-orphan",
        overlaps="defects,maintenance_requests",
    )
    predictions: Mapped[list["Prediction"]] = relationship(
        "Prediction", back_populates="maintenance_request", cascade="all, delete-orphan"
    )
    proposal_items: Mapped[list["ProposalItem"]] = relationship(
        "ProposalItem", back_populates="maintenance_request"
    )


class MaintenanceHistory(Base):
    """Legacy model preserved for backward compatibility."""
    __tablename__ = "maintenance_history"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    maintenance_request_id: Mapped[str] = mapped_column(String(80), index=True)
    asset_id: Mapped[str | None] = mapped_column(String(36), index=True, nullable=True)
    action: Mapped[str] = mapped_column(String(50))
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
