import os
import numpy as np
import pandas as pd

SEED = 42

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

TOPOLOGY_FILE = os.path.join(BASE_DIR, "data", "raw", "network_topology.csv")
WEATHER_FILE = os.path.join(BASE_DIR, "data", "raw", "weather_historical.csv")
MOVEMENTS_FILE = os.path.join(BASE_DIR, "data", "curated", "tms", "tms_actual_movements.csv")
OUTPUT_FILE = os.path.join(BASE_DIR, "data", "curated", "maintenance", "asset_condition_history.csv")

START_DATE = pd.Timestamp("2022-01-01")
END_DATE = pd.Timestamp("2026-08-27")
BALANCED_ASSETS_PER_TYPE = 1000
HAZARD_SCALE = 4.2

ASSET_TYPES = {
    "TRACK_CIRCUIT": {"department": "ENGG", "base_degradation": 0.035},
    "POINT_MACHINE": {"department": "SNT", "base_degradation": 0.045},
    "OHE_MAST":      {"department": "TRD", "base_degradation": 0.025},
    "WELD":          {"department": "ENGG", "base_degradation": 0.038}
}

def load_data():
    topology = pd.read_csv(TOPOLOGY_FILE)
    weather = pd.read_csv(WEATHER_FILE)

    if os.path.exists(MOVEMENTS_FILE):
        movements = pd.read_csv(MOVEMENTS_FILE)
    else:
        movements = pd.DataFrame()

    topology["km_marker"] = pd.to_numeric(topology["km_marker"], errors="coerce")
    topology = topology.dropna(subset=["asset_id", "asset_type"])

    weather["date"] = pd.to_datetime(weather["date"], errors="coerce")
    weather = weather.dropna(subset=["date"])

    if not movements.empty:
        if "actual_entry_time" in movements.columns:
            movements["actual_entry_time"] = pd.to_datetime(movements["actual_entry_time"], errors="coerce")
        if "section_id" in movements.columns:
            movements["section_id"] = movements["section_id"].astype(str)

    return topology, weather, movements

def prepare_assets(topology, rng):
    columns = ["asset_id", "asset_type", "department", "section_id", "km_marker"]
    assets = topology[columns].drop_duplicates("asset_id").copy()

    valid_types = list(ASSET_TYPES.keys())
    invalid = ~assets["asset_type"].isin(valid_types)
    if invalid.any():
        assets.loc[invalid, "asset_type"] = rng.choice(valid_types, size=invalid.sum())

    balanced_parts = []
    for asset_type, type_config in ASSET_TYPES.items():
        type_assets = assets[assets["asset_type"] == asset_type].copy()

        if len(type_assets) > BALANCED_ASSETS_PER_TYPE:
            selected = rng.choice(
                type_assets.index.to_numpy(),
                size=BALANCED_ASSETS_PER_TYPE,
                replace=False,
            )
            type_assets = type_assets.loc[selected].copy()

        missing = BALANCED_ASSETS_PER_TYPE - len(type_assets)
        if missing > 0:
            prototypes = assets.iloc[
                rng.integers(0, len(assets), size=missing)
            ].copy()
            prototypes["asset_id"] = [
                f"SYN_{asset_type}_{index:04d}"
                for index in range(missing)
            ]
            prototypes["asset_type"] = asset_type
            type_assets = pd.concat(
                [type_assets, prototypes],
                ignore_index=True,
            )

        type_assets["department"] = type_config["department"]
        balanced_parts.append(type_assets)

    assets = pd.concat(balanced_parts, ignore_index=True)
    available_days = (END_DATE - START_DATE).days
    
    # Random installation dates for a staggered aging profile
    assets["installation_date"] = START_DATE + pd.to_timedelta(
        rng.integers(0, min(available_days, 1500), size=len(assets)), unit="D"
    )
    return assets

