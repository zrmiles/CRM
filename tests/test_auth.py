import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
class TestAuth:
    async def test_register_first_user_is_admin(self, client: AsyncClient):
        """Первый пользователь должен стать Admin"""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "first@test.com",
                "password": "test12345",
                "full_name": "First User",
                "role": "sales"
            }
        )
        assert response.status_code == 201
        data = response.json()
        assert data["role"] == "admin"  # Первый пользователь = Admin
        assert data["is_active"] is True

    async def test_register_duplicate_email(self, client: AsyncClient, admin_token: str):
        """Нельзя зарегистрировать дубликат email"""
        response = await client.post(
            "/api/v1/auth/register",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "email": "admin@test.com",  # Уже существует
                "password": "test12345",
                "full_name": "Duplicate",
                "role": "sales"
            }
        )
        assert response.status_code == 400
        assert "уже зарегистрирована" in response.json()["detail"].lower()

    async def test_register_requires_admin_after_first_user(
        self, client: AsyncClient, admin_token: str
    ):
        """После первого пользователя регистрация доступна только Admin."""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "blocked@test.com",
                "password": "test12345",
                "full_name": "Blocked User",
                "role": "sales"
            }
        )
        assert response.status_code == 403

    async def test_login_success(self, client: AsyncClient, admin_token: str):
        """Успешный вход"""
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@test.com", "password": "admin123"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" not in data
        assert "httponly" in response.headers["set-cookie"].lower()
        assert data["token_type"] == "bearer"

    async def test_login_wrong_password(self, client: AsyncClient, admin_token: str):
        """Вход с неверным паролем"""
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@test.com", "password": "wrongpassword"}
        )
        assert response.status_code == 401

    async def test_refresh_rotates_token(self, client: AsyncClient, admin_token: str):
        """Refresh token одноразовый: старый токен отзывается после refresh."""
        login_response = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@test.com", "password": "admin123"}
        )
        assert login_response.status_code == 200
        old_refresh = login_response.cookies.get("mini_crm_refresh_token")
        assert old_refresh is not None

        refresh_response = await client.post(
            "/api/v1/auth/refresh",
        )
        assert refresh_response.status_code == 200
        assert "refresh_token" not in refresh_response.json()
        assert refresh_response.cookies.get("mini_crm_refresh_token") != old_refresh

        second_refresh_response = await client.post(
            "/api/v1/auth/refresh",
            headers={"Cookie": f"mini_crm_refresh_token={old_refresh}"},
        )
        assert second_refresh_response.status_code == 401

    async def test_refresh_works_from_http_only_cookie(
        self, client: AsyncClient, admin_token: str
    ):
        login_response = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@test.com", "password": "admin123"}
        )
        assert login_response.status_code == 200
        assert "mini_crm_refresh_token" in login_response.headers["set-cookie"]

        refresh_response = await client.post("/api/v1/auth/refresh")
        assert refresh_response.status_code == 200
        assert "access_token" in refresh_response.json()
        assert "refresh_token" not in refresh_response.json()
        assert "mini_crm_refresh_token" in refresh_response.headers["set-cookie"]

    async def test_register_rejects_short_password(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "short-password@test.com",
                "password": "short",
                "full_name": "Short Password",
                "role": "sales"
            }
        )
        assert response.status_code == 422

    async def test_get_me(self, client: AsyncClient, admin_token: str):
        """Получение текущего пользователя"""
        response = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "admin@test.com"
        assert data["role"] == "admin"

    async def test_unauthorized_access(self, client: AsyncClient):
        """Доступ без токена запрещен"""
        response = await client.get("/api/v1/auth/me")
        assert response.status_code == 401
