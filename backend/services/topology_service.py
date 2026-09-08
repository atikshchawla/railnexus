import csv
from pathlib import Path

from sqlalchemy.orm import Session

from backend.database.models.topology import NetworkTopology
from backend.repositories.topology_repository import TopologyRepository


EXPECTED_COLUMNS = {
    "division", "section_id", "start_station", "end_station", "start_km", "end_km",
    "distance_km", "mps_kmh", "asset_id", "asset_type", "department", "km_marker",
}


class TopologyService:
    def __init__(self, repository: TopologyRepository | None = None):
        self.repository = repository or TopologyRepository()

    def validate_section(self, db: Session, section_id: str) -> None:
        if not self.repository.section_exists(db, section_id):
            raise ValueError(f"unknown section_id: {section_id}")

    def import_csv(self, db: Session, csv_path: Path) -> int:
        with csv_path.open(newline="", encoding="utf-8") as source:
            reader = csv.DictReader(source)
            columns = set(reader.fieldnames or [])
            missing = EXPECTED_COLUMNS - columns
            if missing:
                raise ValueError(f"topology CSV is missing columns: {sorted(missing)}")
            rows = [NetworkTopology(
                division=item["division"], section_id=item["section_id"],
                start_station=item["start_station"], end_station=item["end_station"],
                start_km=float(item["start_km"]), end_km=float(item["end_km"]),
                distance_km=float(item["distance_km"]), mps_kmh=float(item["mps_kmh"]),
                asset_id=item["asset_id"], asset_type=item["asset_type"],
                department=item["department"], km_marker=float(item["km_marker"]),
            ) for item in reader]
        return self.repository.replace_all(db, rows)
