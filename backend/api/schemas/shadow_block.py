from pydantic import BaseModel, Field


class ShadowBlockRequest(BaseModel):
    request_ids: list[str] = Field(min_length=2)
    max_spatial_gap_km: float = Field(default=5.0, gt=0)


class ShadowBlockResponse(BaseModel):
    request_ids: list[str]
    compatible: bool
    reasons: list[str]
    cautions: list[str]
