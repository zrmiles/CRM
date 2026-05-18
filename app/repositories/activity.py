from typing import Optional, Sequence

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity import Activity
from app.repositories.base import BaseRepository


class ActivityRepository(BaseRepository[Activity]):
    def __init__(self, session: AsyncSession):
        super().__init__(Activity, session)

    async def search(
        self,
        client_id: Optional[int] = None,
        deal_id: Optional[int] = None,
        user_id: Optional[int] = None,
        activity_type: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Sequence[Activity]:
        stmt = select(Activity)

        filters = self._build_filters(
            client_id=client_id,
            deal_id=deal_id,
            user_id=user_id,
            activity_type=activity_type,
        )

        for f in filters:
            stmt = stmt.where(f)

        stmt = stmt.order_by(Activity.created_at.desc()).offset(skip).limit(limit)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def count_search(
        self,
        client_id: Optional[int] = None,
        deal_id: Optional[int] = None,
        user_id: Optional[int] = None,
        activity_type: Optional[str] = None,
    ) -> int:
        stmt = select(func.count()).select_from(Activity)

        filters = self._build_filters(
            client_id=client_id,
            deal_id=deal_id,
            user_id=user_id,
            activity_type=activity_type,
        )

        for f in filters:
            stmt = stmt.where(f)

        result = await self.session.execute(stmt)
        return result.scalar() or 0

    async def count_by_client(self, client_id: int) -> int:
        return await self.count(filters=[Activity.client_id == client_id])

    async def count_by_deal(self, deal_id: int) -> int:
        return await self.count(filters=[Activity.deal_id == deal_id])

    def _build_filters(
        self,
        client_id: Optional[int] = None,
        deal_id: Optional[int] = None,
        user_id: Optional[int] = None,
        activity_type: Optional[str] = None,
    ) -> list:
        filters = []
        if client_id is not None:
            filters.append(Activity.client_id == client_id)
        if deal_id is not None:
            filters.append(Activity.deal_id == deal_id)
        if user_id is not None:
            filters.append(Activity.user_id == user_id)
        if activity_type is not None:
            filters.append(Activity.type == activity_type)
        return filters
