from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Float, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.database.connection import Base


class BlockRecord(Base):
    __tablename__ = "blocks"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    department: Mapped[str] = mapped_column(String(40))
    category: Mapped[str] = mapped_column(String(40))
    description: Mapped[str] = mapped_column(Text)
    
    # Store complex nested fields as JSON for easy serialization to frontend
    location: Mapped[dict] = mapped_column(JSON, default=dict)
    scheduledWindow: Mapped[dict] = mapped_column(JSON, default=dict)
    urgency: Mapped[dict] = mapped_column(JSON, default=dict)
    
    status: Mapped[str] = mapped_column(String(30), default="Draft", index=True)
    
    source: Mapped[dict] = mapped_column(JSON, default=dict)
    conflict: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    aiSuggestion: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    evidence: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    auditTrail: Mapped[list] = mapped_column(JSON, default=list)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
