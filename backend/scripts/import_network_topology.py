import argparse
from pathlib import Path

from backend.database.connection import SessionLocal, create_tables
from backend.services.topology_service import TopologyService
from backend.utils.config import get_settings


CSV_PATH = Path(__file__).resolve().parents[2] / "ai_ml" / "data" / "raw" / "network_topology.csv"


def main() -> None:
    parser = argparse.ArgumentParser(description="Import network_topology.csv into RailNexus.")
    parser.add_argument(
        "--allow-sqlite",
        action="store_true",
        help="Allow importing into SQLite for local testing; PostgreSQL is required by default.",
    )
    args = parser.parse_args()
    database_scheme = get_settings().database_url.split("://", 1)[0]
    if not database_scheme.startswith("postgresql") and not args.allow_sqlite:
        raise RuntimeError(
            f"Refusing topology import into {database_scheme}. Configure PostgreSQL in .env "
            "or pass --allow-sqlite for an explicit local test."
        )
    if not CSV_PATH.exists():
        raise FileNotFoundError(f"Topology CSV not found: {CSV_PATH}")
    create_tables()
    db = SessionLocal()
    try:
        service = TopologyService()
        imported = service.import_csv(db, CSV_PATH)
        stored = service.repository.count(db)
        print(f"Imported {imported} network topology records from {CSV_PATH}")
        print(f"Verified {stored} records in {database_scheme}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
