"""Seed the database with realistic blocks, topology, and train data."""

import csv
import datetime
import logging
from pathlib import Path

from sqlalchemy.orm import Session

from backend.database.connection import SessionLocal
from backend.database.models.block import BlockRecord
from backend.database.models.maintenance import MaintenanceRequest
from backend.database.models.topology import NetworkTopology
from backend.services.rules import derive_urgency_tier, create_audit_entry

logger = logging.getLogger(__name__)

AI_ML_DIR = Path(__file__).resolve().parents[2] / "ai_ml"
TOPOLOGY_CSV = AI_ML_DIR / "data" / "raw" / "network_topology.csv"
BLOCK_HISTORY_CSV = AI_ML_DIR / "data" / "curated" / "maintenance" / "block_execution_history.csv"
ASSET_HISTORY_CSV = AI_ML_DIR / "data" / "curated" / "maintenance" / "asset_condition_history.csv"


def _seed_topology(db: Session) -> None:
    """Load network topology from the AI/ML CSV if the table is empty."""
    if db.query(NetworkTopology).first() is not None:
        return
    if not TOPOLOGY_CSV.exists():
        logger.warning("Topology CSV not found at %s — skipping", TOPOLOGY_CSV)
        return

    count = 0
    with open(TOPOLOGY_CSV, newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            record = NetworkTopology(
                division=row["division"],
                section_id=row["section_id"],
                start_station=row["start_station"],
                end_station=row["end_station"],
                start_km=float(row["start_km"]),
                end_km=float(row["end_km"]),
                distance_km=float(row["distance_km"]),
                mps_kmh=float(row["mps_kmh"]),
                asset_id=row["asset_id"],
                asset_type=row["asset_type"],
                department=row["department"],
                km_marker=float(row["km_marker"]),
            )
            db.add(record)
            count += 1
    db.commit()
    logger.info("Seeded %d topology records", count)


def _seed_blocks(db: Session) -> None:
    """Create realistic seed blocks if none exist."""
    if db.query(BlockRecord).first() is not None:
        return

    today = datetime.datetime.utcnow().date().isoformat()

    blocks = [
        {
            "id": "BLK-4521",
            "department": "Engg",
            "category": "IMR",
            "description": "Rail fracture repair — weld joint replacement at km 12.5",
            "location": {"kmStart": 10.5, "kmEnd": 14.0, "line": "UP"},
            "scheduledWindow": {"start": f"{today}T08:00:00Z", "end": f"{today}T10:00:00Z"},
            "urgency": {"timeToBreachHours": 18},
            "status": "Under review",
            "source": {"system": "TMS", "lastUpdated": "2 min ago"},
            "auditTrail": [create_audit_entry("R. Sharma", "JE/PWay", "Acknowledged")],
        },
        {
            "id": "BLK-4520",
            "department": "S&T",
            "category": "PM",
            "description": "Track circuit relay replacement — block instrument overhaul",
            "location": {"kmStart": 16.5, "kmEnd": 19.5, "line": "DN"},
            "scheduledWindow": {"start": f"{today}T10:00:00Z", "end": f"{today}T12:30:00Z"},
            "urgency": {"timeToBreachHours": 336},
            "status": "Submitted",
            "source": {"system": "TDMS", "lastUpdated": "8 min ago"},
            "auditTrail": [],
        },
        {
            "id": "BLK-4519",
            "department": "TRD",
            "category": "OBS",
            "description": "OHE mast foundation inspection — catenary tension measurement",
            "location": {"kmStart": 4.5, "kmEnd": 9.0, "line": "UP/DN"},
            "scheduledWindow": {"start": f"{today}T14:00:00Z", "end": f"{today}T16:30:00Z"},
            "urgency": {"timeToBreachHours": 48},
            "status": "Under review",
            "source": {"system": "SMMS", "lastUpdated": "15 min ago"},
            "auditTrail": [create_audit_entry("M. Kumar", "SSE/TRD", "Acknowledged")],
        },
        {
            "id": "BLK-4518",
            "department": "Engg",
            "category": "PM",
            "description": "Ballast tamping and alignment — scheduled preventive maintenance",
            "location": {"kmStart": 0.0, "kmEnd": 5.0, "line": "UP"},
            "scheduledWindow": {"start": f"{today}T06:00:00Z", "end": f"{today}T08:30:00Z"},
            "urgency": {"timeToBreachHours": None},
            "status": "Approved",
            "source": {"system": "Manual", "lastUpdated": "1 hr ago"},
            "auditTrail": [
                create_audit_entry("A. Singh", "SSE/PWay", "Acknowledged"),
                create_audit_entry("Controller", "DOM/AJJ", "Approved"),
            ],
        },
        {
            "id": "BLK-4517",
            "department": "S&T",
            "category": "IMR",
            "description": "Point machine motor replacement — urgent after inspection failure",
            "location": {"kmStart": 12.0, "kmEnd": 13.5, "line": "DN"},
            "scheduledWindow": {"start": f"{today}T09:00:00Z", "end": f"{today}T11:00:00Z"},
            "urgency": {"timeToBreachHours": 12},
            "status": "Under review",
            "source": {"system": "TMS", "lastUpdated": "5 min ago"},
            "auditTrail": [create_audit_entry("P. Verma", "JE/Sig", "Acknowledged")],
        },
        {
            "id": "BLK-4516",
            "department": "TRD",
            "category": "IMR",
            "description": "Broken insulator replacement — OHE section isolation required",
            "location": {"kmStart": 15.0, "kmEnd": 18.0, "line": "UP"},
            "scheduledWindow": {"start": f"{today}T11:00:00Z", "end": f"{today}T13:30:00Z"},
            "urgency": {"timeToBreachHours": 6},
            "status": "Submitted",
            "source": {"system": "TMS", "lastUpdated": "Just now"},
            "auditTrail": [],
        },
    ]

    for b in blocks:
        b["urgency"]["tier"] = derive_urgency_tier(b["urgency"]["timeToBreachHours"])

        # Generate AI suggestion for blocks under review
        ai_sug = None
        if b["status"] == "Under review":
            from backend.services.ai_integration import generate_ai_suggestion
            ai_sug = generate_ai_suggestion(
                {"blockAId": b["id"]},
                block_a={"id": b["id"], "department": b["department"], "category": b["category"],
                          "location": b["location"], "urgency": b["urgency"]},
            )

        record = BlockRecord(
            id=b["id"],
            department=b["department"],
            category=b["category"],
            description=b["description"],
            location=b["location"],
            scheduledWindow=b["scheduledWindow"],
            urgency=b["urgency"],
            status=b["status"],
            source=b["source"],
            auditTrail=b["auditTrail"],
            aiSuggestion=ai_sug,
        )
        db.add(record)

    db.commit()
    logger.info("Seeded %d block records", len(blocks))


def _seed_maintenance(db: Session) -> None:
    """Seed request-time examples from curated history for AI API workflows."""
    if db.query(MaintenanceRequest).first() is not None or not BLOCK_HISTORY_CSV.exists():
        return

    numeric_fields = {
        "location_km_marker", "safety_critical", "inspection_score", "severity_score",
        "planned_duration_minutes", "section_complexity", "workers_required", "equipment_count",
        "workload_per_worker", "trains_in_section", "daily_train_count", "daily_tonnage_mgt",
        "accumulated_tonnage_mgt", "window_train_count", "window_average_delay_minutes",
        "window_peak_delay_minutes", "traffic_density", "congestion_score", "current_delay_minutes",
        "temperature_mean_c", "rainfall_mm", "max_wind_speed_kmh", "weather_risk",
        "is_heavy_rain_day", "is_heatwave_day", "is_rain_day",
    }
    condition_by_type: dict[str, dict[str, str]] = {}
    if ASSET_HISTORY_CSV.exists():
        with open(ASSET_HISTORY_CSV, newline="", encoding="utf-8-sig") as fh:
            for row in csv.DictReader(fh):
                condition_by_type.setdefault(row["asset_type"], row)

    seeded: list[MaintenanceRequest] = []
    with open(BLOCK_HISTORY_CSV, newline="", encoding="utf-8-sig") as fh:
        for index, row in enumerate(csv.DictReader(fh)):
            if index >= 6:
                break
            timestamp = datetime.datetime.fromisoformat(row["request_timestamp"])
            condition = condition_by_type.get(row["asset_type"], {})
            model_features: dict[str, object] = {
                key: (float(value) if key in numeric_fields else value)
                for key, value in row.items()
                if value != "" and key not in {"task_id", "actual_start_time", "actual_end_time"}
            }
            model_features.update({
                key: float(condition[key])
                for key in (
                    "asset_age_days", "days_since_last_maintenance", "previous_failure_count",
                    "lifetime_tonnage_mgt", "tonnage_since_last_maintenance_mgt",
                )
                if condition.get(key) not in (None, "")
            })
            model_features.update({
                "planned_start_hour": timestamp.hour,
                "request_hour": timestamp.hour,
                "request_day_of_week": timestamp.weekday(),
                "request_month": timestamp.month,
                "request_is_weekend": int(timestamp.weekday() >= 5),
            })
            for key in ("daily_train_count", "daily_tonnage_mgt", "rainfall_mm", "temperature_mean_c", "max_wind_speed_kmh", "is_heavy_rain_day"):
                if key not in model_features and condition.get(key) not in (None, ""):
                    model_features[key] = float(condition[key])

            request_id = f"MR-SEED-{index + 1:03d}"
            seeded.append(MaintenanceRequest(
                id=request_id,
                asset_id=row.get("asset_id"),
                section_id=row["section_id"],
                department=row["department"],
                work_type=row["work_type"],
                location_km=float(row["location_km_marker"]),
                priority=row["priority"],
                safety_critical=bool(int(row["safety_critical"])),
                request_data={
                    "id": request_id,
                    "asset_id": row.get("asset_id"),
                    "section_id": row["section_id"],
                    "department": row["department"],
                    "work_type": row["work_type"],
                    "location_km": float(row["location_km_marker"]),
                    "priority": row["priority"],
                    "safety_critical": bool(int(row["safety_critical"])),
                    "model_features": model_features,
                },
            ))
    db.add_all(seeded)
    db.commit()
    logger.info("Seeded %d maintenance requests with model features", len(seeded))


def seed() -> None:
    db = SessionLocal()
    try:
        _seed_topology(db)
        _seed_blocks(db)
        _seed_maintenance(db)
    except Exception as exc:
        logger.error("Seeding failed: %s", exc)
    finally:
        db.close()


if __name__ == "__main__":
    seed()
