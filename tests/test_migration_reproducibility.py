"""Unit test suite for deterministic Alembic migration reproducibility and data preservation.

Validates that:
1. A fresh pre-Phase-5 database fixture successfully migrates to Phase 5 canonical schema.
2. SQLite foreign keys, NOT NULL constraints, check constraints, and indexes are valid.
3. alembic check detects zero schema discrepancies against SQLAlchemy ORM metadata.
4. All 15 maintenance requests, 14 predictions, 2 trains, 2 tms movements, 1 optimization run
   are preserved and correctly transformed without data loss or fabricated defects.
5. Goods traffic terminology strictly adheres to Phase 4 architecture (CONTROL_OFFICE_FORECAST).
6. The migration is idempotent and safe against repeated executions.
"""

from datetime import datetime
import os
from pathlib import Path
import sqlite3
import tempfile
import unittest

from alembic.config import Config
from alembic import command
from alembic.migration import MigrationContext
from alembic.autogenerate import compare_metadata
import sqlalchemy as sa
from sqlalchemy.orm import Session, sessionmaker

from backend.database.connection import Base
import backend.database.models
from backend.database.models import (
    BlockProposal,
    Defect,
    MaintenanceRequest,
    OptimizationRun,
    Prediction,
    ProposalDepartment,
    ProposalItem,
    RequestDefect,
    Section,
    Station,
    Train,
    TrainMovement,
)
from tests.fixtures.pre_phase5_seed import create_pre_phase5_database


