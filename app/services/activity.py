from typing import Optional, Sequence

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import UserRole
from app.core.exceptions import BadRequestException, ForbiddenException, NotFoundException
from app.models.client import Client
from app.models.deal import Deal
from app.models.activity import Activity
from app.models.user import User
from app.repositories.activity import ActivityRepository
from app.repositories.client import ClientRepository
from app.repositories.deal import DealRepository
from app.schemas.activity import ActivityCreate


class ActivityService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.activity_repo = ActivityRepository(session)
        self.client_repo = ClientRepository(session)
        self.deal_repo = DealRepository(session)

    async def _get_accessible_client(self, client_id: int, current_user: User) -> Client:
        """Manager и Sales могут создавать активности только для своих клиентов."""
        client = await self.client_repo.get_by_id(client_id)
        if not client:
            raise NotFoundException(f"Клиент с id {client_id} не найден")

        if current_user.role in [UserRole.MANAGER.value, UserRole.SALES.value]:
            if client.owner_id != current_user.id:
                raise ForbiddenException("Нет доступа к этому клиенту")

        return client

    async def _get_accessible_deal(self, deal_id: int, current_user: User) -> Deal:
        """Manager и Sales могут создавать активности только для своих сделок."""
        deal = await self.deal_repo.get_by_id(deal_id)
        if not deal:
            raise NotFoundException(f"Сделка с id {deal_id} не найдена")

        if current_user.role in [UserRole.MANAGER.value, UserRole.SALES.value]:
            if deal.owner_id != current_user.id:
                raise ForbiddenException("Нет доступа к этой сделке")

        return deal

    def _get_user_filter(self, current_user: User) -> Optional[int]:
        """Manager и Sales видят только свои активности."""
        if current_user.role in [UserRole.MANAGER.value, UserRole.SALES.value]:
            return current_user.id
        return None

    def _check_activity_access(self, activity: Activity, current_user: User) -> None:
        """Проверка доступа к активности"""
        if current_user.role in [UserRole.MANAGER.value, UserRole.SALES.value]:
            if activity.user_id != current_user.id:
                raise ForbiddenException("Нет доступа к этой активности")

    async def create_activity(
        self, activity_data: ActivityCreate, current_user: User
    ) -> Activity:
        await self._get_accessible_client(activity_data.client_id, current_user)

        if activity_data.deal_id:
            deal = await self._get_accessible_deal(activity_data.deal_id, current_user)
            if deal.client_id != activity_data.client_id:
                raise BadRequestException("Сделка не относится к выбранному клиенту")

        data = activity_data.model_dump()
        data["user_id"] = current_user.id
        data["type"] = data["type"].value  # Преобразование enum в строку

        return await self.activity_repo.create(data)

    async def list_activities(
        self,
        current_user: User,
        client_id: Optional[int] = None,
        deal_id: Optional[int] = None,
        activity_type: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[Sequence[Activity], int]:
        # Sales видит только свои активности
        user_filter = self._get_user_filter(current_user)

        activities = await self.activity_repo.search(
            client_id=client_id,
            deal_id=deal_id,
            user_id=user_filter,
            activity_type=activity_type,
            skip=skip,
            limit=limit,
        )
        total = await self.activity_repo.count_search(
            client_id=client_id,
            deal_id=deal_id,
            user_id=user_filter,
            activity_type=activity_type,
        )
        return activities, total

    async def get_activity(self, activity_id: int, current_user: User) -> Activity:
        activity = await self.activity_repo.get_by_id(activity_id)
        if not activity:
            raise NotFoundException(f"Активность с id {activity_id} не найдена")

        self._check_activity_access(activity, current_user)
        return activity
