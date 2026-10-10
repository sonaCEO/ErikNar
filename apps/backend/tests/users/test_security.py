from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

import pytest

from eriknar.core.config import Settings
from eriknar.users.enums import UserRole
from eriknar.users.models import User
from eriknar.users.security import (
    InvalidAccessTokenError,
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


def _settings(**overrides: object) -> Settings:
    values: dict[str, Any] = {
        "jwt_secret": "test-secret-that-is-long-enough-for-hs256",
        "jwt_issuer": "eriknar-test",
        "jwt_audience": "eriknar-admin-test",
        "access_token_minutes": 15,
    }
    values.update(overrides)
    return Settings(**values)


def _user() -> User:
    return User(
        id=uuid4(),
        name="Администратор",
        login="admin",
        password_hash="unused",
        role=UserRole.ADMIN,
        token_version=3,
    )


def test_password_is_argon2_hashed_and_verifiable() -> None:
    encoded = hash_password("correct horse battery staple")

    assert encoded.startswith("$argon2")
    assert verify_password("correct horse battery staple", encoded) is True
    assert verify_password("wrong password", encoded) is False


def test_malformed_password_hash_is_rejected() -> None:
    assert verify_password("password", "not-a-password-hash") is False


def test_access_token_contains_identity_role_and_version() -> None:
    now = datetime(2026, 10, 6, 12, 0, tzinfo=UTC)
    user = _user()

    token = create_access_token(user, _settings(), now=now)
    claims = decode_access_token(token, _settings(), now=now)

    assert claims.sub == user.id
    assert claims.role is UserRole.ADMIN
    assert claims.token_version == 3
    assert claims.issued_at == now
    assert claims.expires_at == now + timedelta(minutes=15)


@pytest.mark.parametrize(
    "decode_settings",
    [
        _settings(jwt_secret="different-secret-that-is-long-enough"),
        _settings(jwt_issuer="another-issuer"),
        _settings(jwt_audience="another-audience"),
    ],
)
def test_access_token_rejects_wrong_security_context(decode_settings: Settings) -> None:
    now = datetime(2026, 10, 6, 12, 0, tzinfo=UTC)
    token = create_access_token(_user(), _settings(), now=now)

    with pytest.raises(InvalidAccessTokenError):
        decode_access_token(token, decode_settings, now=now)


def test_access_token_rejects_expired_token() -> None:
    issued_at = datetime(2026, 10, 6, 12, 0, tzinfo=UTC)
    token = create_access_token(_user(), _settings(), now=issued_at)

    with pytest.raises(InvalidAccessTokenError):
        decode_access_token(token, _settings(), now=issued_at + timedelta(minutes=15))


def test_access_token_rejects_malformed_token() -> None:
    with pytest.raises(InvalidAccessTokenError):
        decode_access_token("not-a-jwt", _settings())
