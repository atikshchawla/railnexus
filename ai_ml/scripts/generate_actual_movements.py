from pathlib import Path

import pandas as pd
import numpy as np


# ============================================================
# PATHS
# ============================================================

PROJECT_ROOT = Path(__file__).resolve().parents[1]

RAW_DIR = PROJECT_ROOT / "data" / "raw"
CURATED_DIR = PROJECT_ROOT / "data" / "curated"

SCHEDULE_FILE = RAW_DIR / "tms" / "tms_section_schedule.csv"
TOPOLOGY_FILE = RAW_DIR / "network_topology.csv"
WEATHER_FILE = RAW_DIR / "weather_historical.csv"

OUTPUT_FILE = (
    CURATED_DIR
    / "tms"
    / "tms_actual_movements.csv"
)


# ============================================================
# CONFIGURATION
# ============================================================

RANDOM_SEED = 42

# Historical expansion period
HISTORY_START_DATE = "2022-01-01"
HISTORY_END_DATE = "2026-08-27"

# Synthetic historical schedule variation
SCHEDULE_TIME_JITTER_MINUTES = 2
TRAIN_OMISSION_RATE = 0.02

# Actual movement parameters
BASE_DELAY_SHAPE = 2.0
BASE_DELAY_SCALE = 2.5

DISRUPTION_PROBABILITY = 0.03
DISRUPTION_MIN_DELAY = 10
DISRUPTION_MAX_DELAY = 30

MAX_ENTRY_DELAY = 60
MAX_EXIT_DELAY = 90

# ============================================================
# RANDOM GENERATOR
# ============================================================

rng = np.random.default_rng(RANDOM_SEED)


# ============================================================
# LOAD DATA
# ============================================================

def load_data():
    """Load schedule, topology and historical weather."""

    print("\n" + "=" * 70)
    print("LOADING INPUT DATA")
    print("=" * 70)

    schedule = pd.read_csv(SCHEDULE_FILE)
    topology = pd.read_csv(TOPOLOGY_FILE)
    weather = pd.read_csv(WEATHER_FILE)

    print(f"Schedule records : {len(schedule):,}")
    print(f"Topology records : {len(topology):,}")
    print(f"Weather records  : {len(weather):,}")

    return schedule, topology, weather


# ============================================================
# ENSURE GROSS TONNAGE
# ============================================================

def ensure_gross_tonnage(schedule):
    """
    Ensure gross tonnage exists.

    If the schedule already contains a tonnage field, use it.
    Otherwise create a realistic synthetic value based on
    train type / train characteristics.
    """

    schedule = schedule.copy()

    possible_columns = [
        "gross_tonnage_t",
        "gross_tonnage",
        "total_weight_t",
        "train_weight_t",
        "tonnage_t"
    ]

    existing = None

    for col in possible_columns:
        if col in schedule.columns:
            existing = col
            break

    if existing is not None:

        schedule["gross_tonnage_t"] = pd.to_numeric(
            schedule[existing],
            errors="coerce"
        )

        schedule["gross_tonnage_t"] = (
            schedule["gross_tonnage_t"]
            .fillna(2500)
            .clip(lower=500)
        )

        print(
            f"Using existing tonnage column: {existing}"
        )

    else:

        print(
            "No gross tonnage column found."
            " Generating synthetic tonnage."
        )

        # Default train tonnage
        schedule["gross_tonnage_t"] = 2500.0

        # Try to identify train type
        type_columns = [
            "train_type",
            "train_category",
            "service_type",
            "train_class"
        ]

        type_col = None

        for col in type_columns:
            if col in schedule.columns:
                type_col = col
                break

        if type_col:

            values = (
                schedule[type_col]
                .astype(str)
                .str.upper()
            )

            # Freight
            freight_mask = values.str.contains(
                "FREIGHT|GOODS|CARGO",
                regex=True,
                na=False
            )

            # Passenger
            passenger_mask = values.str.contains(
                "PASSENGER|EXPRESS|MAIL|INTERCITY",
                regex=True,
                na=False
            )

            schedule.loc[
                freight_mask,
                "gross_tonnage_t"
            ] = rng.uniform(
                3500,
                5500,
                freight_mask.sum()
            )

            schedule.loc[
                passenger_mask,
                "gross_tonnage_t"
            ] = rng.uniform(
                900,
                1800,
                passenger_mask.sum()
            )

            # Remaining trains
            remaining = ~(
                freight_mask |
                passenger_mask
            )

            schedule.loc[
                remaining,
                "gross_tonnage_t"
            ] = rng.uniform(
                1800,
                3000,
                remaining.sum()
            )

        else:

            schedule["gross_tonnage_t"] = rng.uniform(
                1800,
                3500,
                len(schedule)
            )

    schedule["gross_tonnage_t"] = (
        schedule["gross_tonnage_t"]
        .round(1)
    )

    return schedule


# ============================================================
# EXPAND 2-DAY TMS INTO HISTORICAL PERIOD
# ============================================================

