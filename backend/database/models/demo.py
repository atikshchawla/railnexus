from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.database.connection import Base


class DemoIntegrationRequest(Base):
    __tablename__ = "demo_integration_requests"

    request_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    department: Mapped[str] = mapped_column(String(10), index=True)
    type: Mapped[str] = mapped_column(String(30), index=True)
    train_id: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    section_id: Mapped[str] = mapped_column(String(80), index=True)
    description: Mapped[str] = mapped_column(String(500))
    raised_at: Mapped[datetime] = mapped_column(DateTime)
    status: Mapped[str] = mapped_column(String(20), default="received", index=True)
    resulting_state: Mapped[str | None] = mapped_column(String(20), nullable=True)
    maintenance_request_id: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    @staticmethod
    def new_id() -> str:
        return str(uuid4())
