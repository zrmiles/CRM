from typing import Optional, Sequence

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import UserRole
from app.core.exceptions import BadRequestException, ForbiddenException, NotFoundException
from app.models.deal import Deal
from app.models.task import Task
from app.models.user import User
from app.repositories.deal import DealRepository
from app.repositories.task import TaskRepository
from app.repositories.user import UserRepository
from app.schemas.task import TaskCreate, TaskUpdate


class TaskService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.task_repo = TaskRepository(session)
        self.deal_repo = DealRepository(session)
        self.user_repo = UserRepository(session)

    async def _get_accessible_deal(self, deal_id: int, current_user: User) -> Deal:
        """Manager и Sales могут работать только с задачами своих сделок."""
        deal = await self.deal_repo.get_by_id(deal_id)
        if not deal:
            raise NotFoundException(f"Сделка с id {deal_id} не найдена")

        if current_user.role in [UserRole.MANAGER.value, UserRole.SALES.value]:
            if deal.owner_id != current_user.id:
                raise ForbiddenException("Нет доступа к задачам этой сделки")

        return deal

    async def _validate_assignee(self, assignee_id: int, deal: Deal, current_user: User) -> None:
        assignee = await self.user_repo.get_by_id(assignee_id)
        if assignee is None or not assignee.is_active:
            raise BadRequestException(f"Активный пользователь с id {assignee_id} не найден")

        if current_user.role == UserRole.SALES.value and assignee_id != current_user.id:
            raise ForbiddenException("Продавец может назначать задачи только на себя")

        if assignee.role == UserRole.SALES.value and deal.owner_id != assignee.id:
            raise BadRequestException("Продавец-исполнитель должен быть владельцем сделки")

    async def _check_task_access(self, task: Task, current_user: User) -> None:
        """Проверка доступа к задаче"""
        if current_user.role in [UserRole.MANAGER.value, UserRole.SALES.value]:
            deal = await self.deal_repo.get_by_id(task.deal_id)
            if deal is None or deal.owner_id != current_user.id:
                raise ForbiddenException("Нет доступа к этой задаче")

    async def create_task(
        self, task_data: TaskCreate, current_user: User
    ) -> Task:
        deal = await self._get_accessible_deal(task_data.deal_id, current_user)

        data = task_data.model_dump()
        # assignee_id по умолчанию current_user
        if data.get("assignee_id") is None:
            data["assignee_id"] = current_user.id

        await self._validate_assignee(data["assignee_id"], deal, current_user)
        return await self.task_repo.create(data)

    async def list_tasks(
        self,
        current_user: User,
        deal_id: Optional[int] = None,
        assignee_id: Optional[int] = None,
        is_completed: Optional[bool] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[Sequence[Task], int]:
        deal_owner_id = None
        if current_user.role in [UserRole.MANAGER.value, UserRole.SALES.value]:
            deal_owner_id = current_user.id

        tasks = await self.task_repo.search(
            deal_id=deal_id,
            assignee_id=assignee_id,
            deal_owner_id=deal_owner_id,
            is_completed=is_completed,
            skip=skip,
            limit=limit,
        )
        total = await self.task_repo.count_search(
            deal_id=deal_id,
            assignee_id=assignee_id,
            deal_owner_id=deal_owner_id,
            is_completed=is_completed,
        )
        return tasks, total

    async def get_task(self, task_id: int, current_user: User) -> Task:
        task = await self.task_repo.get_by_id(task_id)
        if not task:
            raise NotFoundException(f"Задача с id {task_id} не найдена")

        await self._check_task_access(task, current_user)
        return task

    async def update_task(
        self, task_id: int, task_data: TaskUpdate, current_user: User
    ) -> Task:
        task = await self.get_task(task_id, current_user)
        update_data = task_data.model_dump(exclude_unset=True)
        if "assignee_id" in update_data and update_data["assignee_id"] is not None:
            deal = await self._get_accessible_deal(task.deal_id, current_user)
            await self._validate_assignee(update_data["assignee_id"], deal, current_user)
        return await self.task_repo.update(task, update_data)

    async def complete_task(self, task_id: int, current_user: User) -> Task:
        task = await self.get_task(task_id, current_user)
        return await self.task_repo.update(task, {"is_completed": True})

    async def delete_task(self, task_id: int, current_user: User) -> None:
        task = await self.get_task(task_id, current_user)
        await self.task_repo.delete(task)
