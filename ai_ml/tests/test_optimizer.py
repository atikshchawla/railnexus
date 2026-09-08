from ai_ml.optimizer import CorridorWindow, MaintenanceRequest, check_compatibility, derive_priority, optimize_requests


def request(request_id: str, km: float, department: str = "ENGG") -> MaintenanceRequest:
    return MaintenanceRequest(request_id, "SEC-01", department, "INSPECTION", km, 60.0)


def test_groups_compatible_requests_and_reports_savings():
    result = optimize_requests([request("R1", 10), request("R2", 11), request("R3", 12, "TRD")])
    assert len(result.selected_blocks) == 1
    assert result.selected_blocks[0].request_ids == ["R1", "R2", "R3"]
    assert result.totals["possession_saving_minutes"] > 0


def test_rejects_distant_requests():
    compatibility = check_compatibility(request("R1", 10), request("R2", 20))
    assert not compatibility.compatible
    assert "outside_spatial_window" in compatibility.reasons


def test_does_not_group_shared_equipment():
    left = MaintenanceRequest("R1", "SEC-01", "ENGG", "WORK", 10, 60, equipment_ids=("TAMPER-1",))
    right = MaintenanceRequest("R2", "SEC-01", "TRD", "WORK", 11, 60, equipment_ids=("TAMPER-1",))
    result = optimize_requests([left, right])
    assert result.selected_blocks == []
    assert result.ungrouped_request_ids == ["R1", "R2"]


def test_priority_is_derived_from_risk_and_deadline():
    low = request("LOW", 10)
    urgent = MaintenanceRequest(
        "URGENT", "SEC-01", "ENGG", "WORK", 10, 60,
        safety_critical=True, failure_risk_probability=0.9, deadline_minutes=60,
    )
    assert derive_priority(urgent)[0] > derive_priority(low)[0]
    assert derive_priority(urgent)[1] == "critical"


def test_selected_blocks_receive_non_overlapping_schedule():
    result = optimize_requests(
        [request("R1", 10), request("R2", 11), request("R3", 12, "TRD")],
        max_group_size=2,
        corridors=[CorridorWindow("morning", "SEC-01", 600, 900)],
    )
    assert result.unscheduled_block_ids == []
    assert all(block.scheduled_start_minute is not None for block in result.selected_blocks)
    assert all(block.scheduled_end_minute > block.scheduled_start_minute for block in result.selected_blocks)