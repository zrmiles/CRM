from datetime import datetime, timezone
from typing import Optional, Sequence

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestException, NotFoundException
from app.core.security import hash_password
from app.models.user import User
from app.models.user_session import UserSession
from app.repositories.user import UserRepository
from app.schemas.user import UserUpdate


class UserService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.user_repo = UserRepository(session)

    async def list_users(
        self, skip: int = 0, limit: int = 100
    ) -> tuple[Sequence[User], int]:
        users = await self.user_repo.get_all(skip=skip, limit=limit)
        total = await self.user_repo.count()
        return users, total

    async def get_user(self, user_id: int) -> User:
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise NotFoundException(f"Пользователь с id {user_id} не найден")
        return user

    async def update_user(
        self, user_id: int, user_data: UserUpdate
    ) -> User:
        user = await self.get_user(user_id)

        # Проверка уникальности email при обновлении
        if user_data.email and user_data.email != user.email:
            existing = await self.user_repo.get_by_email(user_data.email)
            if existing:
                raise BadRequestException("Эта электронная почта уже зарегистрирована")

        update_data = user_data.model_dump(exclude_unset=True)
        
        # Преобразование role enum в строку
        if "role" in update_data and update_data["role"] is not None:
            update_data["role"] = update_data["role"].value

        return await self.user_repo.update(user, update_data)

    async def delete_user(self, user_id: int) -> User:
        """Soft delete: устанавливает is_active=False"""
        user = await self.get_user(user_id)
        updated_user = await self.user_repo.update(user, {"is_active": False})
        await self.session.execute(
            update(UserSession)
            .where(UserSession.user_id == user_id, UserSession.revoked_at.is_(None))
            .values(revoked_at=datetime.now(timezone.utc))
        )
        await self.session.commit()
        return updated_user
