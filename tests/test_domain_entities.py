"""Unit tests for domain entities (MaintenanceRequest, Conflict, ManualOverride, OperationalBlock)."""

from datetime import datetime, timezone, timedelta
import unittest

from backend.domain.entities import (
    Conflict,
    MaintenanceRequest,
    ManualOverride,
    OperationalBlock,
)
from backend.domain.enums import (
    Category,
    ConflictSeverity,
    ConflictStatus,
    ConflictType,
    Department,
    MaintenanceStatus,
    OperationalBlockStatus,
    ResolutionAction,
    TrackLine,
    UrgencyTier,
)
from backend.domain.exceptions import (
    ApprovalBlockedByConflictError,
    InvalidStateTransitionError,
    MissingOverrideReasonError,
)
from backend.domain.value_objects import KmRange, TimeWindow


class TestDomainEntities(unittest.TestCase):
    def setUp(self):
        self.base_time = datetime(2026, 9, 26, 11, 0, tzinfo=timezone.utc)
        self.time_window = TimeWindow(self.base_time, self.base_time + timedelta(hours=2))
        self.km_range = KmRange(start_km=45.0, end_km=48.5)

    def test_maintenance_request_creation_and_urgency(self):
        mr = MaintenanceRequest(
            id="REQ-001",
            section_id="MAS-AJJ-SHU",
            department=Department.ENGG,
            category=Category.IMR,
            work_type="RAIL_REPLACEMENT",
            km_range=self.km_range,
            deadline_hours=18.0, # < 24h
            status=MaintenanceStatus.SUBMITTED,
        )
        self.assertEqual(mr.urgency_tier, UrgencyTier.CRITICAL)
        self.assertEqual(mr.category, Category.IMR)

        # Transition to VALIDATED
        mr.transition_to(MaintenanceStatus.VALIDATED)
        self.assertEqual(mr.status, MaintenanceStatus.VALIDATED)

        # Illegal transition directly to COMPLETED raises error
        with self.assertRaises(InvalidStateTransitionError):
            mr.transition_to(MaintenanceStatus.COMPLETED)

    def test_conflict_lifecycle(self):
        conflict = Conflict(
            id="CONF-101",
            conflict_type=ConflictType.TRAIN_CROSSING,
            severity=ConflictSeverity.CRITICAL,
            block_a_id="BLK-001",
            train_number="12608",
            km_location=46.2,
            time_window=self.time_window,
            status=ConflictStatus.UNRESOLVED,
        )
        self.assertEqual(conflict.status, ConflictStatus.UNRESOLVED)

        # Resolve conflict
        conflict.resolve(
            action=ResolutionAction.SEQUENCED,
            resolved_by="Controller / MAS",
            notes="Delayed train 12608 by 15 mins to clear block",
        )
        self.assertEqual(conflict.status, ConflictStatus.RESOLVED)
        self.assertEqual(conflict.resolution_action, ResolutionAction.SEQUENCED)
        self.assertEqual(conflict.resolved_by, "Controller / MAS")
        self.assertIsNotNone(conflict.resolved_at)

    def test_manual_override_creation_and_validation(self):
        adjusted_window = self.time_window.shift_by(30) # +30 min shift
        override = ManualOverride(
            id="OVR-01",
            proposal_id="PROP-99",
            operator_id="USR-CONTROLLER-01",
            operator_role="Section Controller",
            original_time_window=self.time_window,
            adjusted_time_window=adjusted_window,
            justification_reason="Operating priority for Vande Bharat Express",
        )
        self.assertEqual(override.start_delta_minutes, 30.0)
        self.assertEqual(override.duration_delta_minutes, 0.0)

        # Override without reason is rejected
        with self.assertRaises(MissingOverrideReasonError):
            ManualOverride(
                id="OVR-02",
                proposal_id="PROP-99",
                operator_id="USR-CONTROLLER-01",
                operator_role="Section Controller",
                original_time_window=self.time_window,
                adjusted_time_window=adjusted_window,
                justification_reason="",
            )

        # Override without operator_id is rejected
        with self.assertRaises(ValueError):
            ManualOverride(
                id="OVR-03",
                proposal_id="PROP-99",
                operator_id="",
                operator_role="Section Controller",
                original_time_window=self.time_window,
                adjusted_time_window=adjusted_window,
                justification_reason="Valid reason",
            )

    def test_operational_block_approval_workflow(self):
        block = OperationalBlock(
            id="BLK-500",
            section_id="MAS-AJJ-SHU",
            track_line=TrackLine.UP,
            km_range=self.km_range,
            time_window=self.time_window,
            lead_department=Department.ENGG,
            participating_departments=(Department.ENGG, Department.TRD),
            request_ids=("REQ-001", "REQ-002"),
            origin_proposal_id="PROP-99",
            status=OperationalBlockStatus.UNDER_REVIEW,
        )

        unresolved_conflict = Conflict(
            id="CONF-500",
            conflict_type=ConflictType.SECTION_OCCUPATION,
            severity=ConflictSeverity.CRITICAL,
            block_a_id="BLK-500",
            status=ConflictStatus.UNRESOLVED,
        )

        # Attempting to approve while conflict is unresolved MUST be blocked
        with self.assertRaises(ApprovalBlockedByConflictError):
            block.approve(conflicts=[unresolved_conflict], approved_by_user_id="CHC-CHENNAI")
        self.assertEqual(block.status, OperationalBlockStatus.UNDER_REVIEW)

        # Resolve conflict
        unresolved_conflict.resolve(
            action=ResolutionAction.MERGED,
            resolved_by="CHC-CHENNAI",
            notes="Merged into single possession",
        )

        # Now approval succeeds
        block.approve(conflicts=[unresolved_conflict], approved_by_user_id="CHC-CHENNAI")
        self.assertEqual(block.status, OperationalBlockStatus.APPROVED)
        self.assertEqual(block.approved_by, "CHC-CHENNAI")
        self.assertIsNotNone(block.approved_at)

    def test_operational_block_override_versioning(self):
        block = OperationalBlock(
            id="BLK-501",
            section_id="MAS-AJJ-SHU",
            track_line=TrackLine.UP,
            km_range=self.km_range,
            time_window=self.time_window,
            lead_department=Department.ENGG,
            origin_proposal_id="PROP-99",
            status=OperationalBlockStatus.UNDER_REVIEW,
            revision_number=1,
        )

        adjusted_window = self.time_window.shift_by(45)
        override = ManualOverride(
            id="OVR-01",
            proposal_id="PROP-99",
            operator_id="CONTROLLER-01",
            operator_role="Section Controller",
            original_time_window=self.time_window,
            adjusted_time_window=adjusted_window,
            justification_reason="Shifted 45 min to accommodate rake clearance",
        )

        block.apply_override(override)
        self.assertEqual(block.time_window, adjusted_window)
        self.assertEqual(block.revision_number, 2)
        self.assertIsNotNone(block.override)
        self.assertEqual(block.override.justification_reason, "Shifted 45 min to accommodate rake clearance")


if __name__ == "__main__":
    unittest.main()
