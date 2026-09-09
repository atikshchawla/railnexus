from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.api.schemas.maintenance import MaintenanceCreate, MaintenanceRead, MaintenanceStatusUpdate
from backend.api.schemas.prediction import PredictionRead
from backend.database.connection import get_db
from backend.repositories.maintenance_repository import MaintenanceRepository
from backend.services.maintenance_service import MaintenanceService
from backend.services.prediction_service import PredictionService

router = APIRouter(prefix="/maintenance", tags=["maintenance"])
repository = MaintenanceRepository()
service = MaintenanceService(repository)
prediction_service = PredictionService()


def serialize_maintenance(request):
    return {
        "id": request.id,
        "asset_id": request.asset_id,
        "section_id": request.section_id,
        "department": request.department,
        "work_type": request.work_type,
        "location_km": request.location_km,
        "priority": request.priority,
        "safety_critical": request.safety_critical,
        "deadline_minutes": request.deadline_minutes,
        "model_features": (request.request_data or {}).get("model_features", {}),
        "equipment_ids": (request.request_data or {}).get("equipment_ids", []),
        "requires_power_isolation": (request.request_data or {}).get("requires_power_isolation", False),
        "requires_disconnection": (request.request_data or {}).get("requires_disconnection", False),
        "earliest_start_minute": (request.request_data or {}).get("earliest_start_minute"),
        "latest_end_minute": (request.request_data or {}).get("latest_end_minute"),
        "status": request.status,
        "created_at": request.created_at,
    }


@router.get("", response_model=list[MaintenanceRead])
def list_maintenance(status: str | None = Query(default=None), db: Session = Depends(get_db)):
    return [serialize_maintenance(request) for request in repository.list(db, status=status)]


@router.post("", response_model=MaintenanceRead, status_code=201)
def create_maintenance(payload: MaintenanceCreate, db: Session = Depends(get_db)):
    if repository.get(db, payload.id) if payload.id else None:
        raise HTTPException(status_code=409, detail="maintenance request id already exists")
    try:
        return serialize_maintenance(service.create(db, payload))
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.get("/{request_id}", response_model=MaintenanceRead)
def get_maintenance(request_id: str, db: Session = Depends(get_db)):
    request = repository.get(db, request_id)
    if request is None:
        raise HTTPException(status_code=404, detail="maintenance request not found")
    return serialize_maintenance(request)


@router.patch("/{request_id}/status", response_model=MaintenanceRead)
def update_status(request_id: str, payload: MaintenanceStatusUpdate, db: Session = Depends(get_db)):
    request = repository.get(db, request_id)
    if request is None:
        raise HTTPException(status_code=404, detail="maintenance request not found")
    return serialize_maintenance(repository.update_status(db, request, payload.status))


@router.post("/{request_id}/predict", response_model=PredictionRead)
def predict_maintenance(request_id: str, db: Session = Depends(get_db)):
    request = repository.get(db, request_id)
    if request is None:
        raise HTTPException(status_code=404, detail="maintenance request not found")
    try:
        return prediction_service.predict(db, request)
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except (KeyError, TypeError, ValueError) as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
