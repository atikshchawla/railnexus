from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from backend.api.schemas.demo import DemoDecision, DemoRequest
from backend.database.models.demo import DemoIntegrationRequest
from backend.database.models.maintenance import MaintenanceRequest
from backend.services.prediction_service import PredictionService


TRAINED_SECTION_KM: dict[str, float] = {
    "AJJ-SHU": 0.0,
    "SHU-WJR": 21.3,
    "WJR-MCN": 36.2,
    "MCN-KPD": 43.9,
    "KPD-GYM": 60.9,
    "GYM-AB": 85.6,
    "AB-VN": 113.0,
    "VN-JTJ": 129.1,
}


class DemoGatewayService:
    def __init__(self, prediction_service: PredictionService | None = None):
        self.prediction_service = prediction_service or PredictionService()

    def ingest(self, db: Session, request: DemoRequest) -> DemoDecision:
        existing = db.get(DemoIntegrationRequest, str(request.request_id))
        if existing is not None:
            return self._decision(existing)
        if request.section_id not in TRAINED_SECTION_KM:
            raise ValueError(f"section_id is outside the trained AJJ-JTJ corridor: {request.section_id}")

        record = DemoIntegrationRequest(
            request_id=str(request.request_id),
            department=request.department,
            type=request.type,
            train_id=request.train_id,
            section_id=request.section_id,
            description=request.description,
            raised_at=request.raised_at.replace(tzinfo=None),
            status="received",
        )
        db.add(record)
        db.flush()

        maintenance_request_id: str | None = None
        if request.type == "maintenance_block":
            maintenance_request_id = f"DEMO-{request.request_id.hex[:12].upper()}"
            maintenance = MaintenanceRequest(
                id=maintenance_request_id,
                section_id=request.section_id,
                department=request.department,
                work_type="DEMO_MAINTENANCE_BLOCK",
                location_km=TRAINED_SECTION_KM[request.section_id],
                priority="HIGH",
                safety_critical=True,
                request_data=self._model_features(request),
            )
            db.add(maintenance)
            try:
                db.flush()
                self.prediction_service.predict(db, maintenance)
            except (KeyError, OSError, TypeError, ValueError):
                db.rollback()
                record = DemoIntegrationRequest(
                    request_id=str(request.request_id), department=request.department, type=request.type,
                    train_id=request.train_id, section_id=request.section_id, description=request.description,
                    raised_at=request.raised_at.replace(tzinfo=None), status="received",
                )
                db.add(record)
                db.flush()
                maintenance_request_id = None

        decision = self._make_decision(request, maintenance_request_id)
        record.status = decision.status
        record.resulting_state = decision.resulting_state
        record.maintenance_request_id = maintenance_request_id
        record.decided_at = decision.decided_at.replace(tzinfo=None)
        db.commit()
        return decision

    @staticmethod
    def _make_decision(request: DemoRequest, maintenance_request_id: str | None) -> DemoDecision:
        if request.type == "maintenance_block":
            notes = "Accepted by RailNexus maintenance and prediction pipeline"
            if maintenance_request_id is None:
                notes = "Accepted by RailNexus integration ledger; prediction unavailable"
            return DemoDecision(request_id=request.request_id, status="approved", section_id=request.section_id, resulting_state="maintenance", decided_at=datetime.now(timezone.utc), notes=notes)
        if request.type == "section_entry":
            return DemoDecision(request_id=request.request_id, status="approved", section_id=request.section_id, resulting_state="reserved", decided_at=datetime.now(timezone.utc), notes="Section-entry request accepted by RailNexus gateway")
        return DemoDecision(request_id=request.request_id, status="approved", section_id=request.section_id, resulting_state="occupied", decided_at=datetime.now(timezone.utc), notes="Running-status request recorded by RailNexus gateway")

    @staticmethod
    def _decision(record: DemoIntegrationRequest) -> DemoDecision:
        if record.status not in {"queued", "approved", "rerouted", "rejected"} or record.resulting_state is None or record.decided_at is None:
            raise ValueError(f"request {record.request_id} is still being processed")
        return DemoDecision(request_id=UUID(record.request_id), status=record.status, section_id=record.section_id, resulting_state=record.resulting_state, decided_at=record.decided_at.replace(tzinfo=timezone.utc), notes="Idempotent replay of stored RailNexus decision")

    @staticmethod
    def _model_features(request: DemoRequest) -> dict[str, object]:
        return {
            "asset_age_days": 2500, "days_since_last_maintenance": 180, "previous_failure_count": 2,
            "lifetime_tonnage_mgt": 420.0, "tonnage_since_last_maintenance_mgt": 85.0,
            "daily_train_count": 120, "daily_tonnage_mgt": 2.5, "inspection_score": 55,
            "rainfall_mm": 20.0, "temperature_mean_c": 32.0, "max_wind_speed_kmh": 30.0,
            "is_heavy_rain_day": False, "asset_type": "TRACK_CIRCUIT", "department": request.department,
            "section_id": request.section_id, "planned_duration_minutes": 120, "severity_score": 8,
            "workers_required": 8, "equipment_count": 3, "workload_per_worker": 15.0,
            "weather_risk": 0.25, "congestion_score": 0.4, "current_delay_minutes": 10,
            "window_average_delay_minutes": 8, "window_peak_delay_minutes": 20,
            "accumulated_tonnage_mgt": 420.0, "trains_in_section": 8, "section_complexity": 0.7,
            "traffic_density": 0.8, "safety_critical": True, "is_heatwave_day": False,
            "is_rain_day": True, "request_hour": request.raised_at.hour, "request_day_of_week": request.raised_at.weekday(),
            "request_month": request.raised_at.month, "request_is_weekend": request.raised_at.weekday() >= 5,
            "location_km_marker": TRAINED_SECTION_KM[request.section_id], "window_train_count": 8,
            "planned_start_hour": request.raised_at.hour, "work_type": "RAIL_REPLACEMENT", "priority": "HIGH",
        }
