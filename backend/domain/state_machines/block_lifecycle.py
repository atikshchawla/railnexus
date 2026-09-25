"""State machine for OperationalBlock lifecycle."""

from __future__ import annotations

from backend.domain.enums import OperationalBlockStatus
from backend.domain.exceptions import InvalidStateTransitionError


# Explicit transition map: current_status -> set of allowed target statuses
_BLOCK_TRANSITIONS: dict[OperationalBlockStatus, set[OperationalBlockStatus]] = {
    OperationalBlockStatus.PROPOSED: {
        OperationalBlockStatus.UNDER_REVIEW,
        OperationalBlockStatus.REJECTED,
        OperationalBlockStatus.CANCELLED,
    },
    OperationalBlockStatus.UNDER_REVIEW: {
        OperationalBlockStatus.APPROVED,
        OperationalBlockStatus.REJECTED,
        OperationalBlockStatus.CANCELLED,
    },
    OperationalBlockStatus.APPROVED: {
        OperationalBlockStatus.ACTIVE,
        OperationalBlockStatus.CANCELLED,
    },
    OperationalBlockStatus.ACTIVE: {
        OperationalBlockStatus.CLEARED,
    },
    OperationalBlockStatus.CLEARED: {
        OperationalBlockStatus.CLOSED,
    },
    OperationalBlockStatus.REJECTED: {
        OperationalBlockStatus.UNDER_REVIEW,  # Re-opened for review after plan modification
    },
    OperationalBlockStatus.CANCELLED: set(),  # Terminal state
    OperationalBlockStatus.CLOSED: set(),     # Terminal state
}


def can_transition_block(current: OperationalBlockStatus, target: OperationalBlockStatus) -> bool:
    """Return True if the block state transition is valid."""
    allowed = _BLOCK_TRANSITIONS.get(current, set())
    return target in allowed


def assert_valid_block_transition(current: OperationalBlockStatus, target: OperationalBlockStatus) -> None:
    """Raise InvalidStateTransitionError if the block transition is prohibited."""
    if not can_transition_block(current, target):
        raise InvalidStateTransitionError(
            entity_name="OperationalBlock",
            current_state=current.value,
            attempted_state=target.value,
            reason=f"Allowed transitions from '{current.value}' are: {[s.value for s in _BLOCK_TRANSITIONS.get(current, set())]}",
        )