def build_daily_mgt_matrix(movements, sections, rng):
    """
    Creates a continuous daily MGT (Millions of Gross Tonnes) and train count 
    calendar for every section, fusing empirical TMS data where available and 
    stochastic baselines for gaps.
    """
    full_dates = pd.date_range(START_DATE, END_DATE, freq="D")
    
    # 1. Establish robust defaults per section (e.g., 0.04 to 0.12 MGT/day)
    section_baselines = {sec: rng.uniform(0.04, 0.12) for sec in sections}
    
    # 2. Extract real tonnage if available
    empirical_daily = pd.DataFrame()
    if not movements.empty and {"actual_entry_time", "section_id", "gross_tonnage"}.issubset(movements.columns):
        movements = movements.dropna(subset=["actual_entry_time", "section_id"])
        movements["date"] = movements["actual_entry_time"].dt.normalize()
        movements["tonnage_mgt"] = pd.to_numeric(movements["gross_tonnage"], errors="coerce").fillna(1800.0) / 1_000_000.0
        
        empirical_daily = movements.groupby(["date", "section_id"]).agg(
            tonnage_mgt=("tonnage_mgt", "sum"),
            train_count=("tonnage_mgt", "count")
        ).reset_index()

    # 3. Build full calendar matrices
    mgt_matrix = pd.DataFrame(index=full_dates, columns=sections, dtype=float)
    train_matrix = pd.DataFrame(index=full_dates, columns=sections, dtype=float)

    for sec in sections:
        # Generate base synthetic traffic with daily variation
        base_mgt = section_baselines[sec]
        synthetic_mgt = base_mgt * rng.uniform(0.85, 1.15, size=len(full_dates))
        synthetic_trains = np.round((synthetic_mgt * 1_000_000.0) / rng.uniform(1500, 2200, size=len(full_dates)))
        
        mgt_matrix[sec] = synthetic_mgt
        train_matrix[sec] = synthetic_trains

    # 4. Overlay empirical data to retain TMS reality where it exists
    if not empirical_daily.empty:
        for sec in sections:
            sec_data = empirical_daily[empirical_daily["section_id"] == sec].set_index("date")
            if not sec_data.empty:
                # Update synthetic cells with real historical TMS data
                mgt_matrix.loc[sec_data.index.intersection(full_dates), sec] = sec_data["tonnage_mgt"]
                train_matrix.loc[sec_data.index.intersection(full_dates), sec] = sec_data["train_count"]

    return mgt_matrix, train_matrix

def generate_lifecycle_dates(assets, rng):
    records = []
    for _, asset in assets.iterrows():
        installation_date = pd.Timestamp(asset["installation_date"])
        first_date = installation_date + pd.Timedelta(days=int(rng.integers(45, 100)))
        current_date = first_date

        while current_date <= END_DATE:
            records.append({
                "asset_id": asset["asset_id"],
                "observation_date": current_date
            })
            current_date += pd.Timedelta(days=int(rng.integers(45, 120)))

    data = pd.DataFrame(records)
    if data.empty: return data

    data = data.merge(assets, on="asset_id", how="left")
    data["observation_date"] = pd.to_datetime(data["observation_date"]).dt.normalize()
    return data.sort_values(["asset_id", "observation_date"]).reset_index(drop=True)

def calculate_failure_probability_weibull(
    health, days_since_maintenance, tonnage_since_maint, 
    daily_tonnage_mgt, rainfall, wind_speed, temperature,
    previous_failures, asset_type
):
    """
    Estimate the probability of failure during the next seven days.

    The baseline is the Weibull cumulative-hazard increment over the
    next seven days of expected traffic, then adjusted for condition,
    maintenance age, weather and prior failures.
    """
    weibull_params = {
        "TRACK_CIRCUIT": {"beta": 2.2, "lambda_mgt": 120.0},
        "POINT_MACHINE": {"beta": 2.8, "lambda_mgt": 80.0},
        "OHE_MAST":      {"beta": 1.6, "lambda_mgt": 250.0},
        "WELD":          {"beta": 3.5, "lambda_mgt": 60.0} 
    }
    
    params = weibull_params.get(asset_type, {"beta": 2.0, "lambda_mgt": 100.0})
    
    # 1. Seven-day Weibull cumulative-hazard increment from traffic wear.
    current_usage = max(float(tonnage_since_maint), 0.0)
    projected_usage = current_usage + max(float(daily_tonnage_mgt), 0.0) * 7.0
    beta = params["beta"]
    scale = params["lambda_mgt"]
    baseline_hazard = (
        (projected_usage / scale) ** beta
        - (current_usage / scale) ** beta
    )

    # 2. Risk Multipliers (Toned down to prevent explosive growth)
    # Scaled divisor to 35.0 (Max multiplier ~9x if health hits 0, not thousands)
    condition_penalty = np.exp(max(0, 80.0 - health) / 35.0) 
    
    # Maintenance max multiplier ~2.2x if untouched for 1000 days
    maintenance_penalty = np.exp(days_since_maintenance / 1250.0) 
    
    weather_penalty = (
        1.0
        + (rainfall / 120.0) ** 2
        + max(0, wind_speed - 60.0) / 80.0
        + max(0, temperature - 38.0) / 20.0
    )
    history_penalty = np.exp(previous_failures * 0.25)

    # 3. Convert adjusted seven-day cumulative hazard to probability.
    total_hazard = (
    baseline_hazard
    * condition_penalty
    * maintenance_penalty
    * weather_penalty
    * history_penalty
)    
    seven_day_prob = 1.0 - np.exp(-total_hazard * HAZARD_SCALE)

    return float(np.clip(seven_day_prob, 0.001, 0.60))

