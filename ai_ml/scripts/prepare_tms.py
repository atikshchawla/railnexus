from pathlib import Path
import pandas as pd


# ============================================================
# PROJECT PATHS
# ============================================================

PROJECT_ROOT = Path(__file__).resolve().parents[1]

RAW_DIR = PROJECT_ROOT / "data" / "raw"

TIMETABLE_FILE = RAW_DIR / "indian_railways_schedule.csv"
TOPOLOGY_FILE = RAW_DIR / "network_topology.csv"

OUTPUT_TRAINS = RAW_DIR / "tms_real_trains.csv"
OUTPUT_SCHEDULE = RAW_DIR / "tms_real_schedule.csv"
OUTPUT_SECTION_SCHEDULE = RAW_DIR / "tms_section_schedule.csv"


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def clean_column_names(df):
    """
    Standardize CSV column names.

    Example:
    Train No.      -> train_no
    Station Code   -> station_code
    Arrival time   -> arrival_time
    """

    df = df.copy()

    df.columns = (
        df.columns
        .astype(str)
        .str.strip()
        .str.lower()
        .str.replace(".", "", regex=False)
        .str.replace(" ", "_", regex=False)
        .str.replace("-", "_", regex=False)
    )

    return df


def find_column(df, possible_columns):
    """
    Find the first matching column name.
    """

    for column in possible_columns:
        if column in df.columns:
            return column

    raise ValueError(
        f"\nCould not find any of these columns:\n"
        f"{possible_columns}\n\n"
        f"Available columns:\n"
        f"{list(df.columns)}"
    )


def parse_time(value):
    """
    Convert a timetable time value into a pandas datetime.

    Supports values such as:
    10:25:00
    10:25
    0:00:00
    """

    if pd.isna(value):
        return pd.NaT

    value = str(value).strip()

    if value == "" or value.lower() == "nan":
        return pd.NaT

    return pd.to_datetime(
        value,
        errors="coerce"
    )


# ============================================================
# LOAD CORRIDOR TOPOLOGY
# ============================================================

def load_corridor_topology():

    print("\nLoading network topology...")

    topology = pd.read_csv(TOPOLOGY_FILE)

    topology = clean_column_names(topology)

    required_columns = [
        "section_id",
        "start_station",
        "end_station",
        "start_km",
        "end_km",
        "distance_km",
        "mps_kmh"
    ]

    missing_columns = [
        column
        for column in required_columns
        if column not in topology.columns
    ]

    if missing_columns:
        raise ValueError(
            f"Missing topology columns: {missing_columns}"
        )

    # network_topology.csv contains many rows per section
    # because every section contains multiple railway assets.
    sections = (
        topology
        .drop_duplicates(subset=["section_id"])
        .copy()
    )

    sections = sections[
        required_columns
    ]

    # Standardize station codes
    sections["start_station"] = (
        sections["start_station"]
        .astype(str)
        .str.upper()
        .str.strip()
    )

    sections["end_station"] = (
        sections["end_station"]
        .astype(str)
        .str.upper()
        .str.strip()
    )

    # Ensure numeric values
    numeric_columns = [
        "start_km",
        "end_km",
        "distance_km",
        "mps_kmh"
    ]

    for column in numeric_columns:
        sections[column] = pd.to_numeric(
            sections[column],
            errors="coerce"
        )

    sections = (
        sections
        .dropna(
            subset=[
                "section_id",
                "start_station",
                "end_station",
                "start_km",
                "end_km",
                "distance_km"
            ]
        )
        .sort_values("start_km")
        .reset_index(drop=True)
    )

    print(
        f"Unique block sections found: "
        f"{len(sections)}"
    )

    print("\nTopology:")

    for _, row in sections.iterrows():

        print(
            f"{row['section_id']:10s} | "
            f"{row['start_km']:6.1f} km -> "
            f"{row['end_km']:6.1f} km | "
            f"{row['distance_km']:5.1f} km"
        )

    return sections


# ============================================================
# LOAD REAL INDIAN RAILWAYS TIMETABLE
# ============================================================

