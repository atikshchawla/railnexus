"""Train the asset failure risk models using a chronological evaluation split."""

from __future__ import annotations

import json
import os
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import average_precision_score, brier_score_loss, roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from xgboost import XGBClassifier

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_FILE = BASE_DIR / "data" / "curated" / "maintenance" / "asset_condition_history.csv"
MODEL_DIR = BASE_DIR / "models" / "failure_risk"
MODEL_DIR.mkdir(parents=True, exist_ok=True)

TARGET = "failure_within_next_7_days"
OBSERVATION_DATE = "observation_date"
TEST_FRACTION = 0.20
RANDOM_STATE = 42
TOP_K_FRACTION = 0.20

N_JOBS = max(1, (os.cpu_count() or 2) - 1)

NUMERIC_FEATURES = [
    "asset_age_days", "days_since_last_maintenance", "previous_failure_count",
    "lifetime_tonnage_mgt", "tonnage_since_last_maintenance_mgt",
    "daily_train_count", "daily_tonnage_mgt",
    "inspection_score", "rainfall_mm", "temperature_mean_c",
    "max_wind_speed_kmh", "is_heavy_rain_day",
]
CATEGORICAL_FEATURES = ["asset_type", "department", "section_id"]
LEAKAGE_COLUMNS = {
    TARGET, "failure_probability_7d", "priority", "priority_score", "health_score",
    "health_risk", "maintenance_risk", "age_risk", "condition_risk_score",
    "traffic_exposure", "weather_risk", "defect_type", "manual_severity_score",
    "failure_date", "failure_event", "post_failure_condition",
}


def load_dataset() -> pd.DataFrame:
    if not DATA_FILE.exists():
        raise FileNotFoundError(f"Dataset not found: {DATA_FILE}")

    df = pd.read_csv(DATA_FILE, low_memory=False)
    required = {TARGET, "asset_id", OBSERVATION_DATE}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {sorted(missing)}")

    df[OBSERVATION_DATE] = pd.to_datetime(df[OBSERVATION_DATE], errors="coerce")
    df[TARGET] = pd.to_numeric(df[TARGET], errors="coerce")
    df = df.dropna(subset=[OBSERVATION_DATE, TARGET]).copy()
    df[TARGET] = df[TARGET].astype(np.int8)
    if not df[TARGET].isin([0, 1]).all():
        raise ValueError("Target contains values other than 0/1.")
    return df.sort_values([OBSERVATION_DATE, "asset_id"], kind="stable").reset_index(drop=True)


def select_features(df: pd.DataFrame) -> tuple[list[str], list[str], list[str]]:
    numeric = [name for name in NUMERIC_FEATURES if name in df.columns]
    categorical = [name for name in CATEGORICAL_FEATURES if name in df.columns]
    features = numeric + categorical
    if not features:
        raise ValueError("No usable features were found.")
    leaked = set(features) & LEAKAGE_COLUMNS
    if leaked:
        raise RuntimeError(f"Leakage detected in features: {sorted(leaked)}")
    return features, numeric, categorical


def temporal_split(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    dates = np.sort(df[OBSERVATION_DATE].dt.normalize().unique())
    if len(dates) < 2:
        raise ValueError("At least two observation dates are required.")
    split_index = max(1, min(int(len(dates) * (1 - TEST_FRACTION)), len(dates) - 1))
    split_date = pd.Timestamp(dates[split_index])
    train = df[df[OBSERVATION_DATE] < split_date].copy()
    test = df[df[OBSERVATION_DATE] >= split_date].copy()
    if train[TARGET].nunique() < 2 or test[TARGET].nunique() < 2:
        raise ValueError("Both temporal splits must contain both target classes.")
    return train, test


def build_preprocessor(numeric: list[str], categorical: list[str]) -> ColumnTransformer:
    numeric_pipeline = Pipeline([("imputer", SimpleImputer(strategy="median"))])
    categorical_pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=True, dtype=np.float32)),
    ])
    transformers = []
    if numeric:
        transformers.append(("numeric", numeric_pipeline, numeric))
    if categorical:
        transformers.append(("categorical", categorical_pipeline, categorical))
    return ColumnTransformer(transformers=transformers, remainder="drop", sparse_threshold=1.0)


