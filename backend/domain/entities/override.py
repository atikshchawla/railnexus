"""ManualOverride domain entity."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from backend.domain.exceptions import MissingOverrideReasonError
from backend.domain.value_objects.time_window import TimeWindow


@dataclass(frozen=True)
class ManualOverride:
    """Represents a human operator modification to an AI-generated block proposal.

    Maintains full attribution and enforces non-empty justification for safety-critical audits.
    """
    id: str
    proposal_id: str
    operator_id: str
    operator_role: str
    original_time_window: TimeWindow
    adjusted_time_window: TimeWindow
    justification_reason: str
    dissolved_group: bool = False
    custom_notes: str = ""
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def __post_init__(self) -> None:
        if not self.justification_reason or not self.justification_reason.strip():
            raise MissingOverrideReasonError(
                proposal_id=self.proposal_id,
                field_name="time_window" if self.original_time_window != self.adjusted_time_window else "group_composition",
            )
        if not self.operator_id or not self.operator_id.strip():
            raise ValueError("Manual override requires an authenticated operator_id.")

    @property
    def start_delta_minutes(self) -> float:
        """Difference in start time in minutes (adjusted - original)."""
        diff = self.adjusted_time_window.start_time - self.original_time_window.start_time
        return round(diff.total_seconds() / 60.0, 2)

    @property
    def duration_delta_minutes(self) -> float:
        """Difference in total duration in minutes (adjusted - original)."""
        return round(
            self.adjusted_time_window.duration_minutes - self.original_time_window.duration_minutes,
            2,
        )
