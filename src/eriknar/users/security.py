from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID

import jwt
from pwdlib import PasswordHash
from pwdlib.exceptions import PwdlibError

from eriknar.core.config import Settings
from eriknar.users.enums import UserRole
from eriknar.users.models import User

ALGORITHM = "HS256"
_password_hash = PasswordHash.recommended()


class InvalidAccessTokenError(ValueError):
    pass


@dataclass(frozen=True, slots=True)
class AccessTokenClaims:
    sub: UUID
    role: UserRole
    token_version: int
    issued_at: datetime
    expires_at: datetime


def hash_password(password: str) -> str:
    return _password_hash.hash(password)


def verify_password(password: str, encoded: str) -> bool:
    try:
        return _password_hash.verify(password, encoded)
    except (PwdlibError, ValueError):
        return False


def create_access_token(
    user: User,
    settings: Settings,
    now: datetime | None = None,
) -> str:
    issued_at = (now or datetime.now(UTC)).astimezone(UTC)
    expires_at = issued_at + timedelta(minutes=settings.access_token_minutes)
    payload = {
        "sub": str(user.id),
        "role": user.role.value,
        "token_version": user.token_version,
        "iat": issued_at,
        "exp": expires_at,
        "iss": settings.jwt_issuer,
        "aud": settings.jwt_audience,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def decode_access_token(
    token: str,
    settings: Settings,
    now: datetime | None = None,
) -> AccessTokenClaims:
    current_time = (now or datetime.now(UTC)).astimezone(UTC)
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[ALGORITHM],
            audience=settings.jwt_audience,
            issuer=settings.jwt_issuer,
            options={
                "require": ["sub", "role", "token_version", "iat", "exp", "iss", "aud"],
                "verify_exp": False,
                "verify_iat": False,
            },
        )
        issued_at = datetime.fromtimestamp(int(payload["iat"]), UTC)
        expires_at = datetime.fromtimestamp(int(payload["exp"]), UTC)
        claims = AccessTokenClaims(
            sub=UUID(str(payload["sub"])),
            role=UserRole(str(payload["role"])),
            token_version=int(payload["token_version"]),
            issued_at=issued_at,
            expires_at=expires_at,
        )
    except (jwt.PyJWTError, KeyError, TypeError, ValueError) as exc:
        raise InvalidAccessTokenError from exc

    if current_time >= claims.expires_at or claims.issued_at > current_time:
        raise InvalidAccessTokenError
    return claims
