from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from eriknar.users.models import User


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
