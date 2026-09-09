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


@router.get("", response_model=list[MaintenanceRead])
def list_maintenance(status: str | None = Query(default=None), db: Session = Depends(get_db)):
    return repository.list(db, status=status)


@router.post("", response_model=MaintenanceRead, status_code=201)
def create_maintenance(payload: MaintenanceCreate, db: Session = Depends(get_db)):
    if repository.get(db, payload.id) if payload.id else None:
        raise HTTPException(status_code=409, detail="maintenance request id already exists")
    try:
        return service.create(db, payload)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.get("/{request_id}", response_model=MaintenanceRead)
def get_maintenance(request_id: str, db: Session = Depends(get_db)):
    request = repository.get(db, request_id)
    if request is None:
        raise HTTPException(status_code=404, detail="maintenance request not found")
    return request


@router.patch("/{request_id}/status", response_model=MaintenanceRead)
def update_status(request_id: str, payload: MaintenanceStatusUpdate, db: Session = Depends(get_db)):
    request = repository.get(db, request_id)
    if request is None:
        raise HTTPException(status_code=404, detail="maintenance request not found")
    return repository.update_status(db, request, payload.status)


@router.post("/{request_id}/predict", response_model=PredictionRead)
def predict_maintenance(request_id: str, db: Session = Depends(get_db)):
    request = repository.get(db, request_id)
    if request is None:
        raise HTTPException(status_code=404, detail="maintenance request not found")
    try:
        return prediction_service.predict(db, request)
    except (KeyError, TypeError, ValueError) as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
