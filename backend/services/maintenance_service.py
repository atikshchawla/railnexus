from uuid import uuid4

from sqlalchemy.orm import Session

from backend.api.schemas.maintenance import MaintenanceCreate
from backend.database.models.maintenance import MaintenanceRequest
from backend.repositories.maintenance_repository import MaintenanceRepository
from backend.services.topology_service import TopologyService


class MaintenanceService:
    def __init__(self, repository: MaintenanceRepository | None = None, topology_service: TopologyService | None = None):
        self.repository = repository or MaintenanceRepository()
        self.topology_service = topology_service or TopologyService()

    def create(self, db: Session, payload: MaintenanceCreate) -> MaintenanceRequest:
        self.topology_service.validate_section(db, payload.section_id)
        request = MaintenanceRequest(
            id=payload.id or f"MR-{uuid4().hex[:10].upper()}",
            asset_id=payload.asset_id,
            section_id=payload.section_id,
            department=payload.department,
            work_type=payload.work_type,
            location_km=payload.location_km,
            priority=payload.priority.upper(),
            safety_critical=payload.safety_critical,
            deadline_minutes=payload.deadline_minutes,
            request_data=payload.model_dump(),
        )
        return self.repository.create(db, request)

    @staticmethod
    def to_pipeline_request(request: MaintenanceRequest) -> dict:
        """Build the dict that ModelPipeline.score_request() expects.

        The pipeline always reads ML features from ``request["model_features"]``.
        Stored records come in two shapes:
          - nested:  {"model_features": {<features>}, "id": ..., ...}
          - flat:    {"asset_age_days": ..., "department": ..., ...}

        Both are normalised here so the pipeline always sees the nested form.
        """
        raw = dict(request.request_data or {})

        # If already stored with the nested key, use it directly.
        if "model_features" in raw and isinstance(raw["model_features"], dict):
            features = raw["model_features"]
        else:
            # Flat storage — everything in raw IS the feature dict.
            features = {k: v for k, v in raw.items() if k not in (
                "id", "section_id", "department", "work_type", "location_km",
                "priority", "safety_critical", "deadline_minutes",
                "asset_id", "equipment_ids", "earliest_start_minute",
                "latest_end_minute", "requires_power_isolation", "requires_disconnection",
            )}

        return {
            "id": request.id,
            "section_id": request.section_id,
            "department": request.department,
            "work_type": request.work_type,
            "location_km": request.location_km,
            "priority": request.priority,
            "safety_critical": request.safety_critical,
            "deadline_minutes": request.deadline_minutes,
            "equipment_ids": raw.get("equipment_ids", []),
            "earliest_start_minute": raw.get("earliest_start_minute"),
            "latest_end_minute": raw.get("latest_end_minute"),
            "requires_power_isolation": raw.get("requires_power_isolation", False),
            "requires_disconnection": raw.get("requires_disconnection", False),
            "model_features": features,
        }
