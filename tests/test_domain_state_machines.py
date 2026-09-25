"""Unit tests for RailNexus domain state machines (MaintenanceRequest and OperationalBlock)."""

import unittest

from backend.domain.enums import MaintenanceStatus, OperationalBlockStatus
from backend.domain.exceptions import InvalidStateTransitionError
from backend.domain.state_machines import (
    assert_valid_block_transition,
    assert_valid_maintenance_transition,
    can_transition_block,
    can_transition_maintenance,
)


class TestMaintenanceLifecycle(unittest.TestCase):
    def test_happy_path_lifecycle(self):
        # DRAFT -> SUBMITTED -> VALIDATED -> PROPOSED -> APPROVED -> ACTIVE -> COMPLETED -> CLOSED
        self.assertTrue(can_transition_maintenance(MaintenanceStatus.DRAFT, MaintenanceStatus.SUBMITTED))
        self.assertTrue(can_transition_maintenance(MaintenanceStatus.SUBMITTED, MaintenanceStatus.VALIDATED))
        self.assertTrue(can_transition_maintenance(MaintenanceStatus.VALIDATED, MaintenanceStatus.PROPOSED))
        self.assertTrue(can_transition_maintenance(MaintenanceStatus.PROPOSED, MaintenanceStatus.APPROVED))
        self.assertTrue(can_transition_maintenance(MaintenanceStatus.APPROVED, MaintenanceStatus.ACTIVE))
        self.assertTrue(can_transition_maintenance(MaintenanceStatus.ACTIVE, MaintenanceStatus.COMPLETED))
        self.assertTrue(can_transition_maintenance(MaintenanceStatus.COMPLETED, MaintenanceStatus.CLOSED))

    def test_resubmission_and_deferral(self):
        # REJECTED -> SUBMITTED
        self.assertTrue(can_transition_maintenance(MaintenanceStatus.REJECTED, MaintenanceStatus.SUBMITTED))
        # SUBMITTED -> DEFERRED -> SUBMITTED
        self.assertTrue(can_transition_maintenance(MaintenanceStatus.SUBMITTED, MaintenanceStatus.DEFERRED))
        self.assertTrue(can_transition_maintenance(MaintenanceStatus.DEFERRED, MaintenanceStatus.SUBMITTED))

    def test_prohibited_transitions(self):
        # Cannot jump straight from DRAFT to APPROVED
        self.assertFalse(can_transition_maintenance(MaintenanceStatus.DRAFT, MaintenanceStatus.APPROVED))
        # Cannot jump from SUBMITTED to ACTIVE (requires formal grant)
        self.assertFalse(can_transition_maintenance(MaintenanceStatus.SUBMITTED, MaintenanceStatus.ACTIVE))
        # Cannot reactivate a COMPLETED request
        self.assertFalse(can_transition_maintenance(MaintenanceStatus.COMPLETED, MaintenanceStatus.ACTIVE))
        # Cannot modify a terminal CLOSED request
        self.assertFalse(can_transition_maintenance(MaintenanceStatus.CLOSED, MaintenanceStatus.DRAFT))

    def test_assert_valid_maintenance_transition_raises(self):
        assert_valid_maintenance_transition(MaintenanceStatus.DRAFT, MaintenanceStatus.SUBMITTED)
        with self.assertRaises(InvalidStateTransitionError) as ctx:
            assert_valid_maintenance_transition(MaintenanceStatus.COMPLETED, MaintenanceStatus.ACTIVE)
        self.assertEqual(ctx.exception.entity_name, "MaintenanceRequest")
        self.assertEqual(ctx.exception.current_state, "COMPLETED")
        self.assertEqual(ctx.exception.attempted_state, "ACTIVE")


class TestOperationalBlockLifecycle(unittest.TestCase):
    def test_happy_path_block_lifecycle(self):
        # PROPOSED -> UNDER_REVIEW -> APPROVED -> ACTIVE -> CLEARED -> CLOSED
        self.assertTrue(can_transition_block(OperationalBlockStatus.PROPOSED, OperationalBlockStatus.UNDER_REVIEW))
        self.assertTrue(can_transition_block(OperationalBlockStatus.UNDER_REVIEW, OperationalBlockStatus.APPROVED))
        self.assertTrue(can_transition_block(OperationalBlockStatus.APPROVED, OperationalBlockStatus.ACTIVE))
        self.assertTrue(can_transition_block(OperationalBlockStatus.ACTIVE, OperationalBlockStatus.CLEARED))
        self.assertTrue(can_transition_block(OperationalBlockStatus.CLEARED, OperationalBlockStatus.CLOSED))

    def test_rejection_and_cancellation(self):
        self.assertTrue(can_transition_block(OperationalBlockStatus.UNDER_REVIEW, OperationalBlockStatus.REJECTED))
        self.assertTrue(can_transition_block(OperationalBlockStatus.REJECTED, OperationalBlockStatus.UNDER_REVIEW))
        self.assertTrue(can_transition_block(OperationalBlockStatus.APPROVED, OperationalBlockStatus.CANCELLED))

    def test_prohibited_block_transitions(self):
        # PROPOSED cannot jump to ACTIVE directly
        self.assertFalse(can_transition_block(OperationalBlockStatus.PROPOSED, OperationalBlockStatus.ACTIVE))
        # CLEARED cannot move back to APPROVED
        self.assertFalse(can_transition_block(OperationalBlockStatus.CLEARED, OperationalBlockStatus.APPROVED))
        # CLOSED is a terminal state
        self.assertFalse(can_transition_block(OperationalBlockStatus.CLOSED, OperationalBlockStatus.ACTIVE))
        self.assertFalse(can_transition_block(OperationalBlockStatus.CANCELLED, OperationalBlockStatus.APPROVED))

    def test_assert_valid_block_transition_raises(self):
        assert_valid_block_transition(OperationalBlockStatus.PROPOSED, OperationalBlockStatus.UNDER_REVIEW)
        with self.assertRaises(InvalidStateTransitionError) as ctx:
            assert_valid_block_transition(OperationalBlockStatus.PROPOSED, OperationalBlockStatus.ACTIVE)
        self.assertEqual(ctx.exception.entity_name, "OperationalBlock")
        self.assertEqual(ctx.exception.current_state, "PROPOSED")
        self.assertEqual(ctx.exception.attempted_state, "ACTIVE")


if __name__ == "__main__":
    unittest.main()
