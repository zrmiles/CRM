from typing import Optional, Sequence

from sqlalchemy import or_, select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.repositories.base import BaseRepository


class ClientRepository(BaseRepository[Client]):
    def __init__(self, session: AsyncSession):
        super().__init__(Client, session)

    async def search(
        self,
        query: Optional[str] = None,
        owner_id: Optional[int] = None,
        include_archived: bool = False,
        include_deleted: bool = False,
        skip: int = 0,
        limit: int = 100,
    ) -> Sequence[Client]:
        stmt = select(Client)

        filters = []
        if not include_deleted:
            filters.append(Client.deleted_at.is_(None))
        if not include_archived:
            filters.append(Client.is_archived.is_(False))
        if owner_id is not None:
            filters.append(Client.owner_id == owner_id)

        if query:
            search_term = f"%{query}%"
            filters.append(
                or_(
                    Client.first_name.ilike(search_term),
                    Client.last_name.ilike(search_term),
                    Client.email.ilike(search_term),
                    Client.phone.ilike(search_term),
                    Client.company.ilike(search_term),
                )
            )

        for f in filters:
            stmt = stmt.where(f)

        stmt = stmt.order_by(Client.created_at.desc(), Client.id.desc()).offset(skip).limit(limit)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def count_search(
        self,
        query: Optional[str] = None,
        owner_id: Optional[int] = None,
        include_archived: bool = False,
        include_deleted: bool = False,
    ) -> int:
        stmt = select(func.count()).select_from(Client)

        filters = []
        if not include_deleted:
            filters.append(Client.deleted_at.is_(None))
        if not include_archived:
            filters.append(Client.is_archived.is_(False))
        if owner_id is not None:
            filters.append(Client.owner_id == owner_id)

        if query:
            search_term = f"%{query}%"
            filters.append(
                or_(
                    Client.first_name.ilike(search_term),
                    Client.last_name.ilike(search_term),
                    Client.email.ilike(search_term),
                    Client.phone.ilike(search_term),
                    Client.company.ilike(search_term),
                )
            )

        for f in filters:
            stmt = stmt.where(f)

        result = await self.session.execute(stmt)
        return result.scalar() or 0

    async def get_by_id(self, id: int, include_deleted: bool = False) -> Optional[Client]:
        stmt = select(Client).where(Client.id == id)
        if not include_deleted:
            stmt = stmt.where(Client.deleted_at.is_(None))
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
