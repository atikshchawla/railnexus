import os
import random

import numpy as np
import pandas as pd


# ==========================================================================
# CONFIGURATION
# ==========================================================================

SEED = 42

random.seed(SEED)
np.random.seed(SEED)
RNG = np.random.default_rng(SEED)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

TOPOLOGY_FILE = os.path.join(
    BASE_DIR, "data", "raw", "network_topology.csv"
)

WEATHER_FILE = os.path.join(
    BASE_DIR, "data", "raw", "weather_historical.csv"
)

MOVEMENTS_FILE = os.path.join(
    BASE_DIR,
    "data",
    "curated",
    "tms",
    "tms_actual_movements.csv",
)

OUTPUT_DIR = os.path.join(
    BASE_DIR,
    "data",
    "curated",
    "maintenance",
)

OUTPUT_FILE = os.path.join(
    OUTPUT_DIR,
    "block_execution_history.csv",
)


# --------------------------------------------------------------------------
# Historical period
#
# This now matches the expanded TMS history:
# 2022-01-01 -> 2026-08-27
# --------------------------------------------------------------------------

NUM_RECORDS = 8000

START_DATE = pd.Timestamp("2022-01-01")
END_DATE = pd.Timestamp("2026-08-27")


# --------------------------------------------------------------------------
# Sanity limits
# --------------------------------------------------------------------------

OVERRUN_RATE_MIN = 0.15
OVERRUN_RATE_MAX = 0.45


# ==========================================================================
# WORK TYPES
# ==========================================================================

WORK_TYPES = {
    "ENGG": [
        "RAIL_REPLACEMENT",
        "WELD_REPAIR",
        "TRACK_GEOMETRY_CORRECTION",
        "BALLAST_REPAIR",
        "SLEEPER_REPLACEMENT",
        "TRACK_INSPECTION",
    ],

    "SNT": [
        "POINT_MACHINE_MAINTENANCE",
        "SIGNAL_MAINTENANCE",
        "TRACK_CIRCUIT_MAINTENANCE",
        "RELAY_INSPECTION",
        "SIGNALLING_CABLE_REPAIR",
    ],

    "TRD": [
        "OHE_INSPECTION",
        "OHE_WIRE_REPAIR",
        "OHE_MAST_MAINTENANCE",
        "INSULATOR_REPLACEMENT",
        "CATENARY_MAINTENANCE",
    ],
}


BASE_DURATION = {
    "RAIL_REPLACEMENT": 180,
    "WELD_REPAIR": 90,
    "TRACK_GEOMETRY_CORRECTION": 150,
    "BALLAST_REPAIR": 120,
    "SLEEPER_REPLACEMENT": 135,
    "TRACK_INSPECTION": 60,

    "POINT_MACHINE_MAINTENANCE": 90,
    "SIGNAL_MAINTENANCE": 75,
    "TRACK_CIRCUIT_MAINTENANCE": 70,
    "RELAY_INSPECTION": 60,
    "SIGNALLING_CABLE_REPAIR": 120,

    "OHE_INSPECTION": 90,
    "OHE_WIRE_REPAIR": 150,
    "OHE_MAST_MAINTENANCE": 120,
    "INSULATOR_REPLACEMENT": 100,
    "CATENARY_MAINTENANCE": 180,
}


# Work types that are especially sensitive to heavy rain.
WEATHER_SENSITIVE_WORK = {
    "RAIL_REPLACEMENT",
    "TRACK_GEOMETRY_CORRECTION",
    "BALLAST_REPAIR",
    "SLEEPER_REPLACEMENT",
}


# ==========================================================================
# HELPERS
# ==========================================================================

def clamp(value, minimum, maximum):
    return np.clip(
        np.asarray(value, dtype=np.float64),
        minimum,
        maximum,
    )


def zscore(values):
    """
    Robust vectorized z-score helper.
    """
    values = np.asarray(values, dtype=np.float64)

    std = values.std()

    if std < 1e-9:
        return np.zeros_like(values)

    return (values - values.mean()) / std


# ==========================================================================
# LOADING
# ==========================================================================

def load_data():

    print("\nLoading topology...")
    topology = pd.read_csv(TOPOLOGY_FILE)

    print("Loading weather...")
    weather = pd.read_csv(WEATHER_FILE)

    weather["date"] = pd.to_datetime(
        weather["date"],
        errors="coerce",
    )

    print("Loading expanded TMS movements...")
    movements = pd.read_csv(MOVEMENTS_FILE)

    movements["actual_entry_time"] = pd.to_datetime(
        movements["actual_entry_time"],
        errors="coerce",
    )

    movements["actual_exit_time"] = pd.to_datetime(
        movements["actual_exit_time"],
        errors="coerce",
    )

    movements = movements.dropna(
        subset=[
            "actual_entry_time",
            "actual_exit_time",
            "section_id",
        ]
    ).reset_index(drop=True)

    return topology, weather, movements


# ==========================================================================
# ASSET PREPARATION
# ==========================================================================

def prepare_assets(topology):

    required = [
        "asset_id",
        "asset_type",
        "department",
        "section_id",
        "km_marker",
    ]

    missing = [
        c for c in required
        if c not in topology.columns
    ]

    if missing:
        raise ValueError(
            f"Topology missing columns: {missing}"
        )

    assets = (
        topology[required]
        .drop_duplicates("asset_id")
        .reset_index(drop=True)
    )

    assets["km_marker"] = pd.to_numeric(
        assets["km_marker"],
        errors="coerce",
    )

    assets = assets.dropna(
        subset=["km_marker"]
    ).reset_index(drop=True)

    if assets.empty:
        raise ValueError("No valid assets found in topology.")

    return assets


# ==========================================================================
# MOVEMENT STATISTICS
# ==========================================================================

