"""OperationalBlock domain entity."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from backend.domain.enums import (
    Department,
    OperationalBlockStatus,
    TrackLine,
)
from backend.domain.entities.conflict import Conflict
from backend.domain.entities.override import ManualOverride
from backend.domain.rules.safety_invariants import assert_can_approve_operational_block
from backend.domain.state_machines.block_lifecycle import assert_valid_block_transition
from backend.domain.value_objects.km_range import KmRange
from backend.domain.value_objects.time_window import TimeWindow


@dataclass
class OperationalBlock:
    """An authoritative operational track possession granted by the Operating Department.

    Represents what the Section Controller actually grants on the live railway line.
    """
    id: str
    section_id: str
    track_line: TrackLine
    km_range: KmRange
    time_window: TimeWindow
    lead_department: Department
    participating_departments: tuple[Department, ...] = ()
    request_ids: tuple[str, ...] = ()
    origin_proposal_id: str | None = None
    override: ManualOverride | None = None
    power_isolation_granted: bool = False
    snt_disconnection_granted: bool = False
    status: OperationalBlockStatus = OperationalBlockStatus.PROPOSED
    approved_by: str | None = None
    approved_at: datetime | None = None
    revision_number: int = 1

    def approve(
        self,
        conflicts: list[Conflict],
        approved_by_user_id: str,
        approved_at: datetime | None = None,
    ) -> None:
        """Approve this block possession, strictly enforcing Safety Invariant BR-003.

        Raises ApprovalBlockedByConflictError if any unresolved conflict is active.
        Raises InvalidStateTransitionError if the block is not in an approvable state.
        """
        assert_can_approve_operational_block(self.id, conflicts)
        assert_valid_block_transition(self.status, OperationalBlockStatus.APPROVED)

        if not approved_by_user_id or not approved_by_user_id.strip():
            raise ValueError("Operational block approval requires a valid approved_by_user_id.")

        self.status = OperationalBlockStatus.APPROVED
        self.approved_by = approved_by_user_id
        self.approved_at = approved_at or datetime.now(timezone.utc)

    def transition_to(self, target_status: OperationalBlockStatus) -> None:
        """Transition block status according to the operational state machine."""
        assert_valid_block_transition(self.status, target_status)
        self.status = target_status

    def apply_override(self, override: ManualOverride) -> None:
        """Apply a validated manual override, creating a new revision."""
        if not override.justification_reason or not override.justification_reason.strip():
            raise ValueError("Manual override requires an operational justification.")

        self.time_window = override.adjusted_time_window
        self.override = override
        self.revision_number += 1
