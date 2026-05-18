from typing import Optional, Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.stage import Stage
from app.repositories.base import BaseRepository


class StageRepository(BaseRepository[Stage]):
    def __init__(self, session: AsyncSession):
        super().__init__(Stage, session)

    async def get_by_name(self, name: str) -> Optional[Stage]:
        result = await self.session.execute(
            select(Stage).where(Stage.name == name)
        )
        return result.scalar_one_or_none()

    async def get_all_ordered(self) -> Sequence[Stage]:
        result = await self.session.execute(
            select(Stage).order_by(Stage.position)
        )
        return result.scalars().all()

    async def get_max_position(self) -> int:
        result = await self.session.execute(
            select(Stage.position).order_by(Stage.position.desc()).limit(1)
        )
        max_pos = result.scalar()
        return max_pos if max_pos is not None else 0

    async def get_default_stage(self) -> Optional[Stage]:
        result = await self.session.execute(
            select(Stage).where(Stage.is_default == True)
        )
        return result.scalar_one_or_none()
