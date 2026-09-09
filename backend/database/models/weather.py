from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, Float, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.database.connection import Base


class WeatherObservation(Base):
    __tablename__ = "weather"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    section_id: Mapped[str] = mapped_column(String(80), index=True)
    observed_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    temperature_mean_c: Mapped[float] = mapped_column(Float)
    rainfall_mm: Mapped[float] = mapped_column(Float, default=0.0)
    max_wind_speed_kmh: Mapped[float] = mapped_column(Float, default=0.0)
    weather_risk: Mapped[float] = mapped_column(Float, default=0.0)
