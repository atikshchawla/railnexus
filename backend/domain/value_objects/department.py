"""Department helpers and cross-department compatibility rules."""

from __future__ import annotations

from backend.domain.enums import Department


def normalize_department(value: str | Department) -> Department:
    """Normalize any string or Department enum into canonical Department enum."""
    if isinstance(value, Department):
        return value
    return Department.from_str(value)


def check_department_safety_requirements(
    departments: set[Department],
    requires_power_isolation: bool = False,
    requires_disconnection: bool = False,
) -> list[str]:
    """Identify statutory interlock requirements for a multi-department possession."""
    cautions: list[str] = []
    if Department.TRD in departments or requires_power_isolation:
        cautions.append("TRD_POWER_ISOLATION_REQUIRED")
    if Department.SNT in departments or requires_disconnection:
        cautions.append("SNT_DISCONNECTION_MEMO_REQUIRED")
    if len(departments) > 1:
        cautions.append("MULTI_DEPARTMENT_COORDINATION_REQUIRED")
    return sorted(cautions)