def metrics(y_true: pd.Series, probability: np.ndarray) -> dict:
    count = max(1, int(len(y_true) * TOP_K_FRACTION))
    top_indices = np.argsort(probability)[-count:]
    return {
        "roc_auc": round(float(roc_auc_score(y_true, probability)), 4),
        "average_precision": round(float(average_precision_score(y_true, probability)), 4),
        "brier_score": round(float(brier_score_loss(y_true, probability)), 4),
        "precision_at_top20pct": round(float(np.asarray(y_true)[top_indices].mean()), 4),
        "base_rate": round(float(np.mean(y_true)), 4),
        "n_samples": int(len(y_true)),
    }


def top_features(model, feature_names: list[str], count: int = 15) -> list[dict]:
    order = np.argsort(model.feature_importances_)[::-1][:count]
    return [{"feature": feature_names[i], "importance": round(float(model.feature_importances_[i]), 4)} for i in order]


def save_xgboost_model(model: XGBClassifier, path: Path) -> None:
    if not hasattr(model, "_estimator_type"):
        model._estimator_type = "classifier"
    model.save_model(path)


def main() -> None:
    df = load_dataset()
    features, numeric, categorical = select_features(df)
    train, test = temporal_split(df)

    preprocessor = build_preprocessor(numeric, categorical)
    X_train = preprocessor.fit_transform(train[features])
    X_test = preprocessor.transform(test[features])
    feature_names = list(preprocessor.get_feature_names_out())
    y_train = train[TARGET].to_numpy()
    y_test = test[TARGET].to_numpy()

    positive = int(y_train.sum())
    if positive == 0:
        raise ValueError("No positive failure examples in training data.")
    scale_pos_weight = (len(y_train) - positive) / positive

    rf = RandomForestClassifier(
        n_estimators=600, max_depth=12, min_samples_leaf=22, max_features="sqrt",
        class_weight="balanced", random_state=RANDOM_STATE, n_jobs=N_JOBS,
    )
    rf.fit(X_train, y_train)

    xgb = XGBClassifier(
        n_estimators=400, max_depth=6, learning_rate=0.07, subsample=0.85,
        colsample_bytree=0.85, min_child_weight=5, reg_alpha=0.1, reg_lambda=2.0,
        objective="binary:logistic", eval_metric="logloss", tree_method="hist",
        scale_pos_weight=scale_pos_weight, random_state=RANDOM_STATE, n_jobs=N_JOBS,
    )
    xgb.fit(X_train, y_train, verbose=False)

    rf_metrics = metrics(y_test, rf.predict_proba(X_test)[:, 1])
    xgb_metrics = metrics(y_test, xgb.predict_proba(X_test)[:, 1])
    if (xgb_metrics["roc_auc"], xgb_metrics["average_precision"]) > (
        rf_metrics["roc_auc"], rf_metrics["average_precision"]
    ):
        primary_model = "xgboost"
    else:
        primary_model = "random_forest"

    joblib.dump(rf, MODEL_DIR / "random_forest.joblib", compress=3)
    save_xgboost_model(xgb, MODEL_DIR / "xgboost.json")
    joblib.dump(preprocessor, MODEL_DIR / "encoder.joblib", compress=3)

    manifest = {
        "model": "asset_failure_risk", "target": TARGET, "primary_model": primary_model,
        "numeric_features": numeric, "categorical_features": categorical,
        "all_features": features, "excluded_leakage_columns": sorted(LEAKAGE_COLUMNS),
        "processed_feature_names": feature_names, "test_fraction": TEST_FRACTION,
        "random_state": RANDOM_STATE,
    }
    (MODEL_DIR / "features.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    report = {
        "primary_model": primary_model, "train_size": len(train), "test_size": len(test),
        "train_date_range": [str(train[OBSERVATION_DATE].min()), str(train[OBSERVATION_DATE].max())],
        "test_date_range": [str(test[OBSERVATION_DATE].min()), str(test[OBSERVATION_DATE].max())],
        "scale_pos_weight": round(float(scale_pos_weight), 4),
        "results": {
            "random_forest": {**rf_metrics, "top_features": top_features(rf, feature_names)},
            "xgboost": {**xgb_metrics, "top_features": top_features(xgb, feature_names)},
        },
    }
    (MODEL_DIR / "metrics.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Primary model: {primary_model}; train matrix: {X_train.shape}; jobs: {N_JOBS}")


if __name__ == "__main__":
    main()