def expand_schedule_to_history(schedule):
    """
    Expand the available TMS schedule templates across the full
    historical period.

    The source TMS contains only a small number of dates. These
    dates are treated as operational templates, not as complete
    historical traffic records.

    The dominant template defines the network's normal movement
    structure. Daily traffic is then varied using:
        - weekday effects
        - yearly trend
        - seasonal variation
        - controlled daily stochastic variation
        - small movement-level timing jitter

    This creates SYNTHETIC historical schedule data.
    It is not claimed to be real historical TMS data.
    """

    schedule = schedule.copy()

    print("\n" + "=" * 70)
    print("EXPANDING TMS SCHEDULE TO HISTORICAL PERIOD")
    print("=" * 70)

    # --------------------------------------------------------
    # Parse original timestamps
    # --------------------------------------------------------

    entry_candidates = [
        "scheduled_entry_time",
        "schedule_entry_time",
        "entry_time",
        "scheduled_start_time"
    ]

    exit_candidates = [
        "scheduled_exit_time",
        "schedule_exit_time",
        "exit_time",
        "scheduled_end_time"
    ]

    entry_col = None
    exit_col = None

    for col in entry_candidates:
        if col in schedule.columns:
            entry_col = col
            break

    for col in exit_candidates:
        if col in schedule.columns:
            exit_col = col
            break

    if entry_col is None or exit_col is None:
        raise ValueError(
            "Could not find scheduled entry/exit time columns."
        )

    schedule["scheduled_entry_time"] = pd.to_datetime(
        schedule[entry_col],
        errors="coerce"
    )

    schedule["scheduled_exit_time"] = pd.to_datetime(
        schedule[exit_col],
        errors="coerce"
    )

    schedule = schedule.dropna(
        subset=[
            "scheduled_entry_time",
            "scheduled_exit_time"
        ]
    ).copy()

    # --------------------------------------------------------
    # Identify template dates
    # --------------------------------------------------------

    schedule["template_date"] = (
        schedule["scheduled_entry_time"]
        .dt.normalize()
    )

    template_counts = (
        schedule["template_date"]
        .value_counts()
        .sort_index()
    )

    template_dates = list(template_counts.index)

    print(
        f"Template dates available: "
        f"{len(template_dates)}"
    )

    for d, count in template_counts.items():
        print(
            f"  {pd.Timestamp(d).date()} : "
            f"{count:,} movements"
        )

    if not template_dates:
        raise ValueError(
            "No valid template dates found."
        )

    # --------------------------------------------------------
    # Select dominant operational template
    #
    # The 20-movement Thursday snapshot in the source data is
    # treated as incomplete rather than as a genuine low-volume
    # Thursday.
    # --------------------------------------------------------

    dominant_template_date = (
        template_counts.idxmax()
    )

    dominant_count = int(
        template_counts.max()
    )

    dominant_template = schedule[
        schedule["template_date"]
        == dominant_template_date
    ].copy()

    print("\nDominant operational template:")
    print(
        f"  Date: "
        f"{pd.Timestamp(dominant_template_date).date()}"
    )
    print(
        f"  Movements: "
        f"{dominant_count:,}"
    )

    print("\nTemplate classification:")

    for d, count in template_counts.items():

        ratio = count / dominant_count

        if ratio >= 0.25:
            status = "USED"
        else:
            status = (
                "INCOMPLETE - not used as daily "
                "traffic-volume template"
            )

        print(
            f"  {pd.Timestamp(d).date()} : "
            f"{count:,} movements -> {status}"
        )

    # --------------------------------------------------------
    # Historical dates
    # --------------------------------------------------------

    history_dates = pd.date_range(
        HISTORY_START_DATE,
        HISTORY_END_DATE,
        freq="D"
    )

    print(
        f"\nHistorical dates: "
        f"{len(history_dates):,}"
    )

    # --------------------------------------------------------
    # Daily traffic controls
    #
    # These are intentionally moderate. The purpose is to
    # remove the artificial 20-vs-1108 bimodal distribution,
    # not to fabricate extreme traffic events.
    # --------------------------------------------------------

    weekday_factors = {
        0: 0.94,   # Monday
        1: 0.98,   # Tuesday
        2: 1.00,   # Wednesday
        3: 0.96,   # Thursday
        4: 1.02,   # Friday
        5: 0.90,   # Saturday
        6: 0.84    # Sunday
    }

    year_factors = {
        2022: 0.94,
        2023: 0.97,
        2024: 1.00,
        2025: 1.03,
        2026: 1.05
    }

    # Use a local generator so this function remains reproducible
    # independently of later random draws.
    local_rng = np.random.default_rng(
        RANDOM_SEED + 100
    )

    expanded_parts = []

    # --------------------------------------------------------
    # Expand each historical day
    # --------------------------------------------------------

    for day_index, target_date in enumerate(history_dates):

        weekday = target_date.weekday()

        weekday_factor = weekday_factors[
            weekday
        ]

        # Small annual seasonal effect.
        day_of_year = target_date.dayofyear

        seasonal_factor = (
            1.0
            + 0.04
            * np.sin(
                2.0
                * np.pi
                * day_of_year
                / 365.25
            )
        )

        year_factor = year_factors.get(
            target_date.year,
            1.0
        )

        # Daily operational variation.
        daily_noise = local_rng.normal(
            loc=1.0,
            scale=0.055
        )

        daily_noise = np.clip(
            daily_noise,
            0.85,
            1.15
        )

        daily_multiplier = (
            weekday_factor
            * seasonal_factor
            * year_factor
            * daily_noise
        )

        target_count = int(
            round(
                dominant_count
                * daily_multiplier
            )
        )

        # Hard bounds prevent unrealistic synthetic extremes.
        target_count = int(
            np.clip(
                target_count,
                int(dominant_count * 0.70),
                int(dominant_count * 1.15)
            )
        )

        # ----------------------------------------------------
        # Sample movements from the dominant template.
        #
        # Sampling without replacement preserves the original
        # operational structure while producing different
        # movement sets on different historical days.
        # ----------------------------------------------------

        day_template = dominant_template.sample(
            n=min(target_count, len(dominant_template)),
            replace=False,
            random_state=RANDOM_SEED + day_index
        ).copy()

        # In case configuration ever requests more records than
        # the template contains, sample with replacement.
        if target_count > len(dominant_template):

            extra = dominant_template.sample(
                n=target_count - len(dominant_template),
                replace=True,
                random_state=RANDOM_SEED
                + 10000
                + day_index
            ).copy()

            day_template = pd.concat(
                [day_template, extra],
                ignore_index=True
            )

        # ----------------------------------------------------
        # Preserve time-of-day
        # ----------------------------------------------------

        # Calculate duration while both timestamps still belong to
        # the original template date.
        original_entry = pd.to_datetime(
            day_template["scheduled_entry_time"],
            errors="coerce"
        )

        original_exit = pd.to_datetime(
            day_template["scheduled_exit_time"],
            errors="coerce"
        )

        duration = (
            (original_exit - original_entry)
            .dt.total_seconds()
            / 60.0
        )

        duration = pd.to_numeric(
            duration,
            errors="coerce"
        ).fillna(30.0).clip(
            lower=5.0,
            upper=180.0
        )

        entry_time_of_day = (
            day_template["scheduled_entry_time"]
            - day_template[
                "scheduled_entry_time"
            ].dt.normalize()
        )

        day_template["scheduled_entry_time"] = (
            target_date
            + entry_time_of_day
        )

        # ----------------------------------------------------
        # Small movement-level schedule jitter
        # ----------------------------------------------------

        entry_jitter = pd.to_timedelta(
            local_rng.normal(
                loc=0.0,
                scale=SCHEDULE_TIME_JITTER_MINUTES,
                size=len(day_template)
            ),
            unit="m"
        )

        day_template["scheduled_entry_time"] = (
            day_template["scheduled_entry_time"]
            + entry_jitter
        )

        day_template["scheduled_exit_time"] = (
            day_template["scheduled_entry_time"]
            + pd.to_timedelta(
                duration,
                unit="m"
            )
        )

        # ----------------------------------------------------
        # Ensure valid ordering
        # ----------------------------------------------------

        invalid_exit = (
            day_template["scheduled_exit_time"]
            <= day_template["scheduled_entry_time"]
        )

        if invalid_exit.any():

            day_template.loc[
                invalid_exit,
                "scheduled_exit_time"
            ] = (
                day_template.loc[
                    invalid_exit,
                    "scheduled_entry_time"
                ]
                + pd.to_timedelta(
                    30,
                    unit="m"
                )
            )

        day_template["historical_synthetic"] = 1

        expanded_parts.append(
            day_template
        )

    # --------------------------------------------------------
    # Combine all historical days
    # --------------------------------------------------------

    if not expanded_parts:
        raise ValueError(
            "Historical schedule expansion produced no records."
        )

    expanded = pd.concat(
        expanded_parts,
        ignore_index=True
    )

    # --------------------------------------------------------
    # Keep movements strictly inside requested history period
    # --------------------------------------------------------
    #
    # Movement-level jitter can push a movement near midnight
    # into the following calendar day. Do not allow that to
    # create dates outside HISTORY_START_DATE/HISTORY_END_DATE.
    # --------------------------------------------------------

    history_start = pd.Timestamp(HISTORY_START_DATE)
    history_end = (
        pd.Timestamp(HISTORY_END_DATE)
        + pd.Timedelta(days=1)
    )

    expanded = expanded[
        (expanded["scheduled_entry_time"] >= history_start)
        & (expanded["scheduled_entry_time"] < history_end)
    ].copy()

    expanded = expanded.drop(
        columns=["template_date"],
        errors="ignore"
    )

    expanded = expanded.sort_values(
        "scheduled_entry_time"
    ).reset_index(drop=True)

    # --------------------------------------------------------
    # Final date sanity check
    # --------------------------------------------------------

    actual_dates = (
        expanded["scheduled_entry_time"]
        .dt.normalize()
    )

    print(
        f"\nExpanded movements: "
        f"{len(expanded):,}"
    )

    print(
        f"Unique dates: "
        f"{actual_dates.nunique():,}"
    )

    print(
        f"Earliest date: "
        f"{actual_dates.min().date()}"
    )

    print(
        f"Latest date: "
        f"{actual_dates.max().date()}"
    )

    if "train_id" in expanded.columns:
        print(
            f"Unique trains: "
            f"{expanded['train_id'].nunique():,}"
        )

    if "section_id" in expanded.columns:
        print(
            f"Unique sections: "
            f"{expanded['section_id'].nunique():,}"
        )

    # --------------------------------------------------------
    # Daily traffic validation
    # --------------------------------------------------------

    daily_counts = (
        expanded
        .groupby(
            expanded["scheduled_entry_time"].dt.date
        )
        .size()
    )

    print("\nDaily movement statistics:")
    print(
        daily_counts.describe()
    )

    print("\nWeekday movement statistics:")

    weekday_counts = (
        expanded.assign(
            weekday=expanded[
                "scheduled_entry_time"
            ].dt.day_name()
        )
        .groupby("weekday")
        .size()
        .reindex([
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday"
        ])
        .fillna(0)
        .astype(int)
    )

    print(weekday_counts)

    return expanded


