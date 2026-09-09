import os
import random
from datetime import datetime, timedelta

import numpy as np
import pandas as pd


SEED = 42
NUM_DAYS = 365
BASE_TIME = datetime(2025, 8, 1)
RAW_DATA_DIR = "data/raw"

random.seed(SEED)
np.random.seed(SEED)


def logistic(x):
    x = np.clip(x, -500, 500)
    return 1.0 / (1.0 + np.exp(-x))


def day_date(day):
    return (BASE_TIME + timedelta(days=day)).date().isoformat()


def path(filename):
    return os.path.join(RAW_DATA_DIR, filename)


def ensure_out_dir():
    os.makedirs(RAW_DATA_DIR, exist_ok=True)


def require(filename, step_hint):
    file_path = path(filename)

    if not os.path.exists(file_path):
        raise SystemExit(
            f"\nError: '{filename}' was not found in '{RAW_DATA_DIR}'.\n"
            f"Run '{step_hint}' first.\n"
        )

    return file_path


def load_topology():
    return pd.read_csv(
        require("network_topology.csv", "python 01_generate_topology.py"),
    )


def load_weather():
    return pd.read_csv(
        require("weather_historical.csv", "python fetch_weather.py"),
        parse_dates=["date"]
    )


def load_calendar():
    return pd.read_csv(
        require("calendar_events.csv", "python fetch_calendar.py"),
        parse_dates=["date"]
    )


def load_timetable():
    return pd.read_csv(
        require("timetable.csv", "python fetch_timetable.py")
    )


def load_traffic():
    return pd.read_csv(
        require("traffic_fois.csv", "python gen_traffic.py")
    )


def load_tms():
    return pd.read_csv(
        require("tms_track_defects.csv", "python gen_tms.py"),
        parse_dates=["timestamp"]
    )


def load_smms():
    return pd.read_csv(
        require("smms_signal_faults.csv", "python gen_smms.py"),
        parse_dates=["timestamp"]
    )


def load_tdms():
    return pd.read_csv(
        require("tdms_ohe_defects.csv", "python gen_tdms.py"),
        parse_dates=["timestamp"]
    )


def load_bdms():
    return pd.read_csv(
        require("bdms_block_demands.csv", "python gen_bdms.py"),
        parse_dates=[
            "requested_ts",
            "decision_ts",
            "block_start_ts",
            "block_end_ts"
        ]
    )