from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class AssetCreate(BaseModel):
    asset_code: str = Field(min_length=1, max_length=80)
    asset_type: str
    section_id: str
    location_km: float = Field(ge=0)
    department: str = "ENGG"
    commissioned_at: datetime | None = None
    status: str = "active"
    metadata: dict = Field(default_factory=dict)


class AssetRead(AssetCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    created_at: datetime
    updated_at: datetime
