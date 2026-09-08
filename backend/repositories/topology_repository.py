from sqlalchemy import delete, exists, select
from sqlalchemy.orm import Session

from backend.database.models.topology import NetworkTopology


class TopologyRepository:
    def section_exists(self, db: Session, section_id: str) -> bool:
        statement = select(exists().where(NetworkTopology.section_id == section_id))
        return bool(db.scalar(statement))

    def sections_exist(self, db: Session, section_ids: list[str]) -> bool:
        requested = set(section_ids)
        if not requested:
            return True
        found = set(db.scalars(select(NetworkTopology.section_id).where(NetworkTopology.section_id.in_(requested))))
        return found == requested

    def list(self, db: Session, section_id: str | None = None) -> list[NetworkTopology]:
        statement = select(NetworkTopology).order_by(NetworkTopology.section_id, NetworkTopology.km_marker)
        if section_id:
            statement = statement.where(NetworkTopology.section_id == section_id)
        return list(db.scalars(statement))

    def replace_all(self, db: Session, rows: list[NetworkTopology]) -> int:
        db.execute(delete(NetworkTopology))
        db.add_all(rows)
        db.commit()
        return len(rows)

    def count(self, db: Session) -> int:
        return db.query(NetworkTopology).count()
