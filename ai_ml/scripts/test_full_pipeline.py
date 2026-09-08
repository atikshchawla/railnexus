from ai_ml.pipeline import ModelPipeline


pipeline = ModelPipeline()


# ============================================================
# TEST REQUESTS
# ============================================================

requests = [

    # ========================================================
    # REQUEST 1
    # ========================================================
    {
        "id": "TEST-001",
        "section_id": "SEC_001",
        "department": "TRD",
        "work_type": "RAIL_REPLACEMENT",
        "location_km": 12.5,

        "safety_critical": True,
        "equipment_ids": ["EQ-001", "EQ-002"],

        "requires_power_isolation": False,
        "requires_disconnection": False,

        "earliest_start_minute": 480,
        "latest_end_minute": 900,

        "model_features": {
            # Model 1
            "asset_age_days": 2500,
            "days_since_last_maintenance": 180,
            "previous_failure_count": 2,
            "lifetime_tonnage_mgt": 420.0,
            "tonnage_since_last_maintenance_mgt": 85.0,
            "daily_train_count": 120,
            "daily_tonnage_mgt": 2.5,
            "inspection_score": 55,
            "rainfall_mm": 20.0,
            "temperature_mean_c": 32.0,
            "max_wind_speed_kmh": 30.0,
            "is_heavy_rain_day": False,
            "asset_type": "TRACK_CIRCUIT",
            "department": "TRD",
            "section_id": "SEC_001",

            # Model 2
            "planned_duration_minutes": 120,
            "severity_score": 8,
            "workers_required": 8,
            "equipment_count": 3,
            "workload_per_worker": 15.0,
            "weather_risk": 0.25,
            "congestion_score": 0.40,
            "current_delay_minutes": 10,
            "window_average_delay_minutes": 8,
            "window_peak_delay_minutes": 20,
            "accumulated_tonnage_mgt": 420.0,
            "trains_in_section": 12,
            "section_complexity": 0.70,
            "traffic_density": 0.80,
            "safety_critical": True,
            "is_heatwave_day": False,
            "is_rain_day": True,
            "request_hour": 10,
            "request_day_of_week": 1,
            "request_month": 9,
            "request_is_weekend": False,
            "work_type": "RAIL_REPLACEMENT",

            # Model 2B
            "location_km_marker": 12.5,
            "window_train_count": 25,

            # Model 3
            "planned_start_hour": 10,

            # Priority
            "priority": "MEDIUM",
        },
    },


    # ========================================================
    # REQUEST 2
    # ========================================================
    {
        "id": "TEST-002",
        "section_id": "SEC_001",
        "department": "TRD",
        "work_type": "SLEEPER_REPLACEMENT",
        "location_km": 14.0,

        "safety_critical": False,
        "equipment_ids": ["EQ-003"],

        "requires_power_isolation": False,
        "requires_disconnection": False,

        "earliest_start_minute": 480,
        "latest_end_minute": 900,

        "model_features": {
            # Model 1
            "asset_age_days": 2100,
            "days_since_last_maintenance": 150,
            "previous_failure_count": 1,
            "lifetime_tonnage_mgt": 350.0,
            "tonnage_since_last_maintenance_mgt": 70.0,
            "daily_train_count": 120,
            "daily_tonnage_mgt": 2.5,
            "inspection_score": 65,
            "rainfall_mm": 20.0,
            "temperature_mean_c": 32.0,
            "max_wind_speed_kmh": 30.0,
            "is_heavy_rain_day": False,
            "asset_type": "TRACK_CIRCUIT",
            "department": "TRD",
            "section_id": "SEC_001",

            # Model 2
            "planned_duration_minutes": 90,
            "severity_score": 6,
            "workers_required": 6,
            "equipment_count": 2,
            "workload_per_worker": 15.0,
            "weather_risk": 0.25,
            "congestion_score": 0.40,
            "current_delay_minutes": 8,
            "window_average_delay_minutes": 8,
            "window_peak_delay_minutes": 20,
            "accumulated_tonnage_mgt": 350.0,
            "trains_in_section": 12,
            "section_complexity": 0.70,
            "traffic_density": 0.80,
            "safety_critical": False,
            "is_heatwave_day": False,
            "is_rain_day": True,
            "request_hour": 10,
            "request_day_of_week": 1,
            "request_month": 9,
            "request_is_weekend": False,
            "work_type": "SLEEPER_REPLACEMENT",

            # Model 2B
            "location_km_marker": 14.0,
            "window_train_count": 25,

            # Model 3
            "planned_start_hour": 10,

            "priority": "MEDIUM",
        },
    },


    # ========================================================
    # REQUEST 3
    # ========================================================
    {
        "id": "TEST-003",
        "section_id": "SEC_001",
        "department": "TRD",
        "work_type": "BALLAST_REPAIR",
        "location_km": 15.5,

        "safety_critical": False,
        "equipment_ids": ["EQ-004"],

        "requires_power_isolation": False,
        "requires_disconnection": False,

        "earliest_start_minute": 480,
        "latest_end_minute": 900,

        "model_features": {
            # Model 1
            "asset_age_days": 1900,
            "days_since_last_maintenance": 120,
            "previous_failure_count": 1,
            "lifetime_tonnage_mgt": 300.0,
            "tonnage_since_last_maintenance_mgt": 60.0,
            "daily_train_count": 120,
            "daily_tonnage_mgt": 2.5,
            "inspection_score": 70,
            "rainfall_mm": 20.0,
            "temperature_mean_c": 32.0,
            "max_wind_speed_kmh": 30.0,
            "is_heavy_rain_day": False,
            "asset_type": "TRACK_CIRCUIT",
            "department": "TRD",
            "section_id": "SEC_001",

            # Model 2
            "planned_duration_minutes": 75,
            "severity_score": 5,
            "workers_required": 5,
            "equipment_count": 2,
            "workload_per_worker": 15.0,
            "weather_risk": 0.25,
            "congestion_score": 0.40,
            "current_delay_minutes": 6,
            "window_average_delay_minutes": 8,
            "window_peak_delay_minutes": 20,
            "accumulated_tonnage_mgt": 300.0,
            "trains_in_section": 12,
            "section_complexity": 0.70,
            "traffic_density": 0.80,
            "safety_critical": False,
            "is_heatwave_day": False,
            "is_rain_day": True,
            "request_hour": 10,
            "request_day_of_week": 1,
            "request_month": 9,
            "request_is_weekend": False,
            "work_type": "BALLAST_REPAIR",

            # Model 2B
            "location_km_marker": 15.5,
            "window_train_count": 25,

            # Model 3
            "planned_start_hour": 10,

            "priority": "MEDIUM",
        },
    },


    # ========================================================
    # REQUEST 4
    # ========================================================
    {
        "id": "TEST-004",
        "section_id": "SEC_001",
        "department": "TRD",
        "work_type": "WELD_REPAIR",
        "location_km": 17.0,

        "safety_critical": False,
        "equipment_ids": ["EQ-005"],

        "requires_power_isolation": False,
        "requires_disconnection": False,

        "earliest_start_minute": 480,
        "latest_end_minute": 900,

        "model_features": {
            # Model 1
            "asset_age_days": 1700,
            "days_since_last_maintenance": 100,
            "previous_failure_count": 0,
            "lifetime_tonnage_mgt": 260.0,
            "tonnage_since_last_maintenance_mgt": 50.0,
            "daily_train_count": 120,
            "daily_tonnage_mgt": 2.5,
            "inspection_score": 75,
            "rainfall_mm": 20.0,
            "temperature_mean_c": 32.0,
            "max_wind_speed_kmh": 30.0,
            "is_heavy_rain_day": False,
            "asset_type": "WELD",
            "department": "TRD",
            "section_id": "SEC_001",

            # Model 2
            "planned_duration_minutes": 60,
            "severity_score": 4,
            "workers_required": 4,
            "equipment_count": 1,
            "workload_per_worker": 15.0,
            "weather_risk": 0.25,
            "congestion_score": 0.40,
            "current_delay_minutes": 5,
            "window_average_delay_minutes": 8,
            "window_peak_delay_minutes": 20,
            "accumulated_tonnage_mgt": 260.0,
            "trains_in_section": 12,
            "section_complexity": 0.70,
            "traffic_density": 0.80,
            "safety_critical": False,
            "is_heatwave_day": False,
            "is_rain_day": True,
            "request_hour": 10,
            "request_day_of_week": 1,
            "request_month": 9,
            "request_is_weekend": False,
            "work_type": "WELD_REPAIR",

            # Model 2B
            "location_km_marker": 17.0,
            "window_train_count": 25,

            # Model 3
            "planned_start_hour": 10,

            "priority": "MEDIUM",
        },
    },
]


