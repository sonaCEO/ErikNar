from uuid import UUID

from aiogram import F, Router
from aiogram.types import CallbackQuery
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from eriknar.leads.enums import LeadStatus
from eriknar.leads.schemas import LeadActionResult
from eriknar.leads.service import LeadService
from eriknar.users.repository import UserRepository


class UnauthorizedManagerError(ValueError):
    pass


class ManagerActionService:
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self._session_factory = session_factory

    async def perform(self, action: str, lead_id: UUID, telegram_user_id: int) -> LeadActionResult:
        async with self._session_factory() as session:
            user = await UserRepository(session).get_active_by_telegram_id(telegram_user_id)
        if user is None:
            raise UnauthorizedManagerError(telegram_user_id)

        async with self._session_factory() as session:
            service = LeadService(session)
            if action == "claim":
                result = await service.claim(lead_id, user.id)
                return LeadActionResult(
                    assigned_to_user_id=result.assigned_to_user_id,
                    status=result.status,
                )
            targets = {
                "complete": LeadStatus.COMPLETED,
                "reject": LeadStatus.REJECTED,
            }
            if action not in targets:
                raise ValueError(action)
            return await service.resolve(lead_id, user.id, targets[action])


def build_router(session_factory: async_sessionmaker[AsyncSession]) -> Router:
    router = Router(name="manager-actions")
    actions = ManagerActionService(session_factory)

    @router.callback_query(F.data.startswith("lead:"))
    async def manager_action(callback: CallbackQuery) -> None:
        if callback.data is None:
            return
        try:
            _, action, raw_lead_id = callback.data.split(":", maxsplit=2)
            result = await actions.perform(action, UUID(raw_lead_id), callback.from_user.id)
            await callback.answer(f"Статус: {result.status.value}")
        except UnauthorizedManagerError:
            await callback.answer("Нет доступа", show_alert=True)
        except (ValueError, TypeError):
            await callback.answer("Действие недоступно", show_alert=True)

    return router
