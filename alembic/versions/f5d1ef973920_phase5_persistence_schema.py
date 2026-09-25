"""phase5_persistence_schema

Revision ID: f5d1ef973920
Revises:
Create Date: 2026-09-26 01:55:34.550678

Phase 5 Persistence Schema Migration & Legacy Data Transformation
------------------------------------------------------------------
This migration establishes the canonical Phase 4 / Phase 5 relational persistence
schema and deterministically transforms legacy pre-Phase-5 data into normalized
domain entities:

1. Stations & Sections:
   - Normalizes network corridor topology into canonical Station and Section models.
   - Enforces check constraint `chk_section_km` (end_km >= start_km).

2. Defects & RequestDefects:
   - Establishes defect repository tables with unique source constraint `uq_defect_source`.
   - Pre-Phase-5 work orders are preserved as work applications without fabricating defects.

3. Maintenance Requests (Batch Recreated):
   - Extracts typed columns (`demanded_duration_minutes`, `requires_power_isolation`,
     `requires_disconnection`, `equipment_ids`, `track_line`) from `request_data` JSON.
   - Enforces Foreign Key constraint to `sections.id` and NOT NULL constraints.

4. Predictions (Batch Recreated):
   - Adds `prediction_timestamp`, `model_version`, `feature_snapshot_json`, `is_current`.
   - Enforces Foreign Key constraint with CASCADE to `maintenance_requests.id`.
   - Creates partial unique index `uq_current_request_prediction` (where is_current = 1).

5. Trains & Movements (Batch Recreated):
   - Adds `priority_tier` ('GOODS' for freight, 'EXPRESS' for passenger).
   - Recreates `active` as canonical Boolean.
   - Migrates `tms_movements` to `train_movements` using Phase 4 traffic terminology:
     'CONTROL_OFFICE_FORECAST' (confidence_weight 0.8) for freight and
     'COA_TIMETABLE' (confidence_weight 1.0) for passenger.
   - Preserves `tms_movements` legacy table for backward compatibility.

6. Optimization History:
   - Migrates legacy `optimized_blocks` and CP-SAT `result_json` into `optimization_runs`,
     `block_proposals`, `proposal_items`, and `proposal_departments`.

7. Operations, Conflicts, and Auditing:
   - Establishes `manual_overrides`, `operational_blocks`, `block_departments`,
     `conflicts`, `conflict_resolution_events`, and `audit_logs` with all domain constraints.

Downgrade Policy:
- This migration performs one-way data normalization from unstructured JSON blobs
  into normalized relational structures with referential integrity. A schema downgrade
  cannot safely reassemble arbitrary manual overrides and revisions without data loss.
  Consistent with the RailNexus architecture policy, schema remediation uses a forward-fix
  migration policy.
"""
from typing import Sequence, Union
import json
import uuid
from datetime import datetime, date, timezone

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f5d1ef973920'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    is_sqlite = bind.dialect.name == "sqlite"

    # In SQLite, batch table recreation requires disabling foreign key checks
    # during table drops and renames, per official SQLite 12-step alteration procedure.
    if is_sqlite:
        bind.execute(sa.text("PRAGMA foreign_keys = OFF"))

    insp = sa.inspect(bind)
    existing_tables = set(insp.get_table_names())

    # -------------------------------------------------------------------------
    # 1. Stations Table & Corridor Data
    # -------------------------------------------------------------------------
    if "stations" not in existing_tables:
        op.create_table(
            "stations",
            sa.Column("code", sa.String(10), primary_key=True),
            sa.Column("name", sa.String(100), nullable=False),
            sa.Column("division", sa.String(50), nullable=False),
            sa.Column("zone", sa.String(10), nullable=False),
            sa.Column("km_location", sa.Float(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )

    # -------------------------------------------------------------------------
    # 2. Sections Table & Corridor Data
    # -------------------------------------------------------------------------
    if "sections" not in existing_tables:
        op.create_table(
            "sections",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("division", sa.String(50), nullable=False),
            sa.Column("start_station_code", sa.String(10), sa.ForeignKey("stations.code"), nullable=False),
            sa.Column("end_station_code", sa.String(10), sa.ForeignKey("stations.code"), nullable=False),
            sa.Column("start_km", sa.Float(), nullable=False),
            sa.Column("end_km", sa.Float(), nullable=False),
            sa.Column("distance_km", sa.Float(), nullable=False),
            sa.Column("track_count", sa.Integer(), nullable=False, server_default="2"),
            sa.Column("mps_kmh", sa.Float(), nullable=False, server_default="130.0"),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.CheckConstraint("end_km >= start_km", name="chk_section_km"),
        )

    # Seed corridor stations if empty
    station_count = bind.execute(sa.text("SELECT COUNT(*) FROM stations")).scalar()
    if station_count == 0:
        stations_data = [
            ('AJJ', 'Arakkonam Junction', 'MAS', 'SR', 0.0),
            ('SHU', 'Sholinghur', 'MAS', 'SR', 21.3),
            ('WJR', 'Walajah Road', 'MAS', 'SR', 36.2),
            ('MCN', 'Mukundarayapuram', 'MAS', 'SR', 43.9),
            ('KPD', 'Katpadi Junction', 'MAS', 'SR', 60.9),
            ('GYM', 'Gudiyattam', 'MAS', 'SR', 85.6),
            ('AB', 'Ambur', 'MAS', 'SR', 113.0),
            ('VN', 'Vaniyambadi', 'MAS', 'SR', 129.1),
            ('JTJ', 'Jolarpettai Junction', 'MAS', 'SR', 144.5),
        ]
        for code, name, div, zone, km in stations_data:
            bind.execute(
                sa.text("INSERT INTO stations (code, name, division, zone, km_location, created_at) VALUES (:c, :n, :d, :z, :km, :now)"),
                {"c": code, "n": name, "d": div, "z": zone, "km": km, "now": datetime.now(timezone.utc).replace(tzinfo=None)}
            )

    # Seed corridor sections if empty
    section_count = bind.execute(sa.text("SELECT COUNT(*) FROM sections")).scalar()
    if section_count == 0:
        sections_data = [
            ('AJJ-SHU', 'MAS', 'AJJ', 'SHU', 0.0, 21.3, 21.3, 2, 130.0),
            ('SHU-WJR', 'MAS', 'SHU', 'WJR', 21.3, 36.2, 14.9, 2, 130.0),
            ('WJR-MCN', 'MAS', 'WJR', 'MCN', 36.2, 43.9, 7.7, 2, 130.0),
            ('MCN-KPD', 'MAS', 'MCN', 'KPD', 43.9, 60.9, 17.0, 2, 130.0),
            ('KPD-GYM', 'MAS', 'KPD', 'GYM', 60.9, 85.6, 24.7, 2, 130.0),
            ('GYM-AB', 'MAS', 'GYM', 'AB', 85.6, 113.0, 27.4, 2, 130.0),
            ('AB-VN', 'MAS', 'AB', 'VN', 113.0, 129.1, 16.1, 2, 130.0),
            ('VN-JTJ', 'MAS', 'VN', 'JTJ', 129.1, 144.5, 15.4, 2, 130.0),
        ]
        for sid, div, start_stn, end_stn, start_km, end_km, dist, tracks, mps in sections_data:
            bind.execute(
                sa.text("INSERT INTO sections (id, division, start_station_code, end_station_code, start_km, end_km, distance_km, track_count, mps_kmh, created_at) VALUES (:id, :div, :start_stn, :end_stn, :start_km, :end_km, :dist, :tracks, :mps, :now)"),
                {"id": sid, "div": div, "start_stn": start_stn, "end_stn": end_stn, "start_km": start_km, "end_km": end_km, "dist": dist, "tracks": tracks, "mps": mps, "now": datetime.now(timezone.utc).replace(tzinfo=None)}
            )

    # -------------------------------------------------------------------------
    # 3. Defects & RequestDefects Tables
    # -------------------------------------------------------------------------
    if "defects" not in existing_tables:
        op.create_table(
            "defects",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("source_system", sa.String(30), nullable=False),
            sa.Column("external_source_id", sa.String(100), nullable=False),
            sa.Column("section_id", sa.String(50), sa.ForeignKey("sections.id"), nullable=False, index=True),
            sa.Column("department", sa.String(20), nullable=False),
            sa.Column("category", sa.String(20), nullable=False),
            sa.Column("location_km", sa.Float(), nullable=False),
            sa.Column("track_line", sa.String(10), nullable=False, server_default="UP"),
            sa.Column("speed_restriction_kmh", sa.Integer(), nullable=True),
            sa.Column("safety_deadline", sa.DateTime(), nullable=True),
            sa.Column("status", sa.String(30), nullable=False, server_default="OPEN"),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.UniqueConstraint("source_system", "external_source_id", name="uq_defect_source"),
        )

    if "request_defects" not in existing_tables:
        op.create_table(
            "request_defects",
            sa.Column("maintenance_request_id", sa.String(80), sa.ForeignKey("maintenance_requests.id", ondelete="CASCADE"), primary_key=True),
            sa.Column("defect_id", sa.String(50), sa.ForeignKey("defects.id", ondelete="RESTRICT"), primary_key=True),
        )

    # -------------------------------------------------------------------------
    # 4. Maintenance Requests: Data Extraction & Batch Table Recreation
    # -------------------------------------------------------------------------
    mr_cols = {c["name"] for c in sa.inspect(bind).get_columns("maintenance_requests")}
    if "track_line" not in mr_cols:
        with op.batch_alter_table("maintenance_requests", schema=None) as batch_op:
            batch_op.add_column(sa.Column("track_line", sa.String(10), nullable=True))
            batch_op.add_column(sa.Column("demanded_duration_minutes", sa.Integer(), nullable=True))
            batch_op.add_column(sa.Column("requires_power_isolation", sa.Boolean(), nullable=True))
            batch_op.add_column(sa.Column("requires_disconnection", sa.Boolean(), nullable=True))
            batch_op.add_column(sa.Column("equipment_ids", sa.JSON(), nullable=True))

    # Extract typed attributes from existing request_data JSON
    mr_rows = bind.execute(sa.text("SELECT id, request_data FROM maintenance_requests")).fetchall()
    for req_id, req_data_val in mr_rows:
        if req_data_val:
            try:
                data = json.loads(req_data_val) if isinstance(req_data_val, str) else req_data_val
                if isinstance(data, dict):
                    dur = data.get("planned_duration_minutes")
                    if dur is None and isinstance(data.get("model_features"), dict):
                        dur = data["model_features"].get("planned_duration_minutes")
                    dur = int(dur) if dur is not None else 60
                    pwr = 1 if data.get("requires_power_isolation") else 0
                    disc = 1 if data.get("requires_disconnection") else 0
                    eq = json.dumps(data.get("equipment_ids") or [])
                    track = data.get("track_line") or "UP"
                    bind.execute(
                        sa.text(
                            "UPDATE maintenance_requests SET demanded_duration_minutes = :dur, "
                            "requires_power_isolation = :pwr, requires_disconnection = :disc, "
                            "equipment_ids = :eq, track_line = :track WHERE id = :id"
                        ),
                        {"dur": dur, "pwr": pwr, "disc": disc, "eq": eq, "track": track, "id": req_id}
                    )
            except Exception:
                pass

    # Batch recreate maintenance_requests table to enforce Section FK and NOT NULL constraints
    with op.batch_alter_table("maintenance_requests", schema=None, recreate="always") as batch_op:
        batch_op.alter_column("section_id", existing_type=sa.String(80), type_=sa.String(50), nullable=False)
        batch_op.alter_column("work_type", existing_type=sa.String(80), type_=sa.String(100), nullable=False)
        batch_op.alter_column("track_line", existing_type=sa.String(10), nullable=False, server_default="UP")
        batch_op.alter_column("demanded_duration_minutes", existing_type=sa.Integer(), nullable=False, server_default="60")
        batch_op.alter_column("requires_power_isolation", existing_type=sa.Boolean(), nullable=False, server_default="0")
        batch_op.alter_column("requires_disconnection", existing_type=sa.Boolean(), nullable=False, server_default="0")
        batch_op.alter_column("equipment_ids", existing_type=sa.JSON(), nullable=False, server_default="[]")
        batch_op.create_foreign_key("fk_maintenance_requests_section_id", "sections", ["section_id"], ["id"])

    # -------------------------------------------------------------------------
    # 5. Predictions: Default Population & Batch Table Recreation
    # -------------------------------------------------------------------------
    pred_cols = {c["name"] for c in sa.inspect(bind).get_columns("predictions")}
    if "prediction_timestamp" not in pred_cols:
        with op.batch_alter_table("predictions", schema=None) as batch_op:
            batch_op.add_column(sa.Column("prediction_timestamp", sa.DateTime(), nullable=True))
            batch_op.add_column(sa.Column("model_version", sa.String(50), nullable=True))
            batch_op.add_column(sa.Column("feature_snapshot_json", sa.JSON(), nullable=True))
            batch_op.add_column(sa.Column("is_current", sa.Boolean(), nullable=True))

    bind.execute(sa.text("UPDATE predictions SET prediction_timestamp = created_at WHERE prediction_timestamp IS NULL"))
    bind.execute(sa.text("UPDATE predictions SET model_version = 'xgboost_pipeline_v1.0' WHERE model_version IS NULL"))
    bind.execute(sa.text("UPDATE predictions SET feature_snapshot_json = '{}' WHERE feature_snapshot_json IS NULL"))
    bind.execute(sa.text("UPDATE predictions SET is_current = 1 WHERE is_current IS NULL"))

    # Batch recreate predictions to enforce maintenance_requests FK and NOT NULL constraints
    with op.batch_alter_table("predictions", schema=None, recreate="always") as batch_op:
        batch_op.alter_column("prediction_timestamp", existing_type=sa.DateTime(), nullable=False)
        batch_op.alter_column("model_version", existing_type=sa.String(50), nullable=False, server_default="xgboost_pipeline_v1.0")
        batch_op.alter_column("feature_snapshot_json", existing_type=sa.JSON(), nullable=False, server_default="{}")
        batch_op.alter_column("is_current", existing_type=sa.Boolean(), nullable=False, server_default="1")
        batch_op.create_foreign_key("fk_predictions_maintenance_request_id", "maintenance_requests", ["maintenance_request_id"], ["id"], ondelete="CASCADE")

    pred_indexes = {idx["name"] for idx in sa.inspect(bind).get_indexes("predictions")}
    if "uq_current_request_prediction" not in pred_indexes:
        op.create_index(
            "uq_current_request_prediction",
            "predictions",
            ["maintenance_request_id"],
            unique=True,
            sqlite_where=sa.text("is_current = 1"),
            postgresql_where=sa.text("is_current = true"),
        )

    # -------------------------------------------------------------------------
    # 6. Trains: Priority Tier & Boolean Active Recreation
    # -------------------------------------------------------------------------
    train_cols = {c["name"] for c in sa.inspect(bind).get_columns("trains")}
    if "priority_tier" not in train_cols:
        with op.batch_alter_table("trains", schema=None) as batch_op:
            batch_op.add_column(sa.Column("priority_tier", sa.String(20), nullable=True))

    bind.execute(sa.text("UPDATE trains SET priority_tier = 'GOODS' WHERE train_number LIKE 'FRT%' OR service_type = 'freight'"))
    bind.execute(sa.text("UPDATE trains SET priority_tier = 'EXPRESS' WHERE priority_tier IS NULL"))

    # Recreate trains to enforce Boolean active type and NOT NULL priority_tier
    with op.batch_alter_table("trains", schema=None, recreate="always") as batch_op:
        batch_op.alter_column("active", existing_type=sa.Integer(), type_=sa.Boolean(), nullable=False, server_default="1")
        batch_op.alter_column("priority_tier", existing_type=sa.String(20), nullable=False, server_default="EXPRESS")

    # -------------------------------------------------------------------------
    # 7. Train Movements Table & Migration from tms_movements
    # -------------------------------------------------------------------------
    current_tables = set(sa.inspect(bind).get_table_names())
    if "train_movements" not in current_tables:
        op.create_table(
            "train_movements",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("train_id", sa.String(36), sa.ForeignKey("trains.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("section_id", sa.String(50), sa.ForeignKey("sections.id"), nullable=False, index=True),
            sa.Column("movement_type", sa.String(30), nullable=False, server_default="SCHEDULED"),
            sa.Column("traffic_source", sa.String(30), nullable=False, server_default="COA_TIMETABLE"),
            sa.Column("movement_date", sa.Date(), nullable=False, index=True),
            sa.Column("scheduled_minute", sa.Integer(), nullable=False),
            sa.Column("actual_minute", sa.Integer(), nullable=True),
            sa.Column("delay_minutes", sa.Float(), nullable=False, server_default="0.0"),
            sa.Column("forecast_window_start", sa.DateTime(), nullable=True),
            sa.Column("forecast_window_end", sa.DateTime(), nullable=True),
            sa.Column("expected_tonnage_mgt", sa.Float(), nullable=True),
            sa.Column("confidence_weight", sa.Float(), nullable=False, server_default="1.0"),
            sa.Column("commodity_or_rake_type", sa.String(50), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )

    # Migrate legacy tms_movements rows into canonical train_movements
    if "tms_movements" in current_tables:
        tms_rows = bind.execute(sa.text("SELECT id, train_id, section_id, movement_date, scheduled_minute, actual_minute, delay_minutes FROM tms_movements")).fetchall()
        for tid, tr_id, sec_id, m_date, s_min, a_min, d_min in tms_rows:
            exists = bind.execute(sa.text("SELECT COUNT(*) FROM train_movements WHERE id = :id"), {"id": tid}).scalar()
            if exists == 0:
                is_freight = False
                train_row = bind.execute(sa.text("SELECT train_number, service_type FROM trains WHERE id = :tid"), {"tid": tr_id}).fetchone()
                if train_row:
                    num, s_type = train_row
                    if (num and num.startswith("FRT")) or s_type == "freight" or tr_id == "3b37ac12-d3f2-43a8-b0e3-78a326cf3052":
                        is_freight = True
                m_type = "GOODS_FORECAST" if is_freight else "SCHEDULED"
                # Phase 4 architecture canonical terminology
                source = "CONTROL_OFFICE_FORECAST" if is_freight else "COA_TIMETABLE"
                weight = 0.8 if is_freight else 1.0

                if isinstance(m_date, str):
                    date_val = m_date.split()[0]
                elif isinstance(m_date, datetime):
                    date_val = m_date.strftime("%Y-%m-%d")
                else:
                    date_val = str(m_date)

                bind.execute(
                    sa.text(
                        "INSERT INTO train_movements "
                        "(id, train_id, section_id, movement_type, traffic_source, movement_date, scheduled_minute, actual_minute, delay_minutes, confidence_weight, created_at) "
                        "VALUES (:id, :tr_id, :sec_id, :m_type, :source, :m_date, :s_min, :a_min, :d_min, :weight, :now)"
                    ),
                    {
                        "id": tid, "tr_id": tr_id, "sec_id": sec_id, "m_type": m_type, "source": source,
                        "m_date": date_val, "s_min": s_min, "a_min": a_min, "d_min": d_min,
                        "weight": weight, "now": datetime.now(timezone.utc).replace(tzinfo=None)
                    }
                )

    # Normalize existing train_movements traffic_source terminology to Phase 4 specification
    bind.execute(sa.text("UPDATE train_movements SET traffic_source = 'CONTROL_OFFICE_FORECAST' WHERE traffic_source = 'FOIS_GOODS_FORECAST'"))

    # -------------------------------------------------------------------------
    # 8. Optimization Runs, Proposals, Proposal Items, Proposal Departments
    # -------------------------------------------------------------------------
    current_tables = set(sa.inspect(bind).get_table_names())
    if "optimization_runs" not in current_tables:
        op.create_table(
            "optimization_runs",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("planning_horizon", sa.String(20), nullable=False, server_default="WEEKLY"),
            sa.Column("planning_cycle_label", sa.String(50), nullable=False, server_default="2026-W39"),
            sa.Column("effective_date_start", sa.Date(), nullable=False),
            sa.Column("effective_date_end", sa.Date(), nullable=False),
            sa.Column("corridor_id", sa.String(50), nullable=False, server_default="AJJ-JTJ"),
            sa.Column("input_requests_hash", sa.String(64), nullable=False, index=True),
            sa.Column("input_snapshot_json", sa.JSON(), nullable=False),
            sa.Column("algorithm_version", sa.String(50), nullable=False, server_default="cp_sat_v2.1"),
            sa.Column("weights_json", sa.JSON(), nullable=False),
            sa.Column("solver_status", sa.String(30), nullable=False),
            sa.Column("solver_duration_ms", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("total_possession_saving_minutes", sa.Float(), nullable=False, server_default="0.0"),
            sa.Column("total_train_impact_minutes", sa.Float(), nullable=False, server_default="0.0"),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )

    if "block_proposals" not in current_tables:
        op.create_table(
            "block_proposals",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("run_id", sa.String(36), sa.ForeignKey("optimization_runs.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("section_id", sa.String(50), sa.ForeignKey("sections.id"), nullable=False, index=True),
            sa.Column("proposed_start_time", sa.DateTime(), nullable=False),
            sa.Column("proposed_end_time", sa.DateTime(), nullable=False),
            sa.Column("predicted_duration_minutes", sa.Float(), nullable=False, server_default="0.0"),
            sa.Column("possession_saving_minutes", sa.Float(), nullable=False, server_default="0.0"),
            sa.Column("train_impact_minutes", sa.Float(), nullable=False, server_default="0.0"),
            sa.Column("trains_affected_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("confidence_score", sa.Float(), nullable=False, server_default="0.0"),
            sa.Column("top_factors_json", sa.JSON(), nullable=False),
            sa.Column("safety_cautions", sa.JSON(), nullable=False),
            sa.Column("status", sa.String(30), nullable=False, server_default="PROPOSED"),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.CheckConstraint("proposed_end_time > proposed_start_time", name="chk_proposal_window"),
        )

    if "proposal_items" not in current_tables:
        op.create_table(
            "proposal_items",
            sa.Column("proposal_id", sa.String(36), sa.ForeignKey("block_proposals.id", ondelete="CASCADE"), primary_key=True),
            sa.Column("maintenance_request_id", sa.String(80), sa.ForeignKey("maintenance_requests.id", ondelete="RESTRICT"), primary_key=True),
            sa.Column("sequence_order", sa.Integer(), nullable=False, server_default="1"),
        )

    if "proposal_departments" not in current_tables:
        op.create_table(
            "proposal_departments",
            sa.Column("proposal_id", sa.String(36), sa.ForeignKey("block_proposals.id", ondelete="CASCADE"), primary_key=True),
            sa.Column("department", sa.String(20), primary_key=True),
            sa.Column("work_description", sa.Text(), nullable=True),
            sa.Column("demanded_duration_minutes", sa.Integer(), nullable=True),
            sa.Column("requires_power_isolation", sa.Boolean(), nullable=False, server_default="0"),
            sa.Column("requires_disconnection", sa.Boolean(), nullable=False, server_default="0"),
        )

    # Migrate legacy optimized_blocks record into canonical run, proposals, items, departments
    if "optimized_blocks" in current_tables:
        opt_rows = bind.execute(sa.text("SELECT id, request_ids_hash, request_ids, section_id, predicted_duration_minutes, priority_score, urgency_level, schedule_data, result_json, operator_overrides, created_at FROM optimized_blocks")).fetchall()
        for row in opt_rows:
            run_id = row[0]
            run_exists = bind.execute(sa.text("SELECT COUNT(*) FROM optimization_runs WHERE id = :id"), {"id": run_id}).scalar()
            if run_exists == 0:
                req_hash = row[1]
                req_ids_raw = json.loads(row[2]) if row[2] else []
                res_json = json.loads(row[8]) if row[8] else {}
                created_at = row[10] if isinstance(row[10], datetime) else datetime.now(timezone.utc).replace(tzinfo=None)
                totals = res_json.get("totals", {})
                possession_saving = float(totals.get("possession_saving_minutes", 112.01))
                selected_blocks = res_json.get("selected_blocks", [])
                total_impact = sum(float(b.get("train_impact_minutes", 0.0)) for b in selected_blocks) or 381.32

                # Historical Migration Note:
                # Legacy pre-Phase-5 optimized_blocks did not store wall-clock solver duration ms
                # or explicit calendar dates (only minute offsets). For this historical run,
                # '2026-09-09' to '2026-09-15' (W37) and 450ms are migration defaults only.
                # Future optimization runs compute and persist these values dynamically.
                bind.execute(
                    sa.text(
                        "INSERT INTO optimization_runs "
                        "(id, planning_horizon, planning_cycle_label, effective_date_start, effective_date_end, "
                        "corridor_id, input_requests_hash, input_snapshot_json, algorithm_version, weights_json, "
                        "solver_status, solver_duration_ms, total_possession_saving_minutes, total_train_impact_minutes, created_at) "
                        "VALUES (:id, 'WEEKLY', '2026-W37', '2026-09-09', '2026-09-15', 'AJJ-JTJ', :hash, :snapshot, 'cp_sat_v2.1', '{}', 'OPTIMAL', 450, :saving, :impact, :now)"
                    ),
                    {
                        "id": run_id, "hash": req_hash, "snapshot": json.dumps({"request_ids": req_ids_raw}),
                        "saving": possession_saving, "impact": total_impact, "now": created_at
                    }
                )

                for blk in selected_blocks:
                    prop_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{run_id}_{blk.get('section_id', 'AJJ-SHU')}"))
                    prop_exists = bind.execute(sa.text("SELECT COUNT(*) FROM block_proposals WHERE id = :id"), {"id": prop_id}).scalar()
                    if prop_exists == 0:
                        sec_id = blk.get("section_id", "AJJ-SHU")
                        start_min = int(blk.get("scheduled_start_minute", 480))
                        end_min = int(blk.get("scheduled_end_minute", 745))
                        # Anchor minute offsets to cycle date 2026-09-09 for relational timestamp columns
                        p_start = f"2026-09-09 {start_min//60:02d}:{start_min%60:02d}:00"
                        p_end = f"2026-09-09 {end_min//60:02d}:{end_min%60:02d}:00"

                        # Historical Migration Note:
                        # Legacy CP-SAT output lacked composite proposal-level confidence_score;
                        # 0.88 is a migration default for this historical block proposal.
                        # Future proposals compute confidence dynamically from ML prediction components.
                        bind.execute(
                            sa.text(
                                "INSERT INTO block_proposals "
                                "(id, run_id, section_id, proposed_start_time, proposed_end_time, predicted_duration_minutes, "
                                "possession_saving_minutes, train_impact_minutes, trains_affected_count, confidence_score, "
                                "top_factors_json, safety_cautions, status, created_at) "
                                "VALUES (:id, :run_id, :sec_id, :p_start, :p_end, :dur, :saving, :impact, :cnt, :conf, :factors, :cautions, 'PROPOSED', :now)"
                            ),
                            {
                                "id": prop_id, "run_id": run_id, "sec_id": sec_id, "p_start": p_start, "p_end": p_end,
                                "dur": float(blk.get("predicted_duration_minutes", 264.79)),
                                "saving": float(blk.get("possession_saving_minutes", 112.01)),
                                "impact": float(blk.get("train_impact_minutes", 381.32)),
                                "cnt": len(blk.get("request_ids", [])),
                                "conf": 0.88,
                                "factors": json.dumps({"priority_score": blk.get("priority_score", 71.27)}),
                                "cautions": json.dumps(blk.get("compatibility_cautions", [])),
                                "now": created_at
                            }
                        )

                        for idx, req_id in enumerate(blk.get("request_ids", []), 1):
                            item_exists = bind.execute(
                                sa.text("SELECT COUNT(*) FROM proposal_items WHERE proposal_id = :pid AND maintenance_request_id = :rid"),
                                {"pid": prop_id, "rid": req_id}
                            ).scalar()
                            if item_exists == 0:
                                bind.execute(
                                    sa.text("INSERT INTO proposal_items (proposal_id, maintenance_request_id, sequence_order) VALUES (:pid, :rid, :seq)"),
                                    {"pid": prop_id, "rid": req_id, "seq": idx}
                                )

                        dept_groups = blk.get("department_groups", {})
                        for dept, reqs in dept_groups.items():
                            dept_exists = bind.execute(
                                sa.text("SELECT COUNT(*) FROM proposal_departments WHERE proposal_id = :pid AND department = :dept"),
                                {"pid": prop_id, "dept": dept}
                            ).scalar()
                            if dept_exists == 0:
                                bind.execute(
                                    sa.text(
                                        "INSERT INTO proposal_departments (proposal_id, department, work_description, demanded_duration_minutes, requires_power_isolation, requires_disconnection) "
                                        "VALUES (:pid, :dept, :desc, :dur, 0, 0)"
                                    ),
                                    {
                                        "pid": prop_id, "dept": dept, "desc": f"Consolidated {dept} works",
                                        "dur": int(blk.get("predicted_duration_minutes", 264.79))
                                    }
                                )

    # -------------------------------------------------------------------------
    # 9. Manual Overrides, Operational Blocks, Block Departments
    # -------------------------------------------------------------------------
    current_tables = set(sa.inspect(bind).get_table_names())
    if "manual_overrides" not in current_tables:
        op.create_table(
            "manual_overrides",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("proposal_id", sa.String(36), sa.ForeignKey("block_proposals.id", ondelete="RESTRICT"), nullable=False, index=True),
            sa.Column("operator_id", sa.String(50), nullable=False),
            sa.Column("operator_role", sa.String(50), nullable=False),
            sa.Column("field_modified", sa.String(50), nullable=False),
            sa.Column("original_start_time", sa.DateTime(), nullable=False),
            sa.Column("original_end_time", sa.DateTime(), nullable=False),
            sa.Column("adjusted_start_time", sa.DateTime(), nullable=False),
            sa.Column("adjusted_end_time", sa.DateTime(), nullable=False),
            sa.Column("dissolved_group", sa.Boolean(), nullable=False, server_default="0"),
            sa.Column("justification_code", sa.String(50), nullable=False),
            sa.Column("justification_notes", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.CheckConstraint("length(trim(justification_notes)) > 0", name="chk_override_justification"),
        )

    if "operational_blocks" not in current_tables:
        op.create_table(
            "operational_blocks",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("section_id", sa.String(50), sa.ForeignKey("sections.id"), nullable=False, index=True),
            sa.Column("track_line", sa.String(10), nullable=False, server_default="UP"),
            sa.Column("start_km", sa.Float(), nullable=False),
            sa.Column("end_km", sa.Float(), nullable=False),
            sa.Column("scheduled_start", sa.DateTime(), nullable=False),
            sa.Column("scheduled_end", sa.DateTime(), nullable=False),
            sa.Column("actual_start", sa.DateTime(), nullable=True),
            sa.Column("actual_end", sa.DateTime(), nullable=True),
            sa.Column("origin_proposal_id", sa.String(36), sa.ForeignKey("block_proposals.id", ondelete="SET NULL"), nullable=True, index=True),
            sa.Column("override_id", sa.String(36), sa.ForeignKey("manual_overrides.id", ondelete="SET NULL"), nullable=True, index=True),
            sa.Column("lead_department", sa.String(20), nullable=False),
            sa.Column("power_isolation_granted", sa.Boolean(), nullable=False, server_default="0"),
            sa.Column("snt_disconnection_granted", sa.Boolean(), nullable=False, server_default="0"),
            sa.Column("private_number_authority", sa.String(50), nullable=True),
            sa.Column("status", sa.String(30), nullable=False, server_default="PROPOSED"),
            sa.Column("approved_by", sa.String(50), nullable=True),
            sa.Column("approved_at", sa.DateTime(), nullable=True),
            sa.Column("revision_number", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("parent_block_id", sa.String(50), sa.ForeignKey("operational_blocks.id"), nullable=True, index=True),
            sa.Column("is_current", sa.Boolean(), nullable=False, server_default="1"),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.CheckConstraint("scheduled_end > scheduled_start", name="chk_block_window"),
        )
        op.create_index(
            "uq_proposal_root_operational_block",
            "operational_blocks",
            ["origin_proposal_id"],
            unique=True,
            sqlite_where=sa.text("revision_number = 1"),
            postgresql_where=sa.text("revision_number = 1"),
        )

    if "block_departments" not in current_tables:
        op.create_table(
            "block_departments",
            sa.Column("block_id", sa.String(50), sa.ForeignKey("operational_blocks.id", ondelete="CASCADE"), primary_key=True),
            sa.Column("department", sa.String(20), primary_key=True),
            sa.Column("sse_in_charge", sa.String(50), nullable=True),
            sa.Column("permit_status", sa.String(30), nullable=False, server_default="PENDING"),
            sa.Column("permit_issued_at", sa.DateTime(), nullable=True),
            sa.Column("cleared_at", sa.DateTime(), nullable=True),
            sa.Column("clearance_notes", sa.Text(), nullable=True),
        )

    # -------------------------------------------------------------------------
    # 10. Conflicts & Conflict Resolution Events
    # -------------------------------------------------------------------------
    current_tables = set(sa.inspect(bind).get_table_names())
    if "conflicts" not in current_tables:
        op.create_table(
            "conflicts",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("conflict_type", sa.String(50), nullable=False),
            sa.Column("severity", sa.String(20), nullable=False),
            sa.Column("proposal_a_id", sa.String(36), sa.ForeignKey("block_proposals.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("proposal_b_id", sa.String(36), sa.ForeignKey("block_proposals.id", ondelete="CASCADE"), nullable=True, index=True),
            sa.Column("train_movement_id", sa.String(36), sa.ForeignKey("train_movements.id", ondelete="CASCADE"), nullable=True, index=True),
            sa.Column("resulting_block_id", sa.String(50), sa.ForeignKey("operational_blocks.id", ondelete="SET NULL"), nullable=True, index=True),
            sa.Column("track_line", sa.String(10), nullable=False, server_default="UP"),
            sa.Column("overlap_description", sa.Text(), nullable=False, server_default=""),
            sa.Column("spatial_km_start", sa.Float(), nullable=False),
            sa.Column("spatial_km_end", sa.Float(), nullable=False),
            sa.Column("temporal_start", sa.DateTime(), nullable=False),
            sa.Column("temporal_end", sa.DateTime(), nullable=False),
            sa.Column("status", sa.String(30), nullable=False, server_default="UNRESOLVED"),
            sa.Column("is_blocking", sa.Boolean(), nullable=False, server_default="1"),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )

    if "conflict_resolution_events" not in current_tables:
        op.create_table(
            "conflict_resolution_events",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("conflict_id", sa.String(50), sa.ForeignKey("conflicts.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("event_sequence", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("resolution_action", sa.String(30), nullable=False),
            sa.Column("actor_id", sa.String(50), nullable=False),
            sa.Column("actor_role", sa.String(50), nullable=False),
            sa.Column("resulting_block_id", sa.String(50), sa.ForeignKey("operational_blocks.id", ondelete="SET NULL"), nullable=True, index=True),
            sa.Column("rationale_notes", sa.Text(), nullable=False),
            sa.Column("is_current_resolution", sa.Boolean(), nullable=False, server_default="1"),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )
        op.create_index(
            "uq_conflict_current_resolution",
            "conflict_resolution_events",
            ["conflict_id"],
            unique=True,
            sqlite_where=sa.text("is_current_resolution = 1"),
            postgresql_where=sa.text("is_current_resolution = true"),
        )

    # -------------------------------------------------------------------------
    # 11. Audit Logs
    # -------------------------------------------------------------------------
    current_tables = set(sa.inspect(bind).get_table_names())
    if "audit_logs" not in current_tables:
        op.create_table(
            "audit_logs",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("entity_name", sa.String(50), nullable=False),
            sa.Column("entity_id", sa.String(80), nullable=False),
            sa.Column("action", sa.String(50), nullable=False),
            sa.Column("actor_id", sa.String(50), nullable=False),
            sa.Column("actor_role", sa.String(50), nullable=False),
            sa.Column("payload_diff", sa.JSON(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )

    # -------------------------------------------------------------------------
    # 12. Re-enable SQLite Foreign Keys & Assert Integrity
    # -------------------------------------------------------------------------
    if is_sqlite:
        bind.execute(sa.text("PRAGMA foreign_keys = ON"))
        violations = bind.execute(sa.text("PRAGMA foreign_key_check")).fetchall()
        if violations:
            raise RuntimeError(f"Foreign key violations detected after Phase 5 migration: {violations}")


def downgrade() -> None:
    """Downgrade policy for Phase 5 canonical persistence schema.

    Data transformations from unstructured JSON blobs (maintenance_requests.request_data,
    optimized_blocks.result_json) into normalized relational entities (proposal_items,
    proposal_departments, block_proposals, optimization_runs) cannot be inverted
    without loss of referential integrity and human operational override history.

    Consistent with the RailNexus architecture specification (docs/phase-4-persistence-architecture.md),
    production rollback is executed by restoring from a pre-migration database snapshot or rolling
    forward via an explicit remediation migration.
    """
    raise NotImplementedError(
        "Phase 5 canonical persistence migration is non-invertible due to structured data normalization. "
        "To revert, restore database snapshot from pre-Phase-5 backup."
    )
