import time
import requests
import pandas as pd

from common import (
    path,
    ensure_out_dir,
    load_topology
)


# ============================================================
# CONFIGURATION
# ============================================================

WEATHER_API_URL = "https://archive-api.open-meteo.com/v1/archive"

# Match the historical TMS period
WEATHER_START_DATE = "2022-01-01"
WEATHER_END_DATE = "2026-08-27"


# ============================================================
# WEATHER LOCATIONS
# ============================================================
# We do not need one API request for every railway section.
# These three geographic points cover the railway network.
#
# AJJ -> sections around AJJ / SHU / WJR
# KPD -> sections around MCN / KPD
# JTJ -> sections around JTJ
# ============================================================

WEATHER_POINTS = {
    "AJJ": {
        "latitude": 13.0846,
        "longitude": 79.6705
    },

    "KPD": {
        "latitude": 12.9690,
        "longitude": 79.1400
    },

    "JTJ": {
        "latitude": 12.8170,
        "longitude": 78.8710
    }
}


# ============================================================
# FETCH WEATHER FROM OPEN-METEO
# ============================================================

def fetch_weather(
    latitude,
    longitude,
    start_date,
    end_date
):

    params = {
        "latitude": latitude,
        "longitude": longitude,
        "start_date": start_date,
        "end_date": end_date,

        "daily": (
            "temperature_2m_max,"
            "temperature_2m_min,"
            "temperature_2m_mean,"
            "precipitation_sum,"
            "rain_sum,"
            "wind_speed_10m_max"
        ),

        "timezone": "Asia/Kolkata"
    }

    response = requests.get(
        WEATHER_API_URL,
        params=params,
        timeout=60
    )

    response.raise_for_status()

    data = response.json()

    if "daily" not in data:
        raise ValueError(
            f"Weather API returned no daily data "
            f"for coordinates {latitude}, {longitude}"
        )

    return pd.DataFrame(data["daily"])


# ============================================================
# MAP RAILWAY SECTION TO WEATHER POINT
# ============================================================

def get_weather_point_for_section(section_id):

    start_station = section_id.split("-")[0]

    if start_station in [
        "AJJ",
        "SHU",
        "WJR"
    ]:
        return "AJJ"

    if start_station in [
        "MCN",
        "KPD"
    ]:
        return "KPD"

    return "JTJ"


# ============================================================
# ADD WEATHER FLAGS
# ============================================================

def add_weather_flags(df):

    df = df.copy()

    # Heavy rainfall
    df["is_heavy_rain_day"] = (
        df["rainfall_mm"] >= 40.0
    )

    # Extreme heat
    df["is_heatwave_day"] = (
        df["temperature_max_c"] >= 40.0
    )

    # Rainy day
    df["is_rain_day"] = (
        df["rainfall_mm"] >= 2.5
    )

    return df


# ============================================================
# CLEAN WEATHER DATA
# ============================================================

def clean_weather_data(df):

    df = df.copy()

    # --------------------------------------------------------
    # Validate date
    # --------------------------------------------------------

    if "time" not in df.columns:
        raise ValueError(
            "Open-Meteo response does not contain 'time' column."
        )

    df["date"] = pd.to_datetime(
        df["time"],
        errors="coerce"
    ).dt.date

    # Remove invalid dates
    df = df.dropna(
        subset=["date"]
    )

    # --------------------------------------------------------
    # Rename Open-Meteo fields
    # --------------------------------------------------------

    df = df.rename(
        columns={
            "temperature_2m_max":
                "temperature_max_c",

            "temperature_2m_min":
                "temperature_min_c",

            "temperature_2m_mean":
                "temperature_mean_c",

            "precipitation_sum":
                "rainfall_mm",

            "rain_sum":
                "rain_mm",

            "wind_speed_10m_max":
                "max_wind_speed_kmh"
        }
    )

    # --------------------------------------------------------
    # Remove original API time field
    # --------------------------------------------------------

    if "time" in df.columns:
        df = df.drop(
            columns=["time"]
        )

    # --------------------------------------------------------
    # Numeric conversion
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

        if column in df.columns:

            df[column] = pd.to_numeric(
                df[column],
                errors="coerce"
            )

    # --------------------------------------------------------
    # Missing weather values
    # --------------------------------------------------------

    for column in numeric_columns:

        if column in df.columns:

            df[column] = (
                df[column]
                .interpolate()
                .ffill()
                .bfill()
            )

    return df


