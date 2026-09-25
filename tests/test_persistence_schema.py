"""Unit tests for Phase 5 persistence schema, constraints, and referential integrity."""

from datetime import datetime, timedelta
import unittest
from uuid import uuid4

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from backend.database.connection import Base
from backend.database.models import (
    BlockProposal,
    ManualOverride,
    OperationalBlock,
    OptimizationRun,
    Section,
    Station,
)


def get_test_engine():
    engine = create_engine("sqlite:///:memory:", echo=False)

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    return engine


class TestPersistenceSchema(unittest.TestCase):
    def setUp(self):
        self.engine = get_test_engine()
        Base.metadata.create_all(self.engine)
        self.SessionLocal = sessionmaker(bind=self.engine)
        self.db: Session = self.SessionLocal()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine)

    def test_tables_created(self):
        """All Phase 4 core tables are successfully created in the database."""
        table_names = self.engine.dialect.get_table_names(self.engine.connect())
        expected = [
            "stations",
            "sections",
            "defects",
            "maintenance_requests",
            "request_defects",
            "predictions",
            "optimization_runs",
            "block_proposals",
            "proposal_items",
            "proposal_departments",
            "trains",
            "train_movements",
            "conflicts",
            "conflict_resolution_events",
            "manual_overrides",
            "operational_blocks",
            "block_departments",
            "audit_logs",
        ]
        for tbl in expected:
            self.assertIn(tbl, table_names, f"Expected table '{tbl}' was not created")

    def test_section_km_check_constraint(self):
        """Section end_km must be >= start_km (chk_section_km)."""
        stn1 = Station(code="STN1", name="Station 1", division="MAS", zone="SR", km_location=0.0)
        stn2 = Station(code="STN2", name="Station 2", division="MAS", zone="SR", km_location=10.0)
        self.db.add_all([stn1, stn2])
        self.db.commit()

        # Invalid section: start_km (20.0) > end_km (10.0)
        invalid_sec = Section(
            id="SEC-INVALID",
            division="MAS",
            start_station_code="STN1",
            end_station_code="STN2",
            start_km=20.0,
            end_km=10.0,
            distance_km=10.0,
            track_count=2,
            mps_kmh=130.0,
        )
        self.db.add(invalid_sec)
        with self.assertRaises(IntegrityError):
            self.db.commit()
        self.db.rollback()

    def test_proposal_window_check_constraint(self):
        """BlockProposal proposed_end_time must be > proposed_start_time (chk_proposal_window)."""
        now = datetime.utcnow()
        run = OptimizationRun(
            id=str(uuid4()),
            effective_date_start=now.date(),
            effective_date_end=now.date(),
            corridor_id="AJJ-JTJ",
            input_requests_hash="hash123",
            solver_status="OPTIMAL",
        )
        stn1 = Station(code="S1", name="S1", division="MAS", zone="SR", km_location=0.0)
        stn2 = Station(code="S2", name="S2", division="MAS", zone="SR", km_location=10.0)
        sec = Section(
            id="SEC-1",
            division="MAS",
            start_station_code="S1",
            end_station_code="S2",
            start_km=0.0,
            end_km=10.0,
            distance_km=10.0,
        )
        self.db.add_all([run, stn1, stn2, sec])
        self.db.commit()

        # Invalid proposal: end_time <= start_time
        invalid_prop = BlockProposal(
            id=str(uuid4()),
            run_id=run.id,
            section_id=sec.id,
            proposed_start_time=now,
            proposed_end_time=now - timedelta(minutes=30),  # End before start
        )
        self.db.add(invalid_prop)
        with self.assertRaises(IntegrityError):
            self.db.commit()
        self.db.rollback()

    def test_operational_block_window_check_constraint(self):
        """OperationalBlock scheduled_end must be > scheduled_start (chk_block_window)."""
        now = datetime.utcnow()
        stn1 = Station(code="S1", name="S1", division="MAS", zone="SR", km_location=0.0)
        stn2 = Station(code="S2", name="S2", division="MAS", zone="SR", km_location=10.0)
        sec = Section(
            id="SEC-1",
            division="MAS",
            start_station_code="S1",
            end_station_code="S2",
            start_km=0.0,
            end_km=10.0,
            distance_km=10.0,
        )
        self.db.add_all([stn1, stn2, sec])
        self.db.commit()

        invalid_block = OperationalBlock(
            id="BLK-001",
            section_id="SEC-1",
            start_km=0.0,
            end_km=5.0,
            scheduled_start=now,
            scheduled_end=now,  # Same time, not strictly greater
            lead_department="ENGG",
        )
        self.db.add(invalid_block)
        with self.assertRaises(IntegrityError):
            self.db.commit()
        self.db.rollback()

    def test_foreign_key_enforcement(self):
        """Foreign keys are strictly enforced on SQLite and reject dangling keys."""
        # Section with invalid start_station_code
        sec = Section(
            id="SEC-DANGLING",
            division="MAS",
            start_station_code="NONEXISTENT",
            end_station_code="NONEXISTENT",
            start_km=0.0,
            end_km=10.0,
            distance_km=10.0,
        )
        self.db.add(sec)
        with self.assertRaises(IntegrityError):
            self.db.commit()
        self.db.rollback()
