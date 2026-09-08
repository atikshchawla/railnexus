"""Train request-time models for affected-train count and delay minutes."""

from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from xgboost import XGBRegressor

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_FILE = BASE_DIR / "data" / "curated" / "maintenance" / "train_impact_history.csv"
MODEL_DIR = BASE_DIR / "models" / "train_impact"
MODEL_DIR.mkdir(parents=True, exist_ok=True)
TIME_COLUMN = "request_timestamp"
NUMERIC_FEATURES = [
    "planned_duration_minutes", "planned_start_hour", "daily_train_count", "daily_tonnage_mgt",
    "congestion_score", "current_delay_minutes", "window_average_delay_minutes",
    "window_peak_delay_minutes", "weather_risk", "rainfall_mm", "is_heavy_rain_day",
    "trains_in_section", "traffic_density", "safety_critical",
]
CATEGORICAL_FEATURES = ["section_id", "department", "work_type", "priority", "asset_type"]
TARGETS = ["trains_affected", "total_delay_minutes"]


def encoder() -> OneHotEncoder:
    try:
        return OneHotEncoder(handle_unknown="ignore", sparse_output=False)
    except TypeError:
        return OneHotEncoder(handle_unknown="ignore", sparse=False)


def preprocessor() -> ColumnTransformer:
    return ColumnTransformer([
        ("numeric", Pipeline([("imputer", SimpleImputer(strategy="median"))]), NUMERIC_FEATURES),
        ("categorical", Pipeline([("imputer", SimpleImputer(strategy="most_frequent")), ("encoder", encoder())]), CATEGORICAL_FEATURES),
    ])


def metrics(actual: np.ndarray, predicted: np.ndarray) -> dict:
    return {
        "mae": round(float(mean_absolute_error(actual, predicted)), 4),
        "rmse": round(float(np.sqrt(mean_squared_error(actual, predicted))), 4),
        "r2": round(float(r2_score(actual, predicted)), 4),
    }


def main() -> None:
    if not DATA_FILE.exists():
        raise FileNotFoundError(f"Run generate_train_impact_history.py first: {DATA_FILE}")
    df = pd.read_csv(DATA_FILE, low_memory=False)
    df[TIME_COLUMN] = pd.to_datetime(df[TIME_COLUMN], errors="coerce")
    df = df.dropna(subset=[TIME_COLUMN] + TARGETS).sort_values(TIME_COLUMN).reset_index(drop=True)
    df["planned_start_hour"] = pd.to_datetime(df["planned_start_time"], errors="coerce").dt.hour
    missing = sorted(set(NUMERIC_FEATURES + CATEGORICAL_FEATURES + TARGETS) - set(df.columns))
    if missing:
        raise ValueError(f"Impact dataset missing columns: {missing}")
    train_end = int(len(df) * 0.60)
    validation_end = int(len(df) * 0.80)
    train, validation, test = df.iloc[:train_end], df.iloc[train_end:validation_end], df.iloc[validation_end:]
    fitted = preprocessor()
    x_train = fitted.fit_transform(train[NUMERIC_FEATURES + CATEGORICAL_FEATURES])
    x_validation = fitted.transform(validation[NUMERIC_FEATURES + CATEGORICAL_FEATURES])
    x_test = fitted.transform(test[NUMERIC_FEATURES + CATEGORICAL_FEATURES])
    report = {"train_size": len(train), "validation_size": len(validation), "test_size": len(test), "targets": {}}
    models = {}
    for target in TARGETS:
        model_candidates = {
            "random_forest": RandomForestRegressor(n_estimators=400, max_depth=16, min_samples_leaf=4, random_state=42, n_jobs=-1),
            "xgboost": XGBRegressor(n_estimators=400, max_depth=6, learning_rate=0.05, subsample=0.85, colsample_bytree=0.85, objective="reg:squarederror", random_state=42, n_jobs=-1),
        }
        target_report = {}
        for name, model in model_candidates.items():
            model.fit(x_train, train[target])
            target_report[name] = metrics(validation[target].to_numpy(), model.predict(x_validation))
        target_report["zero_baseline"] = metrics(validation[target].to_numpy(), np.zeros(len(validation)))
        target_report["historical_mean_baseline"] = metrics(validation[target].to_numpy(), np.repeat(train[target].mean(), len(validation)))
        primary = min(("random_forest", "xgboost"), key=lambda name: target_report[name]["mae"])
        final_model = model_candidates[primary]
        final_model.fit(np.vstack([x_train, x_validation]), pd.concat([train[target], validation[target]]))
        predictions = np.maximum(0.0, final_model.predict(x_test))
        target_report["test"] = metrics(test[target].to_numpy(), predictions)
        target_report["primary_model"] = primary
        target_report["test_mean_prediction"] = round(float(predictions.mean()), 4)
        models[target] = final_model
        report["targets"][target] = target_report
    joblib.dump(fitted, MODEL_DIR / "preprocessor.joblib")
    for target, model in models.items():
        joblib.dump(model, MODEL_DIR / f"{target}.joblib")
    (MODEL_DIR / "features.json").write_text(json.dumps({"numeric_features": NUMERIC_FEATURES, "categorical_features": CATEGORICAL_FEATURES, "targets": TARGETS, "request_time_only": True}, indent=2), encoding="utf-8")
    (MODEL_DIR / "metrics.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()