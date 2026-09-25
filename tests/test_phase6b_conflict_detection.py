"""Unit and integration tests for Phase 6B Authoritative Server-Side Conflict Detection."""

from datetime import date, datetime, timedelta
import importlib
import inspect
import unittest
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from backend.api.routes import conflicts as conflicts_route_mod
from backend.api.schemas.conflict import (
    ConflictDetectRequest,
    ConflictResolutionCreate,
)
from backend.database.connection import Base
from backend.database.models import (
    BlockProposal,
    Conflict,
    ConflictResolutionEvent,
    OptimizationRun,
    Section,
    Station,
    Train,
    TrainMovement,
)
from backend.domain.enums import ConflictSeverity, ConflictStatus, ConflictType, ResolutionAction
from backend.repositories import (
    ConflictRepository,
    OptimizationRepository,
    TopologyRepository,
    TrainMovementRepository,
)
from backend.services import conflict_service as conflict_service_mod
from backend.services.conflict_service import ConflictService


def get_test_engine():
    engine = create_engine("sqlite:///:memory:", echo=False)

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    return engine


class TestPhase6BConflictDetection(unittest.TestCase):
    def setUp(self):
        self.engine = get_test_engine()
        Base.metadata.create_all(self.engine)
        self.SessionLocal = sessionmaker(bind=self.engine)
        self.db: Session = self.SessionLocal()

        self.conflict_repo = ConflictRepository()
        self.opt_repo = OptimizationRepository()
        self.topo_repo = TopologyRepository()
        self.train_movement_repo = TrainMovementRepository()

        self.service = ConflictService(
            conflict_repository=self.conflict_repo,
            optimization_repository=self.opt_repo,
            topology_repository=self.topo_repo,
            train_movement_repository=self.train_movement_repo,
        )

        # ── Seed Canonical Topology (AJJ - JTJ Corridor) ─────────────
        self.stn_ajj = Station(code="AJJ", name="Arakkonam Jn", division="MAS", zone="SR", km_location=68.5)
        self.stn_shu = Station(code="SHU", name="Sholinghur", division="MAS", zone="SR", km_location=89.8)
        self.stn_wjr = Station(code="WJR", name="Walajah Road Jn", division="MAS", zone="SR", km_location=105.2)

        self.sec1 = Section(
            id="AJJ-SHU",
            division="MAS",
            start_station_code="AJJ",
            end_station_code="SHU",
            start_km=68.5,
            end_km=89.8,
            distance_km=21.3,
            track_count=2,
            mps_kmh=130.0,
        )
        self.sec2 = Section(
            id="SHU-WJR",
            division="MAS",
            start_station_code="SHU",
            end_station_code="WJR",
            start_km=89.8,
            end_km=105.2,
            distance_km=15.4,
            track_count=2,
            mps_kmh=130.0,
        )
        self.db.add_all([self.stn_ajj, self.stn_shu, self.stn_wjr, self.sec1, self.sec2])
        self.db.commit()

        # ── Baseline Optimization Run ──────────────────────────────
        self.base_date = date(2026, 9, 26)
        self.base_time = datetime(2026, 9, 26, 8, 0, 0)
        self.run = OptimizationRun(
            id=str(uuid4()),
            planning_horizon="WEEKLY",
            planning_cycle_label="2026-W39",
            effective_date_start=self.base_date,
            effective_date_end=self.base_date + timedelta(days=7),
            corridor_id="AJJ-JTJ",
            input_requests_hash="test-hash-6b",
            input_snapshot_json={},
            algorithm_version="cp_sat_v2.1",
            weights_json={},
            solver_status="OPTIMAL",
            solver_duration_ms=50,
            created_at=self.base_time,
        )
        self.db.add(self.run)
        self.db.commit()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def _create_proposal(
        self,
        run_id: str,
        section_id: str,
        start_time: datetime,
        end_time: datetime,
        proposal_id: str | None = None,
    ) -> BlockProposal:
        proposal = BlockProposal(
            id=proposal_id or str(uuid4()),
            run_id=run_id,
            section_id=section_id,
            proposed_start_time=start_time,
            proposed_end_time=end_time,
            predicted_duration_minutes=float((end_time - start_time).total_seconds() / 60),
            possession_saving_minutes=15.0,
            train_impact_minutes=20.0,
            trains_affected_count=2,
            confidence_score=0.95,
            top_factors_json={},
            safety_cautions=[],
            status="PROPOSED",
            created_at=self.base_time,
        )
        self.db.add(proposal)
        self.db.commit()
        self.db.refresh(proposal)
        return proposal

    # ─────────────────────────────────────────────────────────────────
    # 1. BLOCK-VS-BLOCK CONFLICT TESTS
    # ─────────────────────────────────────────────────────────────────

    def test_01_same_section_overlapping_windows_creates_section_occupation(self):
        """1. Same section + overlapping windows → one SECTION_OCCUPATION."""
        prop_a = self._create_proposal(
            self.run.id, "AJJ-SHU",
            self.base_time, self.base_time + timedelta(hours=2)  # 08:00 - 10:00
        )
        prop_b = self._create_proposal(
            self.run.id, "AJJ-SHU",
            self.base_time + timedelta(hours=1), self.base_time + timedelta(hours=3)  # 09:00 - 11:00
        )

        req = ConflictDetectRequest(run_id=self.run.id, check_train_movements=False)
        conflicts = self.service.detect_conflicts(self.db, req)

        self.assertEqual(len(conflicts), 1)
        conflict = conflicts[0]
        self.assertEqual(conflict.conflict_type, ConflictType.SECTION_OCCUPATION.value)
        self.assertEqual(conflict.severity, ConflictSeverity.CRITICAL.value)
        self.assertTrue(conflict.is_blocking)
        self.assertEqual(conflict.status, ConflictStatus.UNRESOLVED.value)
        # Verify canonical ordering
        min_id, max_id = sorted([prop_a.id, prop_b.id])
        self.assertEqual(conflict.proposal_a_id, min_id)
        self.assertEqual(conflict.proposal_b_id, max_id)
        self.assertIsNone(conflict.train_movement_id)
        # Verify temporal bounds: 09:00 - 10:00
        self.assertEqual(conflict.temporal_start, self.base_time + timedelta(hours=1))
        self.assertEqual(conflict.temporal_end, self.base_time + timedelta(hours=2))
        # Spatial extent matches section
        self.assertEqual(conflict.spatial_km_start, 68.5)
        self.assertEqual(conflict.spatial_km_end, 89.8)

    def test_02_same_section_non_overlapping_windows_yields_zero_conflicts(self):
        """2. Same section + non-overlapping windows → zero conflict."""
        self._create_proposal(
            self.run.id, "AJJ-SHU",
            self.base_time, self.base_time + timedelta(hours=2)  # 08:00 - 10:00
        )
        self._create_proposal(
            self.run.id, "AJJ-SHU",
            self.base_time + timedelta(hours=2), self.base_time + timedelta(hours=4)  # 10:00 - 12:00
        )

        req = ConflictDetectRequest(run_id=self.run.id, check_train_movements=False)
        conflicts = self.service.detect_conflicts(self.db, req)
        self.assertEqual(len(conflicts), 0)

    def test_03_different_sections_overlapping_windows_yields_zero_conflicts(self):
        """3. Different sections + overlapping windows → zero SECTION_OCCUPATION."""
        self._create_proposal(
            self.run.id, "AJJ-SHU",
            self.base_time, self.base_time + timedelta(hours=2)  # 08:00 - 10:00
        )
        self._create_proposal(
            self.run.id, "SHU-WJR",
            self.base_time, self.base_time + timedelta(hours=2)  # 08:00 - 10:00 on other section
        )

        req = ConflictDetectRequest(run_id=self.run.id, check_train_movements=False)
        conflicts = self.service.detect_conflicts(self.db, req)
        self.assertEqual(len(conflicts), 0)

    def test_04_same_pair_detected_twice_yields_no_duplicate_current_conflict(self):
        """4. Same pair detected twice → no duplicate current conflict (idempotency)."""
        prop_a = self._create_proposal(
            self.run.id, "AJJ-SHU",
            self.base_time, self.base_time + timedelta(hours=2)
        )
        prop_b = self._create_proposal(
            self.run.id, "AJJ-SHU",
            self.base_time + timedelta(minutes=30), self.base_time + timedelta(hours=2)
        )

        req = ConflictDetectRequest(run_id=self.run.id, check_train_movements=False)
        conflicts_1 = self.service.detect_conflicts(self.db, req)
        self.assertEqual(len(conflicts_1), 1)
        conflict_id = conflicts_1[0].id

        # Second detection run
        conflicts_2 = self.service.detect_conflicts(self.db, req)
        self.assertEqual(len(conflicts_2), 1)
        self.assertEqual(conflicts_2[0].id, conflict_id)

        # Total rows in DB should remain strictly 1
        total_rows = self.db.query(Conflict).count()
        self.assertEqual(total_rows, 1)

    def test_05_multiple_overlapping_proposals_correct_pair_attribution(self):
        """5. Multiple overlapping proposals → correct pair attribution."""
        # 3 proposals overlapping on AJJ-SHU: P1 (08:00-11:00), P2 (09:00-12:00), P3 (10:00-13:00)
        p1 = self._create_proposal(self.run.id, "AJJ-SHU", self.base_time, self.base_time + timedelta(hours=3), "PROP-P1")
        p2 = self._create_proposal(self.run.id, "AJJ-SHU", self.base_time + timedelta(hours=1), self.base_time + timedelta(hours=4), "PROP-P2")
        p3 = self._create_proposal(self.run.id, "AJJ-SHU", self.base_time + timedelta(hours=2), self.base_time + timedelta(hours=5), "PROP-P3")

        req = ConflictDetectRequest(run_id=self.run.id, check_train_movements=False)
        conflicts = self.service.detect_conflicts(self.db, req)

        # There should be 3 pairwise conflicts: (P1, P2), (P1, P3), (P2, P3)
        self.assertEqual(len(conflicts), 3)
        detected_pairs = {(c.proposal_a_id, c.proposal_b_id) for c in conflicts}
        expected_pairs = {
            ("PROP-P1", "PROP-P2"),
            ("PROP-P1", "PROP-P3"),
            ("PROP-P2", "PROP-P3"),
        }
        self.assertEqual(detected_pairs, expected_pairs)

    # ─────────────────────────────────────────────────────────────────
    # 2. TRAIN CONFLICT TESTS
    # ─────────────────────────────────────────────────────────────────

    def test_06_proposal_plus_train_temporal_overlap_creates_train_crossing(self):
        """6. Proposal + train on same section with genuine temporal overlap → TRAIN_CROSSING."""
        prop = self._create_proposal(
            self.run.id, "AJJ-SHU",
            self.base_time, self.base_time + timedelta(hours=2)  # 08:00 - 10:00 (minute 480 to 600)
        )
        train = Train(id=str(uuid4()), train_number="12602", service_type="passenger", priority_tier="EXPRESS")
        self.db.add(train)
        self.db.commit()

        # Train scheduled at 08:30 (minute 510) on same section
        movement = TrainMovement(
            id=str(uuid4()),
            train_id=train.id,
            section_id="AJJ-SHU",
            movement_date=self.base_date,
            scheduled_minute=510,
            movement_type="SCHEDULED",
        )
        self.train_movement_repo.create(self.db, movement)

        req = ConflictDetectRequest(run_id=self.run.id, check_train_movements=True)
        conflicts = self.service.detect_conflicts(self.db, req)

        self.assertEqual(len(conflicts), 1)
        c = conflicts[0]
        self.assertEqual(c.conflict_type, ConflictType.TRAIN_CROSSING.value)
        self.assertEqual(c.severity, ConflictSeverity.HIGH.value)
        self.assertEqual(c.proposal_a_id, prop.id)
        self.assertIsNone(c.proposal_b_id)
        self.assertEqual(c.train_movement_id, movement.id)
        self.assertTrue(c.is_blocking)
        self.assertEqual(c.status, ConflictStatus.UNRESOLVED.value)

    def test_07_proposal_plus_train_outside_window_yields_zero_conflicts(self):
        """7. Proposal + train on same section but outside the window → no conflict."""
        self._create_proposal(
            self.run.id, "AJJ-SHU",
            self.base_time, self.base_time + timedelta(hours=2)  # 08:00 - 10:00 (minute 480 to 600)
        )
        train = Train(id=str(uuid4()), train_number="12604", service_type="passenger", priority_tier="EXPRESS")
        self.db.add(train)
        self.db.commit()

        # Train scheduled at 11:30 (minute 690) - outside proposal window
        movement = TrainMovement(
            id=str(uuid4()),
            train_id=train.id,
            section_id="AJJ-SHU",
            movement_date=self.base_date,
            scheduled_minute=690,
            movement_type="SCHEDULED",
        )
        self.train_movement_repo.create(self.db, movement)

        req = ConflictDetectRequest(run_id=self.run.id, check_train_movements=True)
        conflicts = self.service.detect_conflicts(self.db, req)
        self.assertEqual(len(conflicts), 0)

    def test_08_train_on_another_section_yields_zero_conflicts(self):
        """8. Train on another section → no conflict."""
        self._create_proposal(
            self.run.id, "AJJ-SHU",
            self.base_time, self.base_time + timedelta(hours=2)  # 08:00 - 10:00 on AJJ-SHU
        )
        train = Train(id=str(uuid4()), train_number="12606", service_type="passenger", priority_tier="EXPRESS")
        self.db.add(train)
        self.db.commit()

        # Train at 08:30 (minute 510) but on SHU-WJR
        movement = TrainMovement(
            id=str(uuid4()),
            train_id=train.id,
            section_id="SHU-WJR",
            movement_date=self.base_date,
            scheduled_minute=510,
            movement_type="SCHEDULED",
        )
        self.train_movement_repo.create(self.db, movement)

        req = ConflictDetectRequest(run_id=self.run.id, check_train_movements=True)
        conflicts = self.service.detect_conflicts(self.db, req)
        self.assertEqual(len(conflicts), 0)

    def test_09_train_conflict_persists_correct_fk_references(self):
        """9. Proposal/train conflict persists correct FK references."""
        prop = self._create_proposal(
            self.run.id, "AJJ-SHU",
            self.base_time, self.base_time + timedelta(hours=2)
        )
        train = Train(id=str(uuid4()), train_number="12608", service_type="passenger", priority_tier="EXPRESS")
        self.db.add(train)
        self.db.commit()

        movement = TrainMovement(
            id=str(uuid4()),
            train_id=train.id,
            section_id="AJJ-SHU",
            movement_date=self.base_date,
            scheduled_minute=500,
            movement_type="SCHEDULED",
        )
        self.train_movement_repo.create(self.db, movement)

        req = ConflictDetectRequest(run_id=self.run.id, check_train_movements=True)
        conflicts = self.service.detect_conflicts(self.db, req)
        self.assertEqual(len(conflicts), 1)

        loaded = self.conflict_repo.get(self.db, conflicts[0].id)
        self.assertIsNotNone(loaded)
        self.assertIsNotNone(loaded.proposal_a)
        self.assertEqual(loaded.proposal_a.id, prop.id)
        self.assertIsNone(loaded.proposal_b)
        self.assertIsNotNone(loaded.train_movement)
        self.assertEqual(loaded.train_movement.id, movement.id)
        self.assertEqual(loaded.train_movement.train.train_number, "12608")

    # ─────────────────────────────────────────────────────────────────
    # 3. RESOLUTION TESTS
    # ─────────────────────────────────────────────────────────────────

    def test_10_resolve_conflict_persists_resolution_event(self):
        """10. Resolve a conflict → resolution event persisted."""
        prop_a = self._create_proposal(self.run.id, "AJJ-SHU", self.base_time, self.base_time + timedelta(hours=2))
        prop_b = self._create_proposal(self.run.id, "AJJ-SHU", self.base_time + timedelta(hours=1), self.base_time + timedelta(hours=3))

        req = ConflictDetectRequest(run_id=self.run.id, check_train_movements=False)
        conflicts = self.service.detect_conflicts(self.db, req)
        conflict_id = conflicts[0].id

        event_payload = ConflictResolutionCreate(
            resolution_action="MERGED",
            actor_id="CONTROLLER-CHENNAI-01",
            actor_role="SECTION_CONTROLLER",
            rationale_notes="Merged civil and electrical work under single possession window",
        )
        event = self.service.resolve_conflict(self.db, conflict_id, event_payload)

        self.assertIsNotNone(event.id)
        self.assertEqual(event.conflict_id, conflict_id)
        self.assertEqual(event.resolution_action, "MERGED")
        self.assertEqual(event.actor_id, "CONTROLLER-CHENNAI-01")
        self.assertTrue(event.is_current_resolution)

        # Verify conflict row status is updated to RESOLVED
        conflict = self.conflict_repo.get(self.db, conflict_id)
        self.assertEqual(conflict.status, "RESOLVED")

    def test_11_current_resolution_invariant_remains_valid(self):
        """11. Current resolution invariant remains valid when re-resolved."""
        prop_a = self._create_proposal(self.run.id, "AJJ-SHU", self.base_time, self.base_time + timedelta(hours=2))
        prop_b = self._create_proposal(self.run.id, "AJJ-SHU", self.base_time + timedelta(hours=1), self.base_time + timedelta(hours=3))

        req = ConflictDetectRequest(run_id=self.run.id, check_train_movements=False)
        conflicts = self.service.detect_conflicts(self.db, req)
        conflict_id = conflicts[0].id

        # 1st Resolution
        e1 = self.service.resolve_conflict(
            self.db, conflict_id,
            ConflictResolutionCreate(
                resolution_action="SEQUENCED",
                actor_id="CTRL_01",
                actor_role="SECTION_CONTROLLER",
                rationale_notes="First pass: sequence after traffic",
            )
        )

        # 2nd Resolution (overrides 1st)
        e2 = self.service.resolve_conflict(
            self.db, conflict_id,
            ConflictResolutionCreate(
                resolution_action="MERGED",
                actor_id="SR_DOM_01",
                actor_role="SR_DOM",
                rationale_notes="Senior DOM decision: merge into joint window",
            )
        )

        history = self.conflict_repo.list_resolution_history(self.db, conflict_id)
        self.assertEqual(len(history), 2)

        current_events = [e for e in history if e.is_current_resolution]
        self.assertEqual(len(current_events), 1)
        self.assertEqual(current_events[0].id, e2.id)
        self.assertEqual(current_events[0].resolution_action, "MERGED")

    def test_12_resolution_history_survives_subsequent_detection(self):
        """12. Resolution history survives subsequent detection."""
        prop_a = self._create_proposal(self.run.id, "AJJ-SHU", self.base_time, self.base_time + timedelta(hours=2))
        prop_b = self._create_proposal(self.run.id, "AJJ-SHU", self.base_time + timedelta(hours=1), self.base_time + timedelta(hours=3))

        req = ConflictDetectRequest(run_id=self.run.id, check_train_movements=False)
        conflicts = self.service.detect_conflicts(self.db, req)
        conflict_id = conflicts[0].id

        self.service.resolve_conflict(
            self.db, conflict_id,
            ConflictResolutionCreate(
                resolution_action="MERGED",
                actor_id="CTRL_01",
                actor_role="SECTION_CONTROLLER",
                rationale_notes="Approved joint block",
            )
        )

        # Re-run detection over the same run
        conflicts_after = self.service.detect_conflicts(self.db, req)
        self.assertEqual(len(conflicts_after), 1)
        self.assertEqual(conflicts_after[0].id, conflict_id)
        self.assertEqual(conflicts_after[0].status, "RESOLVED")

        # Verify resolution events are completely preserved
        history = self.conflict_repo.list_resolution_history(self.db, conflict_id)
        self.assertEqual(len(history), 1)
        self.assertEqual(history[0].resolution_action, "MERGED")

    # ─────────────────────────────────────────────────────────────────
    # 4. SAFETY, PERSISTENCE & ARCHITECTURAL ISOLATION TESTS
    # ─────────────────────────────────────────────────────────────────

    def test_13_invalid_proposal_reference_fails_safely(self):
        """13. Invalid proposal reference fails safely (404)."""
        req = ConflictDetectRequest(
            run_id=self.run.id,
            proposal_ids=["NON-EXISTENT-PROP-ID"],
            check_train_movements=False,
        )
        with self.assertRaises(HTTPException) as ctx:
            self.service.detect_conflicts(self.db, req)
        self.assertEqual(ctx.exception.status_code, 404)

    def test_14_invalid_run_proposal_relationship_fails_safely(self):
        """14. Proposal not belonging to run fails safely (422)."""
        other_run = OptimizationRun(
            id=str(uuid4()),
            planning_horizon="WEEKLY",
            planning_cycle_label="2026-W40",
            effective_date_start=self.base_date,
            effective_date_end=self.base_date + timedelta(days=7),
            corridor_id="AJJ-JTJ",
            input_requests_hash="other-hash",
            algorithm_version="cp_sat_v2.1",
            solver_status="OPTIMAL",
            created_at=self.base_time,
        )
        self.db.add(other_run)
        self.db.commit()

        foreign_prop = self._create_proposal(
            other_run.id, "AJJ-SHU", self.base_time, self.base_time + timedelta(hours=2)
        )

        req = ConflictDetectRequest(
            run_id=self.run.id,
            proposal_ids=[foreign_prop.id],
            check_train_movements=False,
        )
        with self.assertRaises(HTTPException) as ctx:
            self.service.detect_conflicts(self.db, req)
        self.assertEqual(ctx.exception.status_code, 422)

    def test_15_transaction_rollback_leaves_no_partial_conflict_records(self):
        """15. Transaction rollback leaves no partial conflict records."""
        prop_a = self._create_proposal(self.run.id, "AJJ-SHU", self.base_time, self.base_time + timedelta(hours=2))
        prop_b = self._create_proposal(self.run.id, "AJJ-SHU", self.base_time + timedelta(hours=1), self.base_time + timedelta(hours=3))

        req = ConflictDetectRequest(run_id=self.run.id, check_train_movements=False)

        # Simulate DB error during commit
        original_commit = self.db.commit

        def failing_commit():
            raise RuntimeError("Simulated DB Disk Failure")

        self.db.commit = failing_commit
        try:
            with self.assertRaises(RuntimeError):
                self.service.detect_conflicts(self.db, req)
        finally:
            self.db.commit = original_commit

        # Ensure no conflict rows were committed
        count = self.db.query(Conflict).count()
        self.assertEqual(count, 0)

    def test_16_demo_isolation_no_demo_imports_from_core_conflict_service_or_route(self):
        """16. Demo isolation: no Demo imports from Core conflict service/route."""
        service_file = inspect.getfile(conflict_service_mod)
        route_file = inspect.getfile(conflicts_route_mod)

        for filepath in (service_file, route_file):
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()

            self.assertNotIn("backend.api.routes.demo", content)
            self.assertNotIn("backend.api.routes.demo_gateway", content)
            self.assertNotIn("backend.services.demo", content)
            self.assertNotIn("frontend", content)

    # ─────────────────────────────────────────────────────────────────
    # 5. FASTAPI ROUTE INTEGRATION TESTS
    # ─────────────────────────────────────────────────────────────────

    def test_17_api_route_handlers(self):
        """17. Test API route handlers: detect, list, get, resolve, and validation errors."""
        prop_a = self._create_proposal(self.run.id, "AJJ-SHU", self.base_time, self.base_time + timedelta(hours=2))
        prop_b = self._create_proposal(self.run.id, "AJJ-SHU", self.base_time + timedelta(hours=1), self.base_time + timedelta(hours=3))

        # POST /api/conflicts/detect via route handler
        detect_req = ConflictDetectRequest(run_id=self.run.id, check_train_movements=False)
        detected = conflicts_route_mod.detect_conflicts(detect_req, db=self.db)
        self.assertEqual(len(detected), 1)
        cid = detected[0].id
        self.assertEqual(detected[0].conflict_type, "SECTION_OCCUPATION")

        # GET /api/conflicts via route handler
        listed = conflicts_route_mod.list_conflicts(run_id=self.run.id, status="UNRESOLVED", db=self.db)
        self.assertEqual(len(listed), 1)
        self.assertEqual(listed[0].id, cid)

        # GET /api/conflicts/{conflict_id} via route handler
        single = conflicts_route_mod.get_conflict(cid, db=self.db)
        self.assertEqual(single.id, cid)

        # POST /api/conflicts/{conflict_id}/resolve via route handler
        res_payload = ConflictResolutionCreate(
            resolution_action="SEQUENCED",
            actor_id="CONTROLLER_01",
            actor_role="SECTION_CONTROLLER",
            rationale_notes="Sequenced behind prior freight movement",
        )
        resolved_event = conflicts_route_mod.resolve_conflict(cid, res_payload, db=self.db)
        self.assertEqual(resolved_event.resolution_action, "SEQUENCED")
        self.assertTrue(resolved_event.is_current_resolution)

        # Verify resolved status via get_conflict
        after_resolve = conflicts_route_mod.get_conflict(cid, db=self.db)
        self.assertEqual(after_resolve.status, "RESOLVED")

        # Validation error: Invalid action code -> 422
        bad_action_payload = ConflictResolutionCreate(
            resolution_action="INVALID_ACTION_CODE",
            actor_id="CTRL",
            actor_role="ROLE",
            rationale_notes="Note",
        )
        with self.assertRaises(HTTPException) as ctx_action:
            conflicts_route_mod.resolve_conflict(cid, bad_action_payload, db=self.db)
        self.assertEqual(ctx_action.exception.status_code, 422)

        # 404 on unknown conflict
        with self.assertRaises(HTTPException) as ctx_404:
            conflicts_route_mod.get_conflict("UNKNOWN-CONFLICT-ID", db=self.db)
        self.assertEqual(ctx_404.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
