from typing import Annotated

from fastapi import APIRouter, Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from eriknar.db.session import get_session
from eriknar.leads.enums import LeadSource
from eriknar.leads.schemas import (
    CreateLeadCommand,
    CreateLeadRequest,
    CreateLeadResponse,
)
from eriknar.leads.service import LeadService

router = APIRouter(prefix="/leads", tags=["leads"])


def get_lead_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> LeadService:
    return LeadService(session)


@router.post("", response_model=CreateLeadResponse, status_code=201)
async def create_lead(
    request: CreateLeadRequest,
    idempotency_key: Annotated[
        str,
        Header(
            alias="Idempotency-Key",
            min_length=1,
            max_length=128,
            description="Уникальный UUID одной попытки отправки формы",
        ),
    ],
    service: Annotated[LeadService, Depends(get_lead_service)],
) -> CreateLeadResponse:
    result = await service.create(
        CreateLeadCommand(
            **request.model_dump(),
            source=LeadSource.WEBSITE,
        ),
        idempotency_key,
    )
    return CreateLeadResponse(public_id=result.public_id, status=result.status)