def load_real_timetable():

    print(
        "\nLoading real Indian Railways timetable..."
    )

    df = pd.read_csv(
        TIMETABLE_FILE,
        low_memory=False
    )

    print(
        f"Raw timetable records: {len(df):,}"
    )

    print("\nOriginal columns:")
    print(list(df.columns))

    df = clean_column_names(df)

    print("\nStandardized columns:")
    print(list(df.columns))

    return df


# ============================================================
# STANDARDIZE REAL TIMETABLE DATA
# ============================================================

def standardize_timetable(df):

    print(
        "\nStandardizing timetable data..."
    )

    train_number_col = find_column(
        df,
        [
            "train_no",
            "train_number"
        ]
    )

    train_name_col = find_column(
        df,
        [
            "train_name"
        ]
    )

    sequence_col = find_column(
        df,
        [
            "seq",
            "sequence",
            "route_sequence"
        ]
    )

    station_code_col = find_column(
        df,
        [
            "station_code"
        ]
    )

    station_name_col = find_column(
        df,
        [
            "station_name"
        ]
    )

    arrival_col = find_column(
        df,
        [
            "arrival_time",
            "arrival"
        ]
    )

    departure_col = find_column(
        df,
        [
            "departure_time",
            "departure"
        ]
    )

    distance_col = find_column(
        df,
        [
            "distance",
            "distance_km"
        ]
    )

    timetable = pd.DataFrame({

        "train_number": (
            df[train_number_col]
            .astype(str)
            .str.strip()
        ),

        "train_name": (
            df[train_name_col]
            .astype(str)
            .str.strip()
        ),

        "route_sequence": pd.to_numeric(
            df[sequence_col],
            errors="coerce"
        ),

        "station_code": (
            df[station_code_col]
            .astype(str)
            .str.upper()
            .str.strip()
        ),

        "station_name": (
            df[station_name_col]
            .astype(str)
            .str.strip()
        ),

        "arrival_time": (
            df[arrival_col]
            .astype(str)
            .str.strip()
        ),

        "departure_time": (
            df[departure_col]
            .astype(str)
            .str.strip()
        ),

        "distance_km": pd.to_numeric(
            df[distance_col],
            errors="coerce"
        )
    })

    # Remove invalid rows
    timetable = timetable.dropna(
        subset=[
            "train_number",
            "route_sequence",
            "station_code"
        ]
    )

    # Remove empty and invalid station codes
    timetable = timetable[
        timetable["station_code"].notna()
    ]

    timetable = timetable[
        timetable["station_code"] != ""
    ]

    timetable = timetable[
        timetable["station_code"] != "NAN"
    ]

    # Sort each train according to its actual route sequence
    timetable = (
        timetable
        .sort_values(
            [
                "train_number",
                "route_sequence"
            ]
        )
        .reset_index(drop=True)
    )

    print(
        f"Valid timetable records: "
        f"{len(timetable):,}"
    )

    print(
        f"Unique trains: "
        f"{timetable['train_number'].nunique():,}"
    )

    return timetable


# ============================================================
# GET ORDERED CORRIDOR STATIONS
# ============================================================

def get_corridor_stations(sections):
    """
    Build the ordered station path from topology.

    Example:
    AJJ -> SHU -> WJR -> MCN -> KPD ...
    """

    sections = (
        sections
        .sort_values("start_km")
        .reset_index(drop=True)
    )

    corridor_stations = [
        sections.iloc[0]["start_station"]
    ]

    for _, row in sections.iterrows():

        end_station = row["end_station"]

        if end_station not in corridor_stations:
            corridor_stations.append(
                end_station
            )

    return corridor_stations


# ============================================================
# FILTER REAL TRAINS FOR AJJ-JTJ CORRIDOR
# ============================================================

