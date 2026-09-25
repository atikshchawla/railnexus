from datetime import datetime
from uuid import uuid4
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, Float, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database.connection import Base

if TYPE_CHECKING:
    from backend.database.models.maintenance import Defect, MaintenanceRequest
    from backend.database.models.train import TrainMovement
    from backend.database.models.optimization import BlockProposal
    from backend.database.models.operational_block import OperationalBlock


class Station(Base):
    __tablename__ = "stations"

    code: Mapped[str] = mapped_column(String(10), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    division: Mapped[str] = mapped_column(String(50), default="MAS", nullable=False)
    zone: Mapped[str] = mapped_column(String(10), default="SR", nullable=False)
    km_location: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    start_sections: Mapped[list["Section"]] = relationship(
        "Section", foreign_keys="[Section.start_station_code]", back_populates="start_station"
    )
    end_sections: Mapped[list["Section"]] = relationship(
        "Section", foreign_keys="[Section.end_station_code]", back_populates="end_station"
    )


class Section(Base):
    __tablename__ = "sections"
    __table_args__ = (
        CheckConstraint("end_km >= start_km", name="chk_section_km"),
    )

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    division: Mapped[str] = mapped_column(String(50), default="MAS", nullable=False)
    start_station_code: Mapped[str] = mapped_column(String(10), ForeignKey("stations.code"), nullable=False)
    end_station_code: Mapped[str] = mapped_column(String(10), ForeignKey("stations.code"), nullable=False)
    start_km: Mapped[float] = mapped_column(Float, nullable=False)
    end_km: Mapped[float] = mapped_column(Float, nullable=False)
    distance_km: Mapped[float] = mapped_column(Float, nullable=False)
    track_count: Mapped[int] = mapped_column(Integer, default=2, nullable=False)
    mps_kmh: Mapped[float] = mapped_column(Float, default=130.0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    start_station: Mapped["Station"] = relationship(
        "Station", foreign_keys=[start_station_code], back_populates="start_sections"
    )
    end_station: Mapped["Station"] = relationship(
        "Station", foreign_keys=[end_station_code], back_populates="end_sections"
    )
    defects: Mapped[list["Defect"]] = relationship("Defect", back_populates="section")
    maintenance_requests: Mapped[list["MaintenanceRequest"]] = relationship(
        "MaintenanceRequest", back_populates="section"
    )
    train_movements: Mapped[list["TrainMovement"]] = relationship("TrainMovement", back_populates="section")
    block_proposals: Mapped[list["BlockProposal"]] = relationship("BlockProposal", back_populates="section")
    operational_blocks: Mapped[list["OperationalBlock"]] = relationship("OperationalBlock", back_populates="section")


class NetworkTopology(Base):
    """Legacy model for backward compatibility with import scripts."""
    __tablename__ = "network_topology"
    __table_args__ = (
        Index("ix_network_topology_section_id", "section_id"),
        Index("ix_network_topology_asset_id", "asset_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    division: Mapped[str] = mapped_column(String(80), nullable=False)
    section_id: Mapped[str] = mapped_column(String(80), nullable=False)
    start_station: Mapped[str] = mapped_column(String(80), nullable=False)
    end_station: Mapped[str] = mapped_column(String(80), nullable=False)
    start_km: Mapped[float] = mapped_column(Float, nullable=False)
    end_km: Mapped[float] = mapped_column(Float, nullable=False)
    distance_km: Mapped[float] = mapped_column(Float, nullable=False)
    mps_kmh: Mapped[float] = mapped_column(Float, nullable=False)
    asset_id: Mapped[str] = mapped_column(String(120), nullable=False)
    asset_type: Mapped[str] = mapped_column(String(80), nullable=False)
    department: Mapped[str] = mapped_column(String(40), nullable=False)
    km_marker: Mapped[float] = mapped_column(Float, nullable=False)
