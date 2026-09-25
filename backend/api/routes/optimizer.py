from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ai_ml.optimizer import OptimizerWeights
from backend.api.schemas.prediction import PipelineOptimizeRequest
from backend.database.connection import get_db
from backend.repositories.maintenance_repository import MaintenanceRepository
from backend.services.maintenance_service import MaintenanceService
from backend.services.prediction_service import get_pipeline
from backend.repositories.topology_repository import TopologyRepository

router = APIRouter(prefix="/optimizer", tags=["optimizer"])
repository = MaintenanceRepository()
service = MaintenanceService(repository)
topology_repository = TopologyRepository()

# Minimum set of ML features the pipeline needs to score a request.
_REQUIRED_FEATURES = {
    "asset_age_days", "days_since_last_maintenance", "previous_failure_count",
    "lifetime_tonnage_mgt", "tonnage_since_last_maintenance_mgt", "daily_train_count",
    "daily_tonnage_mgt", "inspection_score", "rainfall_mm", "temperature_mean_c",
    "max_wind_speed_kmh", "is_heavy_rain_day", "asset_type", "department", "section_id",
}


def _is_pipeline_ready(pipeline_dict: dict) -> bool:
    """Return True if the normalised pipeline dict carries all required ML features."""
    features = pipeline_dict.get("model_features") or {}
    return _REQUIRED_FEATURES.issubset(features.keys())


@router.post("/optimize")
def optimize(payload: PipelineOptimizeRequest, db: Session = Depends(get_db)):
    requests = [repository.get(db, request_id) for request_id in payload.request_ids]
    if any(request is None for request in requests):
        raise HTTPException(status_code=404, detail="one or more maintenance requests not found")

    # Normalise every request into the shape the pipeline expects, then
    # separate those that are ML-ready from those that aren't.
    all_pipeline = [(r, service.to_pipeline_request(r)) for r in requests if r is not None]
    pipeline_ready = [(r, p) for r, p in all_pipeline if _is_pipeline_ready(p)]
    skipped = [r.id for r, p in all_pipeline if not _is_pipeline_ready(p)]

    if not pipeline_ready:
        raise HTTPException(
            status_code=422,
            detail="No requests carry the required ML model features. Run /api/demo/seed first.",
        )

    section_ids = [r.section_id for r, _ in pipeline_ready]
    if not topology_repository.sections_exist(db, section_ids):
        raise HTTPException(status_code=422, detail="one or more maintenance requests use an unknown section_id")

    raw_requests = [p for _, p in pipeline_ready]
    try:
        result = get_pipeline().optimize(
            raw_requests,
            max_group_size=payload.max_group_size,
            max_spatial_gap_km=payload.max_spatial_gap_km,
            weights=OptimizerWeights(**payload.weights) if payload.weights else OptimizerWeights(),
        )
        if skipped:
            result["skipped_request_ids"] = skipped
        return result
    except (KeyError, TypeError, ValueError) as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
