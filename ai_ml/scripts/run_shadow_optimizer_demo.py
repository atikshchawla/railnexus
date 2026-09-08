"""Run a small explainable Shadow Block optimization example."""

from __future__ import annotations

import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from ai_ml.optimizer import MaintenanceRequest, optimize_requests


def main() -> None:
    requests = [
        MaintenanceRequest("R1", "SEC-01", "ENGG", "TRACK_INSPECTION", 100.0, 60.0, 0.12, 18.0),
        MaintenanceRequest("R2", "SEC-01", "ENGG", "WELD_REPAIR", 101.5, 50.0, 0.18, 20.0),
        MaintenanceRequest("R3", "SEC-01", "ENGG", "TRACK_INSPECTION", 102.0, 70.0, 0.10, 15.0),
        MaintenanceRequest("R4", "SEC-01", "TRD", "OHE_INSPECTION", 103.0, 55.0, 0.08, 12.0),
    ]
    result = optimize_requests(requests)
    print(json.dumps(result.to_dict(), indent=2))


if __name__ == "__main__":
    main()