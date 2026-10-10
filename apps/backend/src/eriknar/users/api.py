from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from eriknar.core.config import Settings, get_settings
from eriknar.db.session import get_session
from eriknar.users.dependencies import get_current_user, require_admin
from eriknar.users.models import User
from eriknar.users.schemas import (
    CreateEmployeeCommand,
    LoginRequest,
    TokenResponse,
    UpdateEmployeeCommand,
    UserView,
)
from eriknar.users.security import create_access_token
from eriknar.users.service import AuthService, EmployeeService

router = APIRouter(tags=["auth"])


def get_employee_service(
    session: Annotated[AsyncSession, Depends(get_session, use_cache=False)],
) -> EmployeeService:
    return EmployeeService(session)


@router.post("/auth/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> TokenResponse:
    client_ip = request.client.host if request.client is not None else "unknown"
    user = await AuthService(session, settings, client_ip).authenticate(
        payload.login, payload.password
    )
    return TokenResponse(access_token=create_access_token(user, settings))


@router.get("/auth/me", response_model=UserView)
async def me(user: Annotated[User, Depends(get_current_user)]) -> User:
    return user


@router.post("/admin/users", response_model=UserView, status_code=201, tags=["admin-users"])
async def create_employee(
    payload: CreateEmployeeCommand,
    admin: Annotated[User, Depends(require_admin)],
    service: Annotated[EmployeeService, Depends(get_employee_service)],
) -> UserView:
    del admin
    return await service.create_employee(payload)


@router.patch("/admin/users/{user_id}", response_model=UserView, tags=["admin-users"])
async def update_employee(
    user_id: UUID,
    payload: UpdateEmployeeCommand,
    admin: Annotated[User, Depends(require_admin)],
    service: Annotated[EmployeeService, Depends(get_employee_service)],
) -> UserView:
    del admin
    return await service.set_employee_state(user_id, payload)
