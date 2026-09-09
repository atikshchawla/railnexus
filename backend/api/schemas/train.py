from datetime import datetime
from pydantic import BaseModel, ConfigDict


class TrainCreate(BaseModel):
    train_number: str
    service_type: str = "passenger"
    origin: str | None = None
    destination: str | None = None


class TrainRead(TrainCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    active: bool


class MovementCreate(BaseModel):
    train_id: str
    section_id: str
    movement_date: datetime
    scheduled_minute: int
    actual_minute: int | None = None
    delay_minutes: float = 0.0


class MovementRead(MovementCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
