"""Canonical domain enumerations for RailNexus ABP.

All domain states, departments, categories, and severity tiers are defined here.
Zero loose string literals in domain logic.
"""

from __future__ import annotations

from enum import Enum


class Department(str, Enum):
    """Indian Railways primary operational engineering departments."""
    ENGG = "ENGG"      # Engineering (Civil / Permanent Way)
    TRD = "TRD"        # Traction Distribution (Overhead Electrification / PSI)
    SNT = "S&T"        # Signal & Telecommunication

    @classmethod
    def from_str(cls, value: str) -> Department:
        """Normalize varied representations (e.g. 'Engg', 's&t', 'snt', 'ENGINEERING')."""
        normalized = value.strip().upper()
        if normalized in ("ENGG", "ENGINEERING", "CIVIL", "PWAY", "P.WAY"):
            return cls.ENGG
        if normalized in ("TRD", "TRACTION", "ELECTRICAL"):
            return cls.TRD
        if normalized in ("S&T", "SNT", "SIGNAL", "SIGNALLING"):
            return cls.SNT
        raise ValueError(f"Unknown railway department: {value}")


class Category(str, Enum):
    """Defect/Task classification categories.

    - IMR: Immediate Removal (Tier-1 USFD defect, replacement SLA 3 days)
    - OBS: Observe (Tier-1 USFD defect, clamped fish plates 3 days)
    - PM: Predictive Maintenance (System-defined, sensor/ML telemetry)
    """
    IMR = "IMR"
    OBS = "OBS"
    PM = "PM"

    @classmethod
    def from_str(cls, value: str) -> Category:
        normalized = value.strip().upper()
        if "IMR" in normalized:
            return cls.IMR
        if "OBS" in normalized:
            return cls.OBS
        if "PM" in normalized or "PREDICTIVE" in normalized:
            return cls.PM
        raise ValueError(f"Unknown defect category: {value}")


class UrgencyTier(str, Enum):
    """Derived urgency tier based on SLA time-to-breach hours."""
    CRITICAL = "critical"  # < 24 hours
    WARNING = "warning"    # 24 - 72 hours
    CAUTION = "caution"    # 72 - 168 hours (3 - 7 days)
    ROUTINE = "routine"    # > 168 hours or null SLA


class Priority(str, Enum):
    """Operational priority ranking."""
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class TrackLine(str, Enum):
    """Track direction designation in Indian Railways territory."""
    UP = "UP"
    DN = "DN"
    BOTH = "UP/DN"


class SourceSystem(str, Enum):
    """CRIS and field data origin systems."""
    TMS = "TMS"      # Track Management System (Civil / P-Way)
    SMMS = "SMMS"    # Signalling Maintenance Management System (S&T)
    TDMS = "TDMS"    # Traction Distribution Management System (TRD)
    COA = "COA"      # Control Office Application (Operating)
    MANUAL = "MANUAL"

    @classmethod
    def for_department(cls, department: Department) -> SourceSystem:
        """Return the authoritative CRIS source system for a department."""
        if department == Department.ENGG:
            return cls.TMS
        if department == Department.SNT:
            return cls.SMMS
        if department == Department.TRD:
            return cls.TDMS
        return cls.COA


class MaintenanceStatus(str, Enum):
    """Lifecycle states of a department MaintenanceRequest."""
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    VALIDATED = "VALIDATED"
    PROPOSED = "PROPOSED"
    APPROVED = "APPROVED"
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    CLOSED = "CLOSED"
    REJECTED = "REJECTED"
    DEFERRED = "DEFERRED"


class OperationalBlockStatus(str, Enum):
    """Lifecycle states of an OperationalBlock possession granted by Section Controller."""
    PROPOSED = "PROPOSED"
    UNDER_REVIEW = "UNDER_REVIEW"
    APPROVED = "APPROVED"
    ACTIVE = "ACTIVE"
    CLEARED = "CLEARED"
    CLOSED = "CLOSED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class ConflictStatus(str, Enum):
    """Status of an operational conflict."""
    UNRESOLVED = "UNRESOLVED"
    RESOLVED = "RESOLVED"
    ESCALATED = "ESCALATED"


class ConflictSeverity(str, Enum):
    """Severity tier of an operational conflict."""
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class ConflictType(str, Enum):
    """Category of operational conflict."""
    TRAIN_CROSSING = "TRAIN_CROSSING"            # Train path intersects block window on same line
    SECTION_OCCUPATION = "SECTION_OCCUPATION"    # Two blocks demand the same physical line simultaneously
    RESOURCE_COLLISION = "RESOURCE_COLLISION"    # Shared machinery (e.g. Tamper) double-booked
    POWER_INTERLOCK = "POWER_INTERLOCK"          # Electric traffic scheduled during de-energized OHE block


class ResolutionAction(str, Enum):
    """Permitted conflict resolution methods."""
    MERGED = "MERGED"          # Integrated into a single combined possession
    SEQUENCED = "SEQUENCED"    # Time-shifted to follow previous movement
    REROUTED = "REROUTED"      # Train diverted to alternate loop/chord line
    ESCALATED = "ESCALATED"    # Escalated to Sr. DOM for executive decision
