"""KmRange value object representing spatial extent along an Indian Railways track line."""

from __future__ import annotations

from dataclasses import dataclass
from backend.domain.exceptions import InvalidKmRangeError


@dataclass(frozen=True)
class KmRange:
    """Represents a continuous track kilometer span.

    Invariants:
      - start_km >= 0.0
      - end_km >= start_km
    """
    start_km: float
    end_km: float

    def __post_init__(self) -> None:
        if self.start_km < 0:
            raise InvalidKmRangeError(f"start_km must be non-negative, got {self.start_km}")
        if self.end_km < self.start_km:
            raise InvalidKmRangeError(
                f"end_km ({self.end_km}) must be greater than or equal to start_km ({self.start_km})"
            )

    @property
    def length_km(self) -> float:
        """Total length of the span in kilometers."""
        return round(self.end_km - self.start_km, 3)

    def contains(self, km: float) -> bool:
        """Check if a specific kilometer marker lies within this range."""
        return self.start_km <= km <= self.end_km

    def overlaps(self, other: KmRange) -> bool:
        """Check if this kilometer range overlaps or touches another range."""
        return max(self.start_km, other.start_km) <= min(self.end_km, other.end_km)

    def distance_to(self, other: KmRange) -> float:
        """Compute spatial gap to another kilometer range.

        Returns 0.0 if ranges overlap or touch.
        """
        if self.overlaps(other):
            return 0.0
        if self.end_km < other.start_km:
            return round(other.start_km - self.end_km, 3)
        return round(self.start_km - other.end_km, 3)

    def merge_with(self, other: KmRange) -> KmRange:
        """Create a new range spanning the union of both ranges."""
        return KmRange(
            start_km=min(self.start_km, other.start_km),
            end_km=max(self.end_km, other.end_km),
        )
