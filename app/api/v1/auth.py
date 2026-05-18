from fastapi import APIRouter, Cookie, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.core.dependencies import get_current_user, get_optional_current_user
from app.core.rate_limit import auth_rate_limiter
from app.core.config import get_settings
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse
from app.schemas.user import UserCreate, UserRead
from app.services.auth import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    response.set_cookie(
        key=settings.REFRESH_TOKEN_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        secure=settings.REFRESH_TOKEN_COOKIE_SECURE,
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path="/api/v1/auth",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.REFRESH_TOKEN_COOKIE_NAME,
        path="/api/v1/auth",
        samesite="lax",
    )


@router.post("/register", response_model=UserRead, status_code=201)
async def register(
    request: Request,
    user_data: UserCreate,
    _: None = Depends(auth_rate_limiter),
    current_user: User | None = Depends(get_optional_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Регистрация пользователя. Первый пользователь получает роль администратора."""
    service = AuthService(session)
    user = await service.register(user_data, current_user, request)
    return user


@router.post("/login", response_model=TokenResponse)
async def login(
    request: Request,
    response: Response,
    credentials: LoginRequest,
    _: None = Depends(auth_rate_limiter),
    session: AsyncSession = Depends(get_async_session),
):
    """Вход пользователя и выдача JWT-токенов."""
    service = AuthService(session)
    tokens = await service.login(credentials.email, credentials.password, request)
    _set_refresh_cookie(response, tokens["refresh_token"])
    return TokenResponse(access_token=tokens["access_token"])


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    request: Request,
    response: Response,
    refresh_cookie: str | None = Cookie(default=None, alias=settings.REFRESH_TOKEN_COOKIE_NAME),
    _: None = Depends(auth_rate_limiter),
    session: AsyncSession = Depends(get_async_session),
):
    """Обновление access-токена по refresh-токену."""
    service = AuthService(session)
    tokens = await service.refresh(refresh_cookie, request)
    _set_refresh_cookie(response, tokens["refresh_token"])
    return TokenResponse(access_token=tokens["access_token"])


@router.post("/logout", status_code=204)
async def logout(
    response: Response,
    refresh_cookie: str | None = Cookie(default=None, alias=settings.REFRESH_TOKEN_COOKIE_NAME),
    session: AsyncSession = Depends(get_async_session),
):
    """Отзыв текущего refresh-токена и очистка httpOnly cookie."""
    service = AuthService(session)
    await service.revoke_refresh_token(refresh_cookie)
    _clear_refresh_cookie(response)


@router.get("/me", response_model=UserRead)
async def get_me(
    current_user: User = Depends(get_current_user),
):
    """Получение текущего авторизованного пользователя."""
    return current_user
