from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from backend.database.models.maintenance import Defect, MaintenanceRequest, RequestDefect


class MaintenanceRepository:
    def list(
        self,
        db: Session,
        *,
        status: str | None = None,
        section_id: str | None = None,
        department: str | None = None,
    ) -> list[MaintenanceRequest]:
        statement = select(MaintenanceRequest).order_by(MaintenanceRequest.created_at.desc())
        if status:
            statement = statement.where(MaintenanceRequest.status == status)
        if section_id:
            statement = statement.where(MaintenanceRequest.section_id == section_id)
        if department:
            statement = statement.where(MaintenanceRequest.department == department)
        return list(db.scalars(statement))

    def get(self, db: Session, request_id: str) -> MaintenanceRequest | None:
        return db.get(MaintenanceRequest, request_id)

    def get_with_defects(self, db: Session, request_id: str) -> MaintenanceRequest | None:
        stmt = (
            select(MaintenanceRequest)
            .where(MaintenanceRequest.id == request_id)
            .options(selectinload(MaintenanceRequest.defects))
        )
        return db.scalar(stmt)

    def get_with_predictions(self, db: Session, request_id: str) -> MaintenanceRequest | None:
        stmt = (
            select(MaintenanceRequest)
            .where(MaintenanceRequest.id == request_id)
            .options(selectinload(MaintenanceRequest.predictions))
        )
        return db.scalar(stmt)

    def create(self, db: Session, request: MaintenanceRequest, auto_commit: bool = True) -> MaintenanceRequest:
        db.add(request)
        if auto_commit:
            db.commit()
            db.refresh(request)
        else:
            db.flush()
        return request

    def update_status(self, db: Session, request: MaintenanceRequest, status: str) -> MaintenanceRequest:
        request.status = status
        db.commit()
        db.refresh(request)
        return request

    def link_defect(self, db: Session, request_id: str, defect_id: str) -> RequestDefect:
        link = RequestDefect(maintenance_request_id=request_id, defect_id=defect_id)
        db.add(link)
        db.commit()
        db.refresh(link)
        return link
