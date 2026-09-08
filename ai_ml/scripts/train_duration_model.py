"""Train and evaluate block-duration regressors without temporal leakage."""

from pathlib import Path
import json
import warnings

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

warnings.filterwarnings("ignore")

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_PATH = BASE_DIR / "data" / "curated" / "maintenance" / "block_execution_history.csv"
MODEL_DIR = BASE_DIR / "models" / "duration"
MODEL_DIR.mkdir(parents=True, exist_ok=True)

TARGET = "actual_duration_minutes"
TIME_COLUMN = "request_timestamp"
RANDOM_STATE = 42
TRAIN_FRACTION = 0.60
VALIDATION_FRACTION = 0.20
INTERVAL_QUANTILE = 0.90

NUMERIC_FEATURES = [
	"planned_duration_minutes", "severity_score", "inspection_score",
	"workers_required", "equipment_count", "workload_per_worker",
	"weather_risk", "rainfall_mm", "temperature_mean_c",
	"max_wind_speed_kmh", "congestion_score", "current_delay_minutes",
	"window_average_delay_minutes", "window_peak_delay_minutes",
	"daily_train_count", "daily_tonnage_mgt", "accumulated_tonnage_mgt",
	"trains_in_section", "section_complexity", "traffic_density",
	"safety_critical", "is_heavy_rain_day", "is_heatwave_day", "is_rain_day",
	"request_hour", "request_day_of_week", "request_month", "request_is_weekend",
]
CATEGORICAL_FEATURES = ["asset_type", "department", "section_id", "work_type", "priority"]
REQUIRED_SOURCE_FEATURES = [
	"planned_duration_minutes", "severity_score", "inspection_score",
	"workers_required", "equipment_count", "workload_per_worker",
	"weather_risk", "rainfall_mm", "temperature_mean_c", "max_wind_speed_kmh",
	"congestion_score", "current_delay_minutes", "window_average_delay_minutes",
	"window_peak_delay_minutes", "daily_train_count", "daily_tonnage_mgt",
	"accumulated_tonnage_mgt", "trains_in_section", "safety_critical",
	*CATEGORICAL_FEATURES,
]
FORBIDDEN_FEATURES = {
	TARGET, "actual_start_time", "actual_end_time", "overrun_minutes",
	"completion_status", "complication_occurred", "complication_risk_score",
	"overrun_flag", "trains_affected", "total_delay_minutes",
}


def make_one_hot_encoder():
	try:
		return OneHotEncoder(handle_unknown="ignore", sparse_output=False)
	except TypeError:
		return OneHotEncoder(handle_unknown="ignore", sparse=False)


def build_preprocessor(numeric_features, categorical_features):
	return ColumnTransformer(
		transformers=[
			(
				"numeric",
				Pipeline([("imputer", SimpleImputer(strategy="median"))]),
				numeric_features,
			),
			(
				"categorical",
				Pipeline([
					("imputer", SimpleImputer(strategy="most_frequent")),
					("encoder", make_one_hot_encoder()),
				]),
				categorical_features,
			),
		],
		remainder="drop",
	)


def build_models():
	return {
		"random_forest": RandomForestRegressor(
			n_estimators=500, max_depth=18, min_samples_leaf=5,
			max_features="sqrt", random_state=RANDOM_STATE, n_jobs=-1,
		),
		"xgboost": XGBRegressor(
			n_estimators=500, max_depth=6, learning_rate=0.05,
			subsample=0.85, colsample_bytree=0.85,
			objective="reg:squarederror", random_state=RANDOM_STATE, n_jobs=-1,
		),
	}


def regression_metrics(y_true, predictions):
	return {
		"mae": round(float(mean_absolute_error(y_true, predictions)), 4),
		"rmse": round(float(np.sqrt(mean_squared_error(y_true, predictions))), 4),
		"r2": round(float(r2_score(y_true, predictions)), 4) if len(y_true) > 1 else None,
	}


def subgroup_metrics(frame, predictions, columns):
	result = {}
	actual = frame[TARGET].to_numpy()
	for column in columns:
		groups = frame[column].astype(str) if column in frame else pd.Series()
		result[column] = {}
		for value in sorted(groups.dropna().unique()):
			mask = groups.to_numpy() == value
			metrics = regression_metrics(actual[mask], predictions[mask])
			metrics["n"] = int(mask.sum())
			result[column][value] = metrics
	return result


def group_median_predict(train_frame, test_frame, group_column):
	medians = train_frame.groupby(group_column)[TARGET].median()
	fallback = float(train_frame[TARGET].median())
	return test_frame[group_column].map(medians).fillna(fallback).to_numpy()


