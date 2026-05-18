from collections.abc import Callable

from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import UserRole
from app.core.database import get_async_session
from app.core.exceptions import ForbiddenException, UnauthorizedException
from app.core.security import verify_token
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")
optional_oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login",
    auto_error=False,
)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: AsyncSession = Depends(get_async_session),
) -> User:
    payload = verify_token(token)
    if payload is None or payload.get("type") != "access":
        raise UnauthorizedException("Токен недействителен или истек")

    user_id = payload.get("sub")
    if user_id is None:
        raise UnauthorizedException("Некорректные данные токена")

    result = await session.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise UnauthorizedException("Пользователь не найден или неактивен")

    return user


async def get_optional_current_user(
    token: str | None = Depends(optional_oauth2_scheme),
    session: AsyncSession = Depends(get_async_session),
) -> User | None:
    if token is None:
        return None

    payload = verify_token(token)
    if payload is None or payload.get("type") != "access":
        raise UnauthorizedException("Токен недействителен или истек")

    user_id = payload.get("sub")
    if user_id is None:
        raise UnauthorizedException("Некорректные данные токена")

    result = await session.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise UnauthorizedException("Пользователь не найден или неактивен")

    return user


def require_roles(*roles: UserRole) -> Callable:
    async def role_checker(
        current_user: User = Depends(get_current_user),
    ) -> User:
        if current_user.role not in roles:
            raise ForbiddenException("Недостаточно прав")
        return current_user

    return role_checker
