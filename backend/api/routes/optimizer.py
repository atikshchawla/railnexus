from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.api.schemas.prediction import PipelineOptimizeRequest
from backend.database.connection import get_db
from backend.services.optimization_service import OptimizationService, is_pipeline_ready

router = APIRouter(prefix="/optimizer", tags=["optimizer"])
optimization_service = OptimizationService()

# Retain module-level helper for backward compatibility
_is_pipeline_ready = is_pipeline_ready


@router.post("/optimize")
def optimize(payload: PipelineOptimizeRequest, db: Session = Depends(get_db)):
    """Run the ML optimizer; persist to Phase 5 relational schema and serve result."""
    return optimization_service.optimize(db, payload)


@router.post("/overrides/{cache_id}")
def save_overrides(
    cache_id: str,
    overrides: dict = Body(...),
    db: Session = Depends(get_db),
):
    """Persist operator time/dissolution overrides for a cached optimizer result."""
    ok = optimization_service.save_legacy_overrides(db, cache_id, overrides)
    if not ok:
        raise HTTPException(status_code=404, detail="optimizer cache entry not found")
    return {"ok": True, "cache_id": cache_id}
