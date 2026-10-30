from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from eriknar.leads.enums import LeadSource, LeadStatus
from eriknar.leads.schemas import LeadSnapshot


class AssigneeView(BaseModel):
    id: UUID
    name: str


class LeadHistoryView(BaseModel):
    id: UUID
    action: str
    actor: AssigneeView | None
    previous_status: LeadStatus | None
    new_status: LeadStatus | None
    previous_assignee_id: UUID | None
    new_assignee_id: UUID | None
    comment: str
    created_at: datetime


class AdminLeadView(BaseModel):
    id: UUID
    public_id: UUID
    number: int
    source: LeadSource
    status: LeadStatus
    customer_name: str
    customer_phone: str
    comment: str
    snapshot: LeadSnapshot | None
    assigned_to: AssigneeView | None
    assigned_at: datetime | None
    closed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class AdminLeadDetail(AdminLeadView):
    history: list[LeadHistoryView]


class LeadPage(BaseModel):
    items: list[AdminLeadView]
    page: int
    page_size: int
    total: int


class ChangeLeadStatusCommand(BaseModel):
    expected_updated_at: datetime
    status: LeadStatus
    comment: str = Field(default="", max_length=1000)


class AssignLeadCommand(BaseModel):
    expected_updated_at: datetime
    user_id: UUID | None
    comment: str = Field(default="", max_length=1000)
