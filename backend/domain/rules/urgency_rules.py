"""Canonical rules for urgency tier derivation and defect category upgrades."""

from __future__ import annotations

from backend.domain.enums import Category, UrgencyTier
from backend.domain.rules.policy_config import DEFAULT_POLICY, DomainPolicyConfig


def derive_urgency_tier(time_to_breach_hours: float | None) -> UrgencyTier:
    """Derive operational urgency tier from statutory SLA breach clock (BR-004).

    - None: routine (e.g. predictive maintenance without immediate breach clock)
    - < 24 hours: critical
    - 24 - 72 hours: warning
    - 72 - 168 hours: caution (3 to 7 days)
    - > 168 hours: routine
    """
    if time_to_breach_hours is None:
        return UrgencyTier.ROUTINE
    if time_to_breach_hours < 0:
        # Breached SLA is critical
        return UrgencyTier.CRITICAL
    if time_to_breach_hours < 24.0:
        return UrgencyTier.CRITICAL
    if time_to_breach_hours <= 72.0:
        return UrgencyTier.WARNING
    if time_to_breach_hours <= 168.0:
        return UrgencyTier.CAUTION
    return UrgencyTier.ROUTINE


def should_upgrade_obs_to_imr(
    distance_meters: float,
    policy: DomainPolicyConfig = DEFAULT_POLICY,
) -> bool:
    """Check if two adjacent OBS rail defects require statutory upgrade to IMR (BR-002).

    Source: USFD Manual (RDSO 2022 Revised Edition):
    If two or more OBS/OBSW defects are within 4.0 metres of each other,
    they are upgraded to IMR/IMRW.
    """
    return distance_meters <= policy.obs_upgrade_proximity_meters


def get_statutory_sla_hours(
    category: Category,
    policy: DomainPolicyConfig = DEFAULT_POLICY,
) -> int | None:
    """Get the statutory maximum resolution timeline in hours (BR-001).

    - IMR: Replaced within 3 days (72 hours). Speed restriction 30 km/h.
    - OBS: Clamped fish plates provided within 3 days (72 hours).
    - PM: System-defined predictive telemetry; no fixed USFD manual deadline.
    """
    if category == Category.IMR:
        return policy.imr_replacement_sla_hours
    if category == Category.OBS:
        return policy.imr_replacement_sla_hours  # 3 days for joggled fish plates
    return None
