from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from eriknar.db.session import get_session
from eriknar.leads.admin_schemas import (
    AdminLeadDetail,
    AssignLeadCommand,
    ChangeLeadStatusCommand,
    LeadPage,
)
from eriknar.leads.admin_service import AdminLeadService
from eriknar.leads.enums import LeadStatus
from eriknar.users.dependencies import require_admin, require_manager_or_admin
from eriknar.users.models import User

router = APIRouter(prefix="/admin/leads", tags=["admin-leads"])


def get_admin_lead_service(
    session: Annotated[AsyncSession, Depends(get_session, use_cache=False)],
) -> AdminLeadService:
    return AdminLeadService(session)


Actor = Annotated[User, Depends(require_manager_or_admin)]
Admin = Annotated[User, Depends(require_admin)]
Service = Annotated[AdminLeadService, Depends(get_admin_lead_service)]


@router.get("", response_model=LeadPage)
async def list_leads(
    actor: Actor,
    service: Service,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    status: LeadStatus | None = None,
    assigned_to_user_id: UUID | None = None,
    unassigned: bool = False,
) -> LeadPage:
    del actor
    return await service.list(
        page=page,
        page_size=page_size,
        status=status,
        assigned_to_user_id=assigned_to_user_id,
        unassigned=unassigned,
    )


@router.get("/{lead_id}", response_model=AdminLeadDetail)
async def get_lead(lead_id: UUID, actor: Actor, service: Service) -> AdminLeadDetail:
    del actor
    return await service.get(lead_id)


@router.post("/{lead_id}/claim", response_model=AdminLeadDetail)
async def claim_lead(lead_id: UUID, actor: Actor, service: Service) -> AdminLeadDetail:
    return await service.claim(lead_id, actor)


@router.patch("/{lead_id}/status", response_model=AdminLeadDetail)
async def change_lead_status(
    lead_id: UUID,
    payload: ChangeLeadStatusCommand,
    actor: Actor,
    service: Service,
) -> AdminLeadDetail:
    return await service.change_status(lead_id, payload, actor)


@router.patch("/{lead_id}/assignee", response_model=AdminLeadDetail)
async def assign_lead(
    lead_id: UUID,
    payload: AssignLeadCommand,
    admin: Admin,
    service: Service,
) -> AdminLeadDetail:
    return await service.assign(lead_id, payload, admin)
