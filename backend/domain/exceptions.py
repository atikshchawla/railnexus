"""Domain-specific exceptions for RailNexus ABP.

Pure Python exceptions representing domain rule and invariant violations.
Completely decoupled from HTTP or database layers.
"""

from __future__ import annotations


class DomainError(Exception):
    """Base exception for all domain invariant and business rule violations."""
    pass


class InvalidStateTransitionError(DomainError):
    """Raised when an illegal state machine transition is attempted."""
    def __init__(self, entity_name: str, current_state: str, attempted_state: str, reason: str = ""):
        message = f"Invalid state transition for {entity_name}: cannot move from '{current_state}' to '{attempted_state}'."
        if reason:
            message += f" Reason: {reason}"
        super().__init__(message)
        self.entity_name = entity_name
        self.current_state = current_state
        self.attempted_state = attempted_state
        self.reason = reason


class InvalidTimeWindowError(DomainError):
    """Raised when start_time >= end_time or duration is non-positive."""
    pass


class InvalidKmRangeError(DomainError):
    """Raised when start_km < 0, end_km < start_km, or invalid kilometer coordinates are passed."""
    pass


class ApprovalBlockedByConflictError(DomainError):
    """Raised when attempting to approve an operational block that has unresolved blocking conflicts."""
    def __init__(self, block_id: str, unresolved_conflict_ids: list[str]):
        message = (
            f"Safety Invariant Violation: Operational Block '{block_id}' cannot be approved because "
            f"it has {len(unresolved_conflict_ids)} unresolved blocking conflict(s): {', '.join(unresolved_conflict_ids)}."
        )
        super().__init__(message)
        self.block_id = block_id
        self.unresolved_conflict_ids = unresolved_conflict_ids


class MissingOverrideReasonError(DomainError):
    """Raised when an operator modifies an AI recommendation without providing mandatory justification."""
    def __init__(self, proposal_id: str, field_name: str):
        message = (
            f"Audit Invariant Violation: Manual override on proposal '{proposal_id}' for field '{field_name}' "
            "requires a non-empty operational justification reason."
        )
        super().__init__(message)
        self.proposal_id = proposal_id
        self.field_name = field_name


class SpatialThresholdExceededError(DomainError):
    """Raised when maintenance tasks exceed the allowable spatial clustering boundary for integration."""
    def __init__(self, gap_km: float, max_allowed_km: float):
        message = (
            f"Spatial Integration Error: Gap between tasks ({gap_km:.2f} km) exceeds "
            f"the maximum allowable threshold ({max_allowed_km:.2f} km)."
        )
        super().__init__(message)
        self.gap_km = gap_km
        self.max_allowed_km = max_allowed_km


class UnauthorizedDomainActionError(DomainError):
    """Raised when an action requires specific operational credentials or role authority."""
    pass
