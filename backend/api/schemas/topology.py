from pydantic import BaseModel, ConfigDict


class TopologyRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    division: str
    section_id: str
    start_station: str
    end_station: str
    start_km: float
    end_km: float
    distance_km: float
    mps_kmh: float
    asset_id: str
    asset_type: str
    department: str
    km_marker: float
