from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from eriknar.users.models import AuthLoginAttempt, User


class UserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_active_by_telegram_id(self, telegram_user_id: int) -> User | None:
        return await self._session.scalar(
            select(User).where(
                User.telegram_user_id == telegram_user_id,
                User.is_active.is_(True),
            )
        )

    async def get_by_id(self, user_id: UUID) -> User | None:
        return await self._session.get(User, user_id)

    async def get_by_login(self, login: str) -> User | None:
        return await self._session.scalar(select(User).where(User.login == login))

    async def get_attempt_for_update(self, fingerprint: str) -> AuthLoginAttempt | None:
        return await self._session.scalar(
            select(AuthLoginAttempt)
            .where(AuthLoginAttempt.fingerprint == fingerprint)
            .with_for_update()
        )

    async def clear_attempt(self, fingerprint: str) -> None:
        await self._session.execute(
            delete(AuthLoginAttempt).where(AuthLoginAttempt.fingerprint == fingerprint)
        )

    def add(self, user: User) -> None:
        self._session.add(user)

    def add_attempt(self, attempt: AuthLoginAttempt) -> None:
        self._session.add(attempt)
