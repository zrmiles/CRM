from datetime import datetime, timedelta, timezone

from fastapi import Request
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.constants import UserRole
from app.core.exceptions import BadRequestException, ForbiddenException, UnauthorizedException
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_token,
    hash_password,
    verify_password,
    verify_token,
)
from app.models.auth_event import AuthEvent
from app.models.user import User
from app.models.user_session import UserSession
from app.repositories.user import UserRepository
from app.schemas.user import UserCreate


class AuthService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.user_repo = UserRepository(session)
        self.settings = get_settings()

    async def register(
        self,
        user_data: UserCreate,
        current_user: User | None = None,
        request: Request | None = None,
    ) -> User:
        try:
            total_users = await self.user_repo.count()
            if total_users > 0 and (
                current_user is None or current_user.role != UserRole.ADMIN.value
            ):
                raise ForbiddenException("Только администратор может регистрировать новых пользователей")

            existing_user = await self.user_repo.get_by_email(user_data.email)
            if existing_user:
                raise BadRequestException("Эта электронная почта уже зарегистрирована")

            role = UserRole.ADMIN if total_users == 0 else user_data.role

            user = await self.user_repo.create({
                "email": user_data.email,
                "hashed_password": hash_password(user_data.password),
                "full_name": user_data.full_name,
                "role": role.value,
            })
            await self._record_auth_event("register", user_data.email, True, request, user.id)
            return user
        except Exception as exc:
            await self._record_auth_event(
                "register",
                str(user_data.email),
                False,
                request,
                reason=self._exception_reason(exc),
            )
            raise

    async def login(self, email: str, password: str, request: Request | None = None) -> dict:
        try:
            user = await self.user_repo.get_by_email(email)

            if not user or not verify_password(password, user.hashed_password):
                raise UnauthorizedException("Неверная электронная почта или пароль")

            if not user.is_active:
                raise UnauthorizedException("Учетная запись отключена")

            tokens = await self._issue_tokens(user)
            await self._record_auth_event("login", email, True, request, user.id)
            return tokens
        except Exception as exc:
            await self._record_auth_event(
                "login",
                email,
                False,
                request,
                reason=self._exception_reason(exc),
            )
            raise

    async def refresh(self, refresh_token: str | None, request: Request | None = None) -> dict:
        try:
            if refresh_token is None:
                raise UnauthorizedException("Токен обновления обязателен")

            payload = verify_token(refresh_token)

            if payload is None:
                raise UnauthorizedException("Токен обновления недействителен")

            if payload.get("type") != "refresh":
                raise UnauthorizedException("Некорректный тип токена")

            user_id = payload.get("sub")
            if user_id is None:
                raise UnauthorizedException("Некорректные данные токена")

            user = await self.user_repo.get_by_id(int(user_id))

            if user is None or not user.is_active:
                raise UnauthorizedException("Пользователь не найден или неактивен")

            session_record = await self._get_active_session(refresh_token)
            if session_record is None or session_record.user_id != user.id:
                raise UnauthorizedException("Токен обновления отозван")

            session_record.revoked_at = datetime.now(timezone.utc)
            await self.session.flush()

            tokens = await self._issue_tokens(user)
            await self._record_auth_event("refresh", user.email, True, request, user.id)
            return tokens
        except Exception as exc:
            await self._record_auth_event(
                "refresh",
                None,
                False,
                request,
                reason=self._exception_reason(exc),
            )
            raise

    async def revoke_refresh_token(self, refresh_token: str | None) -> None:
        if refresh_token is None:
            return

        session_record = await self._get_active_session(refresh_token)
        if session_record is None:
            return

        session_record.revoked_at = datetime.now(timezone.utc)
        await self.session.commit()

    async def _issue_tokens(self, user: User) -> dict:
        token_data = {"sub": str(user.id), "role": user.role}
        refresh_token = create_refresh_token(token_data)
        expires_at = datetime.now(timezone.utc) + timedelta(
            days=self.settings.REFRESH_TOKEN_EXPIRE_DAYS
        )
        self.session.add(
            UserSession(
                user_id=user.id,
                refresh_token_hash=hash_token(refresh_token),
                expires_at=expires_at,
            )
        )
        await self.session.commit()
        return {
            "access_token": create_access_token(token_data),
            "refresh_token": refresh_token,
            "token_type": "bearer",
        }

    async def _get_active_session(self, refresh_token: str) -> UserSession | None:
        now = datetime.now(timezone.utc)
        result = await self.session.execute(
            select(UserSession).where(
                UserSession.refresh_token_hash == hash_token(refresh_token),
                UserSession.revoked_at.is_(None),
                UserSession.expires_at > now,
            )
        )
        return result.scalar_one_or_none()

    async def revoke_user_sessions(self, user_id: int) -> None:
        await self.session.execute(
            update(UserSession)
            .where(UserSession.user_id == user_id, UserSession.revoked_at.is_(None))
            .values(revoked_at=datetime.now(timezone.utc))
        )
        await self.session.commit()

    async def _record_auth_event(
        self,
        event_type: str,
        email: str | None,
        success: bool,
        request: Request | None,
        user_id: int | None = None,
        reason: str | None = None,
    ) -> None:
        client_host = request.client.host if request and request.client else None
        user_agent = request.headers.get("user-agent") if request else None
        self.session.add(
            AuthEvent(
                event_type=event_type,
                email=email,
                user_id=user_id,
                success=success,
                ip_address=client_host,
                user_agent=user_agent,
                reason=reason,
            )
        )
        await self.session.commit()

    @staticmethod
    def _exception_reason(exc: Exception) -> str:
        detail = getattr(exc, "detail", None)
        return str(detail or exc)