# ============================================================
# PREPARE SCHEDULE
# ============================================================

def prepare_schedule(schedule):
    """Clean and prepare schedule."""

    schedule = schedule.copy()

    schedule["scheduled_entry_time"] = pd.to_datetime(
        schedule["scheduled_entry_time"],
        errors="coerce"
    )

    schedule["scheduled_exit_time"] = pd.to_datetime(
        schedule["scheduled_exit_time"],
        errors="coerce"
    )

    schedule = schedule.dropna(
        subset=[
            "scheduled_entry_time",
            "scheduled_exit_time"
        ]
    )

    # --------------------------------------------------------
    # Ensure section ID
    # --------------------------------------------------------

    if "section_id" not in schedule.columns:
        raise ValueError(
            "Schedule does not contain section_id."
        )

    schedule["section_id"] = (
        schedule["section_id"]
        .astype(str)
        .str.strip()
    )

    # --------------------------------------------------------
    # Scheduled duration
    # --------------------------------------------------------

    schedule["scheduled_duration_minutes"] = (
        (
            schedule["scheduled_exit_time"]
            - schedule["scheduled_entry_time"]
        )
        .dt.total_seconds()
        / 60
    )

    # Prevent impossible values
    schedule["scheduled_duration_minutes"] = (
        schedule["scheduled_duration_minutes"]
        .clip(lower=5, upper=1440)
    )

    schedule = schedule.sort_values(
        "scheduled_entry_time"
    ).reset_index(drop=True)

    print("\nSchedule preparation:")
    print(
        f"  Valid movements: "
        f"{len(schedule):,}"
    )

    print(
        f"  Average duration: "
        f"{schedule['scheduled_duration_minutes'].mean():.2f} min"
    )

    return schedule


