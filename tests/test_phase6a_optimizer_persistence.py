"""Phase 6A tests for CP-SAT Optimizer Relational Persistence."""

from datetime import datetime, timedelta, timezone
import unittest
from uuid import uuid4

from sqlalchemy import create_engine, event
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from backend.api.schemas.prediction import PipelineOptimizeRequest
from backend.database.connection import Base
from backend.database.models import (
    BlockProposal,
    MaintenanceRequest,
    OptimizationRun,
    OptimizedBlock,
    ProposalDepartment,
    ProposalItem,
    Section,
    Station,
)
from backend.repositories import (
    MaintenanceRepository,
    OptimizationRepository,
    OptimizedBlockRepository,
    TopologyRepository,
)
from backend.services.optimization_service import OptimizationService


def get_test_engine():
    engine = create_engine("sqlite:///:memory:", echo=False)

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    return engine


def make_model_features(section_id: str, department: str, location_km: float, duration: int) -> dict:
    return {
        "asset_age_days": 2500,
        "days_since_last_maintenance": 180,
        "previous_failure_count": 2,
        "lifetime_tonnage_mgt": 420.0,
        "tonnage_since_last_maintenance_mgt": 85.0,
        "daily_train_count": 120,
        "daily_tonnage_mgt": 2.5,
        "inspection_score": 55,
        "rainfall_mm": 20.0,
        "temperature_mean_c": 32.0,
        "max_wind_speed_kmh": 30.0,
        "is_heavy_rain_day": False,
        "asset_type": "TRACK_CIRCUIT",
        "department": department,
        "section_id": section_id,
        "planned_duration_minutes": duration,
        "severity_score": 8,
        "workers_required": 8,
        "equipment_count": 3,
        "workload_per_worker": 15.0,
        "weather_risk": 0.25,
        "congestion_score": 0.4,
        "current_delay_minutes": 10,
        "window_average_delay_minutes": 8,
        "window_peak_delay_minutes": 20,
        "accumulated_tonnage_mgt": 420.0,
        "trains_in_section": 12,
        "section_complexity": 0.7,
        "traffic_density": 0.8,
        "safety_critical": True,
        "is_heatwave_day": False,
        "is_rain_day": True,
        "request_hour": 10,
        "request_day_of_week": 1,
        "request_month": 9,
        "request_is_weekend": False,
        "location_km_marker": location_km,
        "window_train_count": 25,
        "planned_start_hour": 10,
        "work_type": "RAIL_REPLACEMENT",
        "priority": "MEDIUM",
        "earliest_start_minute": 480,
        "latest_end_minute": 900,
    }


