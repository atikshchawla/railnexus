"""Analytics API — computes metrics from block execution history and live DB data."""

import csv
import logging
from collections import defaultdict
from pathlib import Path

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.database.connection import get_db
from backend.database.models.block import BlockRecord

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analytics", tags=["analytics"])

AI_ML_DIR = Path(__file__).resolve().parents[3] / "ai_ml"
BLOCK_HISTORY_CSV = AI_ML_DIR / "data" / "curated" / "maintenance" / "block_execution_history.csv"


def _load_block_history() -> list[dict]:
    """Load curated block history from CSV if it exists."""
    if not BLOCK_HISTORY_CSV.exists():
        return []
    rows = []
    with open(BLOCK_HISTORY_CSV, newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            rows.append(row)
    return rows


@router.get("")
def get_analytics(db: Session = Depends(get_db)):
    """Return computed analytics metrics."""
    blocks = db.query(BlockRecord).all()
    history = _load_block_history()

    # ── Live DB metrics ────────────────────────────────────────────
    total = len(blocks)
    by_status: dict[str, int] = defaultdict(int)
    by_dept: dict[str, int] = defaultdict(int)
    critical_count = 0
    with_conflict = 0

    for b in blocks:
        by_status[b.status] += 1
        by_dept[b.department] += 1
        if b.urgency and b.urgency.get("tier") == "critical":
            critical_count += 1
        if b.conflict:
            with_conflict += 1

    # ── Historical metrics from CSV ────────────────────────────────
    overrun_count = 0
    total_duration_planned = 0.0
    total_duration_actual = 0.0
    dept_overruns: dict[str, int] = defaultdict(int)
    monthly_counts: dict[str, int] = defaultdict(int)

    for row in history:
        planned = float(row.get("planned_duration_minutes", 0) or 0)
        actual = float(row.get("actual_duration_minutes", 0) or 0)
        total_duration_planned += planned
        total_duration_actual += actual
        if actual > planned * 1.1:  # >10% overrun
            overrun_count += 1
            dept_overruns[row.get("department", "Unknown")] += 1

        date_str = row.get("block_date", "")
        if date_str:
            monthly_counts[date_str[:7]] += 1  # YYYY-MM

    history_total = len(history)
    avg_planned = total_duration_planned / max(1, history_total)
    avg_actual = total_duration_actual / max(1, history_total)
    overrun_rate = overrun_count / max(1, history_total) * 100.0

    return {
        "live": {
            "totalBlocks": total,
            "byStatus": dict(by_status),
            "byDepartment": dict(by_dept),
            "criticalCount": critical_count,
            "withConflict": with_conflict,
        },
        "historical": {
            "totalExecuted": history_total,
            "avgPlannedMinutes": round(avg_planned, 1),
            "avgActualMinutes": round(avg_actual, 1),
            "overrunRate": round(overrun_rate, 1),
            "overrunsByDept": dict(dept_overruns),
            "monthlyTrend": dict(sorted(monthly_counts.items())[-12:]),
        },
    }
