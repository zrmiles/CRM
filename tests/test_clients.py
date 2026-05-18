import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
class TestClientsOwnership:
    async def test_sales_can_create_client(
        self, client: AsyncClient, sales_token: str
    ):
        """Sales может создать клиента"""
        response = await client.post(
            "/api/v1/clients/",
            headers={"Authorization": f"Bearer {sales_token}"},
            json={
                "first_name": "John",
                "last_name": "Doe",
                "email": "john@example.com",
                "phone": "+1234567890",
                "company": "ACME Corp"
            }
        )
        assert response.status_code == 201
        data = response.json()
        assert data["first_name"] == "John"
        assert "owner_id" in data

    async def test_sales_sees_only_own_clients(
        self, client: AsyncClient, sales_token: str, manager_token: str
    ):
        """Sales видит только своих клиентов"""
        # Sales создает клиента
        await client.post(
            "/api/v1/clients/",
            headers={"Authorization": f"Bearer {sales_token}"},
            json={
                "first_name": "Sales",
                "last_name": "Client",
                "email": "sales_client@example.com"
            }
        )
        
        # Manager создает клиента
        await client.post(
            "/api/v1/clients/",
            headers={"Authorization": f"Bearer {manager_token}"},
            json={
                "first_name": "Manager",
                "last_name": "Client",
                "email": "manager_client@example.com"
            }
        )
        
        # Sales видит только 1 клиента
        response = await client.get(
            "/api/v1/clients/",
            headers={"Authorization": f"Bearer {sales_token}"}
        )
        assert response.status_code == 200
        assert response.json()["total"] == 1
        
        # Manager тоже ограничен только своими клиентами.
        response = await client.get(
            "/api/v1/clients/",
            headers={"Authorization": f"Bearer {manager_token}"}
        )
        assert response.status_code == 200
        assert response.json()["total"] == 1

    async def test_search_clients(
        self, client: AsyncClient, admin_token: str
    ):
        """Поиск клиентов работает"""
        # Создаем тестовых клиентов
        await client.post(
            "/api/v1/clients/",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "first_name": "Alice",
                "last_name": "Smith",
                "email": "alice@example.com",
                "company": "TechCorp"
            }
        )
        
        # Поиск по имени
        response = await client.get(
            "/api/v1/clients/?search=Alice",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        assert response.json()["total"] >= 1

    async def test_admin_can_filter_clients_by_owner(
        self, client: AsyncClient, admin_token: str, manager_token: str
    ):
        """Admin может фильтровать клиентов по owner_id."""
        sales_registration = await client.post(
            "/api/v1/auth/register",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "email": "sales-owner@test.com",
                "password": "sales123",
                "full_name": "Sales Owner",
                "role": "sales"
            }
        )
        assert sales_registration.status_code == 201
        sales_user = sales_registration.json()

        manager_client = await client.post(
            "/api/v1/clients/",
            headers={"Authorization": f"Bearer {manager_token}"},
            json={
                "first_name": "Manager",
                "last_name": "Owned",
                "company": "TechCorp"
            }
        )
        assert manager_client.status_code == 201
        manager_owner_id = manager_client.json()["owner_id"]

        sales_login = await client.post(
            "/api/v1/auth/login",
            json={"email": "sales-owner@test.com", "password": "sales123"}
        )
        assert sales_login.status_code == 200
        sales_token = sales_login.json()["access_token"]

        sales_client = await client.post(
            "/api/v1/clients/",
            headers={"Authorization": f"Bearer {sales_token}"},
            json={"first_name": "Sales", "last_name": "Owned"}
        )
        assert sales_client.status_code == 201

        response = await client.get(
            f"/api/v1/clients/?owner_id={sales_user['id']}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        assert response.json()["total"] == 1
        assert response.json()["items"][0]["owner_id"] == sales_user["id"]

        response = await client.get(
            f"/api/v1/clients/?owner_id={manager_owner_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        assert response.json()["total"] >= 1
        
        # Поиск по компании
        response = await client.get(
            "/api/v1/clients/?search=TechCorp",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        assert response.json()["total"] >= 1

    async def test_soft_delete_client_with_deals_hides_it_from_lists(
        self, client: AsyncClient, admin_token: str
    ):
        await client.post(
            "/api/v1/stages/seed",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        stages = (
            await client.get(
                "/api/v1/stages/",
                headers={"Authorization": f"Bearer {admin_token}"},
            )
        ).json()
        crm_client = (
            await client.post(
                "/api/v1/clients/",
                headers={"Authorization": f"Bearer {admin_token}"},
                json={"first_name": "Deal", "last_name": "Client", "email": "client-deal@x.com"},
            )
        ).json()
        deal = await client.post(
            "/api/v1/deals/",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "title": "Client deal",
                "client_id": crm_client["id"],
                "stage_id": stages[0]["id"],
            },
        )
        assert deal.status_code == 201

        response = await client.delete(
            f"/api/v1/clients/{crm_client['id']}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 204

        list_response = await client.get(
            "/api/v1/clients/",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert all(item["id"] != crm_client["id"] for item in list_response.json()["items"])
