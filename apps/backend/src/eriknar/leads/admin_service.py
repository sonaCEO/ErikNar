from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from eriknar.catalog.admin_service import ConcurrentUpdateError
from eriknar.leads.admin_schemas import (
    AdminLeadDetail,
    AdminLeadView,
    AssigneeView,
    AssignLeadCommand,
    ChangeLeadStatusCommand,
    LeadHistoryView,
    LeadPage,
)
from eriknar.leads.enums import LeadStatus
from eriknar.leads.history import LeadHistory
from eriknar.leads.models import Lead
from eriknar.leads.schemas import LeadSnapshot
from eriknar.leads.service import (
    InvalidLeadTransitionError,
    LeadNotFoundError,
    LeadService,
    schedule_lead_archive,
    schedule_lead_telegram_sync,
)
from eriknar.users.dependencies import PermissionDeniedError
from eriknar.users.enums import UserRole
from eriknar.users.models import User


class LeadAssigneeNotFoundError(ValueError):
    pass


class AdminLeadService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list(
        self,
        *,
        page: int,
        page_size: int,
        status: LeadStatus | None,
        assigned_to_user_id: UUID | None,
        unassigned: bool,
    ) -> LeadPage:
        filters = []
        if status is not None:
            filters.append(Lead.status == status)
        if assigned_to_user_id is not None:
            filters.append(Lead.assigned_to_user_id == assigned_to_user_id)
        if unassigned:
            filters.append(Lead.assigned_to_user_id.is_(None))

        total = await self._session.scalar(select(func.count()).select_from(Lead).where(*filters))
        leads = await self._session.scalars(
            select(Lead)
            .where(*filters)
            .options(selectinload(Lead.assigned_to))
            .order_by(Lead.created_at.desc(), Lead.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return LeadPage(
            items=[self._view(lead) for lead in leads],
            page=page,
            page_size=page_size,
            total=total or 0,
        )

    async def get(self, lead_id: UUID) -> AdminLeadDetail:
        lead = await self._session.scalar(
            select(Lead).where(Lead.id == lead_id).options(selectinload(Lead.assigned_to))
        )
        if lead is None:
            raise LeadNotFoundError(lead_id)
        history_rows = (
            await self._session.execute(
                select(LeadHistory, User)
                .outerjoin(User, User.id == LeadHistory.actor_user_id)
                .where(LeadHistory.lead_id == lead_id)
                .order_by(LeadHistory.created_at, LeadHistory.id)
            )
        ).all()
        return AdminLeadDetail(
            **self._view(lead).model_dump(),
            history=[self._history(item, actor) for item, actor in history_rows],
        )

    async def claim(self, lead_id: UUID, actor: User) -> AdminLeadDetail:
        await LeadService(self._session).claim(lead_id, actor.id)
        return await self.get(lead_id)

    async def change_status(
        self,
        lead_id: UUID,
        command: ChangeLeadStatusCommand,
        actor: User,
    ) -> AdminLeadDetail:
        now = datetime.now(UTC)
        async with self._session.begin():
            lead = await self._session.scalar(
                select(Lead).where(Lead.id == lead_id).with_for_update()
            )
            if lead is None:
                raise LeadNotFoundError(lead_id)
            if lead.updated_at != command.expected_updated_at:
                raise ConcurrentUpdateError(lead_id)
            if actor.role is not UserRole.ADMIN and lead.assigned_to_user_id != actor.id:
                raise PermissionDeniedError
            allowed = {
                LeadStatus.NEW: {LeadStatus.CANCELLED},
                LeadStatus.IN_PROGRESS: {LeadStatus.COMPLETED, LeadStatus.CANCELLED},
            }
            if command.status not in allowed.get(lead.status, set()):
                raise InvalidLeadTransitionError(command.status)
            previous_status = lead.status
            lead.status = command.status
            lead.closed_at = now
            lead.updated_at = now
            await schedule_lead_archive(self._session, lead)
            self._session.add(
                LeadHistory(
                    lead_id=lead.id,
                    actor_user_id=actor.id,
                    action="status_changed",
                    previous_status=previous_status,
                    new_status=command.status,
                    previous_assignee_id=lead.assigned_to_user_id,
                    new_assignee_id=lead.assigned_to_user_id,
                    comment=command.comment,
                )
            )
            schedule_lead_telegram_sync(self._session, lead)
        return await self.get(lead_id)

    async def assign(
        self,
        lead_id: UUID,
        command: AssignLeadCommand,
        actor: User,
    ) -> AdminLeadDetail:
        now = datetime.now(UTC)
        async with self._session.begin():
            lead = await self._session.scalar(
                select(Lead).where(Lead.id == lead_id).with_for_update()
            )
            if lead is None:
                raise LeadNotFoundError(lead_id)
            if lead.updated_at != command.expected_updated_at:
                raise ConcurrentUpdateError(lead_id)
            if lead.status in {LeadStatus.COMPLETED, LeadStatus.CANCELLED}:
                raise InvalidLeadTransitionError(lead.status)

            assignee = None
            if command.user_id is not None:
                assignee = await self._session.get(User, command.user_id)
                if assignee is None or not assignee.is_active:
                    raise LeadAssigneeNotFoundError(command.user_id)

            previous_status = lead.status
            previous_assignee_id = lead.assigned_to_user_id
            lead.assigned_to_user_id = assignee.id if assignee else None
            lead.assigned_at = now if assignee else None
            lead.status = LeadStatus.IN_PROGRESS if assignee else LeadStatus.NEW
            lead.updated_at = now
            self._session.add(
                LeadHistory(
                    lead_id=lead.id,
                    actor_user_id=actor.id,
                    action="assigned" if assignee else "unassigned",
                    previous_status=previous_status,
                    new_status=lead.status,
                    previous_assignee_id=previous_assignee_id,
                    new_assignee_id=lead.assigned_to_user_id,
                    comment=command.comment,
                )
            )
            schedule_lead_telegram_sync(self._session, lead)
        return await self.get(lead_id)

    @staticmethod
    def _view(lead: Lead) -> AdminLeadView:
        assignee = (
            AssigneeView(id=lead.assigned_to.id, name=lead.assigned_to.name)
            if lead.assigned_to
            else None
        )
        return AdminLeadView(
            id=lead.id,
            public_id=lead.public_id,
            number=lead.number,
            source=lead.source,
            status=lead.status,
            customer_name=lead.customer_name,
            customer_phone=lead.customer_phone,
            comment=lead.comment,
            snapshot=LeadSnapshot.model_validate(lead.snapshot) if lead.snapshot else None,
            assigned_to=assignee,
            assigned_at=lead.assigned_at,
            closed_at=lead.closed_at,
            created_at=lead.created_at,
            updated_at=lead.updated_at,
        )

    @staticmethod
    def _history(item: LeadHistory, actor: User | None) -> LeadHistoryView:
        return LeadHistoryView(
            id=item.id,
            action=item.action,
            actor=AssigneeView(id=actor.id, name=actor.name) if actor else None,
            previous_status=item.previous_status,
            new_status=item.new_status,
            previous_assignee_id=item.previous_assignee_id,
            new_assignee_id=item.new_assignee_id,
            comment=item.comment,
            created_at=item.created_at,
        )