def prepare_movement_statistics(movements):

    movements = movements.copy()

    movements["section_id"] = (
        movements["section_id"]
        .astype(str)
    )

    movements["movement_date"] = (
        movements["actual_entry_time"]
        .dt.normalize()
    )

    movements["delay_minutes"] = pd.to_numeric(
        movements["exit_delay_minutes"],
        errors="coerce",
    ).fillna(0.0)

    # ----------------------------------------------------------------------
    # Gross tonnage
    # ----------------------------------------------------------------------

    tonnage_column = next(
        (
            column
            for column in (
                "gross_tonnage_t",
                "gross_tonnage",
            )
            if column in movements.columns
        ),
        None,
    )

    if tonnage_column is not None:

        movements["gross_tonnage_t"] = pd.to_numeric(
            movements[tonnage_column],
            errors="coerce",
        ).fillna(0.0)

    elif "train_type" in movements.columns:

        train_type_factor = {
            "FREIGHT": 5.0,
            "EXPRESS": 1.8,
            "PASSENGER": 1.2,
            "MEMU": 0.8,
            "EMU": 0.8,
            "LOCAL": 0.8,
        }

        movements["gross_tonnage_t"] = (
            movements["train_type"]
            .map(train_type_factor)
            .fillna(1.2)
            .astype(float)
            * 1000.0
        )

    else:

        movements["gross_tonnage_t"] = RNG.uniform(
            800.0,
            2500.0,
            len(movements),
        )

    movements["tonnage_mgt"] = (
        movements["gross_tonnage_t"]
        / 1_000_000.0
    )

    # ----------------------------------------------------------------------
    # Daily section statistics
    # ----------------------------------------------------------------------

    daily_stats = (
        movements
        .groupby(
            ["section_id", "movement_date"],
            as_index=False,
        )
        .agg(
            daily_train_count=(
                "train_number",
                "nunique",
            ),
            daily_tonnage_mgt=(
                "tonnage_mgt",
                "sum",
            ),
            average_delay_minutes=(
                "delay_minutes",
                "mean",
            ),
        )
    )

    for col in (
        "daily_train_count",
        "daily_tonnage_mgt",
        "average_delay_minutes",
    ):

        daily_stats[col] = pd.to_numeric(
            daily_stats[col],
            errors="coerce",
        ).fillna(0.0)

    # ----------------------------------------------------------------------
    # Section-level fallback statistics
    # ----------------------------------------------------------------------

    section_stats = (
        daily_stats
        .groupby("section_id", as_index=False)
        .agg(
            mean_daily_train_count=(
                "daily_train_count",
                "mean",
            ),
            mean_daily_tonnage_mgt=(
                "daily_tonnage_mgt",
                "mean",
            ),
        )
    )

    return movements, daily_stats, section_stats


# ==========================================================================
# FAST MOVEMENT WINDOW INDEX
#
# The previous implementation scanned the complete 1.78M-row movement
# dataframe for every maintenance request.
#
# This implementation indexes movements by section and uses searchsorted.
# ==========================================================================

def build_movement_index(movements):

    movement_index = {}

    for section_id, group in movements.groupby("section_id"):

        group = group.sort_values(
            "actual_entry_time"
        ).reset_index(drop=True)

        times = (
            group["actual_entry_time"]
            .astype("int64")
            .to_numpy()
        )

        delays = pd.to_numeric(
            group["delay_minutes"],
            errors="coerce",
        ).fillna(0.0).to_numpy(
            dtype=np.float64
        )

        train_numbers = (
            group["train_number"]
            .astype(str)
            .to_numpy()
        )

        movement_index[str(section_id)] = {
            "times": times,
            "delays": delays,
            "train_numbers": train_numbers,
        }

    return movement_index


# ==========================================================================
# MOVEMENT FEATURES
# ==========================================================================

