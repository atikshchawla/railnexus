from fastapi import APIRouter, Depends
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.api.schemas.maintenance import MaintenanceCreate
from backend.database.connection import get_db, create_tables
from backend.database.models.maintenance import MaintenanceRequest
from backend.database.models.prediction import Prediction
from backend.database.models.train import TmsMovement, Train
from backend.repositories.maintenance_repository import MaintenanceRepository
from backend.services.maintenance_service import MaintenanceService
from backend.services.prediction_service import PredictionService

router = APIRouter(prefix="/demo", tags=["demo"])
maintenance_repository = MaintenanceRepository()
maintenance_service = MaintenanceService(maintenance_repository)
prediction_service = PredictionService()


def model_features(section_id: str, department: str, location_km: float, planned_duration: int) -> dict:
    return {
        "asset_age_days": 2500,
        "days_since_last_maintenance": 180,
        "previous_failure_count": 2,
        "lifetime_tonnage_mgt": 420.0,
        "tonnage_since_last_maintenance_mgt": 85.0,
        "daily_train_count": 120,
        "daily_tonnage_mgt": 2.5,
        "inspection_score": 55,
        "rainfall_mm": 20.0,
        "temperature_mean_c": 32.0,
        "max_wind_speed_kmh": 30.0,
        "is_heavy_rain_day": False,
        "asset_type": "TRACK_CIRCUIT",
        "department": department,
        "section_id": section_id,
        "planned_duration_minutes": planned_duration,
        "severity_score": 8,
        "workers_required": 8,
        "equipment_count": 3,
        "workload_per_worker": 15.0,
        "weather_risk": 0.25,
        "congestion_score": 0.4,
        "current_delay_minutes": 10,
        "window_average_delay_minutes": 8,
        "window_peak_delay_minutes": 20,
        "accumulated_tonnage_mgt": 420.0,
        "trains_in_section": 12,
        "section_complexity": 0.7,
        "traffic_density": 0.8,
        "safety_critical": True,
        "is_heatwave_day": False,
        "is_rain_day": True,
        "request_hour": 10,
        "request_day_of_week": 1,
        "request_month": 9,
        "request_is_weekend": False,
        "location_km_marker": location_km,
        "window_train_count": 25,
        "planned_start_hour": 10,
        "work_type": "RAIL_REPLACEMENT",
        "priority": "MEDIUM",
    }


@router.post("/seed")
def seed_demo(db: Session = Depends(get_db)) -> dict:
    """Create deterministic Chennai demo records and run every ML model once."""
    create_tables()
    section_id = "AJJ-SHU"
    requests = [
        ("DEMO-CHN-001", "ENGG", 12.5, 120, True),
        ("DEMO-CHN-002", "TRD", 14.0, 90, False),
        ("DEMO-CHN-003", "SNT", 16.0, 75, False),
    ]
    created_ids: list[str] = []
    prediction_ids: list[str] = []

    for request_id, department, location_km, duration, safety_critical in requests:
        existing = db.get(MaintenanceRequest, request_id)
        if existing is None:
            payload = MaintenanceCreate(
                id=request_id,
                section_id=section_id,
                department=department,
                work_type="RAIL_REPLACEMENT",
                location_km=location_km,
                priority="MEDIUM",
                safety_critical=safety_critical,
                deadline_minutes=720,
                earliest_start_minute=480,
                latest_end_minute=900,
                equipment_ids=[f"DEMO-EQ-{request_id[-3:] }"],
                model_features=model_features(section_id, department, location_km, duration),
            )
            existing = maintenance_service.create(db, payload)
        created_ids.append(existing.id)
        latest_prediction = db.scalar(
            select(Prediction)
            .where(Prediction.maintenance_request_id == existing.id)
            .order_by(Prediction.created_at.desc())
        )
        if latest_prediction is None:
            latest_prediction = prediction_service.predict(db, existing)
        prediction_ids.append(latest_prediction.id)

    train_specs = [
        ("12005", "passenger", "Chennai", "Arakkonam"),
        ("FRT-CHN-01", "freight", "Chennai", "Sholinghur"),
    ]
    train_ids: list[str] = []
    for number, service_type, origin, destination in train_specs:
        train = db.scalar(select(Train).where(Train.train_number == number))
        if train is None:
            train = Train(train_number=number, service_type=service_type, origin=origin, destination=destination)
            db.add(train)
            db.commit()
            db.refresh(train)
        train_ids.append(train.id)

    movement_specs = [(train_ids[0], 510, 0.0), (train_ids[1], 780, 0.0)]
    for train_id, scheduled_minute, delay_minutes in movement_specs:
        movement_exists = db.scalar(
            select(TmsMovement).where(
                TmsMovement.train_id == train_id,
                TmsMovement.section_id == section_id,
                TmsMovement.scheduled_minute == scheduled_minute,
            )
        )
        if movement_exists is None:
            db.add(TmsMovement(
                train_id=train_id,
                section_id=section_id,
                movement_date=datetime.utcnow(),
                scheduled_minute=scheduled_minute,
                actual_minute=scheduled_minute + int(delay_minutes),
                delay_minutes=delay_minutes,
            ))
    db.commit()

    return {
        "status": "ready",
        "division": "SR_CHENNAI",
        "section_id": section_id,
        "maintenance_request_ids": created_ids,
        "prediction_ids": prediction_ids,
        "train_ids": train_ids,
        "message": "Demo requests were scored by the live ML pipeline.",
    }
