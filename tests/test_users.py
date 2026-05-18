import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
class TestRBAC:
    async def test_sales_cannot_access_users_endpoint(
        self, client: AsyncClient, sales_token: str
    ):
        """Sales не может получить список пользователей"""
        response = await client.get(
            "/api/v1/users/",
            headers={"Authorization": f"Bearer {sales_token}"}
        )
        assert response.status_code == 403

    async def test_admin_can_list_users(
        self, client: AsyncClient, admin_token: str, sales_token: str
    ):
        """Admin может получить список пользователей"""
        response = await client.get(
            "/api/v1/users/",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2  # Admin + Sales

    async def test_admin_and_manager_can_list_user_options(
        self, client: AsyncClient, admin_token: str, manager_token: str
    ):
        """Admin и Manager могут получить безопасный список пользователей для фильтров."""
        for token in (admin_token, manager_token):
            response = await client.get(
                "/api/v1/users/options",
                headers={"Authorization": f"Bearer {token}"}
            )
            assert response.status_code == 200
            data = response.json()
            assert len(data) >= 2
            assert {"id", "email", "full_name", "role"} <= set(data[0])
            assert "hashed_password" not in data[0]

    async def test_sales_cannot_list_user_options(
        self, client: AsyncClient, sales_token: str
    ):
        """Sales не может получить список пользователей для фильтров."""
        response = await client.get(
            "/api/v1/users/options",
            headers={"Authorization": f"Bearer {sales_token}"}
        )
        assert response.status_code == 403

    async def test_admin_can_deactivate_user(
        self, client: AsyncClient, admin_token: str, sales_token: str
    ):
        """Admin может деактивировать пользователя"""
        # Получаем ID sales пользователя
        response = await client.get(
            "/api/v1/users/",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        sales_user = next(u for u in response.json() if u["email"] == "sales@test.com")
        
        # Деактивируем
        response = await client.delete(
            f"/api/v1/users/{sales_user['id']}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        assert response.json()["is_active"] is False

    async def test_deactivate_user_revokes_refresh_sessions(
        self, client: AsyncClient, admin_token: str, sales_token: str
    ):
        """После деактивации пользователь не может обновить refresh token."""
        login_response = await client.post(
            "/api/v1/auth/login",
            json={"email": "sales@test.com", "password": "sales123"}
        )
        assert login_response.status_code == 200
        refresh_token = login_response.cookies.get("mini_crm_refresh_token")
        assert refresh_token is not None

        users_response = await client.get(
            "/api/v1/users/",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        sales_user = next(u for u in users_response.json() if u["email"] == "sales@test.com")

        delete_response = await client.delete(
            f"/api/v1/users/{sales_user['id']}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert delete_response.status_code == 200

        refresh_response = await client.post(
            "/api/v1/auth/refresh",
            headers={"Cookie": f"mini_crm_refresh_token={refresh_token}"},
        )
        assert refresh_response.status_code == 401