def build_movement_features(
    request_times,
    section_ids,
    movements,
    daily_stats,
    section_stats,
):

    request_times = pd.to_datetime(request_times)

    request_df = pd.DataFrame({
        "request_timestamp": request_times,
        "section_id": section_ids.astype(str),
    })

    request_df["request_date"] = (
        request_df["request_timestamp"]
        .dt.normalize()
    )

    # ----------------------------------------------------------------------
    # Daily statistics
    # ----------------------------------------------------------------------

    daily_lookup = daily_stats.copy()

    daily_lookup["movement_date"] = pd.to_datetime(
        daily_lookup["movement_date"]
    )

    request_df = request_df.merge(
        daily_lookup,
        left_on=[
            "section_id",
            "request_date",
        ],
        right_on=[
            "section_id",
            "movement_date",
        ],
        how="left",
    )

    section_lookup = section_stats.set_index(
        "section_id"
    )

    missing_train = (
        request_df["daily_train_count"].isna()
    )

    request_df.loc[missing_train, "daily_train_count"] = (
        request_df.loc[
            missing_train,
            "section_id"
        ].map(
            section_lookup[
                "mean_daily_train_count"
            ]
        )
    )

    missing_tonnage = (
        request_df["daily_tonnage_mgt"].isna()
    )

    request_df.loc[
        missing_tonnage,
        "daily_tonnage_mgt"
    ] = (
        request_df.loc[
            missing_tonnage,
            "section_id"
        ].map(
            section_lookup[
                "mean_daily_tonnage_mgt"
            ]
        )
    )

    for col in (
        "daily_train_count",
        "daily_tonnage_mgt",
        "average_delay_minutes",
    ):

        request_df[col] = pd.to_numeric(
            request_df[col],
            errors="coerce",
        ).fillna(0.0)

    # ----------------------------------------------------------------------
    # Fast section/time index
    # ----------------------------------------------------------------------

    movement_index = build_movement_index(
        movements
    )

    window_records = []

    for row in request_df.itertuples(index=False):

        section_id = str(row.section_id)

        index = movement_index.get(section_id)

        if index is None:

            train_count = max(
                1,
                int(
                    round(
                        float(
                            row.daily_train_count
                        ) / 12.0
                    )
                ),
            )

            mean_delay = float(
                row.average_delay_minutes
            )

            peak_delay = mean_delay

        else:

            times = index["times"]

            delays = index["delays"]

            train_numbers = index[
                "train_numbers"
            ]

            request_ns = (
                pd.Timestamp(
                    row.request_timestamp
                ).value
            )

            start_ns = (
                request_ns
                - pd.Timedelta(
                    minutes=60
                ).value
            )

            end_ns = (
                request_ns
                + pd.Timedelta(
                    minutes=60
                ).value
            )

            left = np.searchsorted(
                times,
                start_ns,
                side="left",
            )

            right = np.searchsorted(
                times,
                end_ns,
                side="right",
            )

            if right > left:

                delay_values = delays[
                    left:right
                ]

                train_values = train_numbers[
                    left:right
                ]

                train_count = len(
                    np.unique(train_values)
                )

                mean_delay = float(
                    delay_values.mean()
                )

                peak_delay = float(
                    delay_values.max()
                )

            else:

                # ----------------------------------------------------------
                # Historical same-hour fallback
                # ----------------------------------------------------------

                target_hour = (
                    pd.Timestamp(
                        row.request_timestamp
                    ).hour
                )

                target_start = (
                    pd.Timestamp(
                        row.request_timestamp
                    ).normalize()
                    + pd.Timedelta(
                        hours=target_hour - 1
                    )
                )

                target_end = (
                    target_start
                    + pd.Timedelta(hours=3)
                )

                target_start_ns = (
                    target_start.value
                )

                target_end_ns = (
                    target_end.value
                )

                hist_left = np.searchsorted(
                    times,
                    target_start_ns,
                    side="left",
                )

                hist_right = np.searchsorted(
                    times,
                    target_end_ns,
                    side="right",
                )

                if hist_right > hist_left:

                    profile_delays = delays[
                        hist_left:hist_right
                    ]

                    profile_trains = train_numbers[
                        hist_left:hist_right
                    ]

                    profile_count = len(
                        np.unique(
                            profile_trains
                        )
                    )

                    daily_count = max(
                        float(
                            row.daily_train_count
                        ),
                        1.0,
                    )

                    section_total = len(
                        np.unique(train_numbers)
                    )

                    if section_total > 0:

                        train_count = max(
                            1,
                            int(
                                round(
                                    daily_count
                                    * profile_count
                                    / section_total
                                )
                            ),
                        )

                    else:

                        train_count = max(
                            1,
                            int(
                                round(
                                    daily_count
                                    / 12.0
                                )
                            ),
                        )

                    mean_delay = float(
                        profile_delays.mean()
                    )

                    peak_delay = float(
                        profile_delays.max()
                    )

                else:

                    train_count = max(
                        1,
                        int(
                            round(
                                float(
                                    row.daily_train_count
                                ) / 12.0
                            )
                        ),
                    )

                    mean_delay = float(
                        row.average_delay_minutes
                    )

                    peak_delay = mean_delay

        window_records.append({
            "window_train_count": train_count,
            "window_average_delay_minutes": mean_delay,
            "window_peak_delay_minutes": peak_delay,
        })

    result = pd.concat(
        [
            request_df.reset_index(drop=True),
            pd.DataFrame(
                window_records
            ).reset_index(drop=True),
        ],
        axis=1,
    )

    for col in (
        "daily_train_count",
        "daily_tonnage_mgt",
        "window_train_count",
        "window_average_delay_minutes",
        "window_peak_delay_minutes",
    ):

        result[col] = pd.to_numeric(
            result[col],
            errors="coerce",
        ).fillna(0.0)

    # ----------------------------------------------------------------------
    # Traffic density
    # ----------------------------------------------------------------------

    result["traffic_density"] = clamp(
        result["window_train_count"]
        / np.maximum(
            result["daily_train_count"],
            1.0,
        ),
        0.0,
        1.0,
    )

    # ----------------------------------------------------------------------
    # Congestion score
    # ----------------------------------------------------------------------

    result["congestion_score"] = clamp(
        0.55
        * result["traffic_density"]

        + 0.25
        * clamp(
            result[
                "window_average_delay_minutes"
            ] / 30.0,
            0.0,
            1.0,
        )

        + 0.20
        * clamp(
            result[
                "window_peak_delay_minutes"
            ] / 60.0,
            0.0,
            1.0,
        ),

        0.0,
        1.0,
    )

    return result


# ==========================================================================
# ACCUMULATED TONNAGE
# ==========================================================================

def calculate_accumulated_tonnage(
    daily_stats,
    section_ids,
    request_times,
):

    daily = daily_stats.copy()

    daily["movement_date"] = pd.to_datetime(
        daily["movement_date"]
    )

    daily["section_id"] = (
        daily["section_id"]
        .astype(str)
    )

    daily["daily_tonnage_mgt"] = pd.to_numeric(
        daily["daily_tonnage_mgt"],
        errors="coerce",
    ).fillna(0.0)

    daily = daily.sort_values(
        [
            "section_id",
            "movement_date",
        ]
    )

    daily[
        "accumulated_tonnage_mgt"
    ] = (
        daily
        .groupby("section_id")[
            "daily_tonnage_mgt"
        ]
        .cumsum()
        .astype(float)
    )

    requests = pd.DataFrame({
        "section_id": section_ids.astype(str),
        "request_date": pd.to_datetime(
            request_times
        ).normalize(),
        "request_order": np.arange(
            len(request_times)
        ),
    })

    requests = requests.sort_values(
        [
            "request_date",
            "section_id",
        ]
    )

    daily = daily.rename(
        columns={
            "movement_date": "request_date"
        }
    )

    daily = daily.sort_values(
        [
            "request_date",
            "section_id",
        ]
    )

    result = pd.merge_asof(
        requests,
        daily[
            [
                "section_id",
                "request_date",
                "accumulated_tonnage_mgt",
            ]
        ],
        on="request_date",
        by="section_id",
        direction="backward",
    )

    result = result.sort_values(
        "request_order"
    )

    return (
        result[
            "accumulated_tonnage_mgt"
        ]
        .fillna(0.0)
        .to_numpy(
            dtype=np.float64
        )
    )


