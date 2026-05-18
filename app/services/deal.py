from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, Sequence

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import UserRole
from app.core.exceptions import BadRequestException, ForbiddenException, NotFoundException
from app.models.deal import Deal
from app.models.user import User
from app.repositories.activity import ActivityRepository
from app.repositories.client import ClientRepository
from app.repositories.deal import DealRepository
from app.repositories.stage import StageRepository
from app.repositories.task import TaskRepository
from app.repositories.user import UserRepository
from app.schemas.deal import DealCreate, DealUpdate
from app.services.audit import record_audit_log, snapshot
from app.services.stage import CLOSED_STAGES


DEAL_AUDIT_FIELDS = [
    "id",
    "title",
    "description",
    "client_id",
    "stage_id",
    "owner_id",
    "amount",
    "closed_at",
    "is_archived",
    "archived_at",
    "deleted_at",
]


class DealService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.deal_repo = DealRepository(session)
        self.stage_repo = StageRepository(session)
        self.client_repo = ClientRepository(session)
        self.user_repo = UserRepository(session)
        self.task_repo = TaskRepository(session)
        self.activity_repo = ActivityRepository(session)

    def _get_owner_filter(self, current_user: User) -> Optional[int]:
        """Manager и Sales видят только свои сделки, Admin — все."""
        if current_user.role in [UserRole.MANAGER.value, UserRole.SALES.value]:
            return current_user.id
        return None

    def _check_ownership(self, deal: Deal, current_user: User) -> None:
        """Проверка права доступа к сделке"""
        if current_user.role in [UserRole.MANAGER.value, UserRole.SALES.value]:
            if deal.owner_id != current_user.id:
                raise ForbiddenException("Нет доступа к этой сделке")

    def _can_reassign_owner(self, current_user: User) -> bool:
        """Только Manager и Admin могут переназначать owner_id"""
        return current_user.role in [UserRole.ADMIN.value, UserRole.MANAGER.value]

    async def _get_accessible_client(self, client_id: int, current_user: User):
        client = await self.client_repo.get_by_id(client_id)
        if not client:
            raise NotFoundException(f"Клиент с id {client_id} не найден")

        if current_user.role in [UserRole.MANAGER.value, UserRole.SALES.value] and client.owner_id != current_user.id:
            raise ForbiddenException("Продавец может создавать сделки только для своих клиентов")

        return client

    async def _validate_new_owner(self, owner_id: int, client_id: int) -> None:
        owner = await self.user_repo.get_by_id(owner_id)
        if owner is None or not owner.is_active:
            raise BadRequestException(f"Активный пользователь с id {owner_id} не найден")

        if owner.role == UserRole.SALES.value:
            client = await self.client_repo.get_by_id(client_id)
            if client is None:
                raise NotFoundException(f"Клиент с id {client_id} не найден")
            if client.owner_id != owner.id:
                raise BadRequestException("Продавец должен быть владельцем клиента по сделке")

    async def create_deal(self, deal_data: DealCreate, current_user: User) -> Deal:
        # Проверка существования стадии
        stage = await self.stage_repo.get_by_id(deal_data.stage_id)
        if not stage:
            raise BadRequestException(f"Стадия с id {deal_data.stage_id} не найдена")

        await self._get_accessible_client(deal_data.client_id, current_user)

        data = deal_data.model_dump()
        data["owner_id"] = current_user.id

        # Проверка на closed стадию при создании
        if stage.name in CLOSED_STAGES:
            data["closed_at"] = datetime.now(timezone.utc)

        deal = await self.deal_repo.create(data)
        await record_audit_log(
            self.session,
            actor=current_user,
            action="create",
            entity_type="deal",
            entity_id=deal.id,
            after=snapshot(deal, DEAL_AUDIT_FIELDS),
        )
        return deal

    async def list_deals(
        self,
        current_user: User,
        stage_id: Optional[int] = None,
        client_id: Optional[int] = None,
        owner_id: Optional[int] = None,
        amount_min: Optional[Decimal] = None,
        amount_max: Optional[Decimal] = None,
        include_archived: bool = False,
        include_deleted: bool = False,
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[Sequence[Deal], int]:
        # Sales видит только свои
        effective_owner_id = self._get_owner_filter(current_user)
        if effective_owner_id is not None:
            owner_id = effective_owner_id

        deals = await self.deal_repo.search(
            owner_id=owner_id,
            stage_id=stage_id,
            client_id=client_id,
            amount_min=amount_min,
            amount_max=amount_max,
            include_archived=include_archived,
            include_deleted=include_deleted,
            skip=skip,
            limit=limit,
        )
        total = await self.deal_repo.count_search(
            owner_id=owner_id,
            stage_id=stage_id,
            client_id=client_id,
            amount_min=amount_min,
            amount_max=amount_max,
            include_archived=include_archived,
            include_deleted=include_deleted,
        )
        return deals, total

    async def get_deal(self, deal_id: int, current_user: User) -> Deal:
        deal = await self.deal_repo.get_by_id(deal_id)
        if not deal:
            raise NotFoundException(f"Сделка с id {deal_id} не найдена")

        self._check_ownership(deal, current_user)
        return deal

    async def update_deal(
        self, deal_id: int, deal_data: DealUpdate, current_user: User
    ) -> Deal:
        deal = await self.get_deal(deal_id, current_user)

        update_data = deal_data.model_dump(exclude_unset=True)
        before = snapshot(deal, DEAL_AUDIT_FIELDS)

        if "client_id" in update_data and update_data["client_id"] is not None:
            await self._get_accessible_client(update_data["client_id"], current_user)

        effective_client_id = update_data.get("client_id", deal.client_id)

        # Проверка права на смену owner_id
        if "owner_id" in update_data and update_data["owner_id"] is not None:
            if not self._can_reassign_owner(current_user):
                raise ForbiddenException("Только менеджер или администратор может менять владельца сделки")
            await self._validate_new_owner(update_data["owner_id"], effective_client_id)

        # Обработка смены стадии на closed
        if "stage_id" in update_data:
            new_stage = await self.stage_repo.get_by_id(update_data["stage_id"])
            if not new_stage:
                raise BadRequestException(f"Стадия с id {update_data['stage_id']} не найдена")

            # Автозаполнение closed_at при переходе на закрытую стадию
            if new_stage.name in CLOSED_STAGES and deal.closed_at is None:
                update_data["closed_at"] = datetime.now(timezone.utc)
            # Очистка closed_at если уходим с closed стадии
            elif new_stage.name not in CLOSED_STAGES and deal.closed_at is not None:
                old_stage = await self.stage_repo.get_by_id(deal.stage_id)
                if old_stage and old_stage.name in CLOSED_STAGES:
                    update_data["closed_at"] = None

        updated = await self.deal_repo.update(deal, update_data)
        await record_audit_log(
            self.session,
            actor=current_user,
            action="update",
            entity_type="deal",
            entity_id=updated.id,
            before=before,
            after=snapshot(updated, DEAL_AUDIT_FIELDS),
        )
        return updated

    async def delete_deal(self, deal_id: int, current_user: User) -> None:
        deal = await self.get_deal(deal_id, current_user)
        before = snapshot(deal, DEAL_AUDIT_FIELDS)
        deal.deleted_at = datetime.now(timezone.utc)
        await self.session.commit()
        await self.session.refresh(deal)
        await record_audit_log(
            self.session,
            actor=current_user,
            action="soft_delete",
            entity_type="deal",
            entity_id=deal.id,
            before=before,
            after=snapshot(deal, DEAL_AUDIT_FIELDS),
        )

    async def set_archive_state(
        self, deal_id: int, current_user: User, is_archived: bool
    ) -> Deal:
        deal = await self.get_deal(deal_id, current_user)
        before = snapshot(deal, DEAL_AUDIT_FIELDS)
        now = datetime.now(timezone.utc)
        deal.is_archived = is_archived
        deal.archived_at = now if is_archived else None
        await self.session.commit()
        await self.session.refresh(deal)
        await record_audit_log(
            self.session,
            actor=current_user,
            action="archive" if is_archived else "unarchive",
            entity_type="deal",
            entity_id=deal.id,
            before=before,
            after=snapshot(deal, DEAL_AUDIT_FIELDS),
        )
        return deal
