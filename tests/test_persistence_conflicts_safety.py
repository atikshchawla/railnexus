"""Persistence tests for Conflicts, Resolutions, Manual Overrides, Operational Blocks, and Safety Invariants."""

from datetime import datetime, timedelta, timezone
import unittest
from uuid import uuid4

from sqlalchemy import create_engine, event
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from backend.database.connection import Base
from backend.database.models import (
    AuditLog,
    BlockDepartment,
    BlockProposal,
    Conflict,
    ConflictResolutionEvent,
    ManualOverride,
    OperationalBlock,
    OptimizationRun,
    Section,
    Station,
    Train,
    TrainMovement,
)
from backend.domain.exceptions import ApprovalBlockedByConflictError, MissingOverrideReasonError
from backend.repositories import (
    AuditRepository,
    ConflictRepository,
    ManualOverrideRepository,
    OperationalBlockRepository,
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


class TestConflictsAndSafetyPersistence(unittest.TestCase):
    def setUp(self):
        self.engine = get_test_engine()
        Base.metadata.create_all(self.engine)
        self.SessionLocal = sessionmaker(bind=self.engine)
        self.db: Session = self.SessionLocal()

        self.opt_repo = OptimizationRepository()
        self.conflict_repo = ConflictRepository()
        self.override_repo = ManualOverrideRepository()
        self.block_repo = OperationalBlockRepository()
        self.audit_repo = AuditRepository()
        self.train_repo = TrainRepository()
        self.movement_repo = TrainMovementRepository()

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

        # Seed optimization run and proposals
        self.now = datetime.now(timezone.utc)
        self.run = OptimizationRun(
            id=str(uuid4()),
            effective_date_start=self.now.date(),
            effective_date_end=self.now.date() + timedelta(days=7),
            corridor_id="AJJ-JTJ",
            input_requests_hash="hash_conflict_test",
            solver_status="OPTIMAL",
        )
        self.prop_a = BlockProposal(
            id=str(uuid4()),
            run_id=self.run.id,
            section_id="AJJ-SHU",
            proposed_start_time=self.now,
            proposed_end_time=self.now + timedelta(hours=3),
            predicted_duration_minutes=180.0,
            confidence_score=0.9,
        )
        self.prop_b = BlockProposal(
            id=str(uuid4()),
            run_id=self.run.id,
            section_id="AJJ-SHU",
            proposed_start_time=self.now + timedelta(hours=2),  # Overlaps with prop_a
            proposed_end_time=self.now + timedelta(hours=5),
            predicted_duration_minutes=180.0,
            confidence_score=0.88,
        )
        self.run.proposals.extend([self.prop_a, self.prop_b])
        self.opt_repo.create_run(self.db, self.run)

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine)

    def test_proposal_to_proposal_conflict_persistence(self):
        """Pre-approval conflict between two candidate proposals persists correctly."""
        c = Conflict(
            id="CONF-PROP-001",
            conflict_type="BLOCK_OVERLAP",
            severity="CRITICAL",
            proposal_a_id=self.prop_a.id,
            proposal_b_id=self.prop_b.id,
            train_movement_id=None,
            track_line="UP",
            overlap_description="Candidate blocks overlap temporally and spatially on UP line",
            spatial_km_start=10.0,
            spatial_km_end=15.0,
            temporal_start=self.now + timedelta(hours=2),
            temporal_end=self.now + timedelta(hours=3),
            status="UNRESOLVED",
            is_blocking=True,
        )
        self.conflict_repo.create(self.db, c)

        loaded = self.conflict_repo.get(self.db, "CONF-PROP-001")
        self.assertIsNotNone(loaded)
        self.assertEqual(loaded.proposal_a.id, self.prop_a.id)
        self.assertEqual(loaded.proposal_b.id, self.prop_b.id)
        self.assertTrue(loaded.is_blocking)
        self.assertEqual(loaded.status, "UNRESOLVED")

    def test_proposal_to_train_conflict_persistence(self):
        """Pre-approval conflict between a proposal and a train movement persists correctly."""
        train = Train(
            id=str(uuid4()),
            train_number="12602",
            service_type="passenger",
            priority_tier="MAIL_EXPRESS",
        )
        self.train_repo.create(self.db, train)
        m = TrainMovement(
            id=str(uuid4()),
            train_id=train.id,
            section_id="AJJ-SHU",
            movement_date=self.now,
            scheduled_minute=60,
            movement_type="SCHEDULED",
        )
        self.movement_repo.create(self.db, m)

        c = Conflict(
            id="CONF-TRAIN-001",
            conflict_type="TRAIN_PATH_OCCUPANCY",
            severity="MAJOR",
            proposal_a_id=self.prop_a.id,
            proposal_b_id=None,
            train_movement_id=m.id,
            track_line="UP",
            overlap_description="Block proposed during scheduled Mail/Express train 12602 path",
            spatial_km_start=5.0,
            spatial_km_end=15.0,
            temporal_start=self.now,
            temporal_end=self.now + timedelta(hours=1),
            status="UNRESOLVED",
            is_blocking=True,
        )
        self.conflict_repo.create(self.db, c)

        loaded = self.conflict_repo.get(self.db, "CONF-TRAIN-001")
        self.assertIsNotNone(loaded)
        self.assertEqual(loaded.train_movement.id, m.id)
        self.assertEqual(loaded.train_movement.train.train_number, "12602")

    def test_conflict_resolution_history_and_single_current(self):
        """Conflict resolution events maintain full history with only one active current resolution."""
        c = Conflict(
            id="CONF-RES-TEST",
            conflict_type="BLOCK_OVERLAP",
            severity="CRITICAL",
            proposal_a_id=self.prop_a.id,
            track_line="UP",
            spatial_km_start=0.0,
            spatial_km_end=5.0,
            temporal_start=self.now,
            temporal_end=self.now + timedelta(hours=1),
            status="UNRESOLVED",
            is_blocking=True,
        )
        self.conflict_repo.create(self.db, c)

        # 1. First resolution event
        e1 = ConflictResolutionEvent(
            conflict_id=c.id,
            event_sequence=1,
            resolution_action="RETARGET_WINDOW",
            actor_id="CONTROLLER_01",
            actor_role="SECTION_CONTROLLER",
            rationale_notes="Shifting proposal start to avoid peak traffic",
            is_current_resolution=True,
        )
        self.conflict_repo.add_resolution_event(self.db, e1)

        # 2. Second resolution event (overriding the first)
        e2 = ConflictResolutionEvent(
            conflict_id=c.id,
            event_sequence=2,
            resolution_action="OVERRIDDEN_BY_CHIEF",
            actor_id="CHIEF_CONTROLLER_01",
            actor_role="CHIEF_CONTROLLER",
            rationale_notes="Authorized joint possession under priority maintenance circular",
            is_current_resolution=True,
        )
        self.conflict_repo.add_resolution_event(self.db, e2)

        # Verify only e2 is current
        history = self.conflict_repo.list_resolution_history(self.db, c.id)
        self.assertEqual(len(history), 2)
        current_events = [e for e in history if e.is_current_resolution]
        self.assertEqual(len(current_events), 1)
        self.assertEqual(current_events[0].id, e2.id)

        # Verify conflict is now marked RESOLVED
        loaded_c = self.conflict_repo.get(self.db, c.id)
        self.assertEqual(loaded_c.status, "RESOLVED")

    def test_manual_override_justification_enforcement(self):
        """Manual overrides require non-empty justification and reject whitespace-only notes."""
        # 1. Blank justification notes fails domain invariant
        with self.assertRaises(MissingOverrideReasonError):
            mo_blank = ManualOverride(
                proposal_id=self.prop_a.id,
                operator_id="CTRL_99",
                operator_role="DY_CHC",
                field_modified="time_window",
                original_start_time=self.now,
                original_end_time=self.now + timedelta(hours=3),
                adjusted_start_time=self.now + timedelta(hours=1),
                adjusted_end_time=self.now + timedelta(hours=4),
                justification_code="TRAFFIC_PRIORITY",
                justification_notes="   ",  # Whitespace only
            )
            self.override_repo.create(self.db, mo_blank)

        # 2. Valid override persists cleanly
        mo_valid = ManualOverride(
            proposal_id=self.prop_a.id,
            operator_id="CTRL_99",
            operator_role="DY_CHC",
            field_modified="time_window",
            original_start_time=self.now,
            original_end_time=self.now + timedelta(hours=3),
            adjusted_start_time=self.now + timedelta(hours=1),
            adjusted_end_time=self.now + timedelta(hours=4),
            justification_code="TRAFFIC_PRIORITY",
            justification_notes="Retargeted by 1 hour to clear Mail/Express 12005",
        )
        self.override_repo.create(self.db, mo_valid)

        loaded_overrides = self.override_repo.list_for_proposal(self.db, self.prop_a.id)
        self.assertEqual(len(loaded_overrides), 1)
        self.assertEqual(loaded_overrides[0].operator_id, "CTRL_99")

    def test_safety_invariant_blocking_conflict_prevents_promotion(self):
        """CRITICAL INVARIANT: A block proposal with an unresolved blocking conflict CANNOT be promoted."""
        # Attach unresolved blocking conflict to prop_a
        c = Conflict(
            id="CONF-BLOCKING-01",
            conflict_type="HEADWAY_VIOLATION",
            severity="CRITICAL",
            proposal_a_id=self.prop_a.id,
            track_line="UP",
            spatial_km_start=10.0,
            spatial_km_end=15.0,
            temporal_start=self.now,
            temporal_end=self.now + timedelta(hours=2),
            status="UNRESOLVED",
            is_blocking=True,
        )
        self.conflict_repo.create(self.db, c)

        # Attempt promotion -> must raise ApprovalBlockedByConflictError
        with self.assertRaises(ApprovalBlockedByConflictError) as ctx:
            self.block_repo.promote_from_proposal(
                self.db,
                proposal_id=self.prop_a.id,
                block_id="BLK-2026-MAS-001",
                lead_department="ENGG",
                approved_by="SR_DOM_MAS",
                start_km=10.0,
                end_km=15.0,
            )
        self.assertIn("CONF-BLOCKING-01", ctx.exception.unresolved_conflict_ids)

        # Resolve the conflict
        res_event = ConflictResolutionEvent(
            conflict_id=c.id,
            event_sequence=1,
            resolution_action="ACCEPTED_WITH_MITIGATION",
            actor_id="SR_DOM_MAS",
            actor_role="DIVISIONAL_OFFICER",
            rationale_notes="Mitigation approved: speed restriction 30 km/h on adjacent road",
            is_current_resolution=True,
        )
        self.conflict_repo.add_resolution_event(self.db, res_event)

        # Now promotion must succeed
        blk = self.block_repo.promote_from_proposal(
            self.db,
            proposal_id=self.prop_a.id,
            block_id="BLK-2026-MAS-001",
            lead_department="ENGG",
            approved_by="SR_DOM_MAS",
            start_km=10.0,
            end_km=15.0,
        )
        self.assertIsNotNone(blk)
        self.assertEqual(blk.status, "APPROVED")
        self.assertEqual(blk.revision_number, 1)

    def test_operational_block_root_uniqueness_and_revision_chain(self):
        """A proposal has at most one root block (revision=1); subsequent changes form a revision chain."""
        # 1. Promote proposal to root block
        root = self.block_repo.promote_from_proposal(
            self.db,
            proposal_id=self.prop_b.id,
            block_id="BLK-ROOT-001",
            lead_department="ENGG",
            approved_by="CPTM_MAS",
            start_km=5.0,
            end_km=12.0,
        )
        self.assertEqual(root.revision_number, 1)
        self.assertTrue(root.is_current)

        # 2. Attempt second root promotion for same proposal -> fails partial unique index
        dup_root = OperationalBlock(
            id="BLK-ROOT-DUP",
            section_id="AJJ-SHU",
            start_km=5.0,
            end_km=12.0,
            scheduled_start=self.now,
            scheduled_end=self.now + timedelta(hours=2),
            origin_proposal_id=self.prop_b.id,
            lead_department="ENGG",
            revision_number=1,  # Duplicate root revision
            is_current=True,
        )
        self.db.add(dup_root)
        with self.assertRaises(IntegrityError):
            self.db.commit()
        self.db.rollback()

        # 3. Create revision (revision 2) through proper revision chaining
        rev2 = self.block_repo.create_revision(
            self.db,
            parent_block_id=root.id,
            new_block_id="BLK-REV2-001",
            scheduled_start=root.scheduled_start + timedelta(minutes=30),
            scheduled_end=root.scheduled_end + timedelta(minutes=30),
            start_km=5.0,
            end_km=12.0,
            approved_by="CPTM_MAS",
        )
        self.assertEqual(rev2.revision_number, 2)
        self.assertTrue(rev2.is_current)
        self.assertEqual(rev2.parent_block_id, root.id)

        # Root block must now be demoted to historical (is_current = False)
        loaded_root = self.block_repo.get(self.db, root.id)
        self.assertFalse(loaded_root.is_current)

    def test_audit_logs_polymorphic_persistence(self):
        """Audit logs store polymorphic entity events with full attribution and payload diff."""
        entry = self.audit_repo.log(
            self.db,
            entity_name="operational_blocks",
            entity_id="BLK-2026-MAS-001",
            action="STATUS_CHANGE",
            actor_id="OPERATOR_RAJESH",
            actor_role="SECTION_CONTROLLER",
            payload_diff={"old_status": "PROPOSED", "new_status": "APPROVED"},
        )
        self.assertIsNotNone(entry.id)

        logs = self.audit_repo.list_for_entity(self.db, "operational_blocks", "BLK-2026-MAS-001")
        self.assertEqual(len(logs), 1)
        self.assertEqual(logs[0].actor_id, "OPERATOR_RAJESH")
        self.assertEqual(logs[0].payload_diff["new_status"], "APPROVED")
