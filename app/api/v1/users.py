from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import UserRole
from app.core.database import get_async_session
from app.core.dependencies import require_roles
from app.models.user import User
from app.schemas.user import UserOptionRead, UserRead, UserUpdate
from app.services.user import UserService

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/", response_model=list[UserRead])
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    """Список всех пользователей. Только для администратора."""
    service = UserService(session)
    users, _ = await service.list_users(skip=skip, limit=limit)
    return users


@router.get("/options", response_model=list[UserOptionRead])
async def list_user_options(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
):
    """Список активных пользователей для фильтров и отображения. Только для администратора и менеджера."""
    service = UserService(session)
    users, _ = await service.list_users(skip=0, limit=100)
    return [user for user in users if user.is_active]


@router.get("/{user_id}", response_model=UserRead)
async def get_user(
    user_id: int,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    """Получение пользователя по ID. Только для администратора."""
    service = UserService(session)
    return await service.get_user(user_id)


@router.patch("/{user_id}", response_model=UserRead)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    """Обновление пользователя. Только для администратора."""
    service = UserService(session)
    return await service.update_user(user_id, user_data)


@router.delete("/{user_id}", response_model=UserRead)
async def delete_user(
    user_id: int,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    """Мягкое удаление пользователя через is_active=False. Только для администратора."""
    service = UserService(session)
    return await service.delete_user(user_id)
