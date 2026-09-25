"""Phase 6C — Authoritative Approval API Routes.

Authoritative Core approval endpoints:
    POST /api/approvals/{proposal_id}/approve  → OperationalBlockRead
    POST /api/approvals/{proposal_id}/reject   → ProposalRejectResponse
    GET  /api/approvals                        → list persisted BlockProposals for human review
    GET  /api/approvals/{proposal_id}          → authoritative persisted proposal approval view

OperationalBlock read endpoints (supplementary):
    GET  /api/operational-blocks               → list current OperationalBlocks
    GET  /api/operational-blocks/{block_id}    → single OperationalBlock detail

Scope (Phase 6C):
    - No authentication / RBAC.
    - No Demo Gateway changes.
    - No Integration/Tunnel changes.
    - Approval is authoritative: creates OperationalBlock, enforces conflict gate.
    - ApprovalService owns the transaction.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.api.schemas.approval import (
    ApprovalProposalRead,
    OperationalBlockRead,
    ProposalApproveRequest,
    ProposalRejectRequest,
    ProposalRejectResponse,
)
from backend.database.connection import get_db
from backend.repositories.operational_block_repository import OperationalBlockRepository
from backend.services.approval_service import ApprovalService

router = APIRouter(tags=["approvals"])
approval_service = ApprovalService()
ob_repo = OperationalBlockRepository()


# ---------------------------------------------------------------------------
# Authoritative Approval Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/approvals/{proposal_id}/approve",
    response_model=OperationalBlockRead,
    status_code=200,
    summary="Approve a BlockProposal → promote to OperationalBlock",
)
def approve_proposal(
    proposal_id: str,
    payload: ProposalApproveRequest,
    db: Session = Depends(get_db),
):
    """Authoritative approval endpoint.

    Enforces Phase 6B conflict safety gate: a proposal with at least one
    UNRESOLVED BLOCKING conflict returns HTTP 409.
    Creates and returns the new OperationalBlock, or returns the existing
    OperationalBlock if already approved (idempotent).
    """
    return approval_service.approve_proposal(db, proposal_id, payload)


@router.post(
    "/approvals/{proposal_id}/reject",
    response_model=ProposalRejectResponse,
    status_code=200,
    summary="Reject a BlockProposal",
)
def reject_proposal(
    proposal_id: str,
    payload: ProposalRejectRequest,
    db: Session = Depends(get_db),
):
    """Reject a block proposal without promoting to an operational block."""
    return approval_service.reject_proposal(db, proposal_id, payload)


@router.get(
    "/approvals",
    response_model=list[ApprovalProposalRead],
    summary="List persisted BlockProposals for human review",
)
def list_approvals(
    section_id: str | None = None,
    status: str | None = None,
    run_id: str | None = None,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """Return persisted BlockProposals appropriate for human review."""
    return approval_service.list_proposals(
        db, section_id=section_id, status=status, run_id=run_id, limit=limit
    )


@router.get(
    "/approvals/{proposal_id}",
    response_model=ApprovalProposalRead,
    summary="Get authoritative persisted proposal approval view",
)
def get_approval(
    proposal_id: str,
    db: Session = Depends(get_db),
):
    """Return the authoritative persisted proposal approval view."""
    return approval_service.get_proposal_view(db, proposal_id)


# ---------------------------------------------------------------------------
# OperationalBlock read endpoints
# ---------------------------------------------------------------------------

@router.get(
    "/operational-blocks",
    response_model=list[OperationalBlockRead],
    summary="List current OperationalBlocks",
)
def list_operational_blocks(
    section_id: str | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
):
    """List current (is_current=True) operational blocks, with optional filters."""
    return ob_repo.list(db, section_id=section_id, status=status, is_current=True)


@router.get(
    "/operational-blocks/{block_id}",
    response_model=OperationalBlockRead,
    summary="Get a single OperationalBlock",
)
def get_operational_block(block_id: str, db: Session = Depends(get_db)):
    """Fetch a single operational block with full relationship data."""
    block = ob_repo.get(db, block_id)
    if not block:
        raise HTTPException(status_code=404, detail=f"OperationalBlock '{block_id}' not found")
    return block
