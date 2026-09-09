from ai_ml.optimizer import MaintenanceRequest
from ai_ml.pipeline import ModelPipeline


def test_score_request_uses_derived_priority_for_downstream_models(monkeypatch):
    pipeline = ModelPipeline.__new__(ModelPipeline)
    observed_priorities = []

    monkeypatch.setattr(pipeline, "predict_failure_risk", lambda features: 0.4533)

    def predict_duration(features):
        observed_priorities.append(features["priority"])
        return 120.0

    def predict_overrun_risk(features):
        observed_priorities.append(features["priority"])
        return 0.2

    monkeypatch.setattr(pipeline, "predict_duration", predict_duration)
    monkeypatch.setattr(pipeline, "predict_overrun_risk", predict_overrun_risk)
    monkeypatch.setattr(pipeline, "predict_impact", lambda features: (14.0, 138.71))

    scored = pipeline.score_request({
        "id": "R1",
        "section_id": "SEC-01",
        "department": "ENGG",
        "work_type": "INSPECTION",
        "location_km": 10.0,
        "priority": "HIGH",
        "safety_critical": True,
        "model_features": {"priority": "HIGH"},
    })

    assert observed_priorities == ["MEDIUM", "MEDIUM"]
    assert scored.priority == "MEDIUM"
    assert scored.trains_affected == 14.0
    assert scored.train_impact_minutes == 138.71


def test_optimize_exposes_both_train_impact_predictions(monkeypatch):
    pipeline = ModelPipeline.__new__(ModelPipeline)
    scored_request = MaintenanceRequest(
        id="R1", section_id="SEC-01", department="ENGG", work_type="INSPECTION",
        location_km=10.0, predicted_duration_minutes=60.0,
        trains_affected=14.0, train_impact_minutes=138.71,
    )
    monkeypatch.setattr(pipeline, "score_request", lambda request: scored_request)

    monkeypatch.setattr(
        "ai_ml.pipeline.optimize_requests",
        lambda requests, **kwargs: type("Result", (), {"to_dict": lambda self: {}})(),
    )

    result = pipeline.optimize([{}])

    assert result["model_outputs"]["R1"]["trains_affected"] == 14.0
    assert result["model_outputs"]["R1"]["train_impact_minutes"] == 138.71