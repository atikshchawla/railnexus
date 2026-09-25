"""Safety invariants and authorization guards for RailNexus ABP.

These rules are authoritative and enforced at the domain layer.
The frontend may mirror them for user guidance, but the backend domain is final.
"""

from __future__ import annotations

from typing import Protocol
from backend.domain.enums import ConflictStatus, ConflictSeverity
from backend.domain.exceptions import (
    ApprovalBlockedByConflictError,
    MissingOverrideReasonError,
    SpatialThresholdExceededError,
)
from backend.domain.rules.policy_config import DEFAULT_POLICY, DomainPolicyConfig
from backend.domain.value_objects.km_range import KmRange


class ConflictLike(Protocol):
    """Protocol representing a conflict object with minimal necessary attributes."""
    id: str
    status: ConflictStatus
    severity: ConflictSeverity
    block_a_id: str
    block_b_id: str | None


def find_blocking_conflicts(
    block_id: str,
    conflicts: list[ConflictLike],
) -> list[str]:
    """Find all unresolved conflicts that structurally block approval of the given block (BR-003).

    Safety Invariant:
    Any conflict directly involving the block that remains UNRESOLVED blocks approval.
    """
    blocking_ids: list[str] = []
    for conflict in conflicts:
        involves_block = (conflict.block_a_id == block_id or conflict.block_b_id == block_id)
        if involves_block and conflict.status == ConflictStatus.UNRESOLVED:
            blocking_ids.append(conflict.id)
    return blocking_ids


def assert_can_approve_operational_block(
    block_id: str,
    conflicts: list[ConflictLike],
) -> None:
    """Enforce Safety Invariant BR-003:

    An operational block must NOT be approved while it has an active unresolved blocking conflict.
    Raises ApprovalBlockedByConflictError if any unresolved conflict is found.
    """
    blocking_ids = find_blocking_conflicts(block_id, conflicts)
    if blocking_ids:
        raise ApprovalBlockedByConflictError(block_id=block_id, unresolved_conflict_ids=blocking_ids)


def assert_valid_manual_override(
    proposal_id: str,
    field_name: str,
    justification_reason: str,
) -> None:
    """Enforce Audit Invariant BR-010:

    Any manual override of an AI recommendation must include a non-empty
    operational justification reason. Silent or unattributed modifications are prohibited.
    """
    if not justification_reason or not justification_reason.strip():
        raise MissingOverrideReasonError(proposal_id=proposal_id, field_name=field_name)


def assert_spatial_cluster_valid(
    range_a: KmRange,
    range_b: KmRange,
    policy: DomainPolicyConfig = DEFAULT_POLICY,
) -> None:
    """Enforce Spatial Policy DA-001:

    Tasks may only be integrated into a single block if their spatial gap does not exceed
    the allowable policy threshold (default 5.0 km).
    """
    gap = range_a.distance_to(range_b)
    if gap > policy.max_spatial_gap_km:
        raise SpatialThresholdExceededError(gap_km=gap, max_allowed_km=policy.max_spatial_gap_km)