# ============================================================
# PREPARE TOPOLOGY
# ============================================================

def prepare_topology(topology):
    """Prepare physical section topology."""

    topology = topology.copy()

    required = [
        "section_id"
    ]

    for col in required:
        if col not in topology.columns:
            raise ValueError(
                f"Topology missing required column: {col}"
            )

    topology["section_id"] = (
        topology["section_id"]
        .astype(str)
        .str.strip()
    )

    # Distance
    if "distance_km" in topology.columns:

        topology["distance_km"] = pd.to_numeric(
            topology["distance_km"],
            errors="coerce"
        )

    else:

        topology["distance_km"] = 10.0

    # Speed
    if "mps_kmh" in topology.columns:

        topology["mps_kmh"] = pd.to_numeric(
            topology["mps_kmh"],
            errors="coerce"
        )

    else:

        topology["mps_kmh"] = 80.0

    topology["distance_km"] = (
        topology["distance_km"]
        .fillna(10)
        .clip(lower=0.1)
    )

    topology["mps_kmh"] = (
        topology["mps_kmh"]
        .fillna(80)
        .clip(lower=10)
    )

    # One row per section
    topology = (
        topology
        .drop_duplicates(
            subset=["section_id"]
        )
        .reset_index(drop=True)
    )

    print("\nTopology preparation:")
    print(
        f"  Sections: "
        f"{len(topology):,}"
    )

    return topology


# ============================================================
# PREPARE WEATHER
# ============================================================

def prepare_weather(weather):
    """
    Prepare historical weather data for exact
    section + date matching with TMS movements.
    """

    print("\n" + "=" * 70)
    print("PREPARING WEATHER DATA")
    print("=" * 70)

    weather = weather.copy()

    # --------------------------------------------------------
    # Normalize section ID
    # --------------------------------------------------------

    if "section_id" not in weather.columns:
        raise ValueError(
            "Weather dataset does not contain 'section_id'."
        )

    weather["section_id"] = (
        weather["section_id"]
        .astype(str)
        .str.strip()
    )

    # --------------------------------------------------------
    # Make sure date column exists
    # --------------------------------------------------------

    if "date" not in weather.columns:

        # Handle old files that may still contain "time"
        if "time" in weather.columns:

            weather["date"] = pd.to_datetime(
                weather["time"],
                errors="coerce"
            ).dt.date

        else:

            # Try to detect a date-like column
            possible_date_columns = [
                "weather_date",
                "weather_day",
                "day",
                "datetime"
            ]

            found_column = None

            for column in possible_date_columns:

                if column in weather.columns:

                    parsed = pd.to_datetime(
                        weather[column],
                        errors="coerce"
                    )

                    if parsed.notna().mean() >= 0.8:
                        found_column = column
                        break

            if found_column is None:
                raise ValueError(
                    "Weather dataset does not contain a usable "
                    "date column."
                )

            weather["date"] = pd.to_datetime(
                weather[found_column],
                errors="coerce"
            ).dt.date

    else:

        weather["date"] = pd.to_datetime(
            weather["date"],
            errors="coerce"
        ).dt.date

    # --------------------------------------------------------
    # Remove invalid dates
    # --------------------------------------------------------

    weather = weather.dropna(
        subset=["date"]
    ).copy()

    # --------------------------------------------------------
    # Required weather columns
    # --------------------------------------------------------

    required_columns = [
        "temperature_max_c",
        "temperature_min_c",
        "temperature_mean_c",
        "rainfall_mm",
        "rain_mm",
        "max_wind_speed_kmh",
        "is_heavy_rain_day",
        "is_heatwave_day",
        "is_rain_day"
    ]

    # Add missing optional columns safely
    for column in required_columns:

        if column not in weather.columns:

            if column in [
                "is_heavy_rain_day",
                "is_heatwave_day",
                "is_rain_day"
            ]:

                weather[column] = False

            else:

                weather[column] = 0.0

    # --------------------------------------------------------
    # Numeric weather columns
    # --------------------------------------------------------

    numeric_columns = [
        "temperature_max_c",
        "temperature_min_c",
        "temperature_mean_c",
        "rainfall_mm",
        "rain_mm",
        "max_wind_speed_kmh"
    ]

    for column in numeric_columns:

        weather[column] = pd.to_numeric(
            weather[column],
            errors="coerce"
        )

    # --------------------------------------------------------
    # Fill small missing numeric values
    # --------------------------------------------------------

    for column in numeric_columns:

        weather[column] = (
            weather[column]
            .interpolate()
            .ffill()
            .bfill()
        )

    # --------------------------------------------------------
    # Boolean flags
    # --------------------------------------------------------

    boolean_columns = [
        "is_heavy_rain_day",
        "is_heatwave_day",
        "is_rain_day"
    ]

    for column in boolean_columns:

        weather[column] = (
            weather[column]
            .fillna(False)
            .astype(bool)
        )

    # --------------------------------------------------------
    # Remove duplicate section/date records
    # --------------------------------------------------------

    weather = (
        weather
        .sort_values(
            [
                "section_id",
                "date"
            ]
        )
        .drop_duplicates(
            subset=[
                "section_id",
                "date"
            ],
            keep="first"
        )
        .reset_index(drop=True)
    )

    # --------------------------------------------------------
    # Summary
    # --------------------------------------------------------

    print(
        f"Weather records: "
        f"{len(weather):,}"
    )

    print(
        f"Weather sections: "
        f"{weather['section_id'].nunique()}"
    )

    print(
        f"Weather date range: "
        f"{weather['date'].min()} → "
        f"{weather['date'].max()}"
    )

    print(
        f"Heavy rain days: "
        f"{weather['is_heavy_rain_day'].sum():,}"
    )

    print(
        f"Rain days: "
        f"{weather['is_rain_day'].sum():,}"
    )

    return weather


