"""MaintenanceRequest domain entity."""

from __future__ import annotations

from dataclasses import dataclass, field
from backend.domain.enums import (
    Category,
    Department,
    MaintenanceStatus,
    TrackLine,
    UrgencyTier,
)
from backend.domain.rules.urgency_rules import derive_urgency_tier
from backend.domain.state_machines.maintenance_lifecycle import assert_valid_maintenance_transition
from backend.domain.value_objects.km_range import KmRange


@dataclass
class MaintenanceRequest:
    """A departmental application for track possession.

    Represents what the field department (P-Way, TRD, S&T) asks for.
    """
    id: str
    section_id: str
    department: Department
    category: Category
    work_type: str
    km_range: KmRange
    line: TrackLine = TrackLine.UP
    demanded_duration_minutes: float = 60.0
    safety_critical: bool = False
    requires_power_isolation: bool = False
    requires_disconnection: bool = False
    equipment_ids: tuple[str, ...] = ()
    deadline_hours: float | None = None
    status: MaintenanceStatus = MaintenanceStatus.SUBMITTED
    notes: str = ""

    @property
    def urgency_tier(self) -> UrgencyTier:
        """Derive urgency tier based on SLA breach clock."""
        return derive_urgency_tier(self.deadline_hours)

    def transition_to(self, target_status: MaintenanceStatus) -> None:
        """Transition request to a new status governed by the state machine."""
        assert_valid_maintenance_transition(self.status, target_status)
        self.status = target_status
