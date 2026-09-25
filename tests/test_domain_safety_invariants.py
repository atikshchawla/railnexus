"""Unit tests for safety invariants, authorization guards, and urgency rules."""

import unittest

from backend.domain.enums import ConflictSeverity, ConflictStatus, ConflictType, UrgencyTier
from backend.domain.exceptions import (
    ApprovalBlockedByConflictError,
    MissingOverrideReasonError,
    SpatialThresholdExceededError,
)
from backend.domain.rules import (
    DomainPolicyConfig,
    assert_can_approve_operational_block,
    assert_spatial_cluster_valid,
    assert_valid_manual_override,
    derive_urgency_tier,
    find_blocking_conflicts,
    should_upgrade_obs_to_imr,
)
from backend.domain.value_objects import KmRange


class SimpleConflict:
    """Mock test helper implementing ConflictLike protocol."""
    def __init__(
        self,
        conflict_id: str,
        block_a_id: str,
        block_b_id: str | None = None,
        status: ConflictStatus = ConflictStatus.UNRESOLVED,
        severity: ConflictSeverity = ConflictSeverity.CRITICAL,
    ):
        self.id = conflict_id
        self.block_a_id = block_a_id
        self.block_b_id = block_b_id
        self.status = status
        self.severity = severity


class TestSafetyInvariants(unittest.TestCase):
    def test_block_with_no_conflicts_can_be_approved(self):
        # Empty conflict list
        blocking = find_blocking_conflicts("BLK-001", [])
        self.assertEqual(blocking, [])
        # Should not raise
        assert_can_approve_operational_block("BLK-001", [])

    def test_block_with_resolved_conflicts_can_be_approved(self):
        c1 = SimpleConflict("CONF-01", "BLK-001", status=ConflictStatus.RESOLVED)
        c2 = SimpleConflict("CONF-02", "BLK-001", "BLK-002", status=ConflictStatus.RESOLVED)
        blocking = find_blocking_conflicts("BLK-001", [c1, c2])
        self.assertEqual(blocking, [])
        assert_can_approve_operational_block("BLK-001", [c1, c2])

    def test_block_with_unresolved_conflict_raises_approval_blocked(self):
        c1 = SimpleConflict("CONF-01", "BLK-001", status=ConflictStatus.UNRESOLVED)
        c2 = SimpleConflict("CONF-02", "BLK-001", "BLK-002", status=ConflictStatus.RESOLVED)

        blocking = find_blocking_conflicts("BLK-001", [c1, c2])
        self.assertEqual(blocking, ["CONF-01"])

        with self.assertRaises(ApprovalBlockedByConflictError) as ctx:
            assert_can_approve_operational_block("BLK-001", [c1, c2])
        self.assertEqual(ctx.exception.block_id, "BLK-001")
        self.assertIn("CONF-01", ctx.exception.unresolved_conflict_ids)

    def test_conflict_on_other_block_does_not_block_this_block(self):
        c_other = SimpleConflict("CONF-99", "BLK-888", "BLK-999", status=ConflictStatus.UNRESOLVED)
        blocking = find_blocking_conflicts("BLK-001", [c_other])
        self.assertEqual(blocking, [])
        assert_can_approve_operational_block("BLK-001", [c_other])

    def test_manual_override_requires_justification(self):
        # Valid justification passes
        assert_valid_manual_override(
            proposal_id="PROP-01",
            field_name="time_window",
            justification_reason="Urgent passenger train 12608 path priority requested by CHC",
        )

        # Empty justification raises MissingOverrideReasonError
        with self.assertRaises(MissingOverrideReasonError):
            assert_valid_manual_override("PROP-01", "time_window", "")

        # Whitespace-only justification raises MissingOverrideReasonError
        with self.assertRaises(MissingOverrideReasonError):
            assert_valid_manual_override("PROP-01", "time_window", "   \t\n  ")

    def test_spatial_clustering_policy_enforcement(self):
        kr1 = KmRange(10.0, 12.0)
        kr2 = KmRange(14.0, 16.0) # gap = 2.0 km <= 5.0 km
        kr3 = KmRange(20.0, 25.0) # gap from kr1 = 8.0 km > 5.0 km

        # Gap = 2.0 km passes
        assert_spatial_cluster_valid(kr1, kr2)

        # Gap = 8.0 km raises
        with self.assertRaises(SpatialThresholdExceededError) as ctx:
            assert_spatial_cluster_valid(kr1, kr3)
        self.assertAlmostEqual(ctx.exception.gap_km, 8.0)
        self.assertEqual(ctx.exception.max_allowed_km, 5.0)

        # Custom configurable policy allows 10 km
        custom_policy = DomainPolicyConfig(max_spatial_gap_km=10.0)
        assert_spatial_cluster_valid(kr1, kr3, policy=custom_policy)


class TestUrgencyRules(unittest.TestCase):
    def test_derive_urgency_tier(self):
        self.assertEqual(derive_urgency_tier(None), UrgencyTier.ROUTINE)
        self.assertEqual(derive_urgency_tier(10.0), UrgencyTier.CRITICAL)
        self.assertEqual(derive_urgency_tier(23.9), UrgencyTier.CRITICAL)
        self.assertEqual(derive_urgency_tier(24.0), UrgencyTier.WARNING)
        self.assertEqual(derive_urgency_tier(71.9), UrgencyTier.WARNING)
        self.assertEqual(derive_urgency_tier(72.0), UrgencyTier.WARNING)
        self.assertEqual(derive_urgency_tier(72.1), UrgencyTier.CAUTION)
        self.assertEqual(derive_urgency_tier(168.0), UrgencyTier.CAUTION)
        self.assertEqual(derive_urgency_tier(168.1), UrgencyTier.ROUTINE)
        self.assertEqual(derive_urgency_tier(500.0), UrgencyTier.ROUTINE)
        self.assertEqual(derive_urgency_tier(-1.0), UrgencyTier.CRITICAL)

    def test_obs_upgrade_proximity_rule(self):
        # BR-002: <= 4.0 meters requires upgrade to IMR
        self.assertTrue(should_upgrade_obs_to_imr(0.0))
        self.assertTrue(should_upgrade_obs_to_imr(3.9))
        self.assertTrue(should_upgrade_obs_to_imr(4.0))
        self.assertFalse(should_upgrade_obs_to_imr(4.01))
        self.assertFalse(should_upgrade_obs_to_imr(10.0))


if __name__ == "__main__":
    unittest.main()
