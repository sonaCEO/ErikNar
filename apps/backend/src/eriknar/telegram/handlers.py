from typing import Any
from uuid import UUID

from aiogram import F, Router
from aiogram.enums import ParseMode
from aiogram.types import CallbackQuery, Message
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from eriknar.leads.enums import LeadStatus
from eriknar.leads.models import Lead
from eriknar.leads.schemas import LeadActionResult
from eriknar.leads.service import InvalidLeadTransitionError, LeadService
from eriknar.telegram.client import TelegramTopicGateway, lead_keyboard
from eriknar.telegram.formatters import format_lead_state, format_topic_name
from eriknar.users.repository import UserRepository


class UnauthorizedManagerError(ValueError):
    pass


class ManagerActionUnavailableError(ValueError):
    pass


async def update_lead_presentation(
    message: Any,
    lead_id: str,
    result: LeadActionResult,
    topic_gateway: TelegramTopicGateway,
) -> None:
    await message.edit_text(
        format_lead_state(message.html_text, result.status, result.assigned_to_name),
        parse_mode=ParseMode.HTML,
        reply_markup=lead_keyboard(lead_id, result.status),
    )
    if result.telegram_topic_id is not None:
        await topic_gateway.rename_topic(
            result.telegram_topic_id,
            format_topic_name(
                result.number,
                result.status,
                result.model_code,
                result.assigned_to_name,
            ),
        )


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
                claim_result = await service.claim(lead_id, user.id)
                async with self._session_factory() as lookup_session:
                    assignee = await UserRepository(lookup_session).get_by_id(
                        claim_result.assigned_to_user_id
                    )
                    lead = await lookup_session.get(Lead, lead_id)
                if lead is None:
                    raise ManagerActionUnavailableError("Заявка не найдена")
                return LeadActionResult(
                    assigned_to_user_id=claim_result.assigned_to_user_id,
                    assigned_to_name=assignee.name if assignee else None,
                    status=claim_result.status,
                    number=lead.number,
                    model_code=str(lead.snapshot["model_code"]),
                    telegram_topic_id=lead.telegram_topic_id,
                    claimed=claim_result.claimed,
                )
            targets = {
                "complete": LeadStatus.COMPLETED,
                "reject": LeadStatus.CANCELLED,
            }
            if action not in targets:
                raise ValueError(action)
            try:
                resolved = await service.resolve(lead_id, user.id, targets[action])
            except InvalidLeadTransitionError as exc:
                raise ManagerActionUnavailableError(
                    await self._unavailable_message(lead_id, user.id)
                ) from exc
            return LeadActionResult(
                assigned_to_user_id=resolved.assigned_to_user_id,
                assigned_to_name=user.name,
                status=resolved.status,
                number=resolved.number,
                model_code=resolved.model_code,
                telegram_topic_id=resolved.telegram_topic_id,
            )

    async def _unavailable_message(self, lead_id: UUID, user_id: UUID) -> str:
        async with self._session_factory() as session:
            lead = await session.get(Lead, lead_id)
            if lead is None:
                return "Заявка не найдена"
            if lead.status == LeadStatus.COMPLETED:
                return "Заявка уже завершена"
            if lead.status == LeadStatus.CANCELLED:
                return "Заявка уже отклонена"
            if lead.status == LeadStatus.NEW:
                return "Сначала возьмите заявку в работу"
            if lead.assigned_to_user_id != user_id and lead.assigned_to_user_id is not None:
                assignee = await UserRepository(session).get_by_id(lead.assigned_to_user_id)
                return f"Заявка закреплена за {assignee.name if assignee else 'другим сотрудником'}"
            return "Действие недоступно"


def build_router(
    session_factory: async_sessionmaker[AsyncSession],
    topic_gateway: TelegramTopicGateway,
) -> Router:
    router = Router(name="manager-actions")
    actions = ManagerActionService(session_factory)

    @router.callback_query(F.data.startswith("lead:"))
    async def manager_action(callback: CallbackQuery) -> None:
        if callback.data is None:
            return
        try:
            _, action, raw_lead_id = callback.data.split(":", maxsplit=2)
            result = await actions.perform(action, UUID(raw_lead_id), callback.from_user.id)
            if result.claimed is False:
                await callback.answer(
                    "Заявка уже закреплена за другой сотрудницей", show_alert=True
                )
            elif result.claimed is True:
                await callback.answer("Заявка закреплена за вами")
            else:
                labels = {
                    LeadStatus.COMPLETED: "Заявка завершена",
                    LeadStatus.CANCELLED: "Заявка отклонена",
                }
                await callback.answer(labels[result.status])
            if isinstance(callback.message, Message) and result.claimed is not False:
                if result.assigned_to_name is None:
                    result.assigned_to_name = callback.from_user.full_name
                await update_lead_presentation(
                    callback.message,
                    raw_lead_id,
                    result,
                    topic_gateway,
                )
        except UnauthorizedManagerError:
            await callback.answer("Нет доступа", show_alert=True)
        except ManagerActionUnavailableError as exc:
            await callback.answer(str(exc), show_alert=True)
        except (ValueError, TypeError):
            await callback.answer("Действие недоступно", show_alert=True)

    return router
