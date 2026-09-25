from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from backend.database.models.maintenance import Defect, RequestDefect


class DefectRepository:
    def get(self, db: Session, defect_id: str) -> Defect | None:
        return db.get(Defect, defect_id)

    def get_by_source(self, db: Session, source_system: str, external_source_id: str) -> Defect | None:
        statement = select(Defect).where(
            Defect.source_system == source_system,
            Defect.external_source_id == external_source_id,
        )
        return db.scalar(statement)

    def list(
        self,
        db: Session,
        *,
        section_id: str | None = None,
        department: str | None = None,
        status: str | None = None,
        category: str | None = None,
    ) -> list[Defect]:
        statement = select(Defect).order_by(Defect.created_at.desc())
        if section_id:
            statement = statement.where(Defect.section_id == section_id)
        if department:
            statement = statement.where(Defect.department == department)
        if status:
            statement = statement.where(Defect.status == status)
        if category:
            statement = statement.where(Defect.category == category)
        return list(db.scalars(statement))

    def create(self, db: Session, defect: Defect) -> Defect:
        db.add(defect)
        db.commit()
        db.refresh(defect)
        return defect

    def update_status(self, db: Session, defect: Defect, status: str) -> Defect:
        defect.status = status
        db.commit()
        db.refresh(defect)
        return defect

    def get_with_requests(self, db: Session, defect_id: str) -> Defect | None:
        stmt = select(Defect).where(Defect.id == defect_id).options(selectinload(Defect.maintenance_requests))
        return db.scalar(stmt)
