from ai_ml.optimizer import check_compatibility
from backend.database.models.maintenance import MaintenanceRequest


def compare_requests(requests: list[MaintenanceRequest], max_spatial_gap_km: float) -> list[dict]:
    opportunities = []
    for index, request in enumerate(requests):
        for other in requests[index + 1:]:
            result = check_compatibility(
                _to_domain(request), _to_domain(other), max_spatial_gap_km=max_spatial_gap_km
            )
            opportunities.append({
                "request_ids": [request.id, other.id],
                "compatible": result.compatible,
                "reasons": result.reasons,
                "cautions": result.cautions,
            })
    return opportunities


def _to_domain(request: MaintenanceRequest):
    from ai_ml.optimizer import MaintenanceRequest as DomainRequest

    data = request.request_data or {}
    return DomainRequest(
        id=request.id, section_id=request.section_id, department=request.department,
        work_type=request.work_type, location_km=request.location_km,
        predicted_duration_minutes=float(data.get("predicted_duration_minutes", 1.0)),
        priority=request.priority, safety_critical=request.safety_critical,
        deadline_minutes=request.deadline_minutes,
    )
