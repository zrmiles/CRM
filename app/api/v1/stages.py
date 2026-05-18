from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import UserRole
from app.core.database import get_async_session
from app.core.dependencies import get_current_user, require_roles
from app.models.user import User
from app.schemas.stage import StageCreate, StageRead, StageReorder, StageUpdate
from app.services.stage import StageService

router = APIRouter(prefix="/stages", tags=["stages"])


@router.post("/", response_model=StageRead, status_code=201)
async def create_stage(
    stage_data: StageCreate,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    """Создание стадии. Только для администратора."""
    service = StageService(session)
    return await service.create_stage(stage_data)


@router.get("/", response_model=list[StageRead])
async def list_stages(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Список всех стадий в порядке воронки."""
    service = StageService(session)
    return await service.list_stages()


@router.post("/seed", response_model=list[StageRead], status_code=201)
async def seed_stages(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    """Создание базовых стадий. Только для администратора."""
    service = StageService(session)
    return await service.seed_stages()


@router.patch("/{stage_id}", response_model=StageRead)
async def update_stage(
    stage_id: int,
    stage_data: StageUpdate,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    """Обновление стадии. Только для администратора."""
    service = StageService(session)
    return await service.update_stage(stage_id, stage_data)


@router.delete("/{stage_id}", status_code=204)
async def delete_stage(
    stage_id: int,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    """Удаление стадии. Только для администратора. Стадию со сделками удалить нельзя."""
    service = StageService(session)
    await service.delete_stage(stage_id)


@router.put("/reorder", response_model=list[StageRead])
async def reorder_stages(
    reorder_data: StageReorder,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    """Изменение порядка стадий. Только для администратора."""
    service = StageService(session)
    return await service.reorder_stages(reorder_data.stage_ids)