# ============================================================
# WEATHER RISK
# ============================================================

def calculate_weather_risk(movements):
    """
    Calculate a 0-1 weather risk score for each train movement.

    Risk components:
    - rainfall
    - wind speed
    - extreme temperature
    - heavy rain flag
    - small stochastic operational variation
    """

    rainfall = pd.to_numeric(
        movements["rainfall_mm"], errors="coerce"
    ).fillna(0.0)

    wind = pd.to_numeric(
        movements["max_wind_speed_kmh"], errors="coerce"
    ).fillna(0.0)

    temperature_max = pd.to_numeric(
        movements["temperature_max_c"], errors="coerce"
    ).fillna(30.0)

    # ---------------------------------------------------------
    # Rainfall risk
    # ---------------------------------------------------------
    rain_risk = np.clip(
        rainfall / 60.0,
        0.0,
        1.0
    )

    # ---------------------------------------------------------
    # Wind risk
    # ---------------------------------------------------------
    wind_risk = np.clip(
        wind / 80.0,
        0.0,
        1.0
    )

    # ---------------------------------------------------------
    # Temperature risk
    # Only extreme heat contributes significantly.
    # ---------------------------------------------------------
    heat_risk = np.clip(
        (temperature_max - 35.0) / 10.0,
        0.0,
        1.0
    )

    # ---------------------------------------------------------
    # Heavy rain flag
    # ---------------------------------------------------------
    if "is_heavy_rain_day" in movements.columns:
        heavy_rain = (
            movements["is_heavy_rain_day"]
            .fillna(False)
            .astype(bool)
            .astype(float)
        )
    else:
        heavy_rain = (rainfall >= 40.0).astype(float)

    # ---------------------------------------------------------
    # Weighted weather risk
    # ---------------------------------------------------------
    weather_risk = (
        0.45 * rain_risk
        + 0.25 * wind_risk
        + 0.15 * heat_risk
        + 0.15 * heavy_rain
    )

    # ---------------------------------------------------------
    # Small operational variation
    # ---------------------------------------------------------
    noise = rng.uniform(
        0.0,
        0.05,
        size=len(movements)
    )

    weather_risk = weather_risk + noise

    # ---------------------------------------------------------
    # Keep score between 0 and 1
    # ---------------------------------------------------------
    weather_risk = np.clip(
        weather_risk,
        0.0,
        1.0
    )

    # IMPORTANT:
    # Return a pandas Series, not a DataFrame.
    return pd.Series(
        weather_risk,
        index=movements.index,
        name="weather_risk"
    )


# ============================================================
# ATTACH WEATHER
# ============================================================

def attach_weather(movements, weather):

    print("\n" + "=" * 70)
    print("ATTACHING WEATHER TO TRAIN MOVEMENTS")
    print("=" * 70)

    movements = movements.copy()
    weather = weather.copy()

    # --------------------------------------------------------
    # Normalize section IDs
    # --------------------------------------------------------

    movements["section_id"] = (
        movements["section_id"]
        .astype(str)
        .str.strip()
    )

    weather["section_id"] = (
        weather["section_id"]
        .astype(str)
        .str.strip()
    )

    # --------------------------------------------------------
    # Create movement date
    # --------------------------------------------------------

    movements["movement_date"] = pd.to_datetime(
        movements["scheduled_entry_time"],
        errors="coerce"
    ).dt.date

    # --------------------------------------------------------
    # Normalize weather date
    # --------------------------------------------------------

    weather["date"] = pd.to_datetime(
        weather["date"],
        errors="coerce"
    ).dt.date

    # --------------------------------------------------------
    # Keep required columns
    # --------------------------------------------------------

    weather_columns = [
        "section_id",
        "date",
        "temperature_max_c",
        "temperature_min_c",
        "temperature_mean_c",
        "rainfall_mm",
        "rain_mm",
        "max_wind_speed_kmh",
        "is_heavy_rain_day",
        "is_heatwave_day",
        "is_rain_day"
    ]

    weather = weather[
        [
            column
            for column in weather_columns
            if column in weather.columns
        ]
    ].copy()

    # --------------------------------------------------------
    # Remove duplicate section/date records
    # --------------------------------------------------------

    weather = weather.drop_duplicates(
        subset=[
            "section_id",
            "date"
        ],
        keep="first"
    )

    # --------------------------------------------------------
    # EXACT SECTION + DATE MATCH
    # --------------------------------------------------------

    movements = movements.merge(
        weather,
        left_on=[
            "section_id",
            "movement_date"
        ],
        right_on=[
            "section_id",
            "date"
        ],
        how="left",
        sort=False
    )

    # --------------------------------------------------------
    # CHECK MATCHES
    # --------------------------------------------------------

    check_column = "temperature_mean_c"

    if check_column in movements.columns:

        missing_mask = movements[
            check_column
        ].isna()

    else:

        missing_mask = movements[
            "rainfall_mm"
        ].isna()

    exact_matches = (
        ~missing_mask
    ).sum()

    missing_matches = (
        missing_mask
    ).sum()

    print(
        f"Exact weather matches: "
        f"{exact_matches:,}"
    )

    print(
        f"Missing weather matches: "
        f"{missing_matches:,}"
    )

    # --------------------------------------------------------
    # SAFETY CHECK
    # --------------------------------------------------------

    if missing_matches > 0:

        print(
            "\nWARNING:"
        )

        print(
            f"{missing_matches:,} movements "
            f"do not have exact weather data."
        )

        print(
            "This should normally be 0 because "
            "the weather dataset covers the full "
            "TMS historical period."
        )

    # --------------------------------------------------------
    # WEATHER RISK
    # --------------------------------------------------------

    movements["weather_risk"] = (
        calculate_weather_risk(
            movements
        )
    )

    # --------------------------------------------------------
    # CLEANUP
    # --------------------------------------------------------

    movements = movements.drop(
        columns=[
            "movement_date",
            "date"
        ],
        errors="ignore"
    )

    # --------------------------------------------------------
    # SUMMARY
    # --------------------------------------------------------

    print(
        f"Average rainfall: "
        f"{movements['rainfall_mm'].mean():.2f} mm"
    )

    print(
        f"Average weather risk: "
        f"{movements['weather_risk'].mean():.4f}"
    )

    return movements