def filter_corridor_trains(
    timetable,
    corridor_stations
):

    print(
        "\nFiltering trains for AJJ-JTJ corridor..."
    )

    timetable = timetable.copy()

    corridor_set = set(
        corridor_stations
    )

    # Check whether each timetable row belongs
    # to our AJJ-JTJ topology.
    timetable["in_corridor"] = (
        timetable["station_code"]
        .isin(corridor_set)
    )

    # Count corridor stations visited by each train
    train_counts = (
        timetable
        .groupby("train_number")
        .agg(
            corridor_station_count=(
                "in_corridor",
                "sum"
            )
        )
        .reset_index()
    )

    # Train needs at least two corridor stations
    # to create a movement through the network.
    valid_trains = train_counts[
        train_counts[
            "corridor_station_count"
        ] >= 2
    ][
        "train_number"
    ]

    corridor_data = timetable[
        timetable["train_number"]
        .isin(valid_trains)
    ].copy()

    # Keep only stations belonging to our corridor
    corridor_data = corridor_data[
        corridor_data["in_corridor"]
    ].copy()

    corridor_data = (
        corridor_data
        .sort_values(
            [
                "train_number",
                "route_sequence"
            ]
        )
        .reset_index(drop=True)
    )

    print(
        f"Trains crossing corridor: "
        f"{corridor_data['train_number'].nunique():,}"
    )

    print(
        f"Corridor station records: "
        f"{len(corridor_data):,}"
    )

    return corridor_data


# ============================================================
# CREATE TRAIN MASTER
# ============================================================

def create_train_master(
    corridor_data,
    corridor_stations
):

    print(
        "\nCreating train master..."
    )

    records = []

    for train_number, group in corridor_data.groupby(
        "train_number"
    ):

        group = (
            group
            .sort_values("route_sequence")
            .reset_index(drop=True)
        )

        first_station = (
            group.iloc[0]["station_code"]
        )

        last_station = (
            group.iloc[-1]["station_code"]
        )

        first_position = (
            corridor_stations.index(first_station)
        )

        last_position = (
            corridor_stations.index(last_station)
        )

        if last_position > first_position:
            direction = "UP"
        else:
            direction = "DOWN"

        records.append({

            "train_id":
                f"IR_{train_number}",

            "train_number":
                train_number,

            "train_name":
                group.iloc[0]["train_name"],

            "first_corridor_station":
                first_station,

            "last_corridor_station":
                last_station,

            "corridor_stations":
                len(group),

            "direction":
                direction
        })

    train_master = pd.DataFrame(
        records
    )

    print(
        f"Train master records: "
        f"{len(train_master):,}"
    )

    return train_master


# ============================================================
# BUILD SECTION LOOKUP
# ============================================================

def build_section_lookup(
    topology_sections
):

    section_lookup = {}

    for _, row in topology_sections.iterrows():

        start_station = (
            row["start_station"]
        )

        end_station = (
            row["end_station"]
        )

        section_lookup[
            (
                start_station,
                end_station
            )
        ] = {

            "section_id":
                row["section_id"],

            "distance_km":
                float(row["distance_km"]),

            "start_km":
                float(row["start_km"]),

            "end_km":
                float(row["end_km"])
        }

    return section_lookup


# ============================================================
# EXPAND TIMETABLE INTO PHYSICAL BLOCK SECTIONS
# ============================================================

