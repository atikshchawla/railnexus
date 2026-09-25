"""Authoritative Conflict API Routes for RailNexus ABP (Phase 6B)."""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from backend.api.schemas.conflict import (
    ConflictDetectRequest,
    ConflictRead,
    ConflictResolutionCreate,
    ConflictResolutionRead,
)
from backend.database.connection import get_db
from backend.services.conflict_service import ConflictService

router = APIRouter(prefix="/conflicts", tags=["conflicts"])
conflict_service = ConflictService()


@router.post("/detect", response_model=list[ConflictRead])
def detect_conflicts(payload: ConflictDetectRequest, db: Session = Depends(get_db)):
    """Detect and persist authoritative server-side conflicts for block proposals."""
    return conflict_service.detect_conflicts(db, payload)


@router.get("", response_model=list[ConflictRead])
def list_conflicts(
    run_id: str | None = None,
    proposal_id: str | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
):
    """List conflicts with optional filtering by run, proposal, or status."""
    return conflict_service.list_conflicts(
        db, run_id=run_id, proposal_id=proposal_id, status=status
    )


@router.get("/{conflict_id}", response_model=ConflictRead)
def get_conflict(conflict_id: str, db: Session = Depends(get_db)):
    """Get single conflict and its complete resolution audit history."""
    return conflict_service.get_conflict(db, conflict_id)


@router.post(
    "/{conflict_id}/resolve",
    response_model=ConflictResolutionRead,
    status_code=status.HTTP_201_CREATED,
)
def resolve_conflict(
    conflict_id: str,
    payload: ConflictResolutionCreate,
    db: Session = Depends(get_db),
):
    """Record a conflict resolution event without promoting to operational block."""
    return conflict_service.resolve_conflict(db, conflict_id, payload)
