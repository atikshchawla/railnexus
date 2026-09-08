import datetime
from typing import Literal

def derive_urgency_tier(time_to_breach_hours: float | None) -> Literal["critical", "warning", "caution", "routine"]:
    """
    R1: 
    <24h = critical
    24-72h = warning
    72-168h = caution
    else/null = routine
    """
    if time_to_breach_hours is None:
        return "routine"
    if time_to_breach_hours < 24:
        return "critical"
    if time_to_breach_hours <= 72:
        return "warning"
    if time_to_breach_hours <= 168:
        return "caution"
    return "routine"

def is_batch_eligible(block: dict) -> bool:
    """
    R2: A block is only batch-eligible if it has no unresolved conflict.
    """
    conflict = block.get("conflict")
    if conflict and conflict.get("status") == "Unresolved":
        return False
    return True

def create_audit_entry(actor: str, role: str, action: str, agreed_with_ai: bool | None = None, notes: str | None = None) -> dict:
    """
    Standardized audit entry creator.
    """
    entry = {
        "actor": actor,
        "role": role,
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
        "action": action,
        "agreedWithAI": agreed_with_ai,
    }
    if notes:
        entry["notes"] = notes
    return entry
