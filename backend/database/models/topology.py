from uuid import uuid4

from sqlalchemy import Float, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.database.connection import Base


class NetworkTopology(Base):
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