# ============================================================
# CONGESTION
# ============================================================

def calculate_congestion(schedule):
    """
    Calculate hourly section congestion.

    Congestion is section-specific and date-aware.
    """

    schedule = schedule.copy()

    print("\n" + "=" * 70)
    print("CALCULATING SECTION CONGESTION")
    print("=" * 70)

    schedule["entry_hour"] = (
        schedule["scheduled_entry_time"]
        .dt.floor("h")
    )

    hourly_volume = (
        schedule
        .groupby(
            [
                "section_id",
                "entry_hour"
            ]
        )
        .size()
        .reset_index(
            name="trains_in_hour"
        )
    )

    schedule = schedule.merge(
        hourly_volume,
        on=[
            "section_id",
            "entry_hour"
        ],
        how="left"
    )

    # --------------------------------------------------------
    # Section-specific maximum volume
    # --------------------------------------------------------

    section_max = (
        hourly_volume
        .groupby("section_id")[
            "trains_in_hour"
        ]
        .max()
        .rename("section_max_hourly_volume")
        .reset_index()
    )

    schedule = schedule.merge(
        section_max,
        on="section_id",
        how="left"
    )

    schedule["section_max_hourly_volume"] = (
        schedule[
            "section_max_hourly_volume"
        ]
        .replace(0, 1)
        .fillna(1)
    )

    schedule["congestion_score"] = (
        schedule["trains_in_hour"]
        / schedule["section_max_hourly_volume"]
    )

    schedule["congestion_score"] = np.clip(
        schedule["congestion_score"],
        0,
        1
    )

    # --------------------------------------------------------
    # Peak-hour effect
    # --------------------------------------------------------

    schedule["entry_hour_num"] = (
        schedule["scheduled_entry_time"]
        .dt.hour
    )

    schedule["is_peak_hour"] = (
        schedule["entry_hour_num"]
        .between(7, 10)
        |
        schedule["entry_hour_num"]
        .between(17, 20)
    ).astype(int)

    print(
        f"Average congestion: "
        f"{schedule['congestion_score'].mean():.4f}"
    )

    print(
        f"Maximum congestion: "
        f"{schedule['congestion_score'].max():.4f}"
    )

    return schedule


# ============================================================
# GENERATE ACTUAL MOVEMENTS
# ============================================================

def generate_actual_movements(schedule):
    """
    Generate realistic actual train movement times.

    Delay drivers:
        - baseline operational variation
        - congestion
        - weather
        - peak hour
        - random disruptions
    """

    schedule = schedule.copy()

    print("\n" + "=" * 70)
    print("GENERATING ACTUAL TRAIN MOVEMENTS")
    print("=" * 70)

    n = len(schedule)

    # --------------------------------------------------------
    # Base delay
    # --------------------------------------------------------

    base_delay = rng.gamma(
        shape=BASE_DELAY_SHAPE,
        scale=BASE_DELAY_SCALE,
        size=n
    )

    # --------------------------------------------------------
    # Congestion delay
    # --------------------------------------------------------

    congestion_delay = (
        schedule["congestion_score"]
        .to_numpy()
        * rng.uniform(
            1.0,
            8.0,
            n
        )
    )

    # --------------------------------------------------------
    # Weather delay
    # --------------------------------------------------------

    weather_delay = (
        schedule["weather_risk"]
        .to_numpy()
        * rng.uniform(
            2.0,
            12.0,
            n
        )
    )

    # --------------------------------------------------------
    # Peak-hour delay
    # --------------------------------------------------------

    peak_delay = (
        schedule["is_peak_hour"]
        .to_numpy()
        * rng.uniform(
            0,
            5,
            n
        )
    )

    # --------------------------------------------------------
    # Random disruption
    # --------------------------------------------------------

    disruption_mask = (
        rng.random(n)
        < DISRUPTION_PROBABILITY
    )

    disruption_delay = np.zeros(n)

    disruption_delay[
        disruption_mask
    ] = rng.uniform(
        DISRUPTION_MIN_DELAY,
        DISRUPTION_MAX_DELAY,
        disruption_mask.sum()
    )

    # --------------------------------------------------------
    # Total entry delay
    # --------------------------------------------------------

    total_entry_delay = (
        base_delay
        + congestion_delay
        + weather_delay
        + peak_delay
        + disruption_delay
    )

    total_entry_delay = np.clip(
        total_entry_delay,
        0,
        MAX_ENTRY_DELAY
    )

    schedule["entry_delay_minutes"] = (
        total_entry_delay.round(2)
    )

    schedule["actual_entry_time"] = (
        schedule["scheduled_entry_time"]
        + pd.to_timedelta(
            schedule["entry_delay_minutes"],
            unit="m"
        )
    )

    # --------------------------------------------------------
    # Actual duration
    # --------------------------------------------------------

    scheduled_duration = (
        schedule[
            "scheduled_duration_minutes"
        ]
        .to_numpy()
    )

    congestion_factor = (
        1
        + schedule[
            "congestion_score"
        ].to_numpy()
        * rng.uniform(
            0.00,
            0.12,
            n
        )
    )

    weather_factor = (
        1
        + schedule[
            "weather_risk"
        ].to_numpy()
        * rng.uniform(
            0.00,
            0.15,
            n
        )
    )

    random_factor = rng.normal(
        1.0,
        0.04,
        n
    )

    random_factor = np.clip(
        random_factor,
        0.85,
        1.20
    )

    actual_duration = (
        scheduled_duration
        * congestion_factor
        * weather_factor
        * random_factor
    )

    # Additional disruption effect
    actual_duration += (
        disruption_mask
        * rng.uniform(
            5,
            20,
            n
        )
    )

    actual_duration = np.clip(
        actual_duration,
        5,
        1440
    )

    schedule["actual_duration_minutes"] = (
        actual_duration.round(2)
    )

    # --------------------------------------------------------
    # Actual exit
    # --------------------------------------------------------

    schedule["actual_exit_time"] = (
        schedule["actual_entry_time"]
        + pd.to_timedelta(
            schedule[
                "actual_duration_minutes"
            ],
            unit="m"
        )
    )

    # --------------------------------------------------------
    # Exit delay
    # --------------------------------------------------------

    schedule["exit_delay_minutes"] = (
        (
            schedule["actual_exit_time"]
            - schedule["scheduled_exit_time"]
        )
        .dt.total_seconds()
        / 60
    )

    schedule["exit_delay_minutes"] = (
        schedule["exit_delay_minutes"]
        .clip(
            lower=-1440,
            upper=MAX_EXIT_DELAY
        )
        .round(2)
    )

    # --------------------------------------------------------
    # Occupancy
    # --------------------------------------------------------

    schedule["occupancy_minutes"] = (
        schedule[
            "actual_duration_minutes"
        ]
        .round(2)
    )

    # --------------------------------------------------------
    # Delay category
    # --------------------------------------------------------

    schedule["delay_category"] = np.select(
        [
            schedule["exit_delay_minutes"] <= 0,
            schedule["exit_delay_minutes"] <= 5,
            schedule["exit_delay_minutes"] <= 15,
            schedule["exit_delay_minutes"] <= 30
        ],
        [
            "EARLY_OR_ON_TIME",
            "MINOR_DELAY",
            "MODERATE_DELAY",
            "MAJOR_DELAY"
        ],
        default="SEVERE_DELAY"
    )

    # --------------------------------------------------------
    # Overrun
    # --------------------------------------------------------

    schedule["duration_overrun_minutes"] = (
        schedule[
            "actual_duration_minutes"
        ]
        - schedule[
            "scheduled_duration_minutes"
        ]
    ).round(2)

    schedule["is_duration_overrun"] = (
        schedule[
            "duration_overrun_minutes"
        ] > 5
    ).astype(int)

    print(
        f"Average entry delay: "
        f"{schedule['entry_delay_minutes'].mean():.2f} min"
    )

    print(
        f"Average actual duration: "
        f"{schedule['actual_duration_minutes'].mean():.2f} min"
    )

    print(
        f"Average duration overrun: "
        f"{schedule['duration_overrun_minutes'].mean():.2f} min"
    )

    print(
        f"Duration overrun rate: "
        f"{schedule['is_duration_overrun'].mean():.2%}"
    )

    return schedule


