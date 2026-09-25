"""Pydantic schemas for Phase 6B conflict detection and resolution."""

from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class ConflictDetectRequest(BaseModel):
    """Payload to trigger server-side conflict detection for an optimization run."""
    run_id: str
    proposal_ids: list[str] | None = None
    check_train_movements: bool = True


class ConflictResolutionCreate(BaseModel):
    """Payload to record a human controller's resolution decision on a conflict."""
    resolution_action: str
    actor_id: str
    actor_role: str
    rationale_notes: str
    resulting_block_id: str | None = None


class ConflictResolutionRead(BaseModel):
    """Schema representing an immutable conflict resolution audit event."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    conflict_id: str
    event_sequence: int
    resolution_action: str
    actor_id: str
    actor_role: str
    resulting_block_id: str | None = None
    rationale_notes: str
    is_current_resolution: bool
    created_at: datetime


class ConflictRead(BaseModel):
    """Authoritative representation of a persisted conflict."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    conflict_type: str
    severity: str
    proposal_a_id: str
    proposal_b_id: str | None = None
    train_movement_id: str | None = None
    resulting_block_id: str | None = None
    track_line: str
    overlap_description: str
    spatial_km_start: float
    spatial_km_end: float
    temporal_start: datetime
    temporal_end: datetime
    status: str
    is_blocking: bool
    created_at: datetime
    resolution_events: list[ConflictResolutionRead] = Field(default_factory=list)
