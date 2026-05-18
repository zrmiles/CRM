from decimal import Decimal
from typing import Optional, Sequence

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.deal import Deal
from app.repositories.base import BaseRepository


class DealRepository(BaseRepository[Deal]):
    def __init__(self, session: AsyncSession):
        super().__init__(Deal, session)

    async def search(
        self,
        owner_id: Optional[int] = None,
        stage_id: Optional[int] = None,
        client_id: Optional[int] = None,
        amount_min: Optional[Decimal] = None,
        amount_max: Optional[Decimal] = None,
        include_archived: bool = False,
        include_deleted: bool = False,
        skip: int = 0,
        limit: int = 100,
    ) -> Sequence[Deal]:
        stmt = select(Deal)

        filters = self._build_filters(
            owner_id=owner_id,
            stage_id=stage_id,
            client_id=client_id,
            amount_min=amount_min,
            amount_max=amount_max,
            include_archived=include_archived,
            include_deleted=include_deleted,
        )

        for f in filters:
            stmt = stmt.where(f)

        stmt = stmt.order_by(Deal.created_at.desc(), Deal.id.desc()).offset(skip).limit(limit)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def count_search(
        self,
        owner_id: Optional[int] = None,
        stage_id: Optional[int] = None,
        client_id: Optional[int] = None,
        amount_min: Optional[Decimal] = None,
        amount_max: Optional[Decimal] = None,
        include_archived: bool = False,
        include_deleted: bool = False,
    ) -> int:
        stmt = select(func.count()).select_from(Deal)

        filters = self._build_filters(
            owner_id=owner_id,
            stage_id=stage_id,
            client_id=client_id,
            amount_min=amount_min,
            amount_max=amount_max,
            include_archived=include_archived,
            include_deleted=include_deleted,
        )

        for f in filters:
            stmt = stmt.where(f)

        result = await self.session.execute(stmt)
        return result.scalar() or 0

    async def count_by_stage(self, stage_id: int) -> int:
        return await self.count(filters=[Deal.stage_id == stage_id, Deal.deleted_at.is_(None)])

    async def count_by_client(self, client_id: int) -> int:
        return await self.count(filters=[Deal.client_id == client_id, Deal.deleted_at.is_(None)])

    async def get_by_id(self, id: int, include_deleted: bool = False) -> Optional[Deal]:
        stmt = select(Deal).where(Deal.id == id)
        if not include_deleted:
            stmt = stmt.where(Deal.deleted_at.is_(None))
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    def _build_filters(
        self,
        owner_id: Optional[int] = None,
        stage_id: Optional[int] = None,
        client_id: Optional[int] = None,
        amount_min: Optional[Decimal] = None,
        amount_max: Optional[Decimal] = None,
        include_archived: bool = False,
        include_deleted: bool = False,
    ) -> list:
        filters = []
        if not include_deleted:
            filters.append(Deal.deleted_at.is_(None))
        if not include_archived:
            filters.append(Deal.is_archived.is_(False))
        if owner_id is not None:
            filters.append(Deal.owner_id == owner_id)
        if stage_id is not None:
            filters.append(Deal.stage_id == stage_id)
        if client_id is not None:
            filters.append(Deal.client_id == client_id)
        if amount_min is not None:
            filters.append(Deal.amount >= amount_min)
        if amount_max is not None:
            filters.append(Deal.amount <= amount_max)
        return filters