def build_section_schedule(
    corridor_data,
    topology_sections,
    corridor_stations
):

    print(
        "\nExpanding real train movements "
        "across all physical block sections..."
    )

    topology_sections = (
        topology_sections
        .sort_values("start_km")
        .reset_index(drop=True)
    )

    # --------------------------------------------------------
    # STATION POSITION LOOKUP
    # --------------------------------------------------------

    station_positions = {}

    # First station
    first_row = topology_sections.iloc[0]

    station_positions[
        first_row["start_station"]
    ] = float(
        first_row["start_km"]
    )

    # Every end station
    for _, row in topology_sections.iterrows():

        station_positions[
            row["end_station"]
        ] = float(
            row["end_km"]
        )

    # --------------------------------------------------------
    # SECTION LOOKUP
    # --------------------------------------------------------

    section_lookup = build_section_lookup(
        topology_sections
    )

    records = []

    total_trains_processed = 0
    total_legs_processed = 0
    skipped_legs = 0

    # --------------------------------------------------------
    # PROCESS EVERY TRAIN
    # --------------------------------------------------------

    for train_number, group in corridor_data.groupby(
        "train_number"
    ):

        group = (
            group
            .sort_values("route_sequence")
            .reset_index(drop=True)
        )

        if len(group) < 2:
            continue

        total_trains_processed += 1

        train_id = f"IR_{train_number}"

        # ----------------------------------------------------
        # PROCESS EACH TIMETABLE LEG
        # ----------------------------------------------------

        for i in range(len(group) - 1):

            current_stop = group.iloc[i]
            next_stop = group.iloc[i + 1]

            from_station = (
                current_stop["station_code"]
            )

            to_station = (
                next_stop["station_code"]
            )

            # Both stations must exist in topology
            if (
                from_station not in station_positions
                or to_station not in station_positions
            ):

                skipped_legs += 1
                continue

            from_km = float(
                station_positions[from_station]
            )

            to_km = float(
                station_positions[to_station]
            )

            # Skip same-position records
            if from_km == to_km:

                skipped_legs += 1
                continue

            # ------------------------------------------------
            # DETERMINE DIRECTION AND STATION PATH
            # ------------------------------------------------

            if to_km > from_km:

                direction = "UP"

                from_index = (
                    corridor_stations.index(
                        from_station
                    )
                )

                to_index = (
                    corridor_stations.index(
                        to_station
                    )
                )

                path_stations = (
                    corridor_stations[
                        from_index:
                        to_index + 1
                    ]
                )

            else:

                direction = "DOWN"

                from_index = (
                    corridor_stations.index(
                        from_station
                    )
                )

                to_index = (
                    corridor_stations.index(
                        to_station
                    )
                )

                path_stations = list(
                    reversed(
                        corridor_stations[
                            to_index:
                            from_index + 1
                        ]
                    )
                )

            if len(path_stations) < 2:

                skipped_legs += 1
                continue

            # ------------------------------------------------
            # PARSE REAL TIMETABLE TIMES
            # ------------------------------------------------

            departure_time = parse_time(
                current_stop[
                    "departure_time"
                ]
            )

            arrival_time = parse_time(
                next_stop[
                    "arrival_time"
                ]
            )

            if pd.isna(departure_time):

                skipped_legs += 1
                continue

            if pd.isna(arrival_time):

                skipped_legs += 1
                continue

            # ------------------------------------------------
            # HANDLE MIDNIGHT CROSSING
            # ------------------------------------------------

            if arrival_time <= departure_time:

                arrival_time = (
                    arrival_time
                    + pd.Timedelta(days=1)
                )

            total_seconds = (
                arrival_time
                - departure_time
            ).total_seconds()

            if total_seconds <= 0:

                skipped_legs += 1
                continue

            total_distance = abs(
                to_km - from_km
            )

            if total_distance <= 0:

                skipped_legs += 1
                continue

            total_legs_processed += 1

            # ------------------------------------------------
            # EXPAND ONE TIMETABLE LEG INTO SECTIONS
            #
            # Example:
            #
            # Real timetable:
            # AJJ -> KPD
            #
            # Physical topology:
            # AJJ -> SHU -> WJR -> MCN -> KPD
            #
            # The train is expanded across all four sections.
            # ------------------------------------------------

            elapsed_distance = 0.0

            for j in range(
                len(path_stations) - 1
            ):

                section_from = (
                    path_stations[j]
                )

                section_to = (
                    path_stations[j + 1]
                )

                # Topology itself is stored in ascending
                # AJJ -> JTJ order.
                #
                # For DOWN movement, reverse the lookup.
                forward_key = (
                    section_from,
                    section_to
                )

                reverse_key = (
                    section_to,
                    section_from
                )

                if forward_key in section_lookup:

                    section_info = (
                        section_lookup[
                            forward_key
                        ]
                    )

                elif reverse_key in section_lookup:

                    section_info = (
                        section_lookup[
                            reverse_key
                        ]
                    )

                else:

                    print(
                        f"WARNING: Section not found: "
                        f"{section_from} -> "
                        f"{section_to}"
                    )

                    continue

                section_distance = float(
                    section_info["distance_km"]
                )

                # ------------------------------------------------
                # DISTANCE-PROPORTIONAL TIME INTERPOLATION
                # ------------------------------------------------

                entry_fraction = (
                    elapsed_distance
                    / total_distance
                )

                exit_fraction = (
                    (
                        elapsed_distance
                        + section_distance
                    )
                    / total_distance
                )

                section_entry_time = (
                    departure_time
                    + pd.Timedelta(
                        seconds=(
                            total_seconds
                            * entry_fraction
                        )
                    )
                )

                section_exit_time = (
                    departure_time
                    + pd.Timedelta(
                        seconds=(
                            total_seconds
                            * exit_fraction
                        )
                    )
                )

                # ------------------------------------------------
                # SAVE PHYSICAL SECTION MOVEMENT
                # ------------------------------------------------

                records.append({

                    "train_id":
                        train_id,

                    "train_number":
                        train_number,

                    "train_name":
                        current_stop[
                            "train_name"
                        ],

                    "source_route_sequence":
                        current_stop[
                            "route_sequence"
                        ],

                    "section_id":
                        section_info[
                            "section_id"
                        ],

                    "direction":
                        direction,

                    "from_station":
                        section_from,

                    "to_station":
                        section_to,

                    "scheduled_entry_time":
                        section_entry_time,

                    "scheduled_exit_time":
                        section_exit_time,

                    "section_distance_km":
                        section_distance,

                    "source_timetable_station":
                        from_station,

                    "destination_timetable_station":
                        to_station,

                    "source_departure_time":
                        departure_time,

                    "destination_arrival_time":
                        arrival_time,

                    "interpolated":
                        True
                })

                elapsed_distance += (
                    section_distance
                )

    # --------------------------------------------------------
    # CREATE FINAL DATAFRAME
    # --------------------------------------------------------

    section_schedule = pd.DataFrame(
        records
    )

    if not section_schedule.empty:

        section_schedule = (
            section_schedule
            .sort_values(
                [
                    "scheduled_entry_time",
                    "train_number",
                    "section_id"
                ]
            )
            .reset_index(drop=True)
        )

    print(
        f"\nTrains processed: "
        f"{total_trains_processed:,}"
    )

    print(
        f"Timetable legs processed: "
        f"{total_legs_processed:,}"
    )

    print(
        f"Skipped timetable legs: "
        f"{skipped_legs:,}"
    )

    print(
        f"Expanded section movement records: "
        f"{len(section_schedule):,}"
    )

    return section_schedule


