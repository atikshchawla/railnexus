from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.api.schemas.train import MovementCreate, MovementRead, TrainCreate, TrainRead
from backend.database.connection import get_db
from backend.database.models.train import TmsMovement, Train
from backend.repositories.train_repository import TrainRepository

router = APIRouter(prefix="/trains", tags=["trains"])
repository = TrainRepository()


@router.get("", response_model=list[TrainRead])
def list_trains(db: Session = Depends(get_db)):
    return repository.list(db)


@router.post("", response_model=TrainRead, status_code=201)
def create_train(payload: TrainCreate, db: Session = Depends(get_db)):
    return repository.create(db, Train(**payload.model_dump()))


@router.post("/movements", status_code=201)
def create_movement(payload: MovementCreate, db: Session = Depends(get_db)):
    movement = repository.add_movement(db, TmsMovement(**payload.model_dump()))
    return {"id": movement.id, "status": "recorded"}


@router.get("/movements", response_model=list[MovementRead])
def list_movements(db: Session = Depends(get_db)):
    return list(db.scalars(select(TmsMovement).order_by(TmsMovement.scheduled_minute)))
