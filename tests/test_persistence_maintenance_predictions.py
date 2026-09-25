"""Persistence tests for Defects, Maintenance Requests, and AI Predictions."""

from datetime import datetime, timezone
import unittest
from uuid import uuid4

from sqlalchemy import create_engine, event
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from backend.database.connection import Base
from backend.database.models import (
    Defect,
    MaintenanceRequest,
    Prediction,
    RequestDefect,
    Section,
    Station,
)
from backend.repositories import DefectRepository, MaintenanceRepository, PredictionRepository


def get_test_engine():
    engine = create_engine("sqlite:///:memory:", echo=False)

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    return engine


class TestMaintenanceAndPredictionsPersistence(unittest.TestCase):
    def setUp(self):
        self.engine = get_test_engine()
        Base.metadata.create_all(self.engine)
        self.SessionLocal = sessionmaker(bind=self.engine)
        self.db: Session = self.SessionLocal()

        self.maintenance_repo = MaintenanceRepository()
        self.defect_repo = DefectRepository()
        self.prediction_repo = PredictionRepository()

        # Seed topology
        self.stn1 = Station(code="AJJ", name="Arakkonam", division="MAS", zone="SR", km_location=0.0)
        self.stn2 = Station(code="SHU", name="Sholinghur", division="MAS", zone="SR", km_location=21.3)
        self.sec = Section(
            id="AJJ-SHU",
            division="MAS",
            start_station_code="AJJ",
            end_station_code="SHU",
            start_km=0.0,
            end_km=21.3,
            distance_km=21.3,
            track_count=2,
            mps_kmh=130.0,
        )
        self.db.add_all([self.stn1, self.stn2, self.sec])
        self.db.commit()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine)

    def test_maintenance_request_belongs_to_section(self):
        """Maintenance requests link to sections with referential integrity."""
        req = MaintenanceRequest(
            id="REQ-ENGG-001",
            section_id="AJJ-SHU",
            department="ENGG",
            work_type="RAIL_REPLACEMENT",
            location_km=12.5,
            track_line="UP",
            demanded_duration_minutes=120,
            safety_critical=True,
            priority="HIGH",
            status="SUBMITTED",
        )
        self.maintenance_repo.create(self.db, req)

        loaded = self.maintenance_repo.get(self.db, "REQ-ENGG-001")
        self.assertIsNotNone(loaded)
        self.assertEqual(loaded.section.id, "AJJ-SHU")
        self.assertEqual(loaded.section.start_station.code, "AJJ")

    def test_defects_and_m_to_n_request_linkage(self):
        """Defects link M:N to maintenance requests through request_defects."""
        # 1. Create two defects
        d1 = Defect(
            id="DEF-001",
            source_system="TMS",
            external_source_id="TMS-RAIL-001",
            section_id="AJJ-SHU",
            department="ENGG",
            category="IMR",
            location_km=12.5,
            track_line="UP",
            speed_restriction_kmh=30,
            status="OPEN",
        )
        d2 = Defect(
            id="DEF-002",
            source_system="TMS",
            external_source_id="TMS-WELD-002",
            section_id="AJJ-SHU",
            department="ENGG",
            category="OBS",
            location_km=12.7,
            track_line="UP",
            status="OPEN",
        )
        self.defect_repo.create(self.db, d1)
        self.defect_repo.create(self.db, d2)

        # 2. Create work request
        req = MaintenanceRequest(
            id="REQ-ENGG-BUNDLE",
            section_id="AJJ-SHU",
            department="ENGG",
            work_type="TRACK_MAINTENANCE",
            location_km=12.5,
            track_line="UP",
            demanded_duration_minutes=180,
            priority="HIGH",
        )
        self.maintenance_repo.create(self.db, req)

        # 3. Link defects to request
        self.maintenance_repo.link_defect(self.db, req.id, d1.id)
        self.maintenance_repo.link_defect(self.db, req.id, d2.id)

        # 4. Verify M:N loading
        loaded_req = self.maintenance_repo.get_with_defects(self.db, req.id)
        self.assertIsNotNone(loaded_req)
        self.assertEqual(len(loaded_req.defects), 2)
        defect_ids = {d.id for d in loaded_req.defects}
        self.assertEqual(defect_ids, {"DEF-001", "DEF-002"})

        # Verify reverse loading from defect
        loaded_defect = self.defect_repo.get_with_requests(self.db, d1.id)
        self.assertIsNotNone(loaded_defect)
        self.assertEqual(len(loaded_defect.maintenance_requests), 1)
        self.assertEqual(loaded_defect.maintenance_requests[0].id, req.id)

    def test_defect_unique_source_constraint(self):
        """uq_defect_source constraint prevents duplicate (source_system, external_source_id)."""
        d1 = Defect(
            id="DEF-10",
            source_system="SMMS",
            external_source_id="SMMS-POINT-99",
            section_id="AJJ-SHU",
            department="SNT",
            category="PM",
            location_km=10.0,
            track_line="UP",
        )
        self.defect_repo.create(self.db, d1)

        d2_dup = Defect(
            id="DEF-11",
            source_system="SMMS",
            external_source_id="SMMS-POINT-99",  # Duplicate external source ID
            section_id="AJJ-SHU",
            department="SNT",
            category="PM",
            location_km=10.0,
            track_line="UP",
        )
        self.db.add(d2_dup)
        with self.assertRaises(IntegrityError):
            self.db.commit()
        self.db.rollback()

    def test_predictions_historical_and_single_current(self):
        """Multiple predictions can exist historically, but only one is current."""
        req = MaintenanceRequest(
            id="REQ-PRED-TEST",
            section_id="AJJ-SHU",
            department="ENGG",
            work_type="RAIL_REPLACEMENT",
            location_km=10.0,
        )
        self.maintenance_repo.create(self.db, req)

        now = datetime.now(timezone.utc)
        # 1. First prediction (current)
        p1 = Prediction(
            id=str(uuid4()),
            maintenance_request_id=req.id,
            prediction_timestamp=now,
            model_version="xgboost_pipeline_v1.0",
            failure_risk_probability=0.82,
            priority_score=78.5,
            urgency_level="high",
            predicted_duration_minutes=110.0,
            overrun_probability=0.20,
            is_current=True,
        )
        self.prediction_repo.save_prediction(self.db, p1, set_as_current=True)

        current = self.prediction_repo.get_current(self.db, req.id)
        self.assertIsNotNone(current)
        self.assertEqual(current.id, p1.id)
        self.assertTrue(current.is_current)

        # 2. Saving second prediction with set_as_current=True automatically demotes p1
        p2 = Prediction(
            id=str(uuid4()),
            maintenance_request_id=req.id,
            prediction_timestamp=now,
            model_version="xgboost_pipeline_v1.1",
            failure_risk_probability=0.91,
            priority_score=88.0,
            urgency_level="critical",
            predicted_duration_minutes=125.0,
            overrun_probability=0.35,
            is_current=True,
        )
        self.prediction_repo.save_prediction(self.db, p2, set_as_current=True)

        # Now p2 is current and p1 is historical
        current_after = self.prediction_repo.get_current(self.db, req.id)
        self.assertEqual(current_after.id, p2.id)

        history = self.prediction_repo.get_history(self.db, req.id)
        self.assertEqual(len(history), 2)
        current_flags = [p.is_current for p in history]
        self.assertEqual(current_flags.count(True), 1)
        self.assertEqual(current_flags.count(False), 1)

    def test_partial_unique_index_rejects_duplicate_current_prediction(self):
        """Direct database insertion of two is_current=True predictions fails uq_current_request_prediction."""
        req = MaintenanceRequest(
            id="REQ-UQ-TEST",
            section_id="AJJ-SHU",
            department="TRD",
            work_type="OHE_INSPECTION",
            location_km=5.0,
        )
        self.maintenance_repo.create(self.db, req)

        now = datetime.now(timezone.utc)
        p1 = Prediction(
            id=str(uuid4()),
            maintenance_request_id=req.id,
            prediction_timestamp=now,
            model_version="xgboost_pipeline_v1.0",
            failure_risk_probability=0.6,
            priority_score=60.0,
            urgency_level="medium",
            predicted_duration_minutes=90.0,
            overrun_probability=0.1,
            is_current=True,
        )
        self.db.add(p1)
        self.db.commit()

        # Second prediction with is_current=True without demoting the first
        p2_conflict = Prediction(
            id=str(uuid4()),
            maintenance_request_id=req.id,
            prediction_timestamp=now,
            model_version="xgboost_pipeline_v1.0",
            failure_risk_probability=0.7,
            priority_score=70.0,
            urgency_level="high",
            predicted_duration_minutes=100.0,
            overrun_probability=0.2,
            is_current=True,
        )
        self.db.add(p2_conflict)
        with self.assertRaises(IntegrityError):
            self.db.commit()
        self.db.rollback()
