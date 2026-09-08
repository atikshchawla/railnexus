import random

def generate_ai_suggestion(conflict: dict) -> dict:
    """
    Generates an AISuggestion for a given conflict.
    In a real system, this would call the ML inference service.
    """
    is_train = conflict.get("trainId") is not None
    
    if is_train:
        train_id = conflict.get("trainId")
        return {
            "confidence": random.randint(75, 95),
            "confidenceBasis": f"minimizes delay for {train_id} while ensuring block completion",
            "topFactors": [
                f"Train {train_id} has sufficient buffer at next station",
                "Block requires continuous power isolation"
            ],
            "recommendedAction": "Hold train at station for 15m"
        }
    else:
        return {
            "confidence": random.randint(70, 92),
            "confidenceBasis": "shifts lower priority block to avoid overlapping maintenance",
            "topFactors": [
                "Shared km point creates safety hazard",
                "Can be sequenced safely within remaining SLA"
            ],
            "recommendedAction": "Shift start by 2 hrs"
        }
