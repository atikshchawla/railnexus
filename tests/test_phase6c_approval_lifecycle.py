"""Unit and integration tests for Phase 6C Authoritative Approval Lifecycle.

Invariants tested:
    1.  PROPOSED proposal + no conflicts → approve → OperationalBlock APPROVED
    2.  PROPOSED proposal + UNRESOLVED BLOCKING conflict → approve → HTTP 409
    3.  PROPOSED proposal + RESOLVED conflict → approve succeeds
    4.  Terminal state: REJECTED proposal cannot be approved → HTTP 409
    5.  end_km <= start_km → approve → HTTP 422
    6.  Manual override all-or-nothing: only justification supplied → HTTP 422
    7.  Manual override all fields → approve → ManualOverride persisted, override_id set
    8.  Non-blocking conflict (is_blocking=False) does not block approval
    9.  Approve creates OperationalBlock with correct origin_proposal_id
    10. Proposal status becomes ACCEPTED after standard approval
    11. Proposal status becomes OVERRIDDEN after override approval
    12. PROPOSED proposal → reject → status REJECTED (historical, no OperationalBlock created)
    13. Terminal state: ACCEPTED proposal cannot be rejected → HTTP 409
    14. Terminal state: OVERRIDDEN proposal cannot be rejected → HTTP 409
    15. Unknown proposal → approve/reject/get → HTTP 404
    16. OperationalBlock revision_number is 1 for a fresh promotion
    17. Block department entries created from proposal departments on approve
    18. True idempotent approval: repeated approval of already approved proposal returns existing block, exactly 1 root block, exactly 1 audit event
    19. Custom scheduled window is used in OperationalBlock when supplied
    20. Conflict where proposal_b_id = target proposal also blocks approval
    21. Manual override cannot bypass an unresolved blocking conflict
    22. Audit logging: successful standard approval creates PROPOSAL_APPROVED audit with actor details
    23. Audit logging: successful override approval creates PROPOSAL_APPROVED audit with override metadata
    24. Audit logging: rejection creates PROPOSAL_REJECTED audit with actor details and reason
    25. Transaction ownership: injected failure before commit rolls back OperationalBlock, proposal, ManualOverride, AuditLog, BlockDepartments
    26. MaintenanceRequest propagation: constituent requests in PROPOSED transition to APPROVED; SUBMITTED requests preserve domain invariant
    27. Authoritative Core approval API routes (/api/approvals, /api/approvals/{id}, /api/approvals/{id}/approve, /api/approvals/{id}/reject)
"""

from __future__ import annotations

import unittest
from datetime import date, datetime, timedelta, timezone
from unittest.mock import patch
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import Session, sessionmaker

import backend.api.routes.approvals as approvals_route

from backend.api.schemas.approval import (
    ApprovalProposalRead,
    OperationalBlockRead,
    ProposalApproveRequest,
    ProposalRejectRequest,
)
from backend.database.connection import Base, get_db
from backend.database.models import (
    AuditLog,
    BlockProposal,
    MaintenanceRequest,
    ManualOverride,
    OperationalBlock,
    OptimizationRun,
    Section,
    Station,
)
from backend.database.models.conflict import Conflict
from backend.database.models.operational_block import BlockDepartment
from backend.database.models.optimization import ProposalDepartment, ProposalItem
from backend.main import app
from backend.repositories.audit_repository import AuditRepository
from backend.repositories.conflict_repository import ConflictRepository
from backend.repositories.operational_block_repository import OperationalBlockRepository
from backend.repositories.optimization_repository import OptimizationRepository
from backend.services.approval_service import ApprovalService


# ---------------------------------------------------------------------------
# Engine helper
# ---------------------------------------------------------------------------

