from typing import Sequence

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestException, NotFoundException
from app.models.stage import Stage
from app.repositories.deal import DealRepository
from app.repositories.stage import StageRepository
from app.schemas.stage import StageCreate, StageUpdate


NEW_STAGE = "Новая"
CLOSED_WON_STAGE = "Успешно закрыта"
CLOSED_LOST_STAGE = "Проиграна"

# Seed-данные для стадий
DEFAULT_STAGES = [
    {"name": NEW_STAGE, "position": 1, "is_default": True},
    {"name": "Квалификация", "position": 2, "is_default": False},
    {"name": "Предложение", "position": 3, "is_default": False},
    {"name": "Переговоры", "position": 4, "is_default": False},
    {"name": CLOSED_WON_STAGE, "position": 5, "is_default": False},
    {"name": CLOSED_LOST_STAGE, "position": 6, "is_default": False},
]

CLOSED_STAGES = [CLOSED_WON_STAGE, CLOSED_LOST_STAGE]


class StageService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.stage_repo = StageRepository(session)
        self.deal_repo = DealRepository(session)

    async def seed_stages(self) -> list[Stage]:
        """Создание начальных стадий если их нет"""
        existing = await self.stage_repo.count()
        if existing > 0:
            return []

        stages = []
        for stage_data in DEFAULT_STAGES:
            stage = await self.stage_repo.create(stage_data)
            stages.append(stage)
        return stages

    async def create_stage(self, stage_data: StageCreate) -> Stage:
        # Проверка уникальности имени
        existing = await self.stage_repo.get_by_name(stage_data.name)
        if existing:
            raise BadRequestException(f"Стадия «{stage_data.name}» уже существует")

        return await self.stage_repo.create(stage_data.model_dump())

    async def list_stages(self) -> Sequence[Stage]:
        return await self.stage_repo.get_all_ordered()

    async def get_stage(self, stage_id: int) -> Stage:
        stage = await self.stage_repo.get_by_id(stage_id)
        if not stage:
            raise NotFoundException(f"Стадия с id {stage_id} не найдена")
        return stage

    async def update_stage(self, stage_id: int, stage_data: StageUpdate) -> Stage:
        stage = await self.get_stage(stage_id)

        # Проверка уникальности имени при обновлении
        if stage_data.name and stage_data.name != stage.name:
            existing = await self.stage_repo.get_by_name(stage_data.name)
            if existing:
                raise BadRequestException(f"Стадия «{stage_data.name}» уже существует")

        update_data = stage_data.model_dump(exclude_unset=True)
        return await self.stage_repo.update(stage, update_data)

    async def delete_stage(self, stage_id: int) -> None:
        stage = await self.get_stage(stage_id)

        # Запрет удаления стадии с привязанными сделками
        deal_count = await self.deal_repo.count_by_stage(stage_id)
        if deal_count > 0:
            raise BadRequestException(
                f"Нельзя удалить стадию: связанных сделок {deal_count}"
            )

        await self.stage_repo.delete(stage)

    async def reorder_stages(self, stage_ids: list[int]) -> Sequence[Stage]:
        """Изменение порядка стадий"""
        all_stages = await self.stage_repo.get_all_ordered()
        stages_by_id = {s.id: s for s in all_stages}
        existing_ids = set(stages_by_id)

        if set(stage_ids) != existing_ids:
            raise BadRequestException("Передан некорректный список стадий")

        # Сначала временные значения с большим offset (избегаем UNIQUE-конфликта)
        offset = len(stage_ids) + 1000
        for stage_id in stage_ids:
            stages_by_id[stage_id].position = stage_id + offset

        await self.session.flush()

        # Затем финальные позиции
        for position, stage_id in enumerate(stage_ids, start=1):
            stages_by_id[stage_id].position = position

        await self.session.commit()

        return await self.stage_repo.get_all_ordered()
