"""Pydantic schemas for Phase 6C authoritative approval/rejection lifecycle."""

from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class ProposalApproveRequest(BaseModel):
    """Payload to approve a BlockProposal and promote it to an OperationalBlock.

    Operator must supply identity, lead department, and spatial boundaries.
    If override_justification is supplied, a ManualOverride record is created
    before promotion. A non-empty override_justification requires override_code.
    """

    block_id: str = Field(
        description="Caller-supplied stable ID for the new OperationalBlock (e.g. 'BLK-2026-001')."
    )
    approved_by: str = Field(min_length=1, description="Operator identity string (employee ID / login).")
    lead_department: str = Field(min_length=1, description="Owning department for the operational block.")
    start_km: float = Field(ge=0.0, description="Physical start kilometre for the block.")
    end_km: float = Field(gt=0.0, description="Physical end kilometre for the block.")
    track_line: str = Field(default="UP", description="Track line designation (UP / DN).")

    # Manual override fields — all three must be present together, or all absent.
    override_justification: str | None = Field(
        default=None,
        description=(
            "Non-empty justification notes required when operator adjusts AI-recommended "
            "timing or parameters. Triggers ManualOverride creation."
        ),
    )
    override_code: str | None = Field(
        default=None,
        description="Short justification code (e.g. 'TRAFFIC_CONSTRAINT', 'SAFETY_CRITICAL').",
    )
    operator_role: str | None = Field(
        default=None,
        description="Role of the approving operator (required when override is provided).",
    )

    # Optional custom schedule (override AI-proposed window)
    custom_scheduled_start: datetime | None = None
    custom_scheduled_end: datetime | None = None


class ProposalRejectRequest(BaseModel):
    """Payload to reject a BlockProposal, closing it without promotion."""

    rejected_by: str = Field(min_length=1, description="Operator identity string.")
    rejection_reason: str = Field(min_length=1, description="Human-readable reason for rejection.")
    operator_role: str | None = Field(
        default=None, description="Role of the rejecting operator (defaults to 'SECTION_CONTROLLER')."
    )


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class OperationalBlockRead(BaseModel):
    """Authoritative representation of a persisted OperationalBlock."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    section_id: str
    track_line: str
    start_km: float
    end_km: float
    scheduled_start: datetime
    scheduled_end: datetime
    actual_start: datetime | None = None
    actual_end: datetime | None = None
    origin_proposal_id: str | None = None
    override_id: str | None = None
    lead_department: str
    status: str
    approved_by: str | None = None
    approved_at: datetime | None = None
    revision_number: int
    parent_block_id: str | None = None
    is_current: bool
    created_at: datetime


class ProposalRejectResponse(BaseModel):
    """Response after a proposal has been rejected."""

    proposal_id: str
    status: str
    rejected_by: str
    rejection_reason: str
    rejected_at: datetime


class ApprovalProposalRead(BaseModel):
    """Authoritative persisted proposal approval view for human review."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    run_id: str
    section_id: str
    status: str
    proposed_start_time: datetime
    proposed_end_time: datetime
    predicted_duration_minutes: float
    possession_saving_minutes: float
    train_impact_minutes: float
    trains_affected_count: int
    confidence_score: float
    top_factors_json: dict = Field(default_factory=dict)
    safety_cautions: list = Field(default_factory=list)
    created_at: datetime

    departments: list[str] = Field(default_factory=list)
    maintenance_request_ids: list[str] = Field(default_factory=list)
    has_blocking_conflicts: bool = False
    blocking_conflict_count: int = 0
    operational_block_id: str | None = None
    operational_block_status: str | None = None