# ============================================================
# OPERATIONAL RISK
# ============================================================

def create_operational_risk(schedule):
    """
    Create operational risk score from:
        weather
        congestion

    The score intentionally uses only information available before
    movement completion so it can be used as a prediction feature.
    """

    schedule = schedule.copy()

    weather_risk = (
        schedule["weather_risk"]
        .to_numpy()
    )

    congestion_risk = (
        schedule["congestion_score"]
        .to_numpy()
    )

    schedule["operational_risk_score"] = np.clip(
        (
            0.55 * weather_risk
            + 0.45 * congestion_risk
        ),
        0,
        1
    )

    schedule["operational_risk"] = np.select(
        [
            schedule[
                "operational_risk_score"
            ] < 0.20,

            schedule[
                "operational_risk_score"
            ] < 0.35,

            schedule[
                "operational_risk_score"
            ] < 0.50
        ],
        [
            "LOW",
            "MEDIUM",
            "HIGH"
        ],
        default="CRITICAL"
    )

    return schedule


# ============================================================
# SAVE OUTPUT
# ============================================================

def save_output(schedule):
    """Save generated actual movement dataset."""

    OUTPUT_FILE.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    output = schedule.copy()

    datetime_cols = [
        "scheduled_entry_time",
        "scheduled_exit_time",
        "actual_entry_time",
        "actual_exit_time"
    ]

    for col in datetime_cols:

        if col in output.columns:

            output[col] = (
                pd.to_datetime(
                    output[col],
                    errors="coerce"
                )
                .dt.strftime(
                    "%Y-%m-%d %H:%M:%S"
                )
            )

    output.to_csv(
        OUTPUT_FILE,
        index=False
    )

    print("\n" + "=" * 70)
    print("OUTPUT SAVED")
    print("=" * 70)

    print(
        f"File: {OUTPUT_FILE}"
    )

    print(
        f"Records: {len(output):,}"
    )

    return output


# ============================================================
# VALIDATION / SUMMARY
# ============================================================

