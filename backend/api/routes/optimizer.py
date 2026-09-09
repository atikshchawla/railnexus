from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ai_ml.optimizer import OptimizerWeights
from backend.api.schemas.prediction import PipelineOptimizeRequest
from backend.database.connection import get_db
from backend.repositories.maintenance_repository import MaintenanceRepository
from backend.services.maintenance_service import MaintenanceService
from backend.services.pipeline_loader import get_pipeline
from backend.repositories.topology_repository import TopologyRepository

router = APIRouter(prefix="/optimizer", tags=["optimizer"])
repository = MaintenanceRepository()
service = MaintenanceService(repository)
topology_repository = TopologyRepository()


@router.post("/optimize")
def optimize(payload: PipelineOptimizeRequest, db: Session = Depends(get_db)):
    requests = [repository.get(db, request_id) for request_id in payload.request_ids]
    if any(request is None for request in requests):
        raise HTTPException(status_code=404, detail="one or more maintenance requests not found")
    section_ids = [request.section_id for request in requests if request is not None]
    if not topology_repository.sections_exist(db, section_ids):
        raise HTTPException(status_code=422, detail="one or more maintenance requests use an unknown section_id")
    raw_requests = [service.to_pipeline_request(request) for request in requests if request is not None]
    try:
        pipeline = get_pipeline()
        if pipeline is None:
            raise HTTPException(status_code=503, detail="AI/ML pipeline is unavailable")
        return pipeline.optimize(
            raw_requests,
            max_group_size=payload.max_group_size,
            max_spatial_gap_km=payload.max_spatial_gap_km,
            weights=OptimizerWeights(**payload.weights) if payload.weights else OptimizerWeights(),
        )
    except (KeyError, TypeError, ValueError) as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