# ============================================================
# MAIN
# ============================================================

def main():

    print("=" * 65)
    print(
        "STEP 02: REAL TMS TIMETABLE PREPARATION"
    )
    print("=" * 65)

    # --------------------------------------------------------
    # CHECK INPUT FILES
    # --------------------------------------------------------

    if not TIMETABLE_FILE.exists():

        raise FileNotFoundError(
            f"\nTimetable file not found:\n"
            f"{TIMETABLE_FILE}\n\n"
            f"Expected location:\n"
            f"data/raw/"
            f"indian_railways_schedule.csv"
        )

    if not TOPOLOGY_FILE.exists():

        raise FileNotFoundError(
            f"\nTopology file not found:\n"
            f"{TOPOLOGY_FILE}\n\n"
            f"Run 01_generate_network.py first."
        )

    # --------------------------------------------------------
    # 1. LOAD NETWORK TOPOLOGY
    # --------------------------------------------------------

    sections = (
        load_corridor_topology()
    )

    corridor_stations = (
        get_corridor_stations(
            sections
        )
    )

    print(
        "\nOur corridor:"
    )

    print(
        " -> ".join(
            corridor_stations
        )
    )

    # --------------------------------------------------------
    # 2. LOAD REAL TIMETABLE
    # --------------------------------------------------------

    raw_timetable = (
        load_real_timetable()
    )

    # --------------------------------------------------------
    # 3. STANDARDIZE TIMETABLE
    # --------------------------------------------------------

    timetable = (
        standardize_timetable(
            raw_timetable
        )
    )

    # --------------------------------------------------------
    # 4. FILTER FOR OUR CORRIDOR
    # --------------------------------------------------------

    corridor_data = (
        filter_corridor_trains(
            timetable,
            corridor_stations
        )
    )

    if corridor_data.empty:

        raise ValueError(
            "\nNo trains found for the AJJ-JTJ "
            "corridor.\n"
            "Check the station codes in the timetable."
        )

    # --------------------------------------------------------
    # 5. CREATE TRAIN MASTER
    # --------------------------------------------------------

    train_master = (
        create_train_master(
            corridor_data,
            corridor_stations
        )
    )

    # --------------------------------------------------------
    # 6. EXPAND REAL TRAIN MOVEMENTS
    # --------------------------------------------------------

    section_schedule = (
        build_section_schedule(
            corridor_data,
            sections,
            corridor_stations
        )
    )

    if section_schedule.empty:

        raise ValueError(
            "\nNo section movements were created.\n"
            "Check timetable arrival/departure "
            "time formats."
        )

    # --------------------------------------------------------
    # FORMAT DATETIME COLUMNS FOR CSV
    # --------------------------------------------------------

    datetime_columns = [
        "scheduled_entry_time",
        "scheduled_exit_time",
        "source_departure_time",
        "destination_arrival_time"
    ]

    for column in datetime_columns:

        if column in section_schedule.columns:

            section_schedule[column] = (
                pd.to_datetime(
                    section_schedule[column]
                )
                .dt.strftime("%Y-%m-%d %H:%M:%S")
            )

    # --------------------------------------------------------
    # SAVE OUTPUT FILES
    # --------------------------------------------------------

    train_master.to_csv(
        OUTPUT_TRAINS,
        index=False
    )

    corridor_data.to_csv(
        OUTPUT_SCHEDULE,
        index=False
    )

    section_schedule.to_csv(
        OUTPUT_SECTION_SCHEDULE,
        index=False
    )

    # ========================================================
    # FINAL SUMMARY
    # ========================================================

    print("\n" + "=" * 65)
    print(
        "REAL TMS PREPARATION COMPLETE"
    )
    print("=" * 65)

    print(
        f"\nUnique corridor trains: "
        f"{len(train_master):,}"
    )

    print(
        f"Corridor station records: "
        f"{len(corridor_data):,}"
    )

    print(
        f"Real section movements: "
        f"{len(section_schedule):,}"
    )

    # --------------------------------------------------------
    # SECTION DISTRIBUTION
    # --------------------------------------------------------

    print(
        "\nMovement distribution:"
    )

    distribution = (
        section_schedule[
            "section_id"
        ]
        .value_counts()
    )

    # Display in physical corridor order
    for section_id in sections["section_id"]:

        count = distribution.get(
            section_id,
            0
        )

        print(
            f"{section_id:10s} {count:>6,}"
        )

    # --------------------------------------------------------
    # DIRECTION DISTRIBUTION
    # --------------------------------------------------------

    print(
        "\nDirection distribution:"
    )

    print(
        section_schedule[
            "direction"
        ]
        .value_counts()
        .to_string()
    )

    # --------------------------------------------------------
    # SAMPLE MOVEMENTS
    # --------------------------------------------------------

    print(
        "\nSample section movements:"
    )

    print(
        section_schedule[
            [
                "train_number",
                "section_id",
                "direction",
                "from_station",
                "to_station",
                "scheduled_entry_time",
                "scheduled_exit_time"
            ]
        ]
        .head(10)
        .to_string(index=False)
    )

    # --------------------------------------------------------
    # OUTPUT FILES
    # --------------------------------------------------------

    print(
        "\nFiles saved:"
    )

    print(
        f"✓ {OUTPUT_TRAINS}"
    )

    print(
        f"✓ {OUTPUT_SCHEDULE}"
    )

    print(
        f"✓ {OUTPUT_SECTION_SCHEDULE}"
    )


# ============================================================
# RUN SCRIPT
# ============================================================

if __name__ == "__main__":
    main()