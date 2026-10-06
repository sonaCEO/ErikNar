from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Enum, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from eriknar.db.base import Base
from eriknar.db.types import TimestampMixin, UUIDPrimaryKeyMixin
from eriknar.users.enums import UserRole


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "users"

    name: Mapped[str] = mapped_column(String(120))
    login: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(500))
    role: Mapped[UserRole] = mapped_column(
        Enum(
            UserRole, name="user_role", values_callable=lambda enum: [item.value for item in enum]
        ),
        default=UserRole.MANAGER,
        server_default=UserRole.MANAGER.value,
    )
    token_version: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    telegram_user_id: Mapped[int | None] = mapped_column(BigInteger, unique=True, index=True)
    is_active: Mapped[bool] = mapped_column(default=True, server_default="true")


class AuthLoginAttempt(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "auth_login_attempts"

    fingerprint: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    failure_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    window_started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    blocked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