# ==========================================================================
# WEATHER
# ==========================================================================

def get_weather_features(
    weather,
    section_ids,
    request_times,
):

    weather = weather.copy()

    weather["date"] = pd.to_datetime(
        weather["date"],
        errors="coerce",
    )

    weather["section_id"] = (
        weather["section_id"]
        .astype(str)
    )

    weather_key = weather[
        [
            "section_id",
            "date",
            "temperature_mean_c",
            "rainfall_mm",
            "rain_mm",
            "max_wind_speed_kmh",
            "is_heavy_rain_day",
            "is_heatwave_day",
            "is_rain_day",
        ]
    ].drop_duplicates(
        [
            "section_id",
            "date",
        ]
    )

    request_df = pd.DataFrame({
        "section_id": section_ids.astype(str),
        "date": pd.to_datetime(
            request_times
        ).normalize(),
    })

    result = request_df.merge(
        weather_key,
        on=[
            "section_id",
            "date",
        ],
        how="left",
    )

    result["rainfall_mm"] = (
        pd.to_numeric(
            result["rainfall_mm"],
            errors="coerce",
        )
        .fillna(
            pd.to_numeric(
                result["rain_mm"],
                errors="coerce",
            )
        )
        .fillna(0.0)
    )

    result["temperature_mean_c"] = (
        pd.to_numeric(
            result["temperature_mean_c"],
            errors="coerce",
        )
        .fillna(28.0)
    )

    result["max_wind_speed_kmh"] = (
        pd.to_numeric(
            result["max_wind_speed_kmh"],
            errors="coerce",
        )
        .fillna(10.0)
    )

    for col in (
        "is_heavy_rain_day",
        "is_heatwave_day",
        "is_rain_day",
    ):

        result[col] = (
            pd.to_numeric(
                result[col],
                errors="coerce",
            )
            .fillna(0)
            .astype(int)
        )

    result["weather_risk"] = clamp(
        0.55
        * clamp(
            result[
                "rainfall_mm"
            ].to_numpy(
                dtype=np.float64
            ) / 50.0,
            0.0,
            1.0,
        )

        + 0.20
        * clamp(
            (
                result[
                    "temperature_mean_c"
                ].to_numpy(
                    dtype=np.float64
                )
                - 32.0
            ) / 15.0,
            0.0,
            1.0,
        )

        + 0.15
        * clamp(
            result[
                "max_wind_speed_kmh"
            ].to_numpy(
                dtype=np.float64
            ) / 60.0,
            0.0,
            1.0,
        )

        + 0.10
        * result[
            "is_heavy_rain_day"
        ].to_numpy(
            dtype=np.float64
        ),

        0.0,
        1.0,
    )

    return result


# ==========================================================================
# DATASET GENERATION
# ==========================================================================