def generate_asset_history(lifecycle, weather, mgt_matrix, train_matrix, rng):
    if lifecycle.empty: return lifecycle

    weather_daily = weather[["date", "temperature_mean_c", "rainfall_mm", "max_wind_speed_kmh"]]\
        .drop_duplicates("date").set_index("date")

    records = []

    for asset_id, group in lifecycle.groupby("asset_id", sort=False):
        group = group.sort_values("observation_date")
        
        asset_type = group["asset_type"].iloc[0]
        section_id = group["section_id"].iloc[0]
        installation_date = pd.Timestamp(group["installation_date"].iloc[0])

        base_rate = ASSET_TYPES[asset_type]["base_degradation"]
        hidden_health = float(rng.uniform(98.0, 100.0))
        last_maintenance_date = installation_date
        previous_failure_count = 0
        
        lifetime_tonnage_mgt = 0.0
        tonnage_since_last_maintenance_mgt = 0.0
        
        previous_observation_date = installation_date

        for _, row in group.iterrows():
            observation_date = pd.Timestamp(row["observation_date"])
            
            # --- Tonnage Accumulator Logic ---
            # Sum the MGT exposure precisely for the interval between observations
            interval_slice = slice(previous_observation_date + pd.Timedelta(days=1), observation_date)
            interval_mgt = mgt_matrix.loc[interval_slice, section_id].sum() if previous_observation_date < observation_date else 0.0
            
            lifetime_tonnage_mgt += interval_mgt
            tonnage_since_last_maintenance_mgt += interval_mgt
            
            # Extract daily metrics for the exact observation date
            daily_tonnage = mgt_matrix.loc[observation_date, section_id] if observation_date in mgt_matrix.index else 0.0
            daily_trains = train_matrix.loc[observation_date, section_id] if observation_date in train_matrix.index else 0
            
            days_elapsed = max((observation_date - previous_observation_date).days, 1)
            asset_age_days = max((observation_date - installation_date).days, 0)
            days_since_maintenance = max((observation_date - last_maintenance_date).days, 0)

            # --- Weather Logic ---
            w_row = weather_daily.loc[observation_date] if observation_date in weather_daily.index else None
            rainfall = float(w_row["rainfall_mm"]) if w_row is not None else 0.0
            wind_speed = float(w_row["max_wind_speed_kmh"]) if w_row is not None else 10.0
            temperature = float(w_row["temperature_mean_c"]) if w_row is not None else 28.0
            is_heavy_rain_day = int(rainfall > 25.0)

            # --- Physical Degradation ---
            age_years = asset_age_days / 365.25
            age_factor = 1.0 + 0.05 * age_years
            maintenance_factor = 1.0 + 0.20 * (1.0 - np.exp(-days_since_maintenance / 600.0))
            traffic_factor = 1.0 + 0.25 * (1.0 - np.exp(-tonnage_since_last_maintenance_mgt / 80.0))
            
            degradation = (base_rate * age_factor * maintenance_factor * traffic_factor * days_elapsed)
            hidden_health = max(1.0, hidden_health - degradation)

            # --- Weibull Hazard Application ---
            failure_probability = calculate_failure_probability_weibull(
                health=hidden_health,
                days_since_maintenance=days_since_maintenance,
                tonnage_since_maint=tonnage_since_last_maintenance_mgt,
                daily_tonnage_mgt=daily_tonnage,
                rainfall=rainfall,
                wind_speed=wind_speed,
                temperature=temperature,
                previous_failures=previous_failure_count,
                asset_type=asset_type
            )

            failure_within_7_days = int(rng.random() < failure_probability)
            
            inspection_score = float(np.clip(hidden_health + rng.normal(0.0, 3.0), 0.0, 100.0))

            maintenance_probability = 0.005
            if inspection_score < 75: maintenance_probability = 0.03
            if inspection_score < 60: maintenance_probability = 0.10
            if inspection_score < 45: maintenance_probability = 0.25
            if failure_within_7_days: maintenance_probability = 0.85 

            maintenance_event = int(rng.random() < maintenance_probability)

            records.append({
                "asset_id": asset_id,
                "asset_type": asset_type,
                "department": row["department"],
                "section_id": section_id,
                "location_km_marker": round(float(row["km_marker"]), 3),
                "observation_date": observation_date.date(),
                "asset_age_days": asset_age_days,
                "days_since_last_maintenance": days_since_maintenance,
                "lifetime_tonnage_mgt": round(lifetime_tonnage_mgt, 4),
                "tonnage_since_last_maintenance_mgt": round(tonnage_since_last_maintenance_mgt, 4),
                "daily_train_count": int(daily_trains),
                "daily_tonnage_mgt": round(daily_tonnage, 4),
                "rainfall_mm": round(rainfall, 2),
                "max_wind_speed_kmh": round(wind_speed, 2),
                "temperature_mean_c": round(temperature, 2),
                "is_heavy_rain_day": is_heavy_rain_day,
                "previous_failure_count": previous_failure_count,
                "inspection_score": round(inspection_score, 2),
                "maintenance_event": maintenance_event,
                "failure_probability_7d": round(failure_probability, 4),
                "failure_within_next_7_days": failure_within_7_days
            })

            if failure_within_7_days:
                previous_failure_count += 1

            if maintenance_event:
                # Reset health with cumulative damage scars
                reset_ceiling = max(100.0 - previous_failure_count * 4.0, 75.0)
                reset_floor = max(95.0 - previous_failure_count * 4.0, 70.0)
                hidden_health = float(rng.uniform(reset_floor, reset_ceiling))
                last_maintenance_date = observation_date
                tonnage_since_last_maintenance_mgt = 0.0 # reset exposure

            previous_observation_date = observation_date

    return pd.DataFrame(records)