# ============================================================
# START TEST
# ============================================================

print("=" * 70)
print("RAILNEXUS END-TO-END PIPELINE TEST")
print("=" * 70)

print("\nLoading models...")

pipeline = ModelPipeline()

print("Models loaded successfully.")


# ============================================================
# STEP 1 — SCORE EACH REQUEST
# ============================================================

print("\n" + "=" * 70)
print("STEP 1 — ML MODEL PREDICTIONS")
print("=" * 70)

scored_requests = []

for request in requests:

    scored = pipeline.score_request(request)
    scored_requests.append(scored)

    print("\n" + "-" * 70)
    print(f"REQUEST: {scored.id}")
    print("-" * 70)

    print(f"Section            : {scored.section_id}")
    print(f"Work Type          : {scored.work_type}")
    print(f"Location           : {scored.location_km:.1f} km")

    print(
        f"Failure Risk       : "
        f"{scored.failure_risk_probability:.4f} "
        f"({scored.failure_risk_probability:.2%})"
    )

    print(
        f"Priority           : "
        f"{scored.priority}"
    )

    print(
        f"Predicted Duration : "
        f"{scored.predicted_duration_minutes:.2f} min"
    )

    print(
        f"Overrun Probability: "
        f"{scored.overrun_probability:.4f} "
        f"({scored.overrun_probability:.2%})"
    )

    print(
        f"Affected Trains    : "
        f"{scored.trains_affected:.0f}"
    )

    print(
        f"Expected Delay     : "
        f"{scored.train_impact_minutes:.2f} min"
    )


