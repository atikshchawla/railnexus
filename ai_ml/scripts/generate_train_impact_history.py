"""Generate block-level train-impact labels from TMS movement history."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

BASE_DIR = Path(__file__).resolve().parents[1]
BLOCK_FILE = BASE_DIR / "data" / "curated" / "maintenance" / "block_execution_history.csv"
TMS_FILE = BASE_DIR / "data" / "curated" / "tms" / "tms_actual_movements.csv"
OUTPUT_FILE = BASE_DIR / "data" / "curated" / "maintenance" / "train_impact_history.csv"


def load_inputs() -> tuple[pd.DataFrame, pd.DataFrame]:
    blocks = pd.read_csv(BLOCK_FILE, low_memory=False)
    tms = pd.read_csv(TMS_FILE, low_memory=False)
    required_blocks = {"task_id", "section_id", "planned_start_time", "planned_duration_minutes"}
    required_tms = {"train_number", "section_id", "actual_entry_time", "actual_exit_time", "exit_delay_minutes"}
    missing_blocks = sorted(required_blocks - set(blocks.columns))
    missing_tms = sorted(required_tms - set(tms.columns))
    if missing_blocks or missing_tms:
        raise ValueError(f"Missing block columns: {missing_blocks}; missing TMS columns: {missing_tms}")
    for frame, columns in ((blocks, ["planned_start_time", "planned_end_time"]), (tms, ["actual_entry_time", "actual_exit_time"])):
        for column in columns:
            if column in frame:
                frame[column] = pd.to_datetime(frame[column], errors="coerce")
    tms["exit_delay_minutes"] = pd.to_numeric(tms["exit_delay_minutes"], errors="coerce").fillna(0.0).clip(lower=0.0)
    blocks["planned_duration_minutes"] = pd.to_numeric(blocks["planned_duration_minutes"], errors="coerce")
    blocks = blocks.dropna(subset=["planned_start_time", "planned_duration_minutes"]).copy()
    tms = tms.dropna(subset=["actual_entry_time", "actual_exit_time", "section_id"]).copy()
    blocks["section_id"] = blocks["section_id"].astype(str)
    tms["section_id"] = tms["section_id"].astype(str)
    return blocks, tms


def calculate_impact(blocks: pd.DataFrame, tms: pd.DataFrame) -> pd.DataFrame:
    movement_index = {
        section: group.sort_values("actual_entry_time").reset_index(drop=True)
        for section, group in tms.groupby("section_id", sort=False)
    }
    labels: list[dict] = []
    for block in blocks.itertuples(index=False):
        start = block.planned_start_time
        end = start + pd.to_timedelta(float(block.planned_duration_minutes), unit="m")
        movements = movement_index.get(str(block.section_id))
        if movements is None:
            affected = movements
        else:
            entries = movements["actual_entry_time"].to_numpy(dtype="datetime64[ns]")
            left = int(np.searchsorted(entries, np.datetime64(start), side="left"))
            right = int(np.searchsorted(entries, np.datetime64(end), side="right"))
            window = movements.iloc[left:right]
            affected = window[
                (window["actual_entry_time"] < end)
                & (window["actual_exit_time"] > start)
            ]
        if affected is None or affected.empty:
            trains_affected = 0
            total_delay = 0.0
            passenger_trains = 0
            freight_trains = 0
        else:
            trains_affected = int(affected["train_number"].astype(str).nunique())
            total_delay = float(affected["exit_delay_minutes"].sum())
            train_type = affected.get("train_type", pd.Series("UNKNOWN", index=affected.index)).astype(str).str.upper()
            passenger_trains = int((~train_type.eq("FREIGHT")).sum())
            freight_trains = int(train_type.eq("FREIGHT").sum())
        labels.append({
            "block_id": block.task_id,
            "trains_affected": trains_affected,
            "total_delay_minutes": round(total_delay, 4),
            "passenger_trains_affected": passenger_trains,
            "freight_trains_affected": freight_trains,
        })
    label_frame = pd.DataFrame(labels)
    block_features = blocks.drop(
        columns=[
            "trains_affected",
            "total_delay_minutes",
            "passenger_trains_affected",
            "freight_trains_affected",
        ],
        errors="ignore",
    )
    result = block_features.rename(columns={"task_id": "block_id"}).merge(
        label_frame,
        on="block_id",
        how="left",
        validate="one_to_one",
    )
    result["block_date"] = result["planned_start_time"].dt.date.astype(str)
    result["planned_end_time"] = result["planned_start_time"] + pd.to_timedelta(result["planned_duration_minutes"], unit="m")
    result["impact_window_minutes"] = result["planned_duration_minutes"]
    return result


def main() -> None:
    blocks, tms = load_inputs()
    result = calculate_impact(blocks, tms)
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    result.to_csv(OUTPUT_FILE, index=False)
    report = {
        "records": len(result),
        "tms_movements": len(tms),
        "date_range": [str(result["planned_start_time"].min()), str(result["planned_start_time"].max())],
        "zero_impact_rate": round(float((result["trains_affected"] == 0).mean()), 4),
        "mean_trains_affected": round(float(result["trains_affected"].mean()), 4),
        "mean_total_delay_minutes": round(float(result["total_delay_minutes"].mean()), 4),
        "target_columns": ["trains_affected", "total_delay_minutes"],
    }
    (OUTPUT_FILE.with_suffix(".metadata.json")).write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    print(f"Saved: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()