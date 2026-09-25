"""TimeWindow value object representing an operational scheduling window."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from backend.domain.exceptions import InvalidTimeWindowError


@dataclass(frozen=True)
class TimeWindow:
    """Represents an immutable operational time interval.

    Invariants:
      - start_time < end_time
    """
    start_time: datetime
    end_time: datetime

    def __post_init__(self) -> None:
        if self.start_time >= self.end_time:
            raise InvalidTimeWindowError(
                f"start_time ({self.start_time.isoformat()}) must be strictly before "
                f"end_time ({self.end_time.isoformat()})"
            )

    @property
    def duration_minutes(self) -> float:
        """Duration in minutes."""
        diff = self.end_time - self.start_time
        return round(diff.total_seconds() / 60.0, 2)

    @property
    def duration_hours(self) -> float:
        """Duration in hours."""
        return round(self.duration_minutes / 60.0, 2)

    def contains(self, point: datetime) -> bool:
        """Check if a specific timestamp falls within this window."""
        return self.start_time <= point <= self.end_time

    def overlaps(self, other: TimeWindow) -> bool:
        """Check if this window overlaps with another window."""
        return self.start_time < other.end_time and other.start_time < self.end_time

    def overlap_minutes(self, other: TimeWindow) -> float:
        """Calculate overlap duration in minutes with another window.

        Returns 0.0 if windows do not overlap.
        """
        if not self.overlaps(other):
            return 0.0
        overlap_start = max(self.start_time, other.start_time)
        overlap_end = min(self.end_time, other.end_time)
        return round((overlap_end - overlap_start).total_seconds() / 60.0, 2)

    def shift_by(self, minutes: int) -> TimeWindow:
        """Return a new TimeWindow shifted by the given number of minutes."""
        delta = timedelta(minutes=minutes)
        return TimeWindow(start_time=self.start_time + delta, end_time=self.end_time + delta)

    def extend_by(self, minutes: int) -> TimeWindow:
        """Return a new TimeWindow with the end time extended by the given minutes."""
        return TimeWindow(start_time=self.start_time, end_time=self.end_time + timedelta(minutes=minutes))