def main():
    rng = np.random.default_rng(SEED)

    topology, weather, movements = load_data()
    assets = prepare_assets(topology, rng)
    
    unique_sections = assets["section_id"].unique()
    mgt_matrix, train_matrix = build_daily_mgt_matrix(movements, unique_sections, rng)
    
    lifecycle = generate_lifecycle_dates(assets, rng)
    dataset = generate_asset_history(lifecycle, weather, mgt_matrix, train_matrix, rng)

    export_columns = [
        "asset_id", "asset_type", "department", "section_id", "location_km_marker",
        "observation_date", "asset_age_days", "days_since_last_maintenance",
        "lifetime_tonnage_mgt", "tonnage_since_last_maintenance_mgt", 
        "daily_train_count", "daily_tonnage_mgt", "inspection_score", 
        "rainfall_mm", "temperature_mean_c", "max_wind_speed_kmh", 
        "is_heavy_rain_day", "previous_failure_count", "maintenance_event", 
        "failure_probability_7d", "failure_within_next_7_days"
    ]

    dataset = dataset[export_columns].sort_values(["asset_id", "observation_date"]).reset_index(drop=True)

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    dataset.to_csv(OUTPUT_FILE, index=False)

    print(f"Total records: {len(dataset):,}")
    print(f"Failure rate: {dataset['failure_within_next_7_days'].mean():.2%}")
    print("\nTonnage Since Maintenance Distribution:")
    print(dataset["tonnage_since_last_maintenance_mgt"].describe())
    print("\nDaily Trains Distribution:")
    print(dataset["daily_train_count"].describe())

if __name__ == "__main__":
    main()