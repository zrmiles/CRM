import pytest
from httpx import AsyncClient


async def _setup_client(client: AsyncClient, token: str, email: str = "c@x.com") -> int:
    resp = await client.post(
        "/api/v1/clients/",
        headers={"Authorization": f"Bearer {token}"},
        json={"first_name": "T", "last_name": "C", "email": email},
    )
    return resp.json()["id"]


@pytest.mark.asyncio
class TestActivities:
    async def test_create_activity(self, client: AsyncClient, admin_token: str):
        client_id = await _setup_client(client, admin_token)
        response = await client.post(
            "/api/v1/activities/",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"type": "call", "description": "Called client", "client_id": client_id},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["type"] == "call"
        assert data["description"] == "Called client"

    async def test_all_activity_types(self, client: AsyncClient, admin_token: str):
        client_id = await _setup_client(client, admin_token)
        for activity_type in ("call", "email", "meeting", "note"):
            resp = await client.post(
                "/api/v1/activities/",
                headers={"Authorization": f"Bearer {admin_token}"},
                json={"type": activity_type, "description": f"{activity_type} desc", "client_id": client_id},
            )
            assert resp.status_code == 201

    async def test_activities_are_immutable(self, client: AsyncClient, admin_token: str):
        """Активности нельзя редактировать или удалять"""
        client_id = await _setup_client(client, admin_token)
        activity = (
            await client.post(
                "/api/v1/activities/",
                headers={"Authorization": f"Bearer {admin_token}"},
                json={"type": "note", "description": "Заметка", "client_id": client_id},
            )
        ).json()

        put_resp = await client.put(
            f"/api/v1/activities/{activity['id']}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"description": "Обновлено"},
        )
        delete_resp = await client.delete(
            f"/api/v1/activities/{activity['id']}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert put_resp.status_code == 405
        assert delete_resp.status_code == 405

    async def test_sales_sees_only_own_activities(
        self, client: AsyncClient, admin_token: str, sales_token: str
    ):
        # Admin создаёт активность по своему клиенту
        admin_client_id = await _setup_client(client, admin_token, "a@x.com")
        await client.post(
            "/api/v1/activities/",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"type": "call", "description": "Звонок администратора", "client_id": admin_client_id},
        )

        # Sales не видит активности admin
        response = await client.get(
            "/api/v1/activities/",
            headers={"Authorization": f"Bearer {sales_token}"},
        )
        assert response.status_code == 200
        assert response.json()["total"] == 0

    async def test_filter_by_type(self, client: AsyncClient, admin_token: str):
        client_id = await _setup_client(client, admin_token)
        await client.post(
            "/api/v1/activities/",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"type": "call", "description": "Звонок", "client_id": client_id},
        )
        await client.post(
            "/api/v1/activities/",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"type": "email", "description": "Письмо", "client_id": client_id},
        )

        response = await client.get(
            "/api/v1/activities/?activity_type=call",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 200
        assert response.json()["total"] == 1

    async def test_activity_deal_must_belong_to_client(
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
        client_id = await _setup_client(client, admin_token, "activity-client@x.com")
        other_client_id = await _setup_client(client, admin_token, "activity-other@x.com")
        deal = (
            await client.post(
                "/api/v1/deals/",
                headers={"Authorization": f"Bearer {admin_token}"},
                json={
                    "title": "Activity deal",
                    "client_id": client_id,
                    "stage_id": stages[0]["id"],
                },
            )
        ).json()

        response = await client.post(
            "/api/v1/activities/",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "type": "note",
                "description": "Wrong pair",
                "client_id": other_client_id,
                "deal_id": deal["id"],
            },
        )
        assert response.status_code == 400

    async def test_soft_delete_client_with_activities_hides_it_from_lists(
        self, client: AsyncClient, admin_token: str
    ):
        client_id = await _setup_client(client, admin_token, "activity-delete@x.com")
        activity = await client.post(
            "/api/v1/activities/",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"type": "note", "description": "Keep history", "client_id": client_id},
        )
        assert activity.status_code == 201

        response = await client.delete(
            f"/api/v1/clients/{client_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 204

        list_response = await client.get(
            "/api/v1/clients/",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert all(item["id"] != client_id for item in list_response.json()["items"])
