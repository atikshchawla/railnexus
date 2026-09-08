from datetime import datetime
from pydantic import BaseModel, ConfigDict


class PredictionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    maintenance_request_id: str
    failure_risk_probability: float
    priority_score: float
    urgency_level: str
    predicted_duration_minutes: float
    overrun_probability: float
    trains_affected: float
    total_delay_minutes: float
    raw_output: dict
    created_at: datetime


class PipelineOptimizeRequest(BaseModel):
    request_ids: list[str]
    max_group_size: int = 4
    max_spatial_gap_km: float = 5.0
    weights: dict[str, float] = {}