def generate_dataset(
    topology,
    weather,
    movements,
):

    assets = prepare_assets(topology)

    (
        movements,
        daily_stats,
        section_stats,
    ) = prepare_movement_statistics(
        movements
    )

    # ----------------------------------------------------------------------
    # Randomly select assets
    # ----------------------------------------------------------------------

    asset_indices = RNG.integers(
        0,
        len(assets),
        NUM_RECORDS,
    )

    selected_assets = (
        assets
        .iloc[asset_indices]
        .reset_index(drop=True)
    )

    section_ids = (
        selected_assets["section_id"]
        .astype(str)
    )

    # ----------------------------------------------------------------------
    # Generate requests across the complete 2022-2026 period
    # ----------------------------------------------------------------------

    total_seconds = int(
        (
            END_DATE
            + pd.Timedelta(days=1)
            - START_DATE
        ).total_seconds()
    )

    request_seconds = RNG.integers(
        0,
        total_seconds,
        NUM_RECORDS,
    )

    request_times = (
        START_DATE
        + pd.to_timedelta(
            request_seconds,
            unit="s",
        )
    )

    # ----------------------------------------------------------------------
    # TMS-derived features
    # ----------------------------------------------------------------------

    print("\nPreparing TMS traffic features...")

    movement_features = build_movement_features(
        request_times,
        section_ids,
        movements,
        daily_stats,
        section_stats,
    )

    print("Preparing weather features...")

    weather_features = get_weather_features(
        weather,
        section_ids,
        request_times,
    )

    print("Calculating accumulated tonnage...")

    accumulated_tonnage = np.asarray(
        calculate_accumulated_tonnage(
            daily_stats,
            section_ids,
            request_times,
        ),
        dtype=np.float64,
    )

    n = NUM_RECORDS

    departments = (
        selected_assets["department"]
        .astype(str)
        .to_numpy()
    )

    # ----------------------------------------------------------------------
    # Work type
    # ----------------------------------------------------------------------

    work_types = np.array([
        random.choice(
            WORK_TYPES.get(
                dept,
                WORK_TYPES["ENGG"],
            )
        )
        for dept in departments
    ])

    base_durations = np.array([
        BASE_DURATION.get(
            work_type,
            120,
        )
        for work_type in work_types
    ], dtype=np.float64)

    # ----------------------------------------------------------------------
    # Priority
    # ----------------------------------------------------------------------

    priorities = RNG.choice(
        [
            "LOW",
            "MEDIUM",
            "HIGH",
            "CRITICAL",
        ],
        n,
        p=[
            0.15,
            0.45,
            0.32,
            0.08,
        ],
    )

    priority_factor = (
        pd.Series(priorities)
        .map({
            "LOW": 0.95,
            "MEDIUM": 1.00,
            "HIGH": 1.08,
            "CRITICAL": 1.15,
        })
        .fillna(1.0)
        .to_numpy(
            dtype=np.float64
        )
    )

    # ----------------------------------------------------------------------
    # Severity / inspection
    # ----------------------------------------------------------------------

    severity_score = (
        RNG.integers(
            1,
            11,
            n,
        )
        .astype(np.float64)
    )

    inspection_score = clamp(
        100.0
        - severity_score * 7.0
        + RNG.normal(
            0.0,
            5.0,
            n,
        ),
        20.0,
        100.0,
    )

    # ----------------------------------------------------------------------
    # Safety critical
    # ----------------------------------------------------------------------

    safety_critical = (
        np.isin(
            priorities,
            [
                "HIGH",
                "CRITICAL",
            ],
        )
        & (
            RNG.random(n)
            < 0.70
        )
    ).astype(int)

    # ----------------------------------------------------------------------
    # Workforce / equipment
    # ----------------------------------------------------------------------

    workers = RNG.integers(
        3,
        16,
        n,
    ).astype(int)

    workers += np.where(
        departments == "ENGG",
        RNG.integers(
            2,
            6,
            n,
        ),
        0,
    )

    equipment_count = RNG.integers(
        1,
        6,
        n,
    ).astype(int)

    section_complexity = RNG.uniform(
        0.90,
        1.25,
        n,
    ).astype(np.float64)

    # ----------------------------------------------------------------------
    # Environmental / traffic inputs
    # ----------------------------------------------------------------------

    weather_risk = np.asarray(
        weather_features[
            "weather_risk"
        ],
        dtype=np.float64,
    )

    heavy_rain = (
        weather_features[
            "is_heavy_rain_day"
        ]
        .to_numpy(
            dtype=np.float64
        )
    )

    congestion = np.asarray(
        movement_features[
            "congestion_score"
        ],
        dtype=np.float64,
    )

    weather_sensitive_work = np.isin(
        work_types,
        list(
            WEATHER_SENSITIVE_WORK
        ),
    )

    # ----------------------------------------------------------------------
    # Planned duration
    # ----------------------------------------------------------------------

    planned_duration = (
        base_durations
        * priority_factor
        * section_complexity
        * RNG.uniform(
            0.85,
            1.15,
            n,
        )
    )

    planned_duration = np.maximum(
        np.nan_to_num(
            planned_duration,
            nan=60.0,
        ),
        20.0,
    )

    planned_duration = np.round(
        planned_duration,
        2,
    )

    # ----------------------------------------------------------------------
    # Workload per worker
    # ----------------------------------------------------------------------

    workload_per_worker = (
        planned_duration
        / np.maximum(
            workers,
            1.0,
        )
    )

    # ----------------------------------------------------------------------
    # Priority numeric encoding
    # ----------------------------------------------------------------------

    priority_numeric = (
        pd.Series(priorities)
        .map({
            "LOW": 0.0,
            "MEDIUM": 1.0,
            "HIGH": 2.0,
            "CRITICAL": 3.0,
        })
        .to_numpy(
            dtype=np.float64
        )
    )

    # ==========================================================================
    # COMPLICATION MODEL
    #
    # This is deliberately probabilistic.
    #
    # Factors:
    #   severity
    #   priority
    #   weather
    #   congestion
    #   workload per worker
    #   heavy rain + weather-sensitive work
    # ==========================================================================

    risk_logit = (
            -1.80

        + 0.55
        * zscore(
            severity_score
        )

        + 0.45
        * zscore(
            priority_numeric
        )

        + 0.35
        * zscore(
            weather_risk
        )

        + 0.30
        * zscore(
            congestion
        )

        + 0.40
        * zscore(
            workload_per_worker
        )

        + np.where(
            (
                (heavy_rain == 1)
                & weather_sensitive_work
            ),
            0.90,
            0.0,
        )
    )

    complication_risk = clamp(
        1.0
        / (
            1.0
            + np.exp(
                -risk_logit
            )
        ),
        0.03,
        0.90,
    )

    complication_occurred = (
        RNG.random(n)
        < complication_risk
    ).astype(int)

    # ----------------------------------------------------------------------
    # Actual execution duration
    # ----------------------------------------------------------------------

    # Routine execution varies by a few minutes around the plan. A bounded
    # additive residual avoids making long jobs systematically overrun.
    routine_sigma = np.maximum(planned_duration * 0.025, 2.0)
    routine_delay = clamp(
        RNG.normal(0.0, routine_sigma),
        -10.0,
        10.0,
    )

    # A complication adds a positive, bounded delay. Its probability carries
    # the causal effects of priority, workload, congestion and weather above.
    complication_delay = (
        RNG.uniform(12.0, 30.0, n)
        + RNG.normal(0.0, 2.0, n)
    )
    complication_delay = clamp(complication_delay, 8.0, 36.0)

    actual_duration = planned_duration + routine_delay + (
        complication_occurred * complication_delay
    )

    # Accumulated traffic contributes a small additive maintenance burden,
    # capped so it cannot dominate the execution outcome.
    tonnage_delay = clamp(
        np.log1p(np.maximum(accumulated_tonnage, 0.0)) * 0.20,
        0.0,
        2.0,
    )
    actual_duration = actual_duration + tonnage_delay

    actual_duration = np.nan_to_num(
        actual_duration,
        nan=20.0,
        posinf=720.0,
        neginf=20.0,
    )

    actual_duration = np.maximum(
        np.round(
            actual_duration,
            2,
        ),
        20.0,
    )

    # ----------------------------------------------------------------------
    # Overrun
    # ----------------------------------------------------------------------

    overrun_minutes = np.round(
        np.maximum(
            actual_duration
            - planned_duration,
            0.0,
        ),
        2,
    )

    overrun_flag = (
        overrun_minutes
        > 10.0
    ).astype(int)

    completion_status = np.where(
        actual_duration
        < planned_duration,

        "EARLY",

        np.where(
            actual_duration
            <= planned_duration + 10.0,

            "ON_TIME",

            "OVERRUN",
        ),
    )

    # ----------------------------------------------------------------------
    # Timing
    # ----------------------------------------------------------------------

    planned_start = (
        request_times
        + pd.to_timedelta(
            RNG.integers(
                15,
                121,
                n,
            ),
            unit="m",
        )
    )

    actual_start = (
        request_times
        + pd.to_timedelta(
            RNG.integers(
                30,
                181,
                n,
            ),
            unit="m",
        )
    )

    planned_end = (
        planned_start
        + pd.to_timedelta(
            planned_duration,
            unit="m",
        )
    )

    actual_end = (
        actual_start
        + pd.to_timedelta(
            actual_duration,
            unit="m",
        )
    )

    # ----------------------------------------------------------------------
    # Train impact
    # ----------------------------------------------------------------------

    trains_in_section = np.maximum(
        movement_features[
            "window_train_count"
        ].to_numpy(
            dtype=np.float64
        ),
        0.0,
    )

    trains_affected = np.round(
        trains_in_section
        * (
            0.5
            + congestion
        )
        * RNG.uniform(
            0.5,
            1.4,
            n,
        )
    ).astype(int)

    current_delay = np.nan_to_num(
        np.asarray(
            movement_features[
                "window_average_delay_minutes"
            ],
            dtype=np.float64,
        ),
        nan=0.0,
        posinf=180.0,
        neginf=0.0,
    )

    # ----------------------------------------------------------------------
    # Task IDs
    # ----------------------------------------------------------------------

    task_prefix = np.select(
        [
            departments == "ENGG",
            departments == "SNT",
            departments == "TRD",
        ],
        [
            "TRK",
            "SNT",
            "OHE",
        ],
        default="TRK",
    )

    task_ids = np.array([
        f"{prefix}-{ts.strftime('%y%m%d')}-{i:05d}"
        for i, (
            prefix,
            ts,
        ) in enumerate(
            zip(
                task_prefix,
                request_times,
            ),
            start=1,
        )
    ])

    # ==========================================================================
    # FINAL DATAFRAME
    # ==========================================================================

    df = pd.DataFrame({

        "task_id": task_ids,

        "request_timestamp": request_times,

        "department": departments,

        "section_id": section_ids.to_numpy(),

        "asset_id": (
            selected_assets[
                "asset_id"
            ].to_numpy()
        ),

        "asset_type": (
            selected_assets[
                "asset_type"
            ].to_numpy()
        ),

        "work_type": work_types,

        "location_km_marker": (
            selected_assets[
                "km_marker"
            ].to_numpy(
                dtype=np.float64
            )
        ),

        "priority": priorities,

        "safety_critical": safety_critical,

        "inspection_score": np.round(
            inspection_score,
            2,
        ),

        "severity_score": (
            severity_score
            .astype(int)
        ),

        "planned_start_time": planned_start,

        "planned_end_time": planned_end,

        "planned_duration_minutes": (
            planned_duration
        ),

        "actual_start_time": actual_start,

        "actual_end_time": actual_end,

        "actual_duration_minutes": (
            actual_duration
        ),

        "overrun_minutes": (
            overrun_minutes
        ),

        "overrun_flag": overrun_flag,

        "complication_occurred": (
            complication_occurred
        ),

        "complication_risk_score": (
            np.round(
                complication_risk,
                4,
            )
        ),

        "completion_status": (
            completion_status
        ),

        "workers_required": workers,

        "equipment_count": equipment_count,

        "workload_per_worker": (
            np.round(
                workload_per_worker,
                2,
            )
        ),

        "trains_in_section": (
            trains_in_section
            .astype(int)
        ),

        "trains_affected": (
            trains_affected
        ),

        "daily_train_count": (
            movement_features[
                "daily_train_count"
            ].to_numpy(
                dtype=np.float64
            )
        ),

        "daily_tonnage_mgt": (
            movement_features[
                "daily_tonnage_mgt"
            ].to_numpy(
                dtype=np.float64
            )
        ),

        "accumulated_tonnage_mgt": (
            accumulated_tonnage
        ),

        "window_train_count": (
            movement_features[
                "window_train_count"
            ].to_numpy(
                dtype=np.float64
            )
        ),

        "window_average_delay_minutes": (
            movement_features[
                "window_average_delay_minutes"
            ].to_numpy(
                dtype=np.float64
            )
        ),

        "window_peak_delay_minutes": (
            movement_features[
                "window_peak_delay_minutes"
            ].to_numpy(
                dtype=np.float64
            )
        ),

        "traffic_density": (
            movement_features[
                "traffic_density"
            ].to_numpy(
                dtype=np.float64
            )
        ),

        "congestion_score": (
            congestion
        ),

        "current_delay_minutes": (
            np.round(
                current_delay,
                2,
            )
        ),

        "temperature_mean_c": (
            weather_features[
                "temperature_mean_c"
            ].to_numpy(
                dtype=np.float64
            )
        ),

        "rainfall_mm": (
            weather_features[
                "rainfall_mm"
            ].to_numpy(
                dtype=np.float64
            )
        ),

        "max_wind_speed_kmh": (
            weather_features[
                "max_wind_speed_kmh"
            ].to_numpy(
                dtype=np.float64
            )
        ),

        "weather_risk": (
            weather_risk
        ),

        "is_heavy_rain_day": (
            weather_features[
                "is_heavy_rain_day"
            ].to_numpy(
                dtype=int
            )
        ),

        "is_heatwave_day": (
            weather_features[
                "is_heatwave_day"
            ].to_numpy(
                dtype=int
            )
        ),

        "is_rain_day": (
            weather_features[
                "is_rain_day"
            ].to_numpy(
                dtype=int
            )
        ),
    })

    return df


