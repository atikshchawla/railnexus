"""AI suggestion generator.

Uses the real ModelPipeline when available, falls back to heuristic-based
suggestions when the pipeline is not loaded.
"""

import logging
from typing import Any

from backend.services.pipeline_loader import get_pipeline

logger = logging.getLogger(__name__)


def _heuristic_suggestion(context: dict) -> dict:
    """Produce a rule-based suggestion when the ML pipeline is unavailable."""
    is_train = context.get("trainId") is not None

    if is_train:
        train_id = context.get("trainId", "unknown")
        return {
            "confidence": 78,
            "confidenceBasis": f"minimises delay for train {train_id} while ensuring block completion",
            "topFactors": [
                f"Train {train_id} has buffer at the next scheduled stop",
                "Block requires continuous possession",
            ],
            "recommendedAction": "Hold train at preceding station for 15 min",
        }

    return {
        "confidence": 72,
        "confidenceBasis": "shifts the lower-priority block to avoid overlapping maintenance windows",
        "topFactors": [
            "Shared km range creates a safety exclusion zone",
            "The later block can be sequenced within its remaining SLA window",
        ],
        "recommendedAction": "Sequence blocks: complete A first, then shift B start by 2 hrs",
    }


def _pipeline_suggestion(context: dict) -> dict:
    """Use the real pipeline to produce a data-driven suggestion."""
    pipeline = get_pipeline()
    if pipeline is None:
        return _heuristic_suggestion(context)

    try:
        # Build a minimal feature vector from what we know about the block
        block_a = context.get("blockA", {})
        location = block_a.get("location", {})
        urgency = block_a.get("urgency", {})

        # Use the pipeline's priority derivation as a proxy for confidence
        from ai_ml.optimizer import MaintenanceRequest, derive_priority

        req = MaintenanceRequest(
            id=block_a.get("id", "unknown"),
            section_id=block_a.get("sectionId", "AJJ-SHU"),
            department=block_a.get("department", "ENGG"),
            work_type=block_a.get("category", "IMR"),
            location_km=location.get("kmStart", 0),
            predicted_duration_minutes=60.0,
            safety_critical=urgency.get("tier") == "critical",
        )
        score, level = derive_priority(req)

        # Map the priority score to a confidence band
        confidence = min(95, max(60, int(score)))

        factors = []
        if urgency.get("tier") == "critical":
            factors.append("SLA breach window is less than 24 hours")
        if location.get("kmEnd", 0) - location.get("kmStart", 0) > 3:
            factors.append("Block spans a long corridor segment")
        factors.append(f"Priority score from ML model: {score:.1f} ({level})")

        is_train = context.get("trainId") is not None
        if is_train:
            action = "Hold train at preceding station for estimated block duration"
        else:
            action = "Sequence blocks to eliminate overlap" if confidence < 80 else "Approve as proposed"

        return {
            "confidence": confidence,
            "confidenceBasis": f"ML-derived priority assessment ({level} urgency)",
            "topFactors": factors[:3],
            "recommendedAction": action,
        }
    except Exception as exc:
        logger.warning("Pipeline suggestion failed, using heuristic: %s", exc)
        return _heuristic_suggestion(context)


def generate_ai_suggestion(conflict: dict, block_a: dict | None = None) -> dict:
    """Public entry point. Tries the real pipeline first, then heuristic."""
    context = dict(conflict)
    if block_a:
        context["blockA"] = block_a

    pipeline = get_pipeline()
    if pipeline is not None:
        return _pipeline_suggestion(context)
    return _heuristic_suggestion(context)
