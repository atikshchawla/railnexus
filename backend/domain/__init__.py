"""RailNexus ABP — Pure Domain Foundation Layer.

Independent of database, HTTP frameworks, OR-Tools, ML models, or UI clients.
"""

from backend.domain.enums import (
    Category,
    ConflictSeverity,
    ConflictStatus,
    ConflictType,
    Department,
    MaintenanceStatus,
    OperationalBlockStatus,
    Priority,
    ResolutionAction,
    SourceSystem,
    TrackLine,
    UrgencyTier,
)
from backend.domain.exceptions import (
    ApprovalBlockedByConflictError,
    DomainError,
    InvalidKmRangeError,
    InvalidStateTransitionError,
    InvalidTimeWindowError,
    MissingOverrideReasonError,
    SpatialThresholdExceededError,
    UnauthorizedDomainActionError,
)
from backend.domain.value_objects import KmRange, TimeWindow, normalize_department
from backend.domain.entities import (
    Conflict,
    MaintenanceRequest,
    ManualOverride,
    OperationalBlock,
)
from backend.domain.rules import (
    DEFAULT_POLICY,
    DomainPolicyConfig,
    assert_can_approve_operational_block,
    assert_spatial_cluster_valid,
    assert_valid_manual_override,
    derive_urgency_tier,
    find_blocking_conflicts,
    get_statutory_sla_hours,
    should_upgrade_obs_to_imr,
)
from backend.domain.state_machines import (
    assert_valid_block_transition,
    assert_valid_maintenance_transition,
    can_transition_block,
    can_transition_maintenance,
)

__all__ = [
    # Enums
    "Category",
    "ConflictSeverity",
    "ConflictStatus",
    "ConflictType",
    "Department",
    "MaintenanceStatus",
    "OperationalBlockStatus",
    "Priority",
    "ResolutionAction",
    "SourceSystem",
    "TrackLine",
    "UrgencyTier",
    # Exceptions
    "ApprovalBlockedByConflictError",
    "DomainError",
    "InvalidKmRangeError",
    "InvalidStateTransitionError",
    "InvalidTimeWindowError",
    "MissingOverrideReasonError",
    "SpatialThresholdExceededError",
    "UnauthorizedDomainActionError",
    # Value Objects
    "KmRange",
    "TimeWindow",
    "normalize_department",
    # Entities
    "Conflict",
    "MaintenanceRequest",
    "ManualOverride",
    "OperationalBlock",
    # Rules
    "DEFAULT_POLICY",
    "DomainPolicyConfig",
    "assert_can_approve_operational_block",
    "assert_spatial_cluster_valid",
    "assert_valid_manual_override",
    "derive_urgency_tier",
    "find_blocking_conflicts",
    "get_statutory_sla_hours",
    "should_upgrade_obs_to_imr",
    # State Machines
    "assert_valid_block_transition",
    "assert_valid_maintenance_transition",
    "can_transition_block",
    "can_transition_maintenance",
]
