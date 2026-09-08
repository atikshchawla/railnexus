from fastapi.testclient import TestClient

from backend.main import app


def test_optimize_endpoint_returns_combined_plan():
    client = TestClient(app)
    response = client.post("/optimize", json={
        "requests": [
            {"id": "R1", "section_id": "SEC-01", "department": "ENGG", "work_type": "INSPECTION", "location_km": 10, "predicted_duration_minutes": 60},
            {"id": "R2", "section_id": "SEC-01", "department": "TRD", "work_type": "OHE_INSPECTION", "location_km": 11, "predicted_duration_minutes": 55},
        ],
    })
    assert response.status_code == 200
    body = response.json()
    assert body["totals"]["optimized_block_count"] == 1.0
    assert body["selected_blocks"][0]["request_ids"] == ["R1", "R2"]


def test_shadow_endpoint_explains_incompatibility():
    client = TestClient(app)
    response = client.post("/shadow-blocks", json={
        "requests": [
            {"id": "R1", "section_id": "SEC-01", "department": "ENGG", "work_type": "WORK", "location_km": 10, "predicted_duration_minutes": 60},
            {"id": "R2", "section_id": "SEC-01", "department": "TRD", "work_type": "WORK", "location_km": 20, "predicted_duration_minutes": 60},
        ],
    })
    assert response.status_code == 200
    assert "outside_spatial_window" in response.json()["opportunities"][0]["reasons"]