# ==========================================================================
# VALIDATION
# ==========================================================================

def validate_dataset(df):

    required_columns = [
        "task_id",
        "request_timestamp",
        "department",
        "section_id",
        "asset_id",
        "asset_type",
        "work_type",
        "planned_duration_minutes",
        "actual_duration_minutes",
        "overrun_minutes",
        "daily_train_count",
        "daily_tonnage_mgt",
        "accumulated_tonnage_mgt",
        "window_train_count",
        "congestion_score",
        "weather_risk",
    ]

    missing = [
        c
        for c in required_columns
        if c not in df.columns
    ]

    if missing:
        raise ValueError(
            f"Missing columns: {missing}"
        )

    # ----------------------------------------------------------------------
    # Record count
    # ----------------------------------------------------------------------

    if len(df) != NUM_RECORDS:

        raise ValueError(
            f"Expected {NUM_RECORDS} records, "
            f"got {len(df)}"
        )

    # ----------------------------------------------------------------------
    # IDs
    # ----------------------------------------------------------------------

    if df["task_id"].duplicated().any():

        raise ValueError(
            "Duplicate task IDs detected."
        )

    # ----------------------------------------------------------------------
    # Numeric validation
    # ----------------------------------------------------------------------

    numeric_columns = [
        "planned_duration_minutes",
        "actual_duration_minutes",
        "overrun_minutes",
        "daily_train_count",
        "daily_tonnage_mgt",
        "accumulated_tonnage_mgt",
        "window_train_count",
        "window_average_delay_minutes",
        "window_peak_delay_minutes",
        "traffic_density",
        "congestion_score",
        "weather_risk",
    ]

    for column in numeric_columns:

        df[column] = pd.to_numeric(
            df[column],
            errors="coerce",
        )

        if df[column].isna().any():

            raise ValueError(
                f"Invalid numeric values in {column}."
            )

        if not np.isfinite(
            df[column].to_numpy(
                dtype=np.float64
            )
        ).all():

            raise ValueError(
                f"Non-finite values in {column}."
            )

    # ----------------------------------------------------------------------
    # Duration checks
    # ----------------------------------------------------------------------

    if (
        df["actual_duration_minutes"]
        <= 0
    ).any():

        raise ValueError(
            "Invalid actual duration."
        )

    if (
        df["planned_duration_minutes"]
        <= 0
    ).any():

        raise ValueError(
            "Invalid planned duration."
        )

    # ----------------------------------------------------------------------
    # Bounded features
    # ----------------------------------------------------------------------

    if not df["weather_risk"].between(
        0,
        1,
    ).all():

        raise ValueError(
            "Invalid weather risk."
        )

    if not df["congestion_score"].between(
        0,
        1,
    ).all():

        raise ValueError(
            "Invalid congestion score."
        )

    if not df["traffic_density"].between(
        0,
        1,
    ).all():

        raise ValueError(
            "Invalid traffic density."
        )

    # ----------------------------------------------------------------------
    # Physical constraints
    # ----------------------------------------------------------------------

    if (
        df["accumulated_tonnage_mgt"]
        < 0
    ).any():

        raise ValueError(
            "Negative accumulated tonnage."
        )

    if (
        df["rainfall_mm"]
        < 0
    ).any():

        raise ValueError(
            "Negative rainfall."
        )

    # ----------------------------------------------------------------------
    # Overrun calculation
    # ----------------------------------------------------------------------

    calculated_overrun = np.maximum(
        df["actual_duration_minutes"]
        - df["planned_duration_minutes"],
        0,
    )

    if (
        np.abs(
            calculated_overrun
            - df["overrun_minutes"]
        )
        > 0.05
    ).any():

        raise ValueError(
            "Overrun calculation mismatch."
        )

    # ----------------------------------------------------------------------
    # Overrun rate sanity check
    # ----------------------------------------------------------------------

    overrun_rate = (
        df["overrun_flag"].mean()
    )

    if not (
        OVERRUN_RATE_MIN
        <= overrun_rate
        <= OVERRUN_RATE_MAX
    ):

        raise ValueError(
            f"Overrun rate "
            f"{overrun_rate:.2%} "
            f"is outside the realistic band "
            f"[{OVERRUN_RATE_MIN:.0%}, "
            f"{OVERRUN_RATE_MAX:.0%}]. "
            f"Check the complication/duration model."
        )

    # ----------------------------------------------------------------------
    # Date validation
    # ----------------------------------------------------------------------

    dates = pd.to_datetime(
        df["request_timestamp"]
    )

    if dates.min() < START_DATE:

        raise ValueError(
            "Request date is before START_DATE."
        )

    if dates.max() > END_DATE + pd.Timedelta(
        days=1
    ):

        raise ValueError(
            "Request date is after END_DATE."
        )