class TestPhase6AOptimizerPersistence(unittest.TestCase):
    def setUp(self):
        self.engine = get_test_engine()
        Base.metadata.create_all(self.engine)
        self.SessionLocal = sessionmaker(bind=self.engine)
        self.db: Session = self.SessionLocal()

        self.opt_repo = OptimizationRepository()
        self.maint_repo = MaintenanceRepository()
        self.topo_repo = TopologyRepository()
        self.cache_repo = OptimizedBlockRepository()
        self.service = OptimizationService(
            optimization_repository=self.opt_repo,
            maintenance_repository=self.maint_repo,
            topology_repository=self.topo_repo,
            cache_repository=self.cache_repo,
        )

        # 1. Seed topology
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

        # 2. Seed compatible maintenance requests on section AJJ-SHU (spatial gap < 5km)
        feat1 = make_model_features("AJJ-SHU", "ENGG", 10.0, 120)
        self.r1 = MaintenanceRequest(
            id="TEST-ENGG-001",
            section_id="AJJ-SHU",
            department="ENGG",
            work_type="RAIL_REPLACEMENT",
            location_km=10.0,
            priority="HIGH",
            safety_critical=True,
            deadline_minutes=720,
            request_data={"model_features": feat1, **feat1},
        )
        feat2 = make_model_features("AJJ-SHU", "TRD", 11.5, 90)
        self.r2 = MaintenanceRequest(
            id="TEST-TRD-002",
            section_id="AJJ-SHU",
            department="TRD",
            work_type="OHE_MAINTENANCE",
            location_km=11.5,
            priority="MEDIUM",
            safety_critical=False,
            deadline_minutes=720,
            requires_power_isolation=True,
            request_data={"model_features": feat2, **feat2},
        )
        feat3 = make_model_features("AJJ-SHU", "SNT", 12.0, 75)
        self.r3 = MaintenanceRequest(
            id="TEST-SNT-003",
            section_id="AJJ-SHU",
            department="SNT",
            work_type="POINT_MACHINE",
            location_km=12.0,
            priority="MEDIUM",
            safety_critical=False,
            deadline_minutes=720,
            requires_disconnection=True,
            request_data={"model_features": feat3, **feat3},
        )
        self.db.add_all([self.r1, self.r2, self.r3])
        self.db.commit()

        self.payload = PipelineOptimizeRequest(
            request_ids=["TEST-ENGG-001", "TEST-TRD-002", "TEST-SNT-003"],
            max_group_size=4,
            max_spatial_gap_km=5.0,
            force_rerun=True,
        )

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine)

    def test_1_successful_persistence(self):
        """Test 1: Successful optimization run creates OptimizationRun, BlockProposal, ProposalItem, ProposalDepartment."""
        initial_runs = len(self.opt_repo.list_runs(self.db))
        self.assertEqual(initial_runs, 0)

        result = self.service.optimize(self.db, self.payload)

        # Verify return structure
        self.assertIn("_run_id", result)
        self.assertIn("_cache_id", result)
        self.assertIn("selected_blocks", result)
        self.assertGreater(len(result["selected_blocks"]), 0)

        # Verify OptimizationRun persistence count (+1)
        runs = self.opt_repo.list_runs(self.db)
        self.assertEqual(len(runs), 1)
        run = runs[0]
        self.assertEqual(run.id, result["_run_id"])
        self.assertEqual(run.corridor_id, "AJJ-JTJ")
        self.assertGreater(run.solver_duration_ms, 0)

        # Verify BlockProposal persistence count (>= 1)
        self.assertEqual(len(run.proposals), len(result["selected_blocks"]))
        first_proposal = run.proposals[0]
        self.assertEqual(first_proposal.status, "PROPOSED")

        # Verify ProposalItems count (at least 2 items bundled)
        self.assertGreaterEqual(len(first_proposal.items), 2)

        # Verify ProposalDepartments count (at least 2 departments)
        self.assertGreaterEqual(len(first_proposal.departments), 2)

    def test_2_relationships(self):
        """Test 2: Verification of ORM foreign keys and entity relationships."""
        result = self.service.optimize(self.db, self.payload)
        run_id = result["_run_id"]

        run = self.opt_repo.get_run(self.db, run_id)
        self.assertIsNotNone(run)
        self.assertGreater(len(run.proposals), 0)

        proposal = run.proposals[0]
        self.assertEqual(proposal.run.id, run.id)
        self.assertEqual(proposal.section.id, "AJJ-SHU")

        # Check ProposalItem -> MaintenanceRequest
        for item in proposal.items:
            self.assertEqual(item.proposal.id, proposal.id)
            self.assertIn(item.maintenance_request_id, ["TEST-ENGG-001", "TEST-TRD-002", "TEST-SNT-003"])
            self.assertIsNotNone(item.maintenance_request)
            self.assertEqual(item.maintenance_request.id, item.maintenance_request_id)

        # Check ProposalDepartment -> Proposal
        for dept in proposal.departments:
            self.assertEqual(dept.proposal.id, proposal.id)
            self.assertIn(dept.department, ["ENGG", "TRD", "S&T"])

    def test_3_data_fidelity(self):
        """Test 3: Persisted proposal fields match actual CP-SAT optimizer output exactly (no synthetic values)."""
        result = self.service.optimize(self.db, self.payload)
        selected_block = result["selected_blocks"][0]

        run = self.opt_repo.get_run(self.db, result["_run_id"])
        proposal = run.proposals[0]

        # Verify exact field match
        self.assertEqual(proposal.section_id, selected_block["section_id"])
        self.assertAlmostEqual(proposal.predicted_duration_minutes, selected_block["predicted_duration_minutes"], places=2)
        self.assertAlmostEqual(proposal.possession_saving_minutes, selected_block["possession_saving_minutes"], places=2)
        self.assertAlmostEqual(proposal.train_impact_minutes, selected_block["train_impact_minutes"], places=2)

        # Verify request IDs match and sequence order is 1-indexed
        persisted_req_ids = [item.maintenance_request_id for item in sorted(proposal.items, key=lambda i: i.sequence_order)]
        self.assertEqual(persisted_req_ids, selected_block["request_ids"])
        for idx, item in enumerate(sorted(proposal.items, key=lambda i: i.sequence_order)):
            self.assertEqual(item.sequence_order, idx + 1)

        # Verify department groups match
        persisted_depts = {d.department for d in proposal.departments}
        self.assertEqual(persisted_depts, set(selected_block["department_groups"].keys()))

        # Check TRD and S&T flags are correctly reflected
        for d in proposal.departments:
            if d.department == "TRD":
                self.assertTrue(d.requires_power_isolation)
            if d.department == "S&T":
                self.assertTrue(d.requires_disconnection)

        # Verify top factors and safety cautions
        self.assertEqual(proposal.safety_cautions, selected_block["compatibility_cautions"])
        self.assertEqual(proposal.top_factors_json["explanation"], selected_block["explanation"])

        # Verify absence of historical migration-only defaults
        self.assertNotEqual(run.planning_cycle_label, "2026-W39-MIGRATION-FALLBACK")
        self.assertGreater(proposal.proposed_end_time, proposal.proposed_start_time)

    def test_4_rerun_behavior(self):
        """Test 4: Optimization reruns preserve historical runs without destructive overwrite."""
        # Run 1
        res1 = self.service.optimize(self.db, self.payload)
        run1_id = res1["_run_id"]

        # Run 2 (force_rerun=True)
        res2 = self.service.optimize(self.db, self.payload)
        run2_id = res2["_run_id"]

        self.assertNotEqual(run1_id, run2_id)

        # Both runs exist in repository
        all_runs = self.opt_repo.list_runs(self.db)
        self.assertEqual(len(all_runs), 2)

        run1 = self.opt_repo.get_run(self.db, run1_id)
        run2 = self.opt_repo.get_run(self.db, run2_id)
        self.assertIsNotNone(run1)
        self.assertIsNotNone(run2)

        # Proposals of run1 and run2 are distinct
        proposals_run1 = {p.id for p in run1.proposals}
        proposals_run2 = {p.id for p in run2.proposals}
        self.assertEqual(len(proposals_run1.intersection(proposals_run2)), 0)

    def test_5_transaction_failure_rollback(self):
        """Test 5: Transaction failure rolls back cleanly leaving no partial planning run."""
        # Create an invalid run with proposed_end_time <= proposed_start_time to trigger check constraint
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        invalid_run = OptimizationRun(
            id=str(uuid4()),
            planning_horizon="WEEKLY",
            planning_cycle_label="2026-W39",
            effective_date_start=now.date(),
            effective_date_end=now.date() + timedelta(days=7),
            corridor_id="AJJ-JTJ",
            input_requests_hash="test_fail_hash",
            solver_status="OPTIMAL",
        )
        invalid_proposal = BlockProposal(
            id=str(uuid4()),
            run_id=invalid_run.id,
            section_id="AJJ-SHU",
            proposed_start_time=now + timedelta(hours=2),
            proposed_end_time=now,  # VIOLATES chk_proposal_window constraint!
            status="PROPOSED",
        )
        invalid_run.proposals.append(invalid_proposal)

        with self.assertRaises(Exception):
            self.opt_repo.create_run(self.db, invalid_run)

        # Verify that NEITHER the run nor any proposals were persisted
        runs = self.opt_repo.list_runs(self.db)
        self.assertEqual(len(runs), 0)
        self.assertEqual(self.db.query(BlockProposal).count(), 0)
        self.assertEqual(self.db.query(ProposalItem).count(), 0)
        self.assertEqual(self.db.query(ProposalDepartment).count(), 0)

    def test_6_legacy_cache_interop(self):
        """Test 6: Legacy cache interop works; cache_id is returned and cached row exists."""
        res = self.service.optimize(self.db, self.payload)
        cache_id = res["_cache_id"]

        cached_row = self.db.get(OptimizedBlock, cache_id)
        self.assertIsNotNone(cached_row)
        self.assertEqual(cached_row.request_ids, self.payload.request_ids)
        self.assertEqual(cached_row.result_json["_run_id"], res["_run_id"])


if __name__ == "__main__":
    unittest.main()
