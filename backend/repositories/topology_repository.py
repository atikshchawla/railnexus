from sqlalchemy import delete, exists, select
from sqlalchemy.orm import Session

from backend.database.models.topology import NetworkTopology, Section, Station


class TopologyRepository:
    """Repository for Stations, Sections, and legacy NetworkTopology records."""

    # Station methods
    def get_station(self, db: Session, code: str) -> Station | None:
        return db.get(Station, code)

    def list_stations(self, db: Session) -> list[Station]:
        return list(db.scalars(select(Station).order_by(Station.km_location)))

    def create_station(self, db: Session, station: Station) -> Station:
        db.add(station)
        db.commit()
        db.refresh(station)
        return station

    # Section methods
    def get_section(self, db: Session, section_id: str) -> Section | None:
        return db.get(Section, section_id)

    def list_sections(self, db: Session) -> list[Section]:
        return list(db.scalars(select(Section).order_by(Section.start_km)))

    def create_section(self, db: Session, section: Section) -> Section:
        db.add(section)
        db.commit()
        db.refresh(section)
        return section

    def section_exists(self, db: Session, section_id: str) -> bool:
        # Check both Section and legacy NetworkTopology for full compatibility
        stmt_section = select(exists().where(Section.id == section_id))
        if db.scalar(stmt_section):
            return True
        stmt_legacy = select(exists().where(NetworkTopology.section_id == section_id))
        return bool(db.scalar(stmt_legacy))

    def sections_exist(self, db: Session, section_ids: list[str]) -> bool:
        requested = set(section_ids)
        if not requested:
            return True
        found_sections = set(db.scalars(select(Section.id).where(Section.id.in_(requested))))
        if found_sections == requested:
            return True
        found_legacy = set(db.scalars(select(NetworkTopology.section_id).where(NetworkTopology.section_id.in_(requested))))
        return (found_sections | found_legacy) == requested

    # Legacy NetworkTopology methods
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
