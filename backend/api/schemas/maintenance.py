from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class MaintenanceCreate(BaseModel):
    id: str | None = None
    asset_id: str | None = None
    section_id: str
    department: str
    work_type: str
    location_km: float = Field(ge=0)
    priority: str = "MEDIUM"
    safety_critical: bool = False
    deadline_minutes: int | None = Field(default=None, ge=0)
    model_features: dict = Field(default_factory=dict)
    equipment_ids: list[str] = Field(default_factory=list)
    requires_power_isolation: bool = False
    requires_disconnection: bool = False
    earliest_start_minute: int | None = Field(default=None, ge=0)
    latest_end_minute: int | None = Field(default=None, ge=0)


class MaintenanceRead(MaintenanceCreate):
    model_config = ConfigDict(from_attributes=True)
    model_features: dict = Field(default_factory=dict, validation_alias="request_data")
    id: str
    status: str
    created_at: datetime


class MaintenanceStatusUpdate(BaseModel):
    status: str = Field(pattern="^(pending|approved|scheduled|in_progress|completed|cancelled)$")
