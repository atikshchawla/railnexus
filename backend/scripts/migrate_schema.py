"""
Schema migration script — syncs PostgreSQL DB schema with SQLAlchemy models.

Missing columns in DB (vs models):
  predictions:
    - prediction_timestamp  TIMESTAMP NOT NULL  DEFAULT NOW()
    - model_version         VARCHAR(50)  NOT NULL DEFAULT 'xgboost_pipeline_v1.0'
    - feature_snapshot_json JSONB  NOT NULL DEFAULT '{}'
    - is_current            BOOLEAN  NOT NULL DEFAULT TRUE
  maintenance_requests:
    - track_line                VARCHAR(10)  NOT NULL DEFAULT 'UP'
    - demanded_duration_minutes INTEGER      NOT NULL DEFAULT 60
    - requires_power_isolation  BOOLEAN      NOT NULL DEFAULT FALSE
    - requires_disconnection    BOOLEAN      NOT NULL DEFAULT FALSE
    - equipment_ids             JSONB        NOT NULL DEFAULT '[]'

Run with:
    python -m backend.scripts.migrate_schema
"""
from __future__ import annotations

import sys
import logging

import psycopg2

from backend.utils.config import get_settings

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Migration definitions
# ---------------------------------------------------------------------------
MIGRATIONS: list[dict] = [
    # predictions
    {
        "table": "predictions",
        "column": "prediction_timestamp",
        "ddl": "ALTER TABLE predictions ADD COLUMN IF NOT EXISTS prediction_timestamp TIMESTAMP NOT NULL DEFAULT NOW()",
        "description": "predictions.prediction_timestamp",
    },
    {
        "table": "predictions",
        "column": "model_version",
        "ddl": "ALTER TABLE predictions ADD COLUMN IF NOT EXISTS model_version VARCHAR(50) NOT NULL DEFAULT 'xgboost_pipeline_v1.0'",
        "description": "predictions.model_version",
    },
    {
        "table": "predictions",
        "column": "feature_snapshot_json",
        "ddl": "ALTER TABLE predictions ADD COLUMN IF NOT EXISTS feature_snapshot_json JSONB NOT NULL DEFAULT '{}'",
        "description": "predictions.feature_snapshot_json",
    },
    {
        "table": "predictions",
        "column": "is_current",
        "ddl": "ALTER TABLE predictions ADD COLUMN IF NOT EXISTS is_current BOOLEAN NOT NULL DEFAULT TRUE",
        "description": "predictions.is_current",
    },
    # maintenance_requests
    {
        "table": "maintenance_requests",
        "column": "track_line",
        "ddl": "ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS track_line VARCHAR(10) NOT NULL DEFAULT 'UP'",
        "description": "maintenance_requests.track_line",
    },
    {
        "table": "maintenance_requests",
        "column": "demanded_duration_minutes",
        "ddl": "ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS demanded_duration_minutes INTEGER NOT NULL DEFAULT 60",
        "description": "maintenance_requests.demanded_duration_minutes",
    },
    {
        "table": "maintenance_requests",
        "column": "requires_power_isolation",
        "ddl": "ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS requires_power_isolation BOOLEAN NOT NULL DEFAULT FALSE",
        "description": "maintenance_requests.requires_power_isolation",
    },
    {
        "table": "maintenance_requests",
        "column": "requires_disconnection",
        "ddl": "ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS requires_disconnection BOOLEAN NOT NULL DEFAULT FALSE",
        "description": "maintenance_requests.requires_disconnection",
    },
    {
        "table": "maintenance_requests",
        "column": "equipment_ids",
        "ddl": "ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS equipment_ids JSONB NOT NULL DEFAULT '[]'",
        "description": "maintenance_requests.equipment_ids",
    },
    # trains
    {
        "table": "trains",
        "column": "priority_tier",
        "ddl": "ALTER TABLE trains ADD COLUMN IF NOT EXISTS priority_tier VARCHAR(20) NOT NULL DEFAULT 'EXPRESS'",
        "description": "trains.priority_tier",
    },
    # optimized_blocks
    {
        "table": "optimized_blocks",
        "column": "request_ids_hash",
        "ddl": "ALTER TABLE optimized_blocks ADD COLUMN IF NOT EXISTS request_ids_hash VARCHAR(64) NOT NULL DEFAULT ''",
        "description": "optimized_blocks.request_ids_hash",
    },
    {
        "table": "optimized_blocks",
        "column": "result_json",
        "ddl": "ALTER TABLE optimized_blocks ADD COLUMN IF NOT EXISTS result_json JSONB NOT NULL DEFAULT '{}'",
        "description": "optimized_blocks.result_json",
    },
    {
        "table": "optimized_blocks",
        "column": "operator_overrides",
        "ddl": "ALTER TABLE optimized_blocks ADD COLUMN IF NOT EXISTS operator_overrides JSONB NOT NULL DEFAULT '{}'",
        "description": "optimized_blocks.operator_overrides",
    },
    {
        "table": "optimized_blocks",
        "column": "updated_at",
        "ddl": "ALTER TABLE optimized_blocks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP",
        "description": "optimized_blocks.updated_at",
    },
]



def get_existing_columns(cur, table: str) -> set[str]:
    cur.execute(
        "SELECT column_name FROM information_schema.columns WHERE table_name = %s",
        (table,),
    )
    return {row[0] for row in cur.fetchall()}


def run_migrations() -> None:
    settings = get_settings()
    url = settings.database_url

    if not url.startswith("postgresql"):
        log.warning("DB is not PostgreSQL (%s) — skipping schema migration.", url)
        return

    dsn = url.replace("postgresql+psycopg2://", "").replace("postgresql://", "")
    userpass, rest = dsn.split("@", 1)
    user, password = userpass.split(":", 1)
    hostport, dbname = rest.split("/", 1)
    host, port = (hostport.rsplit(":", 1) if ":" in hostport else (hostport, "5432"))

    from urllib.parse import unquote
    password = unquote(password)

    log.info("Connecting: host=%s port=%s db=%s user=%s", host, port, dbname, user)
    conn = psycopg2.connect(host=host, port=int(port), dbname=dbname, user=user, password=password)
    conn.autocommit = True
    cur = conn.cursor()

    applied = 0
    skipped = 0
    failed = 0

    for mig in MIGRATIONS:
        table = mig["table"]
        column = mig["column"]
        description = mig["description"]
        existing = get_existing_columns(cur, table)

        if column in existing:
            log.info("  SKIP  %s (already exists)", description)
            skipped += 1
            continue

        try:
            log.info("  APPLY %s ...", description)
            cur.execute(mig["ddl"])
            log.info("        OK")
            applied += 1
        except Exception as exc:
            log.error("  FAIL  %s: %s", description, exc)
            failed += 1

    cur.close()
    conn.close()

    log.info("Done: %d applied, %d skipped, %d failed", applied, skipped, failed)
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    run_migrations()
