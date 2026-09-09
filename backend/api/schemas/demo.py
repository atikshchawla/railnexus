from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


Department = Literal["TMS", "TDMS", "SMMS"]
RequestType = Literal["running_status", "section_entry", "maintenance_block"]
DecisionStatus = Literal["queued", "approved", "rerouted", "rejected"]
ResultingState = Literal["clear", "occupied", "maintenance", "reserved"]


class DemoRequest(BaseModel):
    request_id: UUID
    department: Department
    type: RequestType
    train_id: str | None
    section_id: str
    description: str
    raised_at: datetime


class DemoDecision(BaseModel):
    request_id: UUID
    status: DecisionStatus
    section_id: str
    resulting_state: ResultingState
    decided_at: datetime
    notes: str | None = None


class DemoIntegrationRead(DemoRequest):
    model_config = ConfigDict(from_attributes=True)

    status: str
    resulting_state: str | None
    maintenance_request_id: str | None
    decided_at: datetime | None
    created_at: datetime