def _make_engine():
    engine = create_engine("sqlite:///:memory:", echo=False)

    @event.listens_for(engine, "connect")
    def _set_fk(dbapi_connection, _connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    return engine


# ---------------------------------------------------------------------------
# Test class
# ---------------------------------------------------------------------------

class TestPhase6CApprovalLifecycle(unittest.TestCase):

    def setUp(self):
        self.engine = _make_engine()
        Base.metadata.create_all(self.engine)
        self.SessionLocal = sessionmaker(bind=self.engine)
        self.db: Session = self.SessionLocal()

        self.opt_repo = OptimizationRepository()
        self.ob_repo = OperationalBlockRepository()
        self.conflict_repo = ConflictRepository()
        self.audit_repo = AuditRepository()

        self.service = ApprovalService(
            optimization_repository=self.opt_repo,
            operational_block_repository=self.ob_repo,
            audit_repository=self.audit_repo,
        )

        # ── Seed topology
        self.station_ajj = Station(
            code="AJJ", name="Arakkonam Jn", division="MAS", zone="SR", km_location=68.5
        )
        self.station_shu = Station(
            code="SHU", name="Sholinghur", division="MAS", zone="SR", km_location=89.8
        )
        self.section = Section(
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
        self.db.add_all([self.station_ajj, self.station_shu, self.section])
        self.db.commit()

        # ── Seed OptimizationRun
        self.base_time = datetime(2026, 9, 26, 8, 0, 0)
        self.run = OptimizationRun(
            id=str(uuid4()),
            planning_horizon="WEEKLY",
            planning_cycle_label="2026-W39",
            effective_date_start=date(2026, 9, 26),
            effective_date_end=date(2026, 10, 3),
            corridor_id="AJJ-JTJ",
            input_requests_hash="hash-6c-tests",
            input_snapshot_json={},
            algorithm_version="cp_sat_v2.1",
            weights_json={},
            solver_status="OPTIMAL",
            solver_duration_ms=42,
            created_at=self.base_time,
        )
        self.db.add(self.run)
        self.db.commit()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _make_proposal(
        self,
        *,
        section_id: str = "AJJ-SHU",
        status: str = "PROPOSED",
        offset_hours: int = 0,
    ) -> BlockProposal:
        start = self.base_time + timedelta(hours=offset_hours)
        end = start + timedelta(hours=2)
        p = BlockProposal(
            id=str(uuid4()),
            run_id=self.run.id,
            section_id=section_id,
            proposed_start_time=start,
            proposed_end_time=end,
            predicted_duration_minutes=120.0,
            possession_saving_minutes=10.0,
            train_impact_minutes=5.0,
            trains_affected_count=1,
            confidence_score=0.9,
            top_factors_json={},
            safety_cautions=[],
            status=status,
            created_at=self.base_time,
        )
        self.db.add(p)
        self.db.commit()
        self.db.refresh(p)
        return p

    def _make_unresolved_blocking_conflict(self, proposal_a_id: str, proposal_b_id: str) -> Conflict:
        c = Conflict(
            id=f"CONF-{uuid4().hex[:12].upper()}",
            conflict_type="SECTION_OCCUPATION",
            severity="CRITICAL",
            proposal_a_id=proposal_a_id,
            proposal_b_id=proposal_b_id,
            train_movement_id=None,
            resulting_block_id=None,
            track_line="UP",
            overlap_description="Test overlap",
            spatial_km_start=68.5,
            spatial_km_end=89.8,
            temporal_start=self.base_time,
            temporal_end=self.base_time + timedelta(hours=1),
            status="UNRESOLVED",
            is_blocking=True,
            created_at=self.base_time,
        )
        self.db.add(c)
        self.db.commit()
        return c

    def _make_non_blocking_conflict(self, proposal_id: str) -> Conflict:
        c = Conflict(
            id=f"CONF-{uuid4().hex[:12].upper()}",
            conflict_type="TRAIN_CROSSING",
            severity="LOW",
            proposal_a_id=proposal_id,
            proposal_b_id=None,
            train_movement_id=None,
            resulting_block_id=None,
            track_line="UP",
            overlap_description="Non-blocking advisory",
            spatial_km_start=68.5,
            spatial_km_end=89.8,
            temporal_start=self.base_time,
            temporal_end=self.base_time + timedelta(hours=1),
            status="UNRESOLVED",
            is_blocking=False,
            created_at=self.base_time,
        )
        self.db.add(c)
        self.db.commit()
        return c

    def _approve_payload(self, block_id: str | None = None, **kwargs) -> ProposalApproveRequest:
        defaults = {
            "block_id": block_id or f"BLK-{uuid4().hex[:8].upper()}",
            "approved_by": "operator-001",
            "lead_department": "ENGG",
            "start_km": 68.5,
            "end_km": 89.8,
            "track_line": "UP",
        }
        defaults.update(kwargs)
        return ProposalApproveRequest(**defaults)

    # ------------------------------------------------------------------
    # 1. Happy-path standard approval
    # ------------------------------------------------------------------

    def test_01_proposed_no_conflicts_approve_creates_operational_block(self):
        """1. PROPOSED proposal + no conflicts → approve → OperationalBlock APPROVED."""
        proposal = self._make_proposal()
        payload = self._approve_payload(block_id="BLK-TEST-001")

        block = self.service.approve_proposal(self.db, proposal.id, payload)

        self.assertEqual(block.id, "BLK-TEST-001")
        self.assertEqual(block.status, "APPROVED")
        self.assertEqual(block.origin_proposal_id, proposal.id)
        self.assertEqual(block.approved_by, "operator-001")
        self.assertIsNotNone(block.approved_at)
        self.assertEqual(block.revision_number, 1)
        self.assertTrue(block.is_current)

    # ------------------------------------------------------------------
    # 2. Unresolved blocking conflict blocks approval
    # ------------------------------------------------------------------

    def test_02_unresolved_blocking_conflict_raises_409(self):
        """2. PROPOSED + UNRESOLVED BLOCKING conflict → HTTP 409."""
        proposal_a = self._make_proposal(offset_hours=0)
        proposal_b = self._make_proposal(offset_hours=1)
        self._make_unresolved_blocking_conflict(proposal_a.id, proposal_b.id)

        payload = self._approve_payload()
        with self.assertRaises(HTTPException) as ctx:
            self.service.approve_proposal(self.db, proposal_a.id, payload)
        self.assertEqual(ctx.exception.status_code, 409)
        self.assertIn("unresolved blocking conflict", ctx.exception.detail.lower())

    # ------------------------------------------------------------------
    # 3. RESOLVED conflict no longer blocks
    # ------------------------------------------------------------------

    def test_03_resolved_conflict_does_not_block_approval(self):
        """3. PROPOSED + RESOLVED conflict → approve succeeds."""
        proposal_a = self._make_proposal(offset_hours=0)
        proposal_b = self._make_proposal(offset_hours=1)
        conflict = self._make_unresolved_blocking_conflict(proposal_a.id, proposal_b.id)

        conflict.status = "RESOLVED"
        self.db.commit()

        payload = self._approve_payload()
        block = self.service.approve_proposal(self.db, proposal_a.id, payload)
        self.assertEqual(block.status, "APPROVED")

    # ------------------------------------------------------------------
    # 4. Terminal state: REJECTED proposal cannot be approved
    # ------------------------------------------------------------------

    def test_04_terminal_state_rejected_cannot_be_approved(self):
        """4. Proposal with status REJECTED → approve → HTTP 409."""
        proposal = self._make_proposal(status="REJECTED")
        payload = self._approve_payload()

        with self.assertRaises(HTTPException) as ctx:
            self.service.approve_proposal(self.db, proposal.id, payload)
        self.assertEqual(ctx.exception.status_code, 409)
        self.assertIn("REJECTED", ctx.exception.detail)

    # ------------------------------------------------------------------
    # 5. end_km <= start_km raises 422
    # ------------------------------------------------------------------

    def test_05_invalid_km_range_raises_422(self):
        """5. end_km <= start_km → HTTP 422."""
        proposal = self._make_proposal()
        payload = ProposalApproveRequest(
            block_id="BLK-BADKM",
            approved_by="op-001",
            lead_department="ENGG",
            start_km=100.0,
            end_km=50.0,
            track_line="UP",
        )

        with self.assertRaises(HTTPException) as ctx:
            self.service.approve_proposal(self.db, proposal.id, payload)
        self.assertEqual(ctx.exception.status_code, 422)
        self.assertIn("end_km", ctx.exception.detail)

    # ------------------------------------------------------------------
    # 6. Partial override fields raise 422
    # ------------------------------------------------------------------

    def test_06_partial_override_fields_raises_422(self):
        """6. Override justification without code/role → HTTP 422."""
        proposal = self._make_proposal()
        payload = ProposalApproveRequest(
            block_id="BLK-OVERRIDE-PARTIAL",
            approved_by="op-001",
            lead_department="ENGG",
            start_km=68.5,
            end_km=89.8,
            track_line="UP",
            override_justification="Schedule adjusted for traffic constraints",
        )

        with self.assertRaises(HTTPException) as ctx:
            self.service.approve_proposal(self.db, proposal.id, payload)
        self.assertEqual(ctx.exception.status_code, 422)
        self.assertIn("override", ctx.exception.detail.lower())

    # ------------------------------------------------------------------
    # 7. Full override fields create ManualOverride record
    # ------------------------------------------------------------------

    def test_07_full_override_creates_manual_override_record(self):
        """7. All override fields present → approve → ManualOverride persisted."""
        proposal = self._make_proposal()
        payload = ProposalApproveRequest(
            block_id="BLK-OVERRIDE-FULL",
            approved_by="senior-op-001",
            lead_department="ENGG",
            start_km=68.5,
            end_km=89.8,
            track_line="UP",
            override_justification="Adjusted for special traffic congestion event",
            override_code="TRAFFIC_CONSTRAINT",
            operator_role="SENIOR_CONTROLLER",
        )

        block = self.service.approve_proposal(self.db, proposal.id, payload)

        self.assertEqual(block.status, "APPROVED")
        self.assertIsNotNone(block.override_id)

        self.db.expire_all()
        refreshed_proposal = self.db.get(BlockProposal, proposal.id)
        self.assertEqual(refreshed_proposal.status, "OVERRIDDEN")

        override = self.db.get(ManualOverride, block.override_id)
        self.assertIsNotNone(override)
        self.assertEqual(override.operator_role, "SENIOR_CONTROLLER")
        self.assertEqual(override.justification_code, "TRAFFIC_CONSTRAINT")

    # ------------------------------------------------------------------
    # 8. Non-blocking conflict does NOT block approval
    # ------------------------------------------------------------------

    def test_08_non_blocking_conflict_does_not_block(self):
        """8. Non-blocking conflict (is_blocking=False) → approve succeeds."""
        proposal = self._make_proposal()
        self._make_non_blocking_conflict(proposal.id)

        payload = self._approve_payload()
        block = self.service.approve_proposal(self.db, proposal.id, payload)
        self.assertEqual(block.status, "APPROVED")

    # ------------------------------------------------------------------
    # 9. OperationalBlock has correct origin_proposal_id
    # ------------------------------------------------------------------

    def test_09_operational_block_origin_proposal_id(self):
        """9. Approved OperationalBlock references the correct proposal."""
        proposal = self._make_proposal()
        payload = self._approve_payload(block_id="BLK-ORIGIN-CHECK")

        block = self.service.approve_proposal(self.db, proposal.id, payload)
        self.assertEqual(block.origin_proposal_id, proposal.id)

    # ------------------------------------------------------------------
    # 10. Proposal status becomes ACCEPTED after standard approval
    # ------------------------------------------------------------------

    def test_10_proposal_status_accepted_after_standard_approval(self):
        """10. Proposal status = ACCEPTED after approval without override."""
        proposal = self._make_proposal()
        payload = self._approve_payload()

        self.service.approve_proposal(self.db, proposal.id, payload)

        self.db.expire_all()
        refreshed = self.db.get(BlockProposal, proposal.id)
        self.assertEqual(refreshed.status, "ACCEPTED")

    # ------------------------------------------------------------------
    # 11. Proposal status becomes OVERRIDDEN after override approval
    # ------------------------------------------------------------------

    def test_11_proposal_status_overridden_after_override_approval(self):
        """11. Proposal status = OVERRIDDEN after approval with override fields."""
        proposal = self._make_proposal()
        payload = ProposalApproveRequest(
            block_id="BLK-OVERRIDDEN-STATUS",
            approved_by="controller-001",
            lead_department="SIG",
            start_km=68.5,
            end_km=89.8,
            track_line="UP",
            override_justification="Emergency re-schedule due to flood alert",
            override_code="SAFETY_CRITICAL",
            operator_role="AREA_CONTROLLER",
        )

        self.service.approve_proposal(self.db, proposal.id, payload)

        self.db.expire_all()
        refreshed = self.db.get(BlockProposal, proposal.id)
        self.assertEqual(refreshed.status, "OVERRIDDEN")

    # ------------------------------------------------------------------
    # 12. Standard rejection
    # ------------------------------------------------------------------

    def test_12_proposed_proposal_can_be_rejected(self):
        """12. PROPOSED proposal → reject → status REJECTED (historical, no block created)."""
        proposal = self._make_proposal()
        payload = ProposalRejectRequest(
            rejected_by="controller-002",
            rejection_reason="Section conflict cannot be resolved in this planning cycle",
        )

        result = self.service.reject_proposal(self.db, proposal.id, payload)

        self.assertEqual(result["proposal_id"], proposal.id)
        self.assertEqual(result["status"], "REJECTED")
        self.assertEqual(result["rejected_by"], "controller-002")
        self.assertIn("planning cycle", result["rejection_reason"])

        self.db.expire_all()
        refreshed = self.db.get(BlockProposal, proposal.id)
        self.assertEqual(refreshed.status, "REJECTED")

        # No operational block was created
        blocks = list(self.db.scalars(select(OperationalBlock).where(OperationalBlock.origin_proposal_id == proposal.id)))
        self.assertEqual(len(blocks), 0)

    # ------------------------------------------------------------------
    # 13. Terminal state: ACCEPTED proposal cannot be rejected
    # ------------------------------------------------------------------

    def test_13_terminal_state_accepted_cannot_be_rejected(self):
        """13. ACCEPTED proposal → reject → HTTP 409."""
        proposal = self._make_proposal(status="ACCEPTED")
        payload = ProposalRejectRequest(
            rejected_by="op-001",
            rejection_reason="Trying to reject after acceptance",
        )

        with self.assertRaises(HTTPException) as ctx:
            self.service.reject_proposal(self.db, proposal.id, payload)
        self.assertEqual(ctx.exception.status_code, 409)
        self.assertIn("ACCEPTED", ctx.exception.detail)

    # ------------------------------------------------------------------
    # 14. Terminal state: OVERRIDDEN proposal cannot be rejected
    # ------------------------------------------------------------------

    def test_14_terminal_state_overridden_cannot_be_rejected(self):
        """14. OVERRIDDEN proposal → reject → HTTP 409."""
        proposal = self._make_proposal(status="OVERRIDDEN")
        payload = ProposalRejectRequest(
            rejected_by="op-001",
            rejection_reason="Trying to reject after override",
        )

        with self.assertRaises(HTTPException) as ctx:
            self.service.reject_proposal(self.db, proposal.id, payload)
        self.assertEqual(ctx.exception.status_code, 409)
        self.assertIn("OVERRIDDEN", ctx.exception.detail)

    # ------------------------------------------------------------------
    # 15. Unknown proposal returns 404
    # ------------------------------------------------------------------

    def test_15_unknown_proposal_returns_404(self):
        """15. Unknown proposal → approve/reject/get → HTTP 404."""
        fake_id = str(uuid4())
        payload = self._approve_payload()

        with self.assertRaises(HTTPException) as ctx:
            self.service.approve_proposal(self.db, fake_id, payload)
        self.assertEqual(ctx.exception.status_code, 404)

        reject_payload = ProposalRejectRequest(
            rejected_by="op-001", rejection_reason="Reason"
        )
        with self.assertRaises(HTTPException) as ctx:
            self.service.reject_proposal(self.db, fake_id, reject_payload)
        self.assertEqual(ctx.exception.status_code, 404)

        with self.assertRaises(HTTPException) as ctx:
            self.service.get_proposal_view(self.db, fake_id)
        self.assertEqual(ctx.exception.status_code, 404)

    # ------------------------------------------------------------------
    # 16. OperationalBlock revision_number = 1 for fresh promotion
    # ------------------------------------------------------------------

    def test_16_fresh_promotion_has_revision_number_one(self):
        """16. Fresh promotion → OperationalBlock.revision_number = 1."""
        proposal = self._make_proposal()
        payload = self._approve_payload(block_id="BLK-REV-001")

        block = self.service.approve_proposal(self.db, proposal.id, payload)
        self.assertEqual(block.revision_number, 1)
        self.assertIsNone(block.parent_block_id)

    # ------------------------------------------------------------------
    # 17. Department entries created from proposal departments
    # ------------------------------------------------------------------

    def test_17_proposal_departments_copied_to_operational_block(self):
        """17. BlockDepartment entries from proposal departments are created."""
        proposal = self._make_proposal()

        for dept_name in ["ENGG", "SIG"]:
            pd = ProposalDepartment(
                proposal_id=proposal.id,
                department=dept_name,
                work_description=f"{dept_name} maintenance",
                demanded_duration_minutes=60,
                requires_power_isolation=False,
                requires_disconnection=False,
            )
            self.db.add(pd)
        self.db.commit()

        payload = ProposalApproveRequest(
            block_id="BLK-DEPT-CHECK",
            approved_by="operator-001",
            lead_department="ENGG",
            start_km=68.5,
            end_km=89.8,
            track_line="UP",
        )
        block = self.service.approve_proposal(self.db, proposal.id, payload)

        self.db.expire_all()
        refreshed_block = self.ob_repo.get(self.db, block.id)
        dept_names = {bd.department for bd in refreshed_block.departments}
        self.assertIn("ENGG", dept_names)
        self.assertIn("SIG", dept_names)

    # ------------------------------------------------------------------
    # 18. True idempotent approval
    # ------------------------------------------------------------------

    def test_18_idempotent_repeated_approval(self):
        """18. Repeated approval of an already-approved proposal is idempotent."""
        proposal = self._make_proposal()
        payload1 = self._approve_payload(block_id="BLK-IDEMPOTENT-01")

        # First approval
        block1 = self.service.approve_proposal(self.db, proposal.id, payload1)
        self.assertEqual(block1.id, "BLK-IDEMPOTENT-01")
        self.assertEqual(block1.status, "APPROVED")

        # Second approval of the same proposal with different block_id
        payload2 = self._approve_payload(block_id="BLK-IDEMPOTENT-02")
        block2 = self.service.approve_proposal(self.db, proposal.id, payload2)

        # Verify idempotency requirements:
        # 1. Successful second response
        self.assertIsNotNone(block2)
        # 2. Same OperationalBlock returned (original ID preserved)
        self.assertEqual(block2.id, "BLK-IDEMPOTENT-01")
        # 3. Exactly one root OperationalBlock for this proposal in the database
        all_blocks = list(
            self.db.scalars(
                select(OperationalBlock).where(OperationalBlock.origin_proposal_id == proposal.id)
            )
        )
        self.assertEqual(len(all_blocks), 1)
        self.assertEqual(all_blocks[0].revision_number, 1)

        # 4. Exactly one approval audit event in the database
        audits = self.audit_repo.list_for_entity(self.db, "BlockProposal", proposal.id)
        approval_audits = [a for a in audits if a.action == "PROPOSAL_APPROVED"]
        self.assertEqual(len(approval_audits), 1)

    # ------------------------------------------------------------------
    # 19. Custom scheduled window is used in OperationalBlock
    # ------------------------------------------------------------------

    def test_19_custom_schedule_overrides_proposed_window(self):
        """19. Custom scheduled window is applied to OperationalBlock."""
        proposal = self._make_proposal()
        custom_start = datetime(2026, 9, 26, 10, 0, 0)
        custom_end = datetime(2026, 9, 26, 14, 0, 0)

        payload = ProposalApproveRequest(
            block_id="BLK-CUSTOM-SCHED",
            approved_by="op-002",
            lead_department="ENGG",
            start_km=68.5,
            end_km=89.8,
            track_line="UP",
            custom_scheduled_start=custom_start,
            custom_scheduled_end=custom_end,
        )

        block = self.service.approve_proposal(self.db, proposal.id, payload)
        self.assertEqual(block.scheduled_start, custom_start)
        self.assertEqual(block.scheduled_end, custom_end)

    # ------------------------------------------------------------------
    # 20. Conflict on proposal_b_id also blocks approval of proposal_b
    # ------------------------------------------------------------------

    def test_20_blocking_conflict_on_proposal_b_side_also_blocked(self):
        """20. Conflict where proposal_b_id = target proposal also blocks."""
        proposal_a = self._make_proposal(offset_hours=0)
        proposal_b = self._make_proposal(offset_hours=1)
        min_id = min(proposal_a.id, proposal_b.id)
        max_id = max(proposal_a.id, proposal_b.id)
        self._make_unresolved_blocking_conflict(min_id, max_id)

        payload = self._approve_payload()
        with self.assertRaises(HTTPException) as ctx:
            self.service.approve_proposal(self.db, max_id, payload)
        self.assertEqual(ctx.exception.status_code, 409)

    # ------------------------------------------------------------------
    # 21. Override cannot bypass blocking conflict
    # ------------------------------------------------------------------

    def test_21_override_cannot_bypass_blocking_conflict(self):
        """21. Override fields supplied, but unresolved blocking conflict present → 409."""
        proposal_a = self._make_proposal(offset_hours=0)
        proposal_b = self._make_proposal(offset_hours=1)
        self._make_unresolved_blocking_conflict(proposal_a.id, proposal_b.id)

        payload = ProposalApproveRequest(
            block_id="BLK-BYPASS-FAIL",
            approved_by="senior-controller-99",
            lead_department="ENGG",
            start_km=68.5,
            end_km=89.8,
            track_line="UP",
            override_justification="Emergency priority override attempted",
            override_code="EMERGENCY_OVERRIDE",
            operator_role="CHIEF_CONTROLLER",
        )

        with self.assertRaises(HTTPException) as ctx:
            self.service.approve_proposal(self.db, proposal_a.id, payload)
        self.assertEqual(ctx.exception.status_code, 409)
        self.assertIn("unresolved blocking conflict", ctx.exception.detail.lower())

        # Verify rollback: no override or block staged
        overrides = list(self.db.scalars(select(ManualOverride).where(ManualOverride.proposal_id == proposal_a.id)))
        self.assertEqual(len(overrides), 0)
        blocks = list(self.db.scalars(select(OperationalBlock).where(OperationalBlock.origin_proposal_id == proposal_a.id)))
        self.assertEqual(len(blocks), 0)

    # ------------------------------------------------------------------
    # 22. Audit logging: successful normal approval
    # ------------------------------------------------------------------

    def test_22_audit_successful_normal_approval(self):
        """22. Successful normal approval creates PROPOSAL_APPROVED audit."""
        proposal = self._make_proposal()
        payload = self._approve_payload(block_id="BLK-AUDIT-NORMAL")

        self.service.approve_proposal(self.db, proposal.id, payload)

        audits = self.audit_repo.list_for_entity(self.db, "BlockProposal", proposal.id)
        self.assertEqual(len(audits), 1)
        entry = audits[0]
        self.assertEqual(entry.entity_name, "BlockProposal")
        self.assertEqual(entry.entity_id, proposal.id)
        self.assertEqual(entry.action, "PROPOSAL_APPROVED")
        self.assertEqual(entry.actor_id, "operator-001")
        self.assertEqual(entry.actor_role, "SECTION_CONTROLLER")
        self.assertEqual(entry.payload_diff["block_id"], "BLK-AUDIT-NORMAL")
        self.assertEqual(entry.payload_diff["status"], "ACCEPTED")
        self.assertIsNotNone(entry.created_at)

    # ------------------------------------------------------------------
    # 23. Audit logging: successful override approval
    # ------------------------------------------------------------------

    def test_23_audit_successful_override_approval(self):
        """23. Successful override approval creates PROPOSAL_APPROVED audit with override metadata."""
        proposal = self._make_proposal()
        payload = ProposalApproveRequest(
            block_id="BLK-AUDIT-OVERRIDE",
            approved_by="senior-controller-01",
            lead_department="SIG",
            start_km=68.5,
            end_km=89.8,
            track_line="UP",
            override_justification="Special corridor window extension",
            override_code="SPECIAL_WINDOW",
            operator_role="SR_OPERATIONS_MANAGER",
        )

        self.service.approve_proposal(self.db, proposal.id, payload)

        audits = self.audit_repo.list_for_entity(self.db, "BlockProposal", proposal.id)
        self.assertEqual(len(audits), 1)
        entry = audits[0]
        self.assertEqual(entry.entity_name, "BlockProposal")
        self.assertEqual(entry.entity_id, proposal.id)
        self.assertEqual(entry.action, "PROPOSAL_APPROVED")
        self.assertEqual(entry.actor_id, "senior-controller-01")
        self.assertEqual(entry.actor_role, "SR_OPERATIONS_MANAGER")
        self.assertEqual(entry.payload_diff["status"], "OVERRIDDEN")
        self.assertEqual(entry.payload_diff["override_code"], "SPECIAL_WINDOW")
        self.assertEqual(entry.payload_diff["override_justification"], "Special corridor window extension")
        self.assertEqual(entry.payload_diff["operator_role"], "SR_OPERATIONS_MANAGER")
        self.assertIn("override_id", entry.payload_diff)

    # ------------------------------------------------------------------
    # 24. Audit logging: successful rejection
    # ------------------------------------------------------------------

    def test_24_audit_successful_rejection(self):
        """24. Rejection creates PROPOSAL_REJECTED audit with actor_id, actor_role, and reason."""
        proposal = self._make_proposal()
        payload = ProposalRejectRequest(
            rejected_by="shift-controller-42",
            rejection_reason="Excessive passenger train impact on UP line",
            operator_role="SHIFT_IN_CHARGE",
        )

        self.service.reject_proposal(self.db, proposal.id, payload)

        audits = self.audit_repo.list_for_entity(self.db, "BlockProposal", proposal.id)
        self.assertEqual(len(audits), 1)
        entry = audits[0]
        self.assertEqual(entry.entity_name, "BlockProposal")
        self.assertEqual(entry.entity_id, proposal.id)
        self.assertEqual(entry.action, "PROPOSAL_REJECTED")
        self.assertEqual(entry.actor_id, "shift-controller-42")
        self.assertEqual(entry.actor_role, "SHIFT_IN_CHARGE")
        self.assertEqual(entry.payload_diff["status"], "REJECTED")
        self.assertEqual(entry.payload_diff["rejection_reason"], "Excessive passenger train impact on UP line")

    # ------------------------------------------------------------------
    # 25. Transaction rollback on injected failure
    # ------------------------------------------------------------------

    def test_25_transaction_rollback_on_injected_failure(self):
        """25. Failure injected before commit rolls back OperationalBlock, ManualOverride, AuditLog, departments."""
        proposal = self._make_proposal()
        payload = ProposalApproveRequest(
            block_id="BLK-ROLLBACK-TEST",
            approved_by="tester-001",
            lead_department="ENGG",
            start_km=68.5,
            end_km=89.8,
            track_line="UP",
            override_justification="Test failure injection",
            override_code="TEST_CODE",
            operator_role="TESTER",
        )

        # Inject failure in audit_repo.log right before commit
        with patch.object(self.audit_repo, "log", side_effect=RuntimeError("Simulated database failure before commit")):
            with self.assertRaises(RuntimeError):
                self.service.approve_proposal(self.db, proposal.id, payload)

        # Verify atomic rollback
        self.db.expire_all()

        # 1. No OperationalBlock
        block = self.db.get(OperationalBlock, "BLK-ROLLBACK-TEST")
        self.assertIsNone(block)

        # 2. Proposal unchanged
        refreshed_proposal = self.db.get(BlockProposal, proposal.id)
        self.assertEqual(refreshed_proposal.status, "PROPOSED")

        # 3. No ManualOverride
        overrides = list(self.db.scalars(select(ManualOverride).where(ManualOverride.proposal_id == proposal.id)))
        self.assertEqual(len(overrides), 0)

        # 4. No AuditLog
        audits = self.audit_repo.list_for_entity(self.db, "BlockProposal", proposal.id)
        self.assertEqual(len(audits), 0)

        # 5. No partial department rows
        departments = list(self.db.scalars(select(BlockDepartment).where(BlockDepartment.block_id == "BLK-ROLLBACK-TEST")))
        self.assertEqual(len(departments), 0)

    # ------------------------------------------------------------------
    # 26. Constituent MaintenanceRequest propagation
    # ------------------------------------------------------------------

    def test_26_constituent_maintenance_request_propagation(self):
        """26. Propagate constituent requests only if state machine permits (PROPOSED → APPROVED)."""
        proposal = self._make_proposal()

        # Create two maintenance requests:
        # req1 is in PROPOSED status (allowed to transition to APPROVED)
        req1 = MaintenanceRequest(
            id=f"MR-PROPOSED-{uuid4().hex[:6]}",
            section_id="AJJ-SHU",
            department="ENGG",
            work_type="TRACK_MAINTENANCE",
            status="PROPOSED",
            location_km=70.0,
            demanded_duration_minutes=60,
            priority="HIGH",
            created_at=self.base_time,
        )
        # req2 is in SUBMITTED status (transition to APPROVED is forbidden)
        req2 = MaintenanceRequest(
            id=f"MR-SUBMITTED-{uuid4().hex[:6]}",
            section_id="AJJ-SHU",
            department="SIG",
            work_type="SIGNAL_INTERLOCK",
            status="SUBMITTED",
            location_km=72.0,
            demanded_duration_minutes=45,
            priority="MEDIUM",
            created_at=self.base_time,
        )
        self.db.add_all([req1, req2])
        self.db.flush()

        item1 = ProposalItem(proposal_id=proposal.id, maintenance_request_id=req1.id, sequence_order=1)
        item2 = ProposalItem(proposal_id=proposal.id, maintenance_request_id=req2.id, sequence_order=2)
        proposal.items.extend([item1, item2])
        self.db.commit()

        payload = self._approve_payload()
        self.service.approve_proposal(self.db, proposal.id, payload)

        self.db.expire_all()
        refreshed_req1 = self.db.get(MaintenanceRequest, req1.id)
        refreshed_req2 = self.db.get(MaintenanceRequest, req2.id)

        # PROPOSED request legally transitioned to APPROVED
        self.assertEqual(refreshed_req1.status, "APPROVED")
        # SUBMITTED request did NOT transition because domain state machine prohibits SUBMITTED → APPROVED
        self.assertEqual(refreshed_req2.status, "SUBMITTED")

    # ------------------------------------------------------------------
    # 27. Authoritative Core approval API routes
    # ------------------------------------------------------------------

    def test_27_api_contract_registered_paths(self):
        """27. Authoritative Core approval endpoints are registered and operational."""
        # 1. Check OpenAPI paths
        schema = app.openapi()
        paths = schema.get("paths", {})

        self.assertIn("/api/approvals", paths)
        self.assertIn("get", paths["/api/approvals"])

        self.assertIn("/api/approvals/{proposal_id}", paths)
        self.assertIn("get", paths["/api/approvals/{proposal_id}"])

        self.assertIn("/api/approvals/{proposal_id}/approve", paths)
        self.assertIn("post", paths["/api/approvals/{proposal_id}/approve"])

        self.assertIn("/api/approvals/{proposal_id}/reject", paths)
        self.assertIn("post", paths["/api/approvals/{proposal_id}/reject"])

        # No /api/proposals approval endpoints
        self.assertNotIn("/api/proposals/{proposal_id}/approve", paths)
        self.assertNotIn("/api/proposals/{proposal_id}/reject", paths)

        # 2. Route handler execution verification
        # Create a proposal to test API
        proposal = self._make_proposal()

        # GET /api/approvals handler
        proposals_list = approvals_route.list_approvals(db=self.db)
        self.assertIsInstance(proposals_list, list)
        self.assertTrue(any(p.id == proposal.id for p in proposals_list))

        # GET /api/approvals/{proposal_id} handler
        proposal_view = approvals_route.get_approval(proposal.id, db=self.db)
        self.assertEqual(proposal_view.id, proposal.id)
        self.assertEqual(proposal_view.status, "PROPOSED")
        self.assertFalse(proposal_view.has_blocking_conflicts)

        # POST /api/approvals/{proposal_id}/approve handler
        approve_body = ProposalApproveRequest(
            block_id="BLK-API-001",
            approved_by="api-controller",
            lead_department="ENGG",
            start_km=68.5,
            end_km=89.8,
            track_line="UP",
        )
        approved_block = approvals_route.approve_proposal(proposal.id, approve_body, db=self.db)
        self.assertEqual(approved_block.id, "BLK-API-001")
        self.assertEqual(approved_block.status, "APPROVED")

        # GET /api/approvals/{proposal_id} after approval shows operational block
        proposal_view_after = approvals_route.get_approval(proposal.id, db=self.db)
        self.assertEqual(proposal_view_after.status, "ACCEPTED")
        self.assertEqual(proposal_view_after.operational_block_id, "BLK-API-001")

        # POST /api/approvals/{proposal_id}/reject on second proposal
        proposal2 = self._make_proposal(offset_hours=3)
        reject_body = ProposalRejectRequest(
            rejected_by="api-controller",
            rejection_reason="Maintenance postponed to next week",
        )
        rejected_resp = approvals_route.reject_proposal(proposal2.id, reject_body, db=self.db)
        self.assertEqual(rejected_resp["status"], "REJECTED")


if __name__ == "__main__":
    unittest.main()
