from sqlalchemy.orm import Session

from ai_ml.optimizer import derive_priority
from backend.database.models.prediction import Prediction
from backend.database.models.maintenance import MaintenanceRequest
from backend.services.maintenance_service import MaintenanceService
from backend.services.pipeline_loader import get_pipeline


class PredictionService:
    def predict(self, db: Session, request: MaintenanceRequest) -> Prediction:
        pipeline = get_pipeline()
        if pipeline is None:
            raise RuntimeError("AI/ML pipeline is unavailable")
        scored = pipeline.score_request(MaintenanceService.to_pipeline_request(request))
        score, urgency = derive_priority(scored)
        output = {
            "failure_risk_probability": scored.failure_risk_probability,
            "priority_score": score,
            "urgency_level": urgency,
            "predicted_duration_minutes": scored.predicted_duration_minutes,
            "overrun_probability": scored.overrun_probability,
            "trains_affected": scored.trains_affected,
            "total_delay_minutes": scored.train_impact_minutes,
        }
        prediction = Prediction(
            maintenance_request_id=request.id,
            failure_risk_probability=output["failure_risk_probability"],
            priority_score=output["priority_score"],
            urgency_level=output["urgency_level"],
            predicted_duration_minutes=output["predicted_duration_minutes"],
            overrun_probability=output["overrun_probability"],
            trains_affected=output["trains_affected"],
            total_delay_minutes=output["total_delay_minutes"],
            raw_output=output,
        )
        db.add(prediction)
        db.commit()
        db.refresh(prediction)
        return prediction
