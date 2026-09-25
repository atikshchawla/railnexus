"""Deterministic pre-Phase-5 legacy SQLite database seed fixture.

Constructs the exact legacy pre-Phase-5 database schema (prior to commit f0a3fb69)
and populates it with canonical pre-Phase-5 legacy data records.
This allows reproducible, deterministic testing of the Phase 5 Alembic migration.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
import sqlite3

FIXTURE_DATA_PATH = Path(__file__).parent / "pre_phase5_data.json"


def create_pre_phase5_database(db_path: str | Path) -> None:
    """Create a SQLite database at db_path matching the exact pre-Phase-5 schema and data."""
    db_path = Path(db_path)
    if db_path.exists():
        os.remove(db_path)

    db_path.parent.mkdir(parents=True, exist_ok=True)

    with open(FIXTURE_DATA_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()

    # 1. network_topology (legacy corridor table)
    cursor.execute("""
    CREATE TABLE network_topology (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        division VARCHAR(80) NOT NULL,
        section_id VARCHAR(80) NOT NULL,
        start_station VARCHAR(80) NOT NULL,
        end_station VARCHAR(80) NOT NULL,
        start_km FLOAT NOT NULL,
        end_km FLOAT NOT NULL,
        distance_km FLOAT NOT NULL,
        mps_kmh FLOAT NOT NULL,
        asset_id VARCHAR(120) NOT NULL,
        asset_type VARCHAR(80) NOT NULL,
        department VARCHAR(40) NOT NULL,
        km_marker FLOAT NOT NULL
    )
    """)
    cursor.execute("CREATE INDEX ix_network_topology_asset_id ON network_topology (asset_id)")
    cursor.execute("CREATE INDEX ix_network_topology_section_id ON network_topology (section_id)")
    for r in data["network_topology"]:
        cursor.execute(
            "INSERT INTO network_topology VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                r["id"], r["division"], r["section_id"], r["start_station"], r["end_station"],
                r["start_km"], r["end_km"], r["distance_km"], r["mps_kmh"], r["asset_id"],
                r["asset_type"], r["department"], r["km_marker"],
            ),
        )

    # 2. trains (legacy schema: active is INTEGER 1, priority_tier column does NOT exist)
    cursor.execute("""
    CREATE TABLE trains (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        train_number VARCHAR(40) NOT NULL,
        service_type VARCHAR(30) DEFAULT 'passenger' NOT NULL,
        origin VARCHAR(80),
        destination VARCHAR(80),
        active INTEGER DEFAULT 1 NOT NULL
    )
    """)
    cursor.execute("CREATE UNIQUE INDEX ix_trains_train_number ON trains (train_number)")
    for r in data["trains"]:
        cursor.execute(
            "INSERT INTO trains VALUES (?, ?, ?, ?, ?, ?)",
            (r["id"], r["train_number"], r["service_type"], r["origin"], r["destination"], r.get("active", 1)),
        )

    # 3. tms_movements (legacy movements table)
    cursor.execute("""
    CREATE TABLE tms_movements (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        train_id VARCHAR(36) NOT NULL,
        section_id VARCHAR(80) NOT NULL,
        movement_date DATETIME NOT NULL,
        scheduled_minute INTEGER NOT NULL,
        actual_minute INTEGER,
        delay_minutes FLOAT DEFAULT 0.0 NOT NULL
    )
    """)
    cursor.execute("CREATE INDEX ix_tms_movements_movement_date ON tms_movements (movement_date)")
    cursor.execute("CREATE INDEX ix_tms_movements_section_id ON tms_movements (section_id)")
    cursor.execute("CREATE INDEX ix_tms_movements_train_id ON tms_movements (train_id)")
    for r in data["tms_movements"]:
        cursor.execute(
            "INSERT INTO tms_movements VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                r["id"], r["train_id"], r["section_id"], r["movement_date"],
                r["scheduled_minute"], r["actual_minute"], r["delay_minutes"],
            ),
        )

    # 4. maintenance_requests (legacy schema: NO track_line, NO demanded_duration_minutes,
    # NO requires_power_isolation, NO requires_disconnection, NO equipment_ids, NO FK on section_id)
    cursor.execute("""
    CREATE TABLE maintenance_requests (
        id VARCHAR(80) NOT NULL PRIMARY KEY,
        asset_id VARCHAR(36),
        section_id VARCHAR(80) NOT NULL,
        department VARCHAR(40) NOT NULL,
        work_type VARCHAR(80) NOT NULL,
        location_km FLOAT NOT NULL,
        priority VARCHAR(20) DEFAULT 'MEDIUM' NOT NULL,
        safety_critical BOOLEAN DEFAULT 0 NOT NULL,
        deadline_minutes INTEGER,
        request_data JSON DEFAULT '{}' NOT NULL,
        status VARCHAR(30) DEFAULT 'pending' NOT NULL,
        created_at DATETIME NOT NULL
    )
    """)
    cursor.execute("CREATE INDEX ix_maintenance_requests_asset_id ON maintenance_requests (asset_id)")
    cursor.execute("CREATE INDEX ix_maintenance_requests_section_id ON maintenance_requests (section_id)")
    cursor.execute("CREATE INDEX ix_maintenance_requests_status ON maintenance_requests (status)")
    for r in data["maintenance_requests"]:
        rd = json.dumps(r["request_data"]) if isinstance(r["request_data"], (dict, list)) else r["request_data"]
        cursor.execute(
            "INSERT INTO maintenance_requests VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                r["id"], r["asset_id"], r["section_id"], r["department"], r["work_type"],
                r["location_km"], r["priority"], r["safety_critical"], r["deadline_minutes"],
                rd, r["status"], r["created_at"],
            ),
        )

    # 5. predictions (legacy schema: NO prediction_timestamp, NO model_version, NO feature_snapshot_json,
    # NO is_current, NO FK on maintenance_request_id)
    cursor.execute("""
    CREATE TABLE predictions (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        maintenance_request_id VARCHAR(80) NOT NULL,
        failure_risk_probability FLOAT NOT NULL,
        priority_score FLOAT NOT NULL,
        urgency_level VARCHAR(20) NOT NULL,
        predicted_duration_minutes FLOAT NOT NULL,
        overrun_probability FLOAT NOT NULL,
        trains_affected FLOAT DEFAULT 0.0 NOT NULL,
        total_delay_minutes FLOAT DEFAULT 0.0 NOT NULL,
        raw_output JSON DEFAULT '{}' NOT NULL,
        created_at DATETIME NOT NULL
    )
    """)
    cursor.execute("CREATE INDEX ix_predictions_maintenance_request_id ON predictions (maintenance_request_id)")
    for r in data["predictions"]:
        ro = json.dumps(r["raw_output"]) if isinstance(r["raw_output"], (dict, list)) else r["raw_output"]
        cursor.execute(
            "INSERT INTO predictions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                r["id"], r["maintenance_request_id"], r["failure_risk_probability"], r["priority_score"],
                r["urgency_level"], r["predicted_duration_minutes"], r["overrun_probability"],
                r["trains_affected"], r["total_delay_minutes"], ro, r["created_at"],
            ),
        )

    # 6. optimized_blocks (legacy optimizer run cache table)
    cursor.execute("""
    CREATE TABLE optimized_blocks (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        request_ids_hash VARCHAR(64) DEFAULT '' NOT NULL,
        request_ids JSON DEFAULT '[]' NOT NULL,
        section_id VARCHAR(80) NOT NULL,
        predicted_duration_minutes FLOAT NOT NULL,
        priority_score FLOAT DEFAULT 0.0 NOT NULL,
        urgency_level VARCHAR(20) DEFAULT 'medium' NOT NULL,
        schedule_data JSON DEFAULT '{}' NOT NULL,
        result_json JSON DEFAULT '{}' NOT NULL,
        operator_overrides JSON DEFAULT '{}' NOT NULL,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL
    )
    """)
    cursor.execute("CREATE INDEX ix_optimized_blocks_request_ids_hash ON optimized_blocks (request_ids_hash)")
    cursor.execute("CREATE INDEX ix_optimized_blocks_section_id ON optimized_blocks (section_id)")
    for r in data["optimized_blocks"]:
        r_ids = json.dumps(r["request_ids"]) if isinstance(r["request_ids"], (dict, list)) else r["request_ids"]
        s_data = json.dumps(r["schedule_data"]) if isinstance(r["schedule_data"], (dict, list)) else r["schedule_data"]
        r_json = json.dumps(r["result_json"]) if isinstance(r["result_json"], (dict, list)) else r["result_json"]
        o_over = json.dumps(r["operator_overrides"]) if isinstance(r["operator_overrides"], (dict, list)) else r["operator_overrides"]
        cursor.execute(
            "INSERT INTO optimized_blocks VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                r["id"], r["request_ids_hash"], r_ids, r["section_id"],
                r["predicted_duration_minutes"], r["priority_score"], r["urgency_level"],
                s_data, r_json, o_over, r["created_at"], r["updated_at"],
            ),
        )

    # 7. demo_integration_requests (legacy demo table)
    cursor.execute("""
    CREATE TABLE demo_integration_requests (
        request_id VARCHAR(36) NOT NULL PRIMARY KEY,
        department VARCHAR(10) NOT NULL,
        type VARCHAR(30) NOT NULL,
        train_id VARCHAR(80),
        section_id VARCHAR(80) NOT NULL,
        description VARCHAR(500) NOT NULL,
        raised_at DATETIME NOT NULL,
        status VARCHAR(20) NOT NULL,
        resulting_state VARCHAR(20),
        maintenance_request_id VARCHAR(80),
        decided_at DATETIME,
        created_at DATETIME NOT NULL
    )
    """)
    cursor.execute("CREATE INDEX ix_demo_integration_requests_department ON demo_integration_requests (department)")
    cursor.execute("CREATE INDEX ix_demo_integration_requests_maintenance_request_id ON demo_integration_requests (maintenance_request_id)")
    cursor.execute("CREATE INDEX ix_demo_integration_requests_section_id ON demo_integration_requests (section_id)")
    cursor.execute("CREATE INDEX ix_demo_integration_requests_status ON demo_integration_requests (status)")
    cursor.execute("CREATE INDEX ix_demo_integration_requests_type ON demo_integration_requests (type)")
    cursor.execute("CREATE INDEX ix_demo_integration_requests_train_id ON demo_integration_requests (train_id)")
    for r in data["demo_integration_requests"]:
        cursor.execute(
            "INSERT INTO demo_integration_requests VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                r["request_id"], r["department"], r["type"], r.get("train_id"), r["section_id"],
                r["description"], r["raised_at"], r["status"], r.get("resulting_state"),
                r.get("maintenance_request_id"), r.get("decided_at"), r["created_at"],
            ),
        )

    # 8. Unpopulated legacy tables (maintenance_history, assets, weather)
    cursor.execute("""
    CREATE TABLE maintenance_history (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        maintenance_request_id VARCHAR(80) NOT NULL,
        asset_id VARCHAR(36),
        action VARCHAR(50) NOT NULL,
        started_at DATETIME,
        completed_at DATETIME,
        notes TEXT
    )
    """)
    cursor.execute("CREATE INDEX ix_maintenance_history_maintenance_request_id ON maintenance_history (maintenance_request_id)")
    cursor.execute("CREATE INDEX ix_maintenance_history_asset_id ON maintenance_history (asset_id)")

    cursor.execute("""
    CREATE TABLE assets (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        asset_code VARCHAR(80) NOT NULL,
        asset_type VARCHAR(80) NOT NULL,
        section_id VARCHAR(80) NOT NULL,
        location_km FLOAT NOT NULL,
        department VARCHAR(40) NOT NULL,
        commissioned_at DATETIME,
        status VARCHAR(30) NOT NULL,
        metadata_json TEXT,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL
    )
    """)
    cursor.execute("CREATE INDEX ix_assets_section_id ON assets (section_id)")
    cursor.execute("CREATE UNIQUE INDEX ix_assets_asset_code ON assets (asset_code)")
    cursor.execute("CREATE INDEX ix_assets_asset_type ON assets (asset_type)")

    cursor.execute("""
    CREATE TABLE weather (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        section_id VARCHAR(80) NOT NULL,
        observed_at DATETIME NOT NULL,
        temperature_mean_c FLOAT NOT NULL,
        rainfall_mm FLOAT NOT NULL,
        max_wind_speed_kmh FLOAT NOT NULL,
        weather_risk FLOAT NOT NULL
    )
    """)
    cursor.execute("CREATE INDEX ix_weather_observed_at ON weather (observed_at)")
    cursor.execute("CREATE INDEX ix_weather_section_id ON weather (section_id)")

    conn.commit()
    conn.close()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Create deterministic pre-Phase-5 legacy database fixture.")
    parser.add_argument("--output", default="legacy_fixture.db", help="Target SQLite file path.")
    args = parser.parse_args()
    create_pre_phase5_database(args.output)
    print(f"Created pre-Phase-5 database fixture at: {args.output}")