# ============================================================
# MAIN
# ============================================================

def main():

    print("\n")
    print("=" * 70)
    print("RAILNEXUS - REAL HISTORICAL WEATHER GENERATOR")
    print("=" * 70)

    # ========================================================
    # LOAD TOPOLOGY
    # ========================================================

    print("\n" + "=" * 70)
    print("LOADING TOPOLOGY")
    print("=" * 70)

    df_topology = load_topology()

    print(
        f"Topology records : {len(df_topology):,}"
    )

    print(
        f"Topology sections: "
        f"{df_topology['section_id'].nunique()}"
    )

    # ========================================================
    # DATE RANGE
    # ========================================================

    start_date = pd.Timestamp(
        WEATHER_START_DATE
    ).date()

    end_date = pd.Timestamp(
        WEATHER_END_DATE
    ).date()

    num_days = (
        end_date - start_date
    ).days + 1

    print("\n" + "=" * 70)
    print("WEATHER DATE RANGE")
    print("=" * 70)

    print(
        f"Start date : {start_date}"
    )

    print(
        f"End date   : {end_date}"
    )

    print(
        f"Days       : {num_days:,}"
    )

    print(
        "\nUsing REAL historical weather "
        "from Open-Meteo."
    )

    # ========================================================
    # FETCH WEATHER
    # ========================================================

    print("\n" + "=" * 70)
    print("FETCHING REAL HISTORICAL WEATHER")
    print("=" * 70)

    all_weather = []

    for point_name, coordinates in WEATHER_POINTS.items():

        print(
            f"\nFetching weather for {point_name}..."
        )

        print(
            f"  Latitude : {coordinates['latitude']}"
        )

        print(
            f"  Longitude: {coordinates['longitude']}"
        )

        try:

            df = fetch_weather(
                latitude=coordinates["latitude"],
                longitude=coordinates["longitude"],
                start_date=start_date.isoformat(),
                end_date=end_date.isoformat()
            )

        except Exception as e:

            print(
                f"\nERROR fetching weather for "
                f"{point_name}: {e}"
            )

            raise

        # Add geographic information

        df["weather_point"] = point_name

        df["latitude"] = coordinates["latitude"]

        df["longitude"] = coordinates["longitude"]

        # Clean API response

        df = clean_weather_data(df)

        # Add weather flags

        df = add_weather_flags(df)

        print(
            f"  Records fetched: {len(df):,}"
        )

        print(
            f"  Date range: "
            f"{df['date'].min()} → "
            f"{df['date'].max()}"
        )

        all_weather.append(df)

        # Avoid hammering the API

        time.sleep(1)

    # ========================================================
    # COMBINE WEATHER POINTS
    # ========================================================

    print("\n" + "=" * 70)
    print("COMBINING WEATHER DATA")
    print("=" * 70)

    df_weather = pd.concat(
        all_weather,
        ignore_index=True
    )

    # ========================================================
    # RAILWAY SECTIONS
    # ========================================================

    print("\n" + "=" * 70)
    print("MAPPING WEATHER TO RAILWAY SECTIONS")
    print("=" * 70)

    sections = (
        df_topology[
            [
                "division",
                "section_id"
            ]
        ]
        .drop_duplicates()
        .copy()
    )

    print(
        f"Unique railway sections: "
        f"{len(sections):,}"
    )

    # Determine weather location

    sections["weather_point"] = (
        sections["section_id"]
        .apply(
            get_weather_point_for_section
        )
    )

    print("\nWeather mapping:")

    print(
        sections[
            [
                "section_id",
                "weather_point"
            ]
        ]
        .drop_duplicates()
        .to_string(index=False)
    )

    # ========================================================
    # MERGE WEATHER WITH SECTIONS
    # ========================================================

    df_final = sections.merge(
        df_weather,
        on="weather_point",
        how="left"
    )

    # ========================================================
    # SORT
    # ========================================================

    df_final = (
        df_final
        .sort_values(
            [
                "section_id",
                "date"
            ]
        )
        .reset_index(drop=True)
    )

    # ========================================================
    # VALIDATION
    # ========================================================

    print("\n" + "=" * 70)
    print("VALIDATING WEATHER DATA")
    print("=" * 70)

    expected_dates = pd.date_range(
        start=start_date,
        end=end_date,
        freq="D"
    ).date

    expected_days = len(
        expected_dates
    )

    expected_records = (
        expected_days *
        sections["section_id"].nunique()
    )

    actual_records = len(
        df_final
    )

    print(
        f"Expected daily weather records: "
        f"{expected_records:,}"
    )

    print(
        f"Actual weather records: "
        f"{actual_records:,}"
    )

    print(
        f"Unique sections: "
        f"{df_final['section_id'].nunique()}"
    )

    print(
        f"Unique dates: "
        f"{df_final['date'].nunique()}"
    )

    print(
        f"Date range: "
        f"{df_final['date'].min()} → "
        f"{df_final['date'].max()}"
    )

    # --------------------------------------------------------
    # Missing values
    # --------------------------------------------------------

    important_columns = [
        "temperature_max_c",
        "temperature_min_c",
        "temperature_mean_c",
        "rainfall_mm",
        "rain_mm",
        "max_wind_speed_kmh",
        "date"
    ]

    print("\nMissing values:")

    for column in important_columns:

        if column in df_final.columns:

            missing = (
                df_final[column]
                .isna()
                .sum()
            )

            print(
                f"  {column:25s}: "
                f"{missing:,}"
            )

    # ========================================================
    # SAVE
    # ========================================================

    output_file = path(
        "weather_historical.csv"
    )

    ensure_out_dir()

    df_final.to_csv(
        output_file,
        index=False
    )

    # ========================================================
    # SUMMARY
    # ========================================================

    print("\n" + "=" * 70)
    print("WEATHER DATA GENERATED SUCCESSFULLY")
    print("=" * 70)

    print(
        f"\nOutput file:"
    )

    print(
        f"{output_file}"
    )

    print(
        f"\nRecords: "
        f"{len(df_final):,}"
    )

    print(
        f"Sections: "
        f"{df_final['section_id'].nunique()}"
    )

    print(
        f"Dates: "
        f"{df_final['date'].nunique():,}"
    )

    print(
        f"Date range: "
        f"{df_final['date'].min()} → "
        f"{df_final['date'].max()}"
    )

    # ========================================================
    # WEATHER STATISTICS
    # ========================================================

    print("\nWeather statistics:")

    print(
        f"  Average temperature: "
        f"{df_final['temperature_mean_c'].mean():.2f} °C"
    )

    print(
        f"  Average rainfall: "
        f"{df_final['rainfall_mm'].mean():.2f} mm"
    )

    print(
        f"  Maximum rainfall: "
        f"{df_final['rainfall_mm'].max():.2f} mm"
    )

    print(
        f"  Maximum wind speed: "
        f"{df_final['max_wind_speed_kmh'].max():.2f} km/h"
    )

    print(
        f"  Heavy rain records: "
        f"{df_final['is_heavy_rain_day'].sum():,}"
    )

    print(
        f"  Heatwave records: "
        f"{df_final['is_heatwave_day'].sum():,}"
    )

    print(
        f"  Rainy records: "
        f"{df_final['is_rain_day'].sum():,}"
    )

    # ========================================================
    # SAMPLE
    # ========================================================

    print("\nSample records:")

    sample_columns = [
        "section_id",
        "weather_point",
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

    available_sample_columns = [
        column
        for column in sample_columns
        if column in df_final.columns
    ]

    print(
        df_final[
            available_sample_columns
        ]
        .head(10)
        .to_string(index=False)
    )

    print("\n" + "=" * 70)
    print("GENERATION COMPLETE")
    print("=" * 70)


# ============================================================
# ENTRY POINT
# ============================================================

if __name__ == "__main__":
    main()