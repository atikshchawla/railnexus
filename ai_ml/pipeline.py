"""End-to-end request scoring pipeline for the block optimizer."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from xgboost import Booster, DMatrix

from ai_ml.optimizer import MaintenanceRequest, OptimizerWeights, derive_priority, optimize_requests


BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "models"


class ModelPipeline:
    """Load trained artifacts once and score request-time feature dictionaries."""

    def __init__(self, model_dir: Path = MODEL_DIR) -> None:
        self.model_dir = model_dir
        self.failure_model = joblib.load(model_dir / "failure_risk" / "random_forest.joblib")
        self.failure_encoder = joblib.load(model_dir / "failure_risk" / "encoder.joblib")
        self.overrun_model = joblib.load(model_dir / "overrun_risk" / "overrun_risk_random_forest.joblib")
        self.overrun_encoder = joblib.load(model_dir / "overrun_risk" / "overrun_risk_encoder.joblib")
        self.duration_preprocessor = joblib.load(model_dir / "duration" / "preprocessor.joblib")
        self.duration_model = Booster()
        self.duration_model.load_model(model_dir / "duration" / "xgboost.json")
        self.impact_preprocessor = joblib.load(model_dir / "train_impact" / "preprocessor.joblib")
        self.impact_models = {
            target: joblib.load(model_dir / "train_impact" / f"{target}.joblib")
            for target in ("trains_affected", "total_delay_minutes")
        }

    @staticmethod
    def _frame(features: dict[str, Any]) -> pd.DataFrame:
        return pd.DataFrame([features])

    @staticmethod
    def _require(features: dict[str, Any], names: list[str]) -> None:
        missing = [name for name in names if name not in features]
        if missing:
            raise ValueError(f"Missing request-time model features: {missing}")

    def predict_failure_risk(self, features: dict[str, Any]) -> float:
        names = [
            "asset_age_days", "days_since_last_maintenance", "previous_failure_count",
            "lifetime_tonnage_mgt", "tonnage_since_last_maintenance_mgt", "daily_train_count",
            "daily_tonnage_mgt", "inspection_score", "rainfall_mm", "temperature_mean_c",
            "max_wind_speed_kmh", "is_heavy_rain_day", "asset_type", "department", "section_id",
        ]
        self._require(features, names)
        frame = self._frame(features)
        frame[names[:12]] = frame[names[:12]].apply(pd.to_numeric, errors="coerce")
        frame[names[12:]] = frame[names[12:]].astype(str)
        matrix = self.failure_encoder.transform(frame[names])
        return float(self.failure_model.predict_proba(matrix)[:, 1][0])

    def predict_duration(self, features: dict[str, Any]) -> float:
        names = [
            "planned_duration_minutes", "severity_score", "inspection_score", "workers_required",
            "equipment_count", "workload_per_worker", "weather_risk", "rainfall_mm",
            "temperature_mean_c", "max_wind_speed_kmh", "congestion_score", "current_delay_minutes",
            "window_average_delay_minutes", "window_peak_delay_minutes", "daily_train_count",
            "daily_tonnage_mgt", "accumulated_tonnage_mgt", "trains_in_section", "section_complexity",
            "traffic_density", "safety_critical", "is_heavy_rain_day", "is_heatwave_day",
            "is_rain_day", "request_hour", "request_day_of_week", "request_month",
            "request_is_weekend", "asset_type", "department", "section_id", "work_type", "priority",
        ]
        self._require(features, names)
        encoded = self.duration_preprocessor.transform(self._frame(features)[names])
        return max(1.0, float(self.duration_model.predict(DMatrix(encoded))[0]))

    def predict_overrun_risk(self, features: dict[str, Any]) -> float:
        names = [
            "severity_score", "inspection_score", "workers_required", "equipment_count",
            "workload_per_worker", "location_km_marker", "daily_train_count", "daily_tonnage_mgt",
            "accumulated_tonnage_mgt", "window_train_count", "window_average_delay_minutes",
            "window_peak_delay_minutes", "traffic_density", "congestion_score", "current_delay_minutes",
            "temperature_mean_c", "rainfall_mm", "max_wind_speed_kmh", "weather_risk",
            "is_heavy_rain_day", "is_heatwave_day", "is_rain_day", "safety_critical",
            "planned_duration_minutes", "department", "work_type", "priority", "asset_type",
        ]
        self._require(features, names)
        frame = self._frame(features)
        numeric = frame[names[:24]].apply(pd.to_numeric, errors="coerce").fillna(0.0)
        categorical = frame[names[24:]].astype(str)
        encoded = self.overrun_encoder.transform(categorical)
        encoded_frame = pd.DataFrame(
            encoded,
            columns=self.overrun_encoder.get_feature_names_out(names[24:]),
            index=frame.index,
        )
        matrix = pd.concat([numeric, encoded_frame], axis=1)
        return float(self.overrun_model.predict_proba(matrix)[:, 1][0])

    def predict_impact(self, features: dict[str, Any]) -> tuple[float, float]:
        names = [
            "planned_duration_minutes", "planned_start_hour", "daily_train_count", "daily_tonnage_mgt",
            "congestion_score", "current_delay_minutes", "window_average_delay_minutes",
            "window_peak_delay_minutes", "weather_risk", "rainfall_mm", "is_heavy_rain_day",
            "trains_in_section", "traffic_density", "safety_critical", "section_id", "department",
            "work_type", "priority", "asset_type",
        ]
        self._require(features, names)
        encoded = self.impact_preprocessor.transform(self._frame(features)[names])
        values = tuple(max(0.0, float(self.impact_models[target].predict(encoded)[0])) for target in ("trains_affected", "total_delay_minutes"))
        return values

    def score_request(self, request: dict[str, Any]) -> MaintenanceRequest:
        features = dict(request.get("model_features", {}))
        failure_risk = self.predict_failure_risk(features)
        preliminary = MaintenanceRequest(
            id=request["id"], section_id=request["section_id"], department=request["department"],
            work_type=request["work_type"], location_km=request["location_km"],
            predicted_duration_minutes=0.0, failure_risk_probability=failure_risk,
            priority=request.get("priority", features.get("priority", "MEDIUM")),
            safety_critical=request.get("safety_critical", bool(features.get("safety_critical", 0))),
            deadline_minutes=request.get("deadline_minutes"),
        )
        priority_score, urgency_level = derive_priority(preliminary)
        features["priority"] = urgency_level.upper()
        duration = self.predict_duration(features)
        features["planned_duration_minutes"] = duration
        overrun = self.predict_overrun_risk(features)
        trains, delay = self.predict_impact(features)
        return MaintenanceRequest(
            id=request["id"], section_id=request["section_id"], department=request["department"],
            work_type=request["work_type"], location_km=request["location_km"],
            predicted_duration_minutes=duration, overrun_probability=overrun,
            trains_affected=trains, train_impact_minutes=delay, priority=features["priority"],
            safety_critical=request.get("safety_critical", bool(features.get("safety_critical", 0))),
            equipment_ids=tuple(request.get("equipment_ids", ())),
            requires_power_isolation=request.get("requires_power_isolation", False),
            requires_disconnection=request.get("requires_disconnection", False),
            earliest_start_minute=request.get("earliest_start_minute"),
            latest_end_minute=request.get("latest_end_minute"),
            failure_risk_probability=failure_risk,
            deadline_minutes=request.get("deadline_minutes"),
        )

    def optimize(self, requests: list[dict[str, Any]], **kwargs: Any) -> dict[str, Any]:
        scored = [self.score_request(request) for request in requests]
        result = optimize_requests(scored, **kwargs)
        payload = result.to_dict()
        payload["model_outputs"] = {
            request.id: {
                "failure_risk_probability": request.failure_risk_probability,
                "priority_score": derive_priority(request)[0],
                "urgency_level": derive_priority(request)[1],
                "predicted_duration_minutes": request.predicted_duration_minutes,
                "overrun_probability": request.overrun_probability,
                "trains_affected": request.trains_affected,
                "train_impact_minutes": request.train_impact_minutes,
            }
            for request in scored
        }
        return payload