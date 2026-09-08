from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.database.models.maintenance import MaintenanceRequest


class MaintenanceRepository:
    def list(self, db: Session, *, status: str | None = None) -> list[MaintenanceRequest]:
        statement = select(MaintenanceRequest).order_by(MaintenanceRequest.created_at.desc())
        if status:
            statement = statement.where(MaintenanceRequest.status == status)
        return list(db.scalars(statement))

    def get(self, db: Session, request_id: str) -> MaintenanceRequest | None:
        return db.get(MaintenanceRequest, request_id)

    def create(self, db: Session, request: MaintenanceRequest) -> MaintenanceRequest:
        db.add(request)
        db.commit()
        db.refresh(request)
        return request

    def update_status(self, db: Session, request: MaintenanceRequest, status: str) -> MaintenanceRequest:
        request.status = status
        db.commit()
        db.refresh(request)
        return request