# ============================================================
# STEP 2 — RUN CP-SAT
# ============================================================

print("\n" + "=" * 70)
print("STEP 2 — CP-SAT SHADOW BLOCK OPTIMIZATION")
print("=" * 70)

print("\nSubmitting 4 requests to CP-SAT...")

result = pipeline.optimize(
    requests,
    max_group_size=4,
    max_spatial_gap_km=5.0,
)


# ============================================================
# STEP 3 — FINAL RESULT
# ============================================================

print("\n" + "=" * 70)
print("STEP 3 — FINAL OPTIMIZATION RESULT")
print("=" * 70)

print("\nSelected Shadow Blocks:")
print("-" * 70)

if result["selected_blocks"]:

    for block in result["selected_blocks"]:

        print(f"\nBlock: {block}")

else:

    print("No blocks selected.")


print("\nUngrouped Requests:")
print("-" * 70)

print(result["ungrouped_request_ids"])


print("\nRejected Pairs:")
print("-" * 70)

print(result["rejected_pairs"])


# ============================================================
# STEP 4 — TOTALS
# ============================================================

print("\n" + "=" * 70)
print("OPTIMIZATION SUMMARY")
print("=" * 70)

totals = result["totals"]

print(
    f"Separate Duration : "
    f"{totals['separate_duration_minutes']:.2f} min"
)

print(
    f"Optimized Duration: "
    f"{totals['optimized_duration_minutes']:.2f} min"
)

print(
    f"Possession Saving : "
    f"{totals['possession_saving_minutes']:.2f} min"
)

print(
    f"Separate Blocks   : "
    f"{totals['separate_block_count']:.0f}"
)

print(
    f"Optimized Blocks  : "
    f"{totals['optimized_block_count']:.0f}"
)

print(
    f"Scheduled Blocks  : "
    f"{totals['scheduled_block_count']:.0f}"
)

print(
    f"Solver            : "
    f"{totals['solver']}"
)


# ============================================================
# STEP 5 — MODEL OUTPUT SUMMARY
# ============================================================

print("\n" + "=" * 70)
print("MODEL OUTPUT SUMMARY")
print("=" * 70)

for request_id, output in result["model_outputs"].items():

    print(f"\n{request_id}")

    print(
        f"  Failure Risk    : "
        f"{output['failure_risk_probability']:.2%}"
    )

    print(
        f"  Priority Score  : "
        f"{output['priority_score']:.2f}"
    )

    print(
        f"  Urgency         : "
        f"{output['urgency_level']}"
    )

    print(
        f"  Duration        : "
        f"{output['predicted_duration_minutes']:.2f} min"
    )

    print(
        f"  Overrun Risk    : "
        f"{output['overrun_probability']:.2%}"
    )

    print(
        f"  Affected Trains : "
        f"{output['trains_affected']:.0f}"
    )

    print(
        f"  Expected Delay  : "
        f"{output['train_impact_minutes']:.2f} min"
    )


print("\n" + "=" * 70)
print("END-TO-END TEST COMPLETE")
print("=" * 70)