import json
import os
import warnings
 
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    precision_recall_curve,
    roc_auc_score,
)
from sklearn.preprocessing import OneHotEncoder
 
warnings.filterwarnings("ignore")
 
try:
    from xgboost import XGBClassifier
    HAS_XGBOOST = True
except ImportError:
    HAS_XGBOOST = False
 
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FILE = os.path.join(BASE_DIR, "data", "curated", "maintenance", "block_execution_history.csv")
MODEL_DIR = os.path.join(BASE_DIR, "models", "overrun_risk")
METRICS_FILE = os.path.join(MODEL_DIR, "overrun_risk_model_metrics.json")
MODEL_FILE_XGB = os.path.join(MODEL_DIR, "overrun_risk_xgboost.json")
MODEL_FILE_RF = os.path.join(MODEL_DIR, "overrun_risk_random_forest.joblib")
ENCODER_FILE = os.path.join(MODEL_DIR, "overrun_risk_encoder.joblib")
FEATURE_LIST_FILE = os.path.join(MODEL_DIR, "overrun_risk_features.json")
 
# Columns known at request time -- safe to use as features.
NUMERIC_FEATURES = [
    "severity_score",
    "inspection_score",
    "workers_required",
    "equipment_count",
    "workload_per_worker",
    "location_km_marker",
    "daily_train_count",
    "daily_tonnage_mgt",
    "accumulated_tonnage_mgt",
    "window_train_count",
    "window_average_delay_minutes",
    "window_peak_delay_minutes",
    "traffic_density",
    "congestion_score",
    "current_delay_minutes",
    "temperature_mean_c",
    "rainfall_mm",
    "max_wind_speed_kmh",
    "weather_risk",
    "is_heavy_rain_day",
    "is_heatwave_day",
    "is_rain_day",
    "safety_critical",
    "planned_duration_minutes",
]
CATEGORICAL_FEATURES = ["department", "work_type", "priority", "asset_type"]
LABEL_COLUMN = "overrun_flag"
TIME_COLUMN = "request_timestamp"
RF_WEIGHT = 0.60
XGB_WEIGHT = 0.40
 
# Columns that would leak the outcome -- explicitly never used as features.
LEAKAGE_COLUMNS = [
    "actual_start_time", "actual_end_time", "actual_duration_minutes",
    "overrun_minutes", "overrun_flag", "completion_status",
    "complication_occurred", "complication_risk_score",
    "planned_start_time", "planned_end_time",
]
 
 
def load_dataset():
    if not os.path.exists(DATA_FILE):
        raise FileNotFoundError(
            f"{DATA_FILE} not found. Run 04_generate_block_execution_history.py first."
        )
    df = pd.read_csv(DATA_FILE)
    df[TIME_COLUMN] = pd.to_datetime(df[TIME_COLUMN], errors="coerce")
    df = df.dropna(subset=[TIME_COLUMN]).sort_values(TIME_COLUMN).reset_index(drop=True)
    return df
 
 
def time_based_split(df, test_fraction=0.2):
    """
    Strictly chronological split: train on the earlier X%, test on the
    most recent (1-X)%. This is deliberately NOT a random split -- a
    random split would let the model see request patterns from "the
    future" during training, which overstates real-world accuracy for
    a system that only ever has past data available at decision time.
    """
    split_index = int(len(df) * (1 - test_fraction))
    train_df = df.iloc[:split_index].reset_index(drop=True)
    test_df = df.iloc[split_index:].reset_index(drop=True)
    return train_df, test_df
 
 
def build_feature_matrix(df, encoder=None, fit_encoder=False):
    numeric = df[NUMERIC_FEATURES].apply(pd.to_numeric, errors="coerce").fillna(0.0)
 
    categorical_raw = df[CATEGORICAL_FEATURES].astype(str)
    if fit_encoder:
        encoder = OneHotEncoder(handle_unknown="ignore", sparse_output=False)
        categorical_encoded = encoder.fit_transform(categorical_raw)
    else:
        categorical_encoded = encoder.transform(categorical_raw)
 
    encoded_cols = encoder.get_feature_names_out(CATEGORICAL_FEATURES)
    categorical_df = pd.DataFrame(categorical_encoded, columns=encoded_cols, index=df.index)
 
    features = pd.concat([numeric.reset_index(drop=True), categorical_df.reset_index(drop=True)], axis=1)
    return features, encoder
 
 
def evaluate(y_true, y_prob, label):
    roc_auc = roc_auc_score(y_true, y_prob)
    avg_precision = average_precision_score(y_true, y_prob)
    brier = brier_score_loss(y_true, y_prob)
 
    # Precision@K -- of the top 20% highest-risk predicted blocks, what
    # fraction actually overran? This is the operationally relevant
    # metric: the Priority Queue only has room to flag the riskiest
    # fraction of tasks, so ranking quality at the top matters more
    # than overall accuracy.
    k = max(1, int(0.2 * len(y_true)))
    top_k_idx = np.argsort(y_prob)[-k:]
    precision_at_k = float(np.mean(np.asarray(y_true)[top_k_idx]))
 
    metrics = {
        "roc_auc": round(float(roc_auc), 4),
        "average_precision": round(float(avg_precision), 4),
        "brier_score": round(float(brier), 4),
        "precision_at_top20pct": round(precision_at_k, 4),
        "base_rate": round(float(np.mean(y_true)), 4),
        "n_samples": int(len(y_true)),
    }
 
    print(f"\n--- {label} ---")
    for key, value in metrics.items():
        print(f"  {key}: {value}")
 
    return metrics
 
 
