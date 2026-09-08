from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Float, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.database.connection import Base


class ConflictRecord(Base):
    __tablename__ = "conflicts"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    blockAId: Mapped[str] = mapped_column(String(80), index=True)
    blockBId: Mapped[str | None] = mapped_column(String(80), index=True, nullable=True) # None if conflict is with a train
    overlapDescription: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(30), default="Unresolved", index=True)
    windowStart: Mapped[str] = mapped_column(String(40)) # ISO string for sorting
    
    # Store resolution as JSON object { action, actor, timestamp }
    resolution: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
