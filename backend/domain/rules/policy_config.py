"""Configurable policy parameters for RailNexus ABP.

In accordance with the Domain Governance Protocol (.agents/rules/domain-governance.md),
engineering thresholds and operational buffers that are not immutable statutory laws
are managed as configurable policies with sensible defaults.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class DomainPolicyConfig:
    """Configurable domain policy values with documented defaults."""
    # Spatial clustering: maximum distance between tasks for single-block integration (DA-001)
    max_spatial_gap_km: float = 5.0

    # Statutory USFD replacement SLA: 3 days = 72 hours (BR-001, Tier-1)
    imr_replacement_sla_hours: int = 72

    # Statutory USFD OBS proximity upgrade limit: 4.0 meters (BR-002, Tier-1)
    obs_upgrade_proximity_meters: float = 4.0

    # Statutory IMR speed restriction: 30 km/h (BR-001, Tier-1)
    imr_speed_restriction_kmh: int = 30

    # Operational buffer for TRD 25 kV AC de-energization and PTW issuance (DA-002)
    power_isolation_buffer_minutes: int = 15

    # Operational setup overhead: flag placement, detonator protection (DA-004)
    possession_setup_minutes: float = 10.0

    # Operational clearance overhead: track inspection, machine travel (DA-004)
    possession_clearance_minutes: float = 10.0

    # Additional clearance padding per extra machine in integrated blocks (DA-004)
    extra_machine_clearance_minutes: float = 3.0


# Default global policy configuration instance
DEFAULT_POLICY = DomainPolicyConfig()
