from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from eriknar.core.config import Settings, get_settings
from eriknar.db.session import get_session
from eriknar.users.enums import UserRole
from eriknar.users.models import User
from eriknar.users.repository import UserRepository
from eriknar.users.security import InvalidAccessTokenError, decode_access_token

bearer = HTTPBearer(auto_error=False)


class AuthenticationError(ValueError):
    pass


class PermissionDeniedError(ValueError):
    pass


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    session: Annotated[AsyncSession, Depends(get_session, use_cache=False)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> User:
    if credentials is None or credentials.scheme.casefold() != "bearer":
        raise AuthenticationError
    try:
        claims = decode_access_token(credentials.credentials, settings)
    except InvalidAccessTokenError as exc:
        raise AuthenticationError from exc
    user = await UserRepository(session).get_by_id(claims.sub)
    if (
        user is None
        or not user.is_active
        or user.role != claims.role
        or user.token_version != claims.token_version
    ):
        raise AuthenticationError
    return user


async def require_admin(
    user: Annotated[User, Depends(get_current_user)],
) -> User:
    if user.role is not UserRole.ADMIN:
        raise PermissionDeniedError
    return user


async def require_manager_or_admin(
    user: Annotated[User, Depends(get_current_user)],
) -> User:
    return user
