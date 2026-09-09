import os
import pandas as pd


class TrackAsset:
    def __init__(self, asset_type, km_marker, department):
        prefix = {
            "TRACK_CIRCUIT": "TC",
            "POINT_MACHINE": "PM",
            "OHE_MAST": "OHE"
        }.get(asset_type, asset_type[:3].upper())

        department_code = {
            "ENGG": "ENGG",
            "S&T": "SNT",
            "TRD": "TRD"
        }.get(department, department.replace("&", "N"))

        km_code = f"{km_marker:.3f}".replace(".", "_")

        self.asset_id = f"{prefix}_{department_code}_{km_code}"
        self.asset_type = asset_type
        self.km_marker = km_marker
        self.department = department


class BlockSection:
    def __init__(
        self,
        start_station,
        end_station,
        start_km,
        end_km,
        mps_kmh=130
    ):
        self.section_id = f"{start_station}-{end_station}"
        self.start_station = start_station
        self.end_station = end_station
        self.start_km = start_km
        self.end_km = end_km
        self.distance = round(end_km - start_km, 2)
        self.mps_kmh = mps_kmh
        self.assets = []

    def populate_assets(self):
        current_km = self.start_km

        # Track circuits every 1.5 km
        while current_km < self.end_km:
            self.assets.append(
                TrackAsset(
                    "TRACK_CIRCUIT",
                    round(current_km, 2),
                    "ENGG"
                )
            )
            current_km += 1.5

        # Point machines near both section boundaries
        self.assets.append(
            TrackAsset(
                "POINT_MACHINE",
                round(self.start_km + 0.1, 2),
                "S&T"
            )
        )

        self.assets.append(
            TrackAsset(
                "POINT_MACHINE",
                round(self.end_km - 0.1, 2),
                "S&T"
            )
        )

        # OHE masts every 50 metres
        current_km = self.start_km

        while current_km < self.end_km:
            self.assets.append(
                TrackAsset(
                    "OHE_MAST",
                    round(current_km, 3),
                    "TRD"
                )
            )
            current_km += 0.05


class RailwayNetwork:
    def __init__(self, division_name):
        self.division_name = division_name
        self.stations = []
        self.sections = []

    def build_from_timetable(self, timetable_data):
        self.stations = timetable_data

        for i in range(len(self.stations) - 1):
            start_station, start_km = self.stations[i]
            end_station, end_km = self.stations[i + 1]

            section = BlockSection(
                start_station,
                end_station,
                start_km,
                end_km
            )

            section.populate_assets()
            self.sections.append(section)

    def export_topology_to_dataframe(self):
        rows = []

        for section in self.sections:
            for asset in section.assets:
                rows.append({
                    "division": self.division_name,
                    "section_id": section.section_id,
                    "start_station": section.start_station,
                    "end_station": section.end_station,
                    "start_km": section.start_km,
                    "end_km": section.end_km,
                    "distance_km": section.distance,
                    "mps_kmh": section.mps_kmh,
                    "asset_id": asset.asset_id,
                    "asset_type": asset.asset_type,
                    "department": asset.department,
                    "km_marker": asset.km_marker
                })

        return pd.DataFrame(rows)


if __name__ == "__main__":

    ajj_jtj_corridor = [
        ("AJJ", 0.0),
        ("SHU", 21.3),
        ("WJR", 36.2),
        ("MCN", 43.9),
        ("KPD", 60.9),
        ("GYM", 85.6),
        ("AB", 113.0),
        ("VN", 129.1),
        ("JTJ", 144.5)
    ]

    rail_network = RailwayNetwork("SR_CHENNAI")
    rail_network.build_from_timetable(ajj_jtj_corridor)

    df_topology = rail_network.export_topology_to_dataframe()

    output_dir = "data/raw"
    os.makedirs(output_dir, exist_ok=True)

    output_path = os.path.join(
        output_dir,
        "network_topology.csv"
    )

    df_topology.to_csv(output_path, index=False)

    print(
        f"Network built successfully: "
        f"{len(rail_network.sections)} block sections created."
    )

    print(
        f"Total static assets generated: "
        f"{len(df_topology)}"
    )

    print(
        f"Track circuits: "
        f"{(df_topology['asset_type'] == 'TRACK_CIRCUIT').sum()}"
    )

    print(
        f"Point machines: "
        f"{(df_topology['asset_type'] == 'POINT_MACHINE').sum()}"
    )

    print(
        f"OHE masts: "
        f"{(df_topology['asset_type'] == 'OHE_MAST').sum()}"
    )

    print(f"File saved to: {output_path}")