def print_summary(schedule):
    """Print final dataset validation."""

    print("\n" + "=" * 70)
    print("FINAL DATASET SUMMARY")
    print("=" * 70)

    # --------------------------------------------------------
    # Basic
    # --------------------------------------------------------

    print(
        f"Total movements       : "
        f"{len(schedule):,}"
    )

    if "train_id" in schedule.columns:
        print(
            f"Unique trains         : "
            f"{schedule['train_id'].nunique():,}"
        )

    print(
        f"Unique sections       : "
        f"{schedule['section_id'].nunique():,}"
    )

    print(
        f"Unique dates          : "
        f"{schedule['scheduled_entry_time'].dt.date.nunique():,}"
    )

    print(
        f"Earliest date         : "
        f"{schedule['scheduled_entry_time'].min().date()}"
    )

    print(
        f"Latest date           : "
        f"{schedule['scheduled_entry_time'].max().date()}"
    )

    # --------------------------------------------------------
    # Tonnage
    # --------------------------------------------------------

    if "gross_tonnage_t" in schedule.columns:

        print(
            f"\nGross tonnage:"
        )

        print(
            f"  Mean                : "
            f"{schedule['gross_tonnage_t'].mean():.2f} t"
        )

        print(
            f"  Min                 : "
            f"{schedule['gross_tonnage_t'].min():.2f} t"
        )

        print(
            f"  Max                 : "
            f"{schedule['gross_tonnage_t'].max():.2f} t"
        )

        print(
            f"  Missing             : "
            f"{schedule['gross_tonnage_t'].isna().sum():,}"
        )

    # --------------------------------------------------------
    # Weather
    # --------------------------------------------------------

    print("\nWeather:")

    print(
        f"  Mean rainfall       : "
        f"{schedule['rainfall_mm'].mean():.2f} mm"
    )

    print(
        f"  Heavy rain records  : "
        f"{schedule['is_heavy_rain_day'].sum():,}"
    )

    print(
        f"  Mean weather risk   : "
        f"{schedule['weather_risk'].mean():.4f}"
    )

    # --------------------------------------------------------
    # Congestion
    # --------------------------------------------------------

    print("\nCongestion:")

    print(
        f"  Mean congestion     : "
        f"{schedule['congestion_score'].mean():.4f}"
    )

    print(
        f"  Max congestion      : "
        f"{schedule['congestion_score'].max():.4f}"
    )

    # --------------------------------------------------------
    # Delays
    # --------------------------------------------------------

    print("\nMovement performance:")

    print(
        f"  Mean entry delay    : "
        f"{schedule['entry_delay_minutes'].mean():.2f} min"
    )

    print(
        f"  Mean exit delay     : "
        f"{schedule['exit_delay_minutes'].mean():.2f} min"
    )

    print(
        f"  Mean actual duration: "
        f"{schedule['actual_duration_minutes'].mean():.2f} min"
    )

    print(
        f"  Mean overrun        : "
        f"{schedule['duration_overrun_minutes'].mean():.2f} min"
    )

    print(
        f"  Overrun rate        : "
        f"{schedule['is_duration_overrun'].mean():.2%}"
    )

    # --------------------------------------------------------
    # Risk
    # --------------------------------------------------------

    print("\nOperational risk:")

    print(
        schedule[
            "operational_risk"
        ].value_counts()
    )

    # --------------------------------------------------------
    # Sample
    # --------------------------------------------------------

    print("\nSample records:")

    sample_cols = [
        "section_id",
        "scheduled_entry_time",
        "actual_entry_time",
        "scheduled_duration_minutes",
        "actual_duration_minutes",
        "duration_overrun_minutes",
        "rainfall_mm",
        "weather_risk",
        "congestion_score",
        "operational_risk"
    ]

    sample_cols = [
        col
        for col in sample_cols
        if col in schedule.columns
    ]

    print(
        schedule[
            sample_cols
        ].head(10).to_string(
            index=False
        )
    )


# ============================================================
# MAIN
# ============================================================

def main():

    print("\n")
    print("=" * 70)
    print("RAILNEXUS - TMS ACTUAL MOVEMENT GENERATOR")
    print("=" * 70)

    # --------------------------------------------------------
    # Check files
    # --------------------------------------------------------

    required_files = [
        SCHEDULE_FILE,
        TOPOLOGY_FILE,
        WEATHER_FILE
    ]

    for file in required_files:

        if not file.exists():

            raise FileNotFoundError(
                f"Required file not found:\n{file}"
            )

    # --------------------------------------------------------
    # Load
    # --------------------------------------------------------

    schedule, topology, weather = load_data()

    # --------------------------------------------------------
    # Expand 2-day TMS schedule
    # --------------------------------------------------------

    schedule = expand_schedule_to_history(
        schedule
    )

    # --------------------------------------------------------
    # Prepare schedule
    # --------------------------------------------------------

    schedule = prepare_schedule(
        schedule
    )

    # --------------------------------------------------------
    # Gross tonnage
    # --------------------------------------------------------

    schedule = ensure_gross_tonnage(
        schedule
    )

    # --------------------------------------------------------
    # Topology
    # --------------------------------------------------------

    sections = prepare_topology(
        topology
    )

    # --------------------------------------------------------
    # Merge topology
    # --------------------------------------------------------

    schedule = schedule.merge(
        sections[
            [
                "section_id",
                "distance_km",
                "mps_kmh"
            ]
        ],
        on="section_id",
        how="left"
    )

    # Fallback topology values
    schedule["distance_km"] = (
        schedule["distance_km"]
        .fillna(10.0)
    )

    schedule["mps_kmh"] = (
        schedule["mps_kmh"]
        .fillna(80.0)
    )

    # --------------------------------------------------------
    # Weather
    # --------------------------------------------------------

    weather = prepare_weather(
        weather
    )

    schedule = attach_weather(
        schedule,
        weather
    )

    # --------------------------------------------------------
    # Congestion
    # --------------------------------------------------------

    schedule = calculate_congestion(
        schedule
    )

    # --------------------------------------------------------
    # Actual movements
    # --------------------------------------------------------

    schedule = generate_actual_movements(
        schedule
    )

    # --------------------------------------------------------
    # Operational risk
    # --------------------------------------------------------

    schedule = create_operational_risk(
        schedule
    )

    # --------------------------------------------------------
    # Remove helper columns
    # --------------------------------------------------------

    schedule = schedule.drop(
        columns=[
            "entry_hour",
            "entry_hour_num"
        ],
        errors="ignore"
    )

    # --------------------------------------------------------
    # Save
    # --------------------------------------------------------

    save_output(
        schedule
    )

    # --------------------------------------------------------
    # Summary
    # --------------------------------------------------------

    print_summary(
        schedule
    )

    print("\n" + "=" * 70)
    print("GENERATION COMPLETE")
    print("=" * 70)


# ============================================================
# ENTRY POINT
# ============================================================

if __name__ == "__main__":
    main()