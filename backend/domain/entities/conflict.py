"""Conflict domain entity."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from backend.domain.enums import (
    ConflictSeverity,
    ConflictStatus,
    ConflictType,
    ResolutionAction,
)
from backend.domain.value_objects.time_window import TimeWindow


@dataclass
class Conflict:
    """An operational spatial-temporal conflict between trains and blocks or multiple blocks."""
    id: str
    conflict_type: ConflictType
    severity: ConflictSeverity
    block_a_id: str
    block_b_id: str | None = None
    train_number: str | None = None
    km_location: float = 0.0
    time_window: TimeWindow | None = None
    status: ConflictStatus = ConflictStatus.UNRESOLVED
    resolution_action: ResolutionAction | None = None
    resolved_by: str | None = None
    resolved_at: datetime | None = None
    resolution_notes: str | None = None

    def resolve(
        self,
        action: ResolutionAction,
        resolved_by: str,
        notes: str | None = None,
        resolved_at: datetime | None = None,
    ) -> None:
        """Resolve this conflict with attribution and rationale."""
        self.status = ConflictStatus.RESOLVED
        self.resolution_action = action
        self.resolved_by = resolved_by
        self.resolution_notes = notes
        self.resolved_at = resolved_at or datetime.now(timezone.utc)

    def escalate(
        self,
        escalated_by: str,
        notes: str | None = None,
    ) -> None:
        """Escalate unresolved conflict to divisional authority."""
        self.status = ConflictStatus.ESCALATED
        self.resolution_action = ResolutionAction.ESCALATED
        self.resolved_by = escalated_by
        self.resolution_notes = notes
        self.resolved_at = datetime.now(timezone.utc)