def evaluate_model(name, y_true, predictions):
	metrics = regression_metrics(y_true, predictions)
	print(f"{name}: MAE={metrics['mae']:.2f}, RMSE={metrics['rmse']:.2f}, R2={metrics['r2']:.4f}")
	return metrics


def main():
	print("=" * 70)
	print("RAILNEXUS: BLOCK DURATION PREDICTION")
	print("=" * 70)

	if not DATA_PATH.exists():
		raise FileNotFoundError(f"Dataset not found: {DATA_PATH}")
	df = pd.read_csv(DATA_PATH)
	missing = sorted(set(REQUIRED_SOURCE_FEATURES + [TARGET, TIME_COLUMN]) - set(df.columns))
	if missing:
		raise ValueError(
			"Dataset is missing required request-time features: " + ", ".join(missing)
		)
	forbidden_selected = set(NUMERIC_FEATURES + CATEGORICAL_FEATURES) & FORBIDDEN_FEATURES
	if forbidden_selected:
		raise ValueError(f"Potential target leakage in features: {sorted(forbidden_selected)}")

	df[TIME_COLUMN] = pd.to_datetime(df[TIME_COLUMN], errors="coerce")
	df[TARGET] = pd.to_numeric(df[TARGET], errors="coerce")
	df = df.dropna(subset=[TIME_COLUMN, TARGET]).sort_values(TIME_COLUMN).reset_index(drop=True)
	df = df[df[TARGET] > 0].copy().reset_index(drop=True)
	if len(df) < 100:
		raise ValueError("At least 100 valid duration records are required.")

	df["request_hour"] = df[TIME_COLUMN].dt.hour
	df["request_day_of_week"] = df[TIME_COLUMN].dt.dayofweek
	df["request_month"] = df[TIME_COLUMN].dt.month
	df["request_is_weekend"] = (df[TIME_COLUMN].dt.dayofweek >= 5).astype(int)
	numeric_features = [column for column in NUMERIC_FEATURES if column in df.columns]
	categorical_features = [column for column in CATEGORICAL_FEATURES if column in df.columns]
	features = numeric_features + categorical_features
	for column in numeric_features:
		df[column] = pd.to_numeric(df[column], errors="coerce")
	for column in categorical_features:
		df[column] = df[column].astype("string").fillna("UNKNOWN")

	n = len(df)
	train_end = int(n * TRAIN_FRACTION)
	validation_end = int(n * (TRAIN_FRACTION + VALIDATION_FRACTION))
	train = df.iloc[:train_end].copy()
	validation = df.iloc[train_end:validation_end].copy()
	test = df.iloc[validation_end:].copy()
	train_validation = df.iloc[:validation_end].copy()
	print(f"Records: {n:,}; train={len(train):,}; validation={len(validation):,}; test={len(test):,}")
	print(f"Train period: {train[TIME_COLUMN].min()} -> {train[TIME_COLUMN].max()}")
	print(f"Test period:  {test[TIME_COLUMN].min()} -> {test[TIME_COLUMN].max()}")

	validation_preprocessor = build_preprocessor(numeric_features, categorical_features)
	x_train = validation_preprocessor.fit_transform(train[features])
	x_validation = validation_preprocessor.transform(validation[features])
	validation_predictions = {}
	validation_results = {}
	validation_models = build_models()
	for name, model in validation_models.items():
		model.fit(x_train, train[TARGET])
		validation_predictions[name] = model.predict(x_validation)
		validation_results[name] = evaluate_model(
			f"Validation {name}", validation[TARGET], validation_predictions[name]
		)

	validation_results["planned_duration"] = evaluate_model(
		"Validation planned-duration baseline",
		validation[TARGET], validation["planned_duration_minutes"].to_numpy(),
	)
	validation_predictions["planned_duration"] = validation["planned_duration_minutes"].to_numpy()
	validation_results["work_type_median"] = evaluate_model(
		"Validation work-type median baseline",
		validation[TARGET], group_median_predict(train, validation, "work_type"),
	)
	validation_predictions["work_type_median"] = group_median_predict(train, validation, "work_type")
	primary_predictor = min(
		validation_results,
		key=lambda name: validation_results[name]["mae"],
	)
	primary_ml_model = min(
		validation_models,
		key=lambda name: validation_results[name]["mae"],
	)

	final_preprocessor = build_preprocessor(numeric_features, categorical_features)
	x_train_validation = final_preprocessor.fit_transform(train_validation[features])
	x_test = final_preprocessor.transform(test[features])
	final_models = build_models()
	test_predictions = {}
	test_results = {}
	for name, model in final_models.items():
		model.fit(x_train_validation, train_validation[TARGET])
		test_predictions[name] = model.predict(x_test)
		test_results[name] = evaluate_model(f"Test {name}", test[TARGET], test_predictions[name])

	test_results["planned_duration"] = evaluate_model(
		"Test planned-duration baseline", test[TARGET], test["planned_duration_minutes"].to_numpy()
	)
	test_predictions["planned_duration"] = test["planned_duration_minutes"].to_numpy()
	test_results["work_type_median"] = evaluate_model(
		"Test work-type median baseline", test[TARGET],
		group_median_predict(train_validation, test, "work_type"),
	)
	test_predictions["work_type_median"] = group_median_predict(train_validation, test, "work_type")
	primary_predictions = test_predictions[primary_predictor]
	validation_residuals = validation[TARGET].to_numpy() - validation_predictions[primary_predictor]
	interval_half_width = float(np.quantile(np.abs(validation_residuals), INTERVAL_QUANTILE))
	interval_lower = np.maximum(primary_predictions - interval_half_width, 0.0)
	interval_upper = primary_predictions + interval_half_width
	interval_coverage = float(np.mean(
		(test[TARGET].to_numpy() >= interval_lower)
		& (test[TARGET].to_numpy() <= interval_upper)
	))

	feature_names = final_preprocessor.get_feature_names_out()
	top_features = {}
	for name, model in final_models.items():
		importance = model.feature_importances_
		indices = np.argsort(importance)[::-1][:15]
		top_features[name] = [
			{"feature": str(feature_names[index]), "importance": round(float(importance[index]), 4)}
			for index in indices
		]

	subgroup = subgroup_metrics(
		test.assign(overrun_group=np.where(test[TARGET] - test["planned_duration_minutes"] > 10, "overrun", "not_overrun")),
		primary_predictions,
		["department", "work_type", "priority", "section_id", "overrun_group"],
	)
	quality = {
		"record_count": int(len(df)),
		"date_range": [str(df[TIME_COLUMN].min()), str(df[TIME_COLUMN].max())],
		"target_range_minutes": [float(df[TARGET].min()), float(df[TARGET].max())],
		"department_counts": {str(k): int(v) for k, v in df["department"].value_counts().items()},
		"work_type_counts": {str(k): int(v) for k, v in df["work_type"].value_counts().items()},
		"missing_values": {str(k): int(v) for k, v in df[features].isna().sum().items() if v},
	}
	metrics = {
		"primary_predictor": primary_predictor,
		"primary_ml_model": primary_ml_model,
		"target": TARGET,
		"features": features,
		"split": {"train_fraction": TRAIN_FRACTION, "validation_fraction": VALIDATION_FRACTION, "test_fraction": 1 - TRAIN_FRACTION - VALIDATION_FRACTION},
		"train_size": len(train), "validation_size": len(validation), "test_size": len(test),
		"validation_results": validation_results,
		"test_results": test_results,
		"prediction_interval": {
			"method": "symmetric absolute validation residual quantile",
			"quantile": INTERVAL_QUANTILE,
			"half_width_minutes": round(interval_half_width, 4),
			"test_coverage": round(interval_coverage, 4),
		},
		"subgroup_results": subgroup,
		"top_features": top_features,
		"data_quality": quality,
	}
	joblib.dump(final_models["random_forest"], MODEL_DIR / "random_forest.joblib")
	final_models["xgboost"].get_booster().save_model(MODEL_DIR / "xgboost.json")
	joblib.dump(final_preprocessor, MODEL_DIR / "preprocessor.joblib")
	with (MODEL_DIR / "features.json").open("w", encoding="utf-8") as file:
		json.dump({"target": TARGET, "time_column": TIME_COLUMN, "numeric_features": numeric_features, "categorical_features": categorical_features, "all_features": features, "forbidden_features": sorted(FORBIDDEN_FEATURES)}, file, indent=2)
	with (MODEL_DIR / "metrics.json").open("w", encoding="utf-8") as file:
		json.dump(metrics, file, indent=2)
	print(f"Primary predictor selected on validation MAE: {primary_predictor}")
	print(f"Best ML model selected on validation MAE: {primary_ml_model}")
	print(f"P{int(INTERVAL_QUANTILE * 100)} interval half-width: {interval_half_width:.2f} minutes; test coverage: {interval_coverage:.1%}")
	print(f"Artifacts saved to {MODEL_DIR}")


if __name__ == "__main__":
	main()