class TestMigrationReproducibility(unittest.TestCase):
    """Test suite ensuring deterministic reproducibility of the Phase 5 Alembic migration."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "test_migration.db"
        create_pre_phase5_database(self.db_path)

        self.alembic_cfg = Config("alembic.ini")
        self.alembic_cfg.set_main_option("sqlalchemy.url", f"sqlite:///{self.db_path}")

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_reproducible_migration_and_data_integrity(self):
        """Pre-Phase-5 DB migrates cleanly, matches ORM metadata, and preserves all legacy records."""
        # 1. Run migration from base to head
        command.upgrade(self.alembic_cfg, "head")

        engine = sa.create_engine(f"sqlite:///{self.db_path}")
        with engine.connect() as conn:
            # 2. Verify alembic check / compare_metadata finds 0 discrepancies
            mc = MigrationContext.configure(conn, opts={"render_as_batch": True, "compare_type": True})
            diffs = compare_metadata(mc, Base.metadata)
            self.assertEqual(
                diffs,
                [],
                f"Alembic detected schema differences between migrated SQLite DB and ORM models: {diffs}",
            )

            # 3. Verify SQLite foreign key integrity
            conn.execute(sa.text("PRAGMA foreign_keys = ON"))
            violations = conn.execute(sa.text("PRAGMA foreign_key_check")).fetchall()
            self.assertEqual(violations, [], f"Foreign key violations detected: {violations}")

        # 4. Verify exact canonical row counts
        SessionLocal = sessionmaker(bind=engine)
        db: Session = SessionLocal()
        try:
            # Legacy tables preserved
            self.assertEqual(db.scalar(sa.text("SELECT COUNT(*) FROM network_topology")), 8)
            self.assertEqual(db.scalar(sa.text("SELECT COUNT(*) FROM tms_movements")), 2)
            self.assertEqual(db.scalar(sa.text("SELECT COUNT(*) FROM optimized_blocks")), 1)

            # Core entities preserved
            self.assertEqual(db.query(MaintenanceRequest).count(), 15)
            self.assertEqual(db.query(Prediction).count(), 14)
            self.assertEqual(db.query(Train).count(), 2)
            self.assertEqual(db.query(TrainMovement).count(), 2)
            self.assertEqual(db.query(Station).count(), 9)
            self.assertEqual(db.query(Section).count(), 8)

            # Optimization history migrated
            self.assertEqual(db.query(OptimizationRun).count(), 1)
            self.assertEqual(db.query(BlockProposal).count(), 1)
            self.assertEqual(db.query(ProposalItem).count(), 3)
            self.assertEqual(db.query(ProposalDepartment).count(), 2)

            # Anti-hallucination / zero defect fabrication check
            self.assertEqual(db.query(Defect).count(), 0)
            self.assertEqual(db.query(RequestDefect).count(), 0)

            # 5. Verify typed fields extraction from maintenance request_data
            chn002 = db.get(MaintenanceRequest, "DEMO-CHN-002")
            self.assertIsNotNone(chn002)
            self.assertEqual(chn002.demanded_duration_minutes, 90)
            self.assertEqual(chn002.equipment_ids, ["DEMO-EQ-002"])
            self.assertEqual(chn002.track_line, "UP")

            chn003 = db.get(MaintenanceRequest, "DEMO-CHN-003")
            self.assertIsNotNone(chn003)
            self.assertEqual(chn003.demanded_duration_minutes, 75)
            self.assertEqual(chn003.equipment_ids, ["DEMO-EQ-003"])

            req1947 = db.get(MaintenanceRequest, "REQ-1947")
            self.assertIsNotNone(req1947)
            self.assertEqual(req1947.demanded_duration_minutes, 120)

            # 6. Verify prediction fields
            predictions = db.query(Prediction).all()
            for pred in predictions:
                self.assertTrue(pred.is_current)
                self.assertIsNotNone(pred.prediction_timestamp)
                self.assertEqual(pred.model_version, "xgboost_pipeline_v1.0")
                self.assertIsNotNone(pred.maintenance_request)

            # 7. Verify traffic movements and Phase 4 terminology
            movements = db.query(TrainMovement).order_by(TrainMovement.scheduled_minute).all()
            self.assertEqual(len(movements), 2)

            # Passenger train (12005)
            m_pass = movements[0]
            self.assertEqual(m_pass.movement_type, "SCHEDULED")
            self.assertEqual(m_pass.traffic_source, "COA_TIMETABLE")
            self.assertEqual(m_pass.confidence_weight, 1.0)
            self.assertEqual(m_pass.train.service_type, "passenger")
            self.assertEqual(m_pass.train.priority_tier, "EXPRESS")

            # Freight train (FRT-CHN-01) - Must use CONTROL_OFFICE_FORECAST
            m_freight = movements[1]
            self.assertEqual(m_freight.movement_type, "GOODS_FORECAST")
            self.assertEqual(m_freight.traffic_source, "CONTROL_OFFICE_FORECAST")
            self.assertEqual(m_freight.confidence_weight, 0.8)
            self.assertEqual(m_freight.train.priority_tier, "GOODS")

            # 8. Verify optimization history migration
            run = db.query(OptimizationRun).one()
            self.assertEqual(run.planning_horizon, "WEEKLY")
            self.assertEqual(run.planning_cycle_label, "2026-W37")
            self.assertEqual(run.corridor_id, "AJJ-JTJ")
            self.assertEqual(len(run.proposals), 1)

            prop = run.proposals[0]
            self.assertEqual(prop.section_id, "AJJ-SHU")
            self.assertEqual(prop.trains_affected_count, 3)
            self.assertEqual(prop.possession_saving_minutes, 112.01)

            # Verify proposal items
            items_by_seq = sorted(prop.items, key=lambda x: x.sequence_order)
            item_req_ids = [item.maintenance_request_id for item in items_by_seq]
            self.assertEqual(item_req_ids, ["REQ-1947", "DEMO-CHN-002", "DEMO-CHN-001"])
            self.assertEqual([item.sequence_order for item in items_by_seq], [1, 2, 3])

            # Verify proposal departments
            depts = {d.department for d in prop.departments}
            self.assertEqual(depts, {"ENGG", "TRD"})

        finally:
            db.close()
            engine.dispose()

    def test_migration_idempotency(self):
        """Running alembic upgrade head repeatedly is safe and does not duplicate data."""
        command.upgrade(self.alembic_cfg, "head")
        # Run upgrade again
        command.upgrade(self.alembic_cfg, "head")

        engine = sa.create_engine(f"sqlite:///{self.db_path}")
        try:
            with engine.connect() as conn:
                violations = conn.execute(sa.text("PRAGMA foreign_key_check")).fetchall()
                self.assertEqual(violations, [])
                mr_count = conn.execute(sa.text("SELECT COUNT(*) FROM maintenance_requests")).scalar()
                self.assertEqual(mr_count, 15)
                run_count = conn.execute(sa.text("SELECT COUNT(*) FROM optimization_runs")).scalar()
                self.assertEqual(run_count, 1)
        finally:
            engine.dispose()

    def test_downgrade_policy_is_explicit(self):
        """Downgrading raises NotImplementedError documenting the forward-fix policy."""
        command.upgrade(self.alembic_cfg, "head")
        with self.assertRaises(NotImplementedError):
            command.downgrade(self.alembic_cfg, "-1")


if __name__ == "__main__":
    unittest.main()