# ==========================================================================
# SAVE
# ==========================================================================

def save_dataset(df):

    os.makedirs(
        OUTPUT_DIR,
        exist_ok=True,
    )

    df = (
        df
        .sort_values(
            "request_timestamp"
        )
        .reset_index(drop=True)
    )

    df.to_csv(
        OUTPUT_FILE,
        index=False,
    )


# ==========================================================================
# SUMMARY
# ==========================================================================

def print_summary(df):

    print()
    print("=" * 70)
    print("STEP 04 COMPLETE: BLOCK EXECUTION HISTORY")
    print("=" * 70)

    print(
        f"Total records: "
        f"{len(df):,}"
    )

    print(
        f"Date range: "
        f"{df['request_timestamp'].min()} "
        f"→ "
        f"{df['request_timestamp'].max()}"
    )

    print(
        f"Unique assets: "
        f"{df['asset_id'].nunique():,}"
    )

    print(
        f"Unique sections: "
        f"{df['section_id'].nunique():,}"
    )

    print(
        f"Average planned duration: "
        f"{df['planned_duration_minutes'].mean():.2f} min"
    )

    print(
        f"Average actual duration: "
        f"{df['actual_duration_minutes'].mean():.2f} min"
    )

    print(
        f"Average overrun: "
        f"{df['overrun_minutes'].mean():.2f} min"
    )

    print(
        f"Overrun rate: "
        f"{df['overrun_flag'].mean() * 100:.2f}%"
    )

    print(
        f"Complication rate: "
        f"{df['complication_occurred'].mean() * 100:.2f}%"
    )

    print(
        f"Average daily trains: "
        f"{df['daily_train_count'].mean():.2f}"
    )

    print(
        f"Average daily tonnage: "
        f"{df['daily_tonnage_mgt'].mean():.4f} MGT"
    )

    print(
        f"Average accumulated tonnage: "
        f"{df['accumulated_tonnage_mgt'].mean():.4f} MGT"
    )

    print(
        f"Average congestion score: "
        f"{df['congestion_score'].mean():.4f}"
    )

    print(
        f"Average weather risk: "
        f"{df['weather_risk'].mean():.4f}"
    )

    # ----------------------------------------------------------------------
    # Department
    # ----------------------------------------------------------------------

    print("\nDepartment distribution:")

    print(
        df["department"]
        .value_counts()
        .to_string()
    )

    # ----------------------------------------------------------------------
    # Priority
    # ----------------------------------------------------------------------

    print("\nPriority distribution:")

    print(
        df["priority"]
        .value_counts()
        .to_string()
    )

    # ----------------------------------------------------------------------
    # Completion
    # ----------------------------------------------------------------------

    print("\nCompletion status:")

    print(
        df["completion_status"]
        .value_counts()
        .to_string()
    )

    # ----------------------------------------------------------------------
    # Overrun by priority
    # ----------------------------------------------------------------------

    print(
        "\nOverrun rate by priority "
        "(should generally rise with priority):"
    )

    print(
        df.groupby(
            "priority"
        )["overrun_flag"]
        .mean()
        .sort_values()
        .to_string()
    )

    # ----------------------------------------------------------------------
    # Overrun by heavy rain
    # ----------------------------------------------------------------------

    print(
        "\nOverrun rate by heavy-rain day "
        "(should generally be higher when true):"
    )

    print(
        df.groupby(
            "is_heavy_rain_day"
        )["overrun_flag"]
        .mean()
        .to_string()
    )

    # ----------------------------------------------------------------------
    # Overrun by department
    # ----------------------------------------------------------------------

    print(
        "\nOverrun rate by department:"
    )

    print(
        df.groupby(
            "department"
        )["overrun_flag"]
        .mean()
        .sort_values()
        .to_string()
    )

    # ----------------------------------------------------------------------
    # Overrun by work type
    # ----------------------------------------------------------------------

    print(
        "\nTop work types by overrun rate:"
    )

    print(
        df.groupby(
            "work_type"
        )["overrun_flag"]
        .mean()
        .sort_values(
            ascending=False
        )
        .head(10)
        .to_string()
    )

    print(
        f"\nFile saved to:\n"
        f"{OUTPUT_FILE}"
    )

    print("=" * 70)


