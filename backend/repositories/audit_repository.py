from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.database.models.audit import AuditLog


class AuditRepository:
    """Repository for auditable operational logs.

    Note: entity_name + entity_id is an intentionally polymorphic reference (Phase 4 Section 12).
    """

    def log(
        self,
        db: Session,
        *,
        entity_name: str,
        entity_id: str,
        action: str,
        actor_id: str,
        actor_role: str,
        payload_diff: dict,
    ) -> AuditLog:
        entry = AuditLog(
            entity_name=entity_name,
            entity_id=entity_id,
            action=action,
            actor_id=actor_id,
            actor_role=actor_role,
            payload_diff=payload_diff,
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)
        return entry

    def list_for_entity(
        self, db: Session, entity_name: str, entity_id: str
    ) -> list[AuditLog]:
        stmt = (
            select(AuditLog)
            .where(
                AuditLog.entity_name == entity_name,
                AuditLog.entity_id == entity_id,
            )
            .order_by(AuditLog.created_at.desc())
        )
        return list(db.scalars(stmt))

    def list_recent(self, db: Session, *, limit: int = 100) -> list[AuditLog]:
        stmt = select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)
        return list(db.scalars(stmt))