def train_xgboost(X_train, y_train, X_test, y_test):
    model = XGBClassifier(
        n_estimators=500,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.85,
        colsample_bytree=0.85,
        min_child_weight=3,
        reg_lambda=1.0,
        reg_alpha=0.1,
        gamma=0.1,
        eval_metric="auc",
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)
    return model
 
 
def train_random_forest_baseline(X_train, y_train):
    model = RandomForestClassifier(
        n_estimators=500,
        max_depth=6,
        min_samples_leaf=8,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_train, y_train)
    return model
 
 
def top_feature_importances(model, feature_names, top_n=12):
    if hasattr(model, "feature_importances_"):
        importances = model.feature_importances_
    else:
        return []
    order = np.argsort(importances)[::-1][:top_n]
    return [
        {"feature": feature_names[i], "importance": round(float(importances[i]), 4)}
        for i in order
    ]
 
 
def save_xgboost_model(model, path):
    if not hasattr(model, "_estimator_type"):
        model._estimator_type = "classifier"
    model.save_model(path)
 
 
def main():
    os.makedirs(MODEL_DIR, exist_ok=True)
 
    print("Loading dataset...")
    df = load_dataset()
    print(f"  {len(df):,} records loaded, spanning "
          f"{df[TIME_COLUMN].min().date()} to {df[TIME_COLUMN].max().date()}")
 
    train_df, test_df = time_based_split(df, test_fraction=0.2)
    print(f"  Train: {len(train_df):,} records (up to {train_df[TIME_COLUMN].max().date()})")
    print(f"  Test:  {len(test_df):,} records (from {test_df[TIME_COLUMN].min().date()})")
 
    X_train, encoder = build_feature_matrix(train_df, fit_encoder=True)
    X_test, _ = build_feature_matrix(test_df, encoder=encoder, fit_encoder=False)
    y_train = train_df[LABEL_COLUMN].to_numpy()
    y_test = test_df[LABEL_COLUMN].to_numpy()
 
    feature_names = list(X_train.columns)
 
    print(f"\nFeature matrix: {X_train.shape[1]} features "
          f"({len(NUMERIC_FEATURES)} numeric + {X_train.shape[1] - len(NUMERIC_FEATURES)} one-hot encoded)")
    print(f"Train label rate: {y_train.mean():.2%} overrun | Test label rate: {y_test.mean():.2%} overrun")
 
    all_metrics = {}
 
    # --- Random Forest baseline ---
    print("\nTraining Random Forest baseline...")
    rf_model = train_random_forest_baseline(X_train, y_train)
    rf_prob = rf_model.predict_proba(X_test)[:, 1]
    all_metrics["random_forest"] = evaluate(y_test, rf_prob, "Random Forest (baseline)")
    all_metrics["random_forest"]["top_features"] = top_feature_importances(rf_model, feature_names)
 
    import joblib
    joblib.dump(rf_model, MODEL_FILE_RF)
    joblib.dump(encoder, ENCODER_FILE)
 
    # --- XGBoost component model ---
    if HAS_XGBOOST:
        print("\nTraining XGBoost...")
        xgb_model = train_xgboost(X_train, y_train, X_test, y_test)
        xgb_prob = xgb_model.predict_proba(X_test)[:, 1]
        all_metrics["xgboost"] = evaluate(y_test, xgb_prob, "XGBoost (primary)")
        all_metrics["xgboost"]["top_features"] = top_feature_importances(xgb_model, feature_names)
        save_xgboost_model(xgb_model, MODEL_FILE_XGB)
        ensemble_prob = RF_WEIGHT * rf_prob + XGB_WEIGHT * xgb_prob
        all_metrics["ensemble"] = evaluate(y_test, ensemble_prob, "Weighted ensemble (60/40)")
        all_metrics["ensemble"]["weights"] = {
            "random_forest": RF_WEIGHT,
            "xgboost": XGB_WEIGHT,
        }
        primary_label = "ensemble"
    else:
        print("\nxgboost not installed -- skipping primary model. "
              "Install with: pip install xgboost --break-system-packages")
        primary_label = "random_forest"
 
    with open(FEATURE_LIST_FILE, "w") as f:
        json.dump({
            "numeric_features": NUMERIC_FEATURES,
            "categorical_features": CATEGORICAL_FEATURES,
            "encoded_feature_names": feature_names,
            "label_column": LABEL_COLUMN,
            "excluded_leakage_columns": LEAKAGE_COLUMNS,
            "ensemble": {
                "random_forest_weight": RF_WEIGHT,
                "xgboost_weight": XGB_WEIGHT,
                "fallback_without_xgboost": "random_forest",
            },
        }, f, indent=2)
 
    with open(METRICS_FILE, "w") as f:
        json.dump({
            "primary_model": primary_label,
            "train_size": len(train_df),
            "test_size": len(test_df),
            "train_date_range": [str(train_df[TIME_COLUMN].min()), str(train_df[TIME_COLUMN].max())],
            "test_date_range": [str(test_df[TIME_COLUMN].min()), str(test_df[TIME_COLUMN].max())],
            "results": all_metrics,
        }, f, indent=2)
 
    print(f"\nSaved:")
    print(f"  Random Forest model -> {MODEL_FILE_RF}")
    if HAS_XGBOOST:
        print(f"  XGBoost model        -> {MODEL_FILE_XGB}")
    print(f"  Encoder              -> {ENCODER_FILE}")
    print(f"  Feature manifest     -> {FEATURE_LIST_FILE}")
    print(f"  Metrics report       -> {METRICS_FILE}")
 
    print(f"\nPrimary model selected: {primary_label}")
    print(f"ROC-AUC: {all_metrics[primary_label]['roc_auc']}  |  "
          f"Precision@Top20%: {all_metrics[primary_label]['precision_at_top20pct']}")
 
 
if __name__ == "__main__":
    main()