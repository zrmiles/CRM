from typing import Optional, Sequence

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import Task
from app.models.deal import Deal
from app.repositories.base import BaseRepository


class TaskRepository(BaseRepository[Task]):
    def __init__(self, session: AsyncSession):
        super().__init__(Task, session)

    async def search(
        self,
        deal_id: Optional[int] = None,
        assignee_id: Optional[int] = None,
        deal_owner_id: Optional[int] = None,
        is_completed: Optional[bool] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Sequence[Task]:
        stmt = select(Task)
        if deal_owner_id is not None:
            stmt = stmt.join(Deal, Deal.id == Task.deal_id)

        filters = self._build_filters(
            deal_id=deal_id,
            assignee_id=assignee_id,
            deal_owner_id=deal_owner_id,
            is_completed=is_completed,
        )

        for f in filters:
            stmt = stmt.where(f)

        stmt = stmt.order_by(Task.created_at.desc(), Task.id.desc()).offset(skip).limit(limit)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def count_search(
        self,
        deal_id: Optional[int] = None,
        assignee_id: Optional[int] = None,
        deal_owner_id: Optional[int] = None,
        is_completed: Optional[bool] = None,
    ) -> int:
        stmt = select(func.count()).select_from(Task)
        if deal_owner_id is not None:
            stmt = stmt.join(Deal, Deal.id == Task.deal_id)

        filters = self._build_filters(
            deal_id=deal_id,
            assignee_id=assignee_id,
            deal_owner_id=deal_owner_id,
            is_completed=is_completed,
        )

        for f in filters:
            stmt = stmt.where(f)

        result = await self.session.execute(stmt)
        return result.scalar() or 0

    async def count_by_deal(self, deal_id: int) -> int:
        return await self.count(filters=[Task.deal_id == deal_id])

    def _build_filters(
        self,
        deal_id: Optional[int] = None,
        assignee_id: Optional[int] = None,
        deal_owner_id: Optional[int] = None,
        is_completed: Optional[bool] = None,
    ) -> list:
        filters = []
        if deal_id is not None:
            filters.append(Task.deal_id == deal_id)
        if assignee_id is not None:
            filters.append(Task.assignee_id == assignee_id)
        if deal_owner_id is not None:
            filters.append(Deal.owner_id == deal_owner_id)
            filters.append(Deal.deleted_at.is_(None))
        if is_completed is not None:
            filters.append(Task.is_completed == is_completed)
        return filters
