"""State machine for MaintenanceRequest lifecycle."""

from __future__ import annotations

from backend.domain.enums import MaintenanceStatus
from backend.domain.exceptions import InvalidStateTransitionError


# Explicit transition map: current_status -> set of allowed target statuses
_MAINTENANCE_TRANSITIONS: dict[MaintenanceStatus, set[MaintenanceStatus]] = {
    MaintenanceStatus.DRAFT: {
        MaintenanceStatus.SUBMITTED,
        MaintenanceStatus.REJECTED,
    },
    MaintenanceStatus.SUBMITTED: {
        MaintenanceStatus.VALIDATED,
        MaintenanceStatus.REJECTED,
        MaintenanceStatus.DEFERRED,
    },
    MaintenanceStatus.VALIDATED: {
        MaintenanceStatus.PROPOSED,
        MaintenanceStatus.DEFERRED,
        MaintenanceStatus.REJECTED,
    },
    MaintenanceStatus.PROPOSED: {
        MaintenanceStatus.APPROVED,
        MaintenanceStatus.DEFERRED,
        MaintenanceStatus.REJECTED,
    },
    MaintenanceStatus.APPROVED: {
        MaintenanceStatus.ACTIVE,
        MaintenanceStatus.DEFERRED,
    },
    MaintenanceStatus.ACTIVE: {
        MaintenanceStatus.COMPLETED,
    },
    MaintenanceStatus.COMPLETED: {
        MaintenanceStatus.CLOSED,
    },
    MaintenanceStatus.REJECTED: {
        MaintenanceStatus.SUBMITTED,  # Resubmission after addressing controller feedback
    },
    MaintenanceStatus.DEFERRED: {
        MaintenanceStatus.SUBMITTED,
        MaintenanceStatus.PROPOSED,
    },
    MaintenanceStatus.CLOSED: set(),  # Terminal state
}


def can_transition_maintenance(current: MaintenanceStatus, target: MaintenanceStatus) -> bool:
    """Return True if the state transition is valid."""
    allowed = _MAINTENANCE_TRANSITIONS.get(current, set())
    return target in allowed


def assert_valid_maintenance_transition(current: MaintenanceStatus, target: MaintenanceStatus) -> None:
    """Raise InvalidStateTransitionError if the transition is prohibited."""
    if not can_transition_maintenance(current, target):
        raise InvalidStateTransitionError(
            entity_name="MaintenanceRequest",
            current_state=current.value,
            attempted_state=target.value,
            reason=f"Allowed transitions from '{current.value}' are: {[s.value for s in _MAINTENANCE_TRANSITIONS.get(current, set())]}",
        )
