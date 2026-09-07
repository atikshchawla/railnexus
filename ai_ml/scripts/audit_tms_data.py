from pathlib import Path
import pandas as pd
import numpy as np


PROJECT_ROOT = Path(__file__).resolve().parents[1]

TMS_FILE = (
    PROJECT_ROOT
    / "data"
    / "curated"
    / "tms"
    / "tms_actual_movements.csv"
)


def main():

    print("=" * 70)
    print("RAILNEXUS - TMS DATA AUDIT")
    print("=" * 70)

    df = pd.read_csv(TMS_FILE)

    print(f"\nRecords: {len(df):,}")
    print(f"Columns: {len(df.columns)}")

    # ---------------------------------------------------------
    # DATE
    # ---------------------------------------------------------

    date_column = None

    for column in [
        "scheduled_entry_time",
        "actual_entry_time",
        "date"
    ]:
        if column in df.columns:
            date_column = column
            break

    if date_column:

        df[date_column] = pd.to_datetime(
            df[date_column],
            errors="coerce"
        )

        df["audit_date"] = df[date_column].dt.date

        print("\nDATE COVERAGE")
        print("-" * 70)

        print("Earliest:", df["audit_date"].min())
        print("Latest  :", df["audit_date"].max())
        print("Days    :", df["audit_date"].nunique())

    # ---------------------------------------------------------
    # SECTIONS
    # ---------------------------------------------------------

    if "section_id" in df.columns:

        print("\nSECTION DISTRIBUTION")
        print("-" * 70)

        section_counts = (
            df["section_id"]
            .value_counts()
            .sort_index()
        )

        print(section_counts)

    # ---------------------------------------------------------
    # DAILY TRAIN COUNT
    # ---------------------------------------------------------

    if "audit_date" in df.columns:

        daily_trains = (
            df.groupby("audit_date")
            .size()
        )

        print("\nDAILY TRAIN MOVEMENTS")
        print("-" * 70)

        print(daily_trains.describe())

        print("\nDaily train count by section:")

        daily_section = (
            df.groupby(
                ["audit_date", "section_id"]
            )
            .size()
            .reset_index(name="train_count")
        )

        print(
            daily_section
            .groupby("section_id")["train_count"]
            .agg([
                "mean",
                "std",
                "min",
                "max"
            ])
        )

    # ---------------------------------------------------------
    # GROSS TONNAGE
    # ---------------------------------------------------------

    if "gross_tonnage_t" in df.columns:

        tonnage = pd.to_numeric(
            df["gross_tonnage_t"],
            errors="coerce"
        )

        print("\nGROSS TONNAGE")
        print("-" * 70)

        print(tonnage.describe())

        print(
            "\nUnique tonnage values:",
            tonnage.nunique()
        )

        print(
            "\nTonnage distribution:"
        )

        print(
            tonnage
            .value_counts()
            .sort_index()
            .head(20)
        )

    # ---------------------------------------------------------
    # DAILY SECTION MGT
    # ---------------------------------------------------------

    if (
        "gross_tonnage_t" in df.columns
        and "audit_date" in df.columns
        and "section_id" in df.columns
    ):

        daily_mgt = (
            df.groupby(
                ["audit_date", "section_id"]
            )["gross_tonnage_t"]
            .sum()
            / 1_000_000
        )

        print("\nDAILY SECTION MGT")
        print("-" * 70)

        print(daily_mgt.describe())

        print("\nDaily MGT by section:")

        print(
            daily_mgt
            .groupby("section_id")
            .agg([
                "mean",
                "std",
                "min",
                "max"
            ])
        )

    # ---------------------------------------------------------
    # WEATHER
    # ---------------------------------------------------------

    if "rainfall_mm" in df.columns:

        rainfall = pd.to_numeric(
            df["rainfall_mm"],
            errors="coerce"
        )

        print("\nRAINFALL")
        print("-" * 70)

        print(rainfall.describe())

        print(
            "Unique rainfall values:",
            rainfall.nunique()
        )

    if "weather_risk" in df.columns:

        weather_risk = pd.to_numeric(
            df["weather_risk"],
            errors="coerce"
        )

        print("\nWEATHER RISK")
        print("-" * 70)

        print(weather_risk.describe())

        print(
            "Unique risk values:",
            weather_risk.nunique()
        )

    # ---------------------------------------------------------
    # CONGESTION
    # ---------------------------------------------------------

    if "congestion_score" in df.columns:

        congestion = pd.to_numeric(
            df["congestion_score"],
            errors="coerce"
        )

        print("\nCONGESTION")
        print("-" * 70)

        print(congestion.describe())

        print(
            "Unique congestion values:",
            congestion.nunique()
        )

        print("\nCongestion distribution:")

        print(
            congestion
            .round(2)
            .value_counts()
            .sort_index()
            .head(30)
        )

    # ---------------------------------------------------------
    # DURATION
    # ---------------------------------------------------------

    if "scheduled_duration_minutes" in df.columns:

        scheduled = pd.to_numeric(
            df["scheduled_duration_minutes"],
            errors="coerce"
        )

        print("\nSCHEDULED DURATION")
        print("-" * 70)

        print(scheduled.describe())

    if "actual_duration_minutes" in df.columns:

        actual = pd.to_numeric(
            df["actual_duration_minutes"],
            errors="coerce"
        )

        print("\nACTUAL DURATION")
        print("-" * 70)

        print(actual.describe())

    if "duration_overrun_minutes" in df.columns:

        overrun = pd.to_numeric(
            df["duration_overrun_minutes"],
            errors="coerce"
        )

        print("\nDURATION OVERRUN")
        print("-" * 70)

        print(overrun.describe())

        print(
            "\nOverrun > 0:",
            (overrun > 0).mean() * 100,
            "%"
        )

        print(
            "Overrun > 5 min:",
            (overrun > 5).mean() * 100,
            "%"
        )

        print(
            "Overrun > 10 min:",
            (overrun > 10).mean() * 100,
            "%"
        )

        print(
            "Overrun > 20 min:",
            (overrun > 20).mean() * 100,
            "%"
        )

    # ---------------------------------------------------------
    # OPERATIONAL RISK
    # ---------------------------------------------------------

    if "operational_risk" in df.columns:

        print("\nOPERATIONAL RISK")
        print("-" * 70)

        print(
            df["operational_risk"]
            .value_counts()
        )

        print(
            "\nPercentage:"
        )

        print(
            df["operational_risk"]
            .value_counts(normalize=True)
            .mul(100)
            .round(2)
        )

    # ---------------------------------------------------------
    # HOURLY TRAFFIC
    # ---------------------------------------------------------

    if date_column:

        df["audit_hour"] = df[date_column].dt.hour

        hourly = (
            df["audit_hour"]
            .value_counts()
            .sort_index()
        )

        print("\nHOURLY TRAFFIC")
        print("-" * 70)

        print(hourly)

    # ---------------------------------------------------------
    # WEEKDAY TRAFFIC
    # ---------------------------------------------------------

    if date_column:

        df["weekday"] = df[date_column].dt.day_name()

        weekday = (
            df["weekday"]
            .value_counts()
        )

        print("\nWEEKDAY TRAFFIC")
        print("-" * 70)

        print(weekday)

    print("\n" + "=" * 70)
    print("AUDIT COMPLETE")
    print("=" * 70)


if __name__ == "__main__":
    main()