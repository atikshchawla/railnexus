"""Persistence tests for Optimization Runs, Proposals, Departments, and Traffic Movements."""

from datetime import date, datetime, timedelta, timezone
import unittest
from uuid import uuid4

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from backend.database.connection import Base
from backend.database.models import (
    BlockProposal,
    MaintenanceRequest,
    OptimizationRun,
    ProposalDepartment,
    ProposalItem,
    Section,
    Station,
    Train,
    TrainMovement,
)
from backend.repositories import (
    MaintenanceRepository,
    OptimizationRepository,
    TrainMovementRepository,
    TrainRepository,
)


def get_test_engine():
    engine = create_engine("sqlite:///:memory:", echo=False)

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    return engine


class TestOptimizationAndTrafficPersistence(unittest.TestCase):
    def setUp(self):
        self.engine = get_test_engine()
        Base.metadata.create_all(self.engine)
        self.SessionLocal = sessionmaker(bind=self.engine)
        self.db: Session = self.SessionLocal()

        self.opt_repo = OptimizationRepository()
        self.train_repo = TrainRepository()
        self.movement_repo = TrainMovementRepository()
        self.maintenance_repo = MaintenanceRepository()

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

    def test_run_with_multiple_proposals_and_provenance(self):
        """One optimization run can have multiple proposals, each preserving run provenance."""
        now = datetime.now(timezone.utc)
        run = OptimizationRun(
            id=str(uuid4()),
            planning_horizon="WEEKLY",
            planning_cycle_label="2026-W39",
            effective_date_start=now.date(),
            effective_date_end=now.date() + timedelta(days=7),
            corridor_id="AJJ-JTJ",
            input_requests_hash="hash_abc",
            solver_status="OPTIMAL",
            solver_duration_ms=420,
        )

        p1 = BlockProposal(
            id=str(uuid4()),
            run_id=run.id,
            section_id="AJJ-SHU",
            proposed_start_time=now,
            proposed_end_time=now + timedelta(hours=3),
            predicted_duration_minutes=180.0,
            possession_saving_minutes=45.0,
            train_impact_minutes=30.0,
            confidence_score=0.92,
        )
        p2 = BlockProposal(
            id=str(uuid4()),
            run_id=run.id,
            section_id="AJJ-SHU",
            proposed_start_time=now + timedelta(hours=6),
            proposed_end_time=now + timedelta(hours=8),
            predicted_duration_minutes=120.0,
            possession_saving_minutes=20.0,
            train_impact_minutes=15.0,
            confidence_score=0.85,
        )
        run.proposals.extend([p1, p2])

        self.opt_repo.create_run(self.db, run)

        loaded_run = self.opt_repo.get_run(self.db, run.id)
        self.assertIsNotNone(loaded_run)
        self.assertEqual(len(loaded_run.proposals), 2)
        proposal_ids = {p.id for p in loaded_run.proposals}
        self.assertEqual(proposal_ids, {p1.id, p2.id})

        # Check proposal's back reference to run
        loaded_p1 = self.opt_repo.get_proposal(self.db, p1.id)
        self.assertIsNotNone(loaded_p1)
        self.assertEqual(loaded_p1.run.id, run.id)
        self.assertEqual(loaded_p1.run.planning_cycle_label, "2026-W39")

    def test_rerunning_optimization_preserves_historical_runs(self):
        """Rerunning optimization with matching input hash does NOT delete historical runs."""
        now = datetime.now(timezone.utc)
        identical_hash = "same_input_requests_hash_12345"

        # First run
        run1 = OptimizationRun(
            id=str(uuid4()),
            planning_horizon="WEEKLY",
            planning_cycle_label="2026-W39",
            effective_date_start=now.date(),
            effective_date_end=now.date() + timedelta(days=7),
            corridor_id="AJJ-JTJ",
            input_requests_hash=identical_hash,
            solver_status="OPTIMAL",
        )
        prop1 = BlockProposal(
            id=str(uuid4()),
            run_id=run1.id,
            section_id="AJJ-SHU",
            proposed_start_time=now,
            proposed_end_time=now + timedelta(hours=2),
            predicted_duration_minutes=120.0,
            confidence_score=0.88,
        )
        run1.proposals.append(prop1)
        self.opt_repo.create_run(self.db, run1)

        # Second run with exact same hash
        run2 = OptimizationRun(
            id=str(uuid4()),
            planning_horizon="WEEKLY",
            planning_cycle_label="2026-W39-RERUN",
            effective_date_start=now.date(),
            effective_date_end=now.date() + timedelta(days=7),
            corridor_id="AJJ-JTJ",
            input_requests_hash=identical_hash,
            solver_status="OPTIMAL",
        )
        prop2 = BlockProposal(
            id=str(uuid4()),
            run_id=run2.id,
            section_id="AJJ-SHU",
            proposed_start_time=now + timedelta(hours=3),
            proposed_end_time=now + timedelta(hours=5),
            predicted_duration_minutes=120.0,
            confidence_score=0.90,
        )
        run2.proposals.append(prop2)
        self.opt_repo.create_run(self.db, run2)

        # Both runs and both proposals must still exist
        all_runs = self.opt_repo.list_runs(self.db, corridor_id="AJJ-JTJ")
        self.assertEqual(len(all_runs), 2)
        run_ids = {r.id for r in all_runs}
        self.assertIn(run1.id, run_ids)
        self.assertIn(run2.id, run_ids)

        self.assertIsNotNone(self.opt_repo.get_proposal(self.db, prop1.id))
        self.assertIsNotNone(self.opt_repo.get_proposal(self.db, prop2.id))

    def test_proposal_items_and_departments_persist(self):
        """Proposal items link requests and proposal departments preserve multi-department coordination."""
        now = datetime.now(timezone.utc)
        req1 = MaintenanceRequest(
            id="REQ-ENGG-1",
            section_id="AJJ-SHU",
            department="ENGG",
            work_type="RAIL_REPLACEMENT",
            location_km=12.0,
        )
        req2 = MaintenanceRequest(
            id="REQ-TRD-1",
            section_id="AJJ-SHU",
            department="TRD",
            work_type="OHE_INSPECTION",
            location_km=12.5,
        )
        self.maintenance_repo.create(self.db, req1)
        self.maintenance_repo.create(self.db, req2)

        run = OptimizationRun(
            id=str(uuid4()),
            effective_date_start=now.date(),
            effective_date_end=now.date() + timedelta(days=7),
            corridor_id="AJJ-JTJ",
            input_requests_hash="hash_multi_dept",
            solver_status="OPTIMAL",
        )
        prop = BlockProposal(
            id=str(uuid4()),
            run_id=run.id,
            section_id="AJJ-SHU",
            proposed_start_time=now,
            proposed_end_time=now + timedelta(hours=4),
            predicted_duration_minutes=240.0,
            possession_saving_minutes=60.0,
            confidence_score=0.95,
        )
        run.proposals.append(prop)
        self.opt_repo.create_run(self.db, run)

        # Add items
        item1 = ProposalItem(proposal_id=prop.id, maintenance_request_id=req1.id, sequence_order=1)
        item2 = ProposalItem(proposal_id=prop.id, maintenance_request_id=req2.id, sequence_order=2)
        # Add departments
        dept_engg = ProposalDepartment(
            proposal_id=prop.id,
            department="ENGG",
            work_description="Rail Renewal km 12.0",
            demanded_duration_minutes=180,
        )
        dept_trd = ProposalDepartment(
            proposal_id=prop.id,
            department="TRD",
            work_description="OHE Isolation km 12.5",
            demanded_duration_minutes=120,
            requires_power_isolation=True,
        )
        self.db.add_all([item1, item2, dept_engg, dept_trd])
        self.db.commit()

        loaded = self.opt_repo.get_proposal(self.db, prop.id)
        self.assertIsNotNone(loaded)
        self.assertEqual(len(loaded.items), 2)
        item_req_ids = [it.maintenance_request_id for it in loaded.items]
        self.assertEqual(item_req_ids, ["REQ-ENGG-1", "REQ-TRD-1"])

        self.assertEqual(len(loaded.departments), 2)
        depts = {d.department: d for d in loaded.departments}
        self.assertIn("ENGG", depts)
        self.assertIn("TRD", depts)
        self.assertTrue(depts["TRD"].requires_power_isolation)

    def test_scheduled_and_goods_forecast_train_movements(self):
        """Train movements support both SCHEDULED (timetabled) and GOODS_FORECAST."""
        now = datetime.now(timezone.utc)
        # 1. Passenger Train
        t_pass = Train(
            id=str(uuid4()),
            train_number="12005",
            service_type="passenger",
            priority_tier="EXPRESS",
            origin="Chennai",
            destination="Mysuru",
        )
        # 2. Freight Train
        t_goods = Train(
            id=str(uuid4()),
            train_number="BOXN-COAL-01",
            service_type="goods",
            priority_tier="GOODS",
            origin="Chennai Port",
            destination="Katpadi",
        )
        self.train_repo.create(self.db, t_pass)
        self.train_repo.create(self.db, t_goods)

        # 3. Scheduled Movement
        m_sched = TrainMovement(
            id=str(uuid4()),
            train_id=t_pass.id,
            section_id="AJJ-SHU",
            movement_date=now,
            scheduled_minute=510,  # 08:30
            actual_minute=510,
            delay_minutes=0.0,
            movement_type="SCHEDULED",
            traffic_source="COA_TIMETABLE",
            confidence_weight=1.0,
        )
        # 4. Goods Forecast Movement
        m_goods = TrainMovement(
            id=str(uuid4()),
            train_id=t_goods.id,
            section_id="AJJ-SHU",
            movement_date=now,
            scheduled_minute=600,  # 10:00
            delay_minutes=0.0,
            movement_type="GOODS_FORECAST",
            traffic_source="CONTROL_OFFICE_FORECAST",
            confidence_weight=0.8,
        )
        self.movement_repo.create(self.db, m_sched)
        self.movement_repo.create(self.db, m_goods)

        # Query in window 500 to 650
        in_window = self.movement_repo.list_in_window(self.db, "AJJ-SHU", 500, 650)
        self.assertEqual(len(in_window), 2)

        # Query by movement_type
        goods_only = self.movement_repo.list(self.db, section_id="AJJ-SHU", movement_type="GOODS_FORECAST")
        self.assertEqual(len(goods_only), 1)
        self.assertEqual(goods_only[0].traffic_source, "CONTROL_OFFICE_FORECAST")
        self.assertEqual(goods_only[0].confidence_weight, 0.8)
