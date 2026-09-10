"""RailNexus backend application entrypoint."""

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from ai_ml.optimizer import CorridorWindow, MaintenanceRequest, OptimizerWeights, check_compatibility, optimize_requests

from backend.api.routes import assets, demo, demo_gateway, maintenance, optimizer, predictions, shadow_blocks, topology, trains
from backend.database.connection import create_tables
from backend.utils.config import get_settings
from backend.utils.logging import configure_logging


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    create_tables()
    yield


settings = get_settings()
app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(assets.router, prefix="/api")
app.include_router(maintenance.router, prefix="/api")
app.include_router(predictions.router, prefix="/api")
app.include_router(trains.router, prefix="/api")
app.include_router(shadow_blocks.router, prefix="/api")
app.include_router(optimizer.router, prefix="/api")
app.include_router(topology.router, prefix="/api")
app.include_router(demo.router, prefix="/api")
app.include_router(demo_gateway.router, prefix="/api")


class LegacyRequestPayload(BaseModel):
    id: str
    section_id: str
    department: str
    work_type: str
    location_km: float
    predicted_duration_minutes: float = Field(gt=0)
    overrun_probability: float = Field(default=0.0, ge=0.0, le=1.0)
    trains_affected: float = Field(default=0.0, ge=0.0)
    train_impact_minutes: float = Field(default=0.0, ge=0.0)
    priority: str = "MEDIUM"
    safety_critical: bool = False
    equipment_ids: list[str] = Field(default_factory=list)
    requires_power_isolation: bool = False
    requires_disconnection: bool = False
    earliest_start_minute: int | None = None
    latest_end_minute: int | None = None
    failure_risk_probability: float = Field(default=0.0, ge=0.0, le=1.0)
    deadline_minutes: int | None = Field(default=None, ge=0)

    def to_domain(self) -> MaintenanceRequest:
        values = self.model_dump()
        values["equipment_ids"] = tuple(self.equipment_ids)
        return MaintenanceRequest(**values)


class LegacyOptimizePayload(BaseModel):
    requests: list[LegacyRequestPayload] = Field(min_length=1)
    max_group_size: int = Field(default=4, ge=2, le=8)
    max_spatial_gap_km: float = Field(default=10.0, gt=0, le=50)
    weights: dict[str, float] = Field(default_factory=dict)
    corridors: list[dict] | None = None


@app.post("/optimize")
def legacy_optimize(payload: LegacyOptimizePayload) -> dict:
    requests = [request.to_domain() for request in payload.requests]
    if len({request.id for request in requests}) != len(requests):
        raise HTTPException(status_code=422, detail="request ids must be unique")
    corridors = [CorridorWindow(**corridor) for corridor in payload.corridors] if payload.corridors else None
    return optimize_requests(
        requests,
        weights=OptimizerWeights(**payload.weights) if payload.weights else OptimizerWeights(),
        max_group_size=payload.max_group_size,
        max_spatial_gap_km=payload.max_spatial_gap_km,
        corridors=corridors,
    ).to_dict()


@app.post("/shadow-blocks")
def legacy_shadow_blocks(payload: LegacyOptimizePayload) -> dict:
    requests = [request.to_domain() for request in payload.requests]
    opportunities = []
    for index, request in enumerate(requests):
        for other in requests[index + 1:]:
            compatibility = check_compatibility(request, other, max_spatial_gap_km=payload.max_spatial_gap_km)
            opportunities.append({
                "request_ids": [request.id, other.id],
                "compatible": compatibility.compatible,
                "reasons": compatibility.reasons,
                "cautions": compatibility.cautions,
            })
    return {"opportunities": opportunities}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "railnexus-backend"}


@app.get("/api/db-info")
def db_info() -> dict[str, str]:
    return {"database": settings.database_url.split("://", 1)[0]}