# ==========================================================================
# MAIN
# ==========================================================================

def main():

    print("=" * 70)
    print("STEP 04: BLOCK EXECUTION HISTORY")
    print("=" * 70)

    print(
        f"\nHistorical period: "
        f"{START_DATE.date()} "
        f"→ "
        f"{END_DATE.date()}"
    )

    print(
        f"Target records: "
        f"{NUM_RECORDS:,}"
    )

    # ----------------------------------------------------------------------
    # Load
    # ----------------------------------------------------------------------

    topology, weather, movements = load_data()

    print(
        f"\nTopology records: "
        f"{len(topology):,}"
    )

    print(
        f"Weather records: "
        f"{len(weather):,}"
    )

    print(
        f"Actual movement records: "
        f"{len(movements):,}"
    )

    # ----------------------------------------------------------------------
    # TMS date range
    # ----------------------------------------------------------------------

    movement_min = movements[
        "actual_entry_time"
    ].min()

    movement_max = movements[
        "actual_entry_time"
    ].max()

    print(
        f"TMS movement date range: "
        f"{movement_min.date()} "
        f"→ "
        f"{movement_max.date()}"
    )

    # ----------------------------------------------------------------------
    # Generate
    # ----------------------------------------------------------------------

    print(
        "\nGenerating maintenance/block "
        "execution records..."
    )

    df = generate_dataset(
        topology,
        weather,
        movements,
    )

    # ----------------------------------------------------------------------
    # Validate
    # ----------------------------------------------------------------------

    print(
        "\nValidating dataset..."
    )

    validate_dataset(df)

    print(
        "Validation passed."
    )

    # ----------------------------------------------------------------------
    # Save
    # ----------------------------------------------------------------------

    save_dataset(df)

    # ----------------------------------------------------------------------
    # Summary
    # ----------------------------------------------------------------------

    print_summary(df)


if __name__ == "__main__":
    main()