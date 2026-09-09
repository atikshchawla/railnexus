from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.api.schemas.prediction import PredictionRead
from backend.database.connection import get_db
from backend.database.models.prediction import Prediction

router = APIRouter(prefix="/predictions", tags=["predictions"])


@router.get("", response_model=list[PredictionRead])
def list_predictions(db: Session = Depends(get_db)):
    return list(db.scalars(select(Prediction).order_by(Prediction.created_at.desc()).limit(100)))


@router.get("/{prediction_id}", response_model=PredictionRead)
def get_prediction(prediction_id: str, db: Session = Depends(get_db)):
    prediction = db.get(Prediction, prediction_id)
    if prediction is None:
        raise HTTPException(status_code=404, detail="prediction not found")
    return prediction
