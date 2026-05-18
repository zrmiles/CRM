import pytest
from httpx import AsyncClient


async def _setup_deal(client: AsyncClient, token: str, email: str = "c@x.com") -> dict:
    """Вспомогательная функция: seed stages + client + deal."""
    await client.post(
        "/api/v1/stages/seed", headers={"Authorization": f"Bearer {token}"}
    )
    client_resp = await client.post(
        "/api/v1/clients/",
        headers={"Authorization": f"Bearer {token}"},
        json={"first_name": "T", "last_name": "C", "email": email},
    )
    stages = (
        await client.get(
            "/api/v1/stages/", headers={"Authorization": f"Bearer {token}"}
        )
    ).json()
    deal_resp = await client.post(
        "/api/v1/deals/",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "title": "Deal",
            "client_id": client_resp.json()["id"],
            "stage_id": stages[0]["id"],
        },
    )
    return deal_resp.json()


@pytest.mark.asyncio
class TestTasks:
    async def test_create_task(self, client: AsyncClient, admin_token: str):
        deal = await _setup_deal(client, admin_token)
        response = await client.post(
            "/api/v1/tasks/",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"title": "Call client", "deal_id": deal["id"]},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Call client"
        assert data["is_completed"] is False

    async def test_complete_task(self, client: AsyncClient, admin_token: str):
        deal = await _setup_deal(client, admin_token)
        task = (
            await client.post(
                "/api/v1/tasks/",
                headers={"Authorization": f"Bearer {admin_token}"},
                json={"title": "Task", "deal_id": deal["id"]},
            )
        ).json()

        response = await client.patch(
            f"/api/v1/tasks/{task['id']}/complete",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 200
        assert response.json()["is_completed"] is True

    async def test_update_task_completion_status(
        self, client: AsyncClient, admin_token: str
    ):
        deal = await _setup_deal(client, admin_token)
        task = (
            await client.post(
                "/api/v1/tasks/",
                headers={"Authorization": f"Bearer {admin_token}"},
                json={"title": "Task", "deal_id": deal["id"]},
            )
        ).json()

        done = await client.patch(
            f"/api/v1/tasks/{task['id']}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"is_completed": True},
        )
        assert done.status_code == 200
        assert done.json()["is_completed"] is True

        active = await client.patch(
            f"/api/v1/tasks/{task['id']}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"is_completed": False},
        )
        assert active.status_code == 200
        assert active.json()["is_completed"] is False

    async def test_sales_sees_only_own_tasks(
        self, client: AsyncClient, admin_token: str, sales_token: str
    ):
        # Admin создаёт сделку и задачу
        deal = await _setup_deal(client, admin_token, "a@x.com")
        await client.post(
            "/api/v1/tasks/",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"title": "Admin task", "deal_id": deal["id"]},
        )

        # Sales запрашивает список задач — не видит чужих
        response = await client.get(
            "/api/v1/tasks/",
            headers={"Authorization": f"Bearer {sales_token}"},
        )
        assert response.status_code == 200
        assert response.json()["total"] == 0

    async def test_sales_cannot_access_others_task(
        self, client: AsyncClient, admin_token: str, sales_token: str
    ):
        deal = await _setup_deal(client, admin_token, "b@x.com")
        task = (
            await client.post(
                "/api/v1/tasks/",
                headers={"Authorization": f"Bearer {admin_token}"},
                json={"title": "Task", "deal_id": deal["id"]},
            )
        ).json()

        response = await client.get(
            f"/api/v1/tasks/{task['id']}",
            headers={"Authorization": f"Bearer {sales_token}"},
        )
        assert response.status_code == 403

    async def test_filter_by_is_completed(
        self, client: AsyncClient, admin_token: str
    ):
        deal = await _setup_deal(client, admin_token)
        task = (
            await client.post(
                "/api/v1/tasks/",
                headers={"Authorization": f"Bearer {admin_token}"},
                json={"title": "T", "deal_id": deal["id"]},
            )
        ).json()
        await client.patch(
            f"/api/v1/tasks/{task['id']}/complete",
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        done = await client.get(
            "/api/v1/tasks/?is_completed=true",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        pending = await client.get(
            "/api/v1/tasks/?is_completed=false",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert done.json()["total"] == 1
        assert pending.json()["total"] == 0

    async def test_create_task_rejects_missing_assignee(
        self, client: AsyncClient, admin_token: str
    ):
        deal = await _setup_deal(client, admin_token)
        response = await client.post(
            "/api/v1/tasks/",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"title": "Bad assignee", "deal_id": deal["id"], "assignee_id": 999},
        )
        assert response.status_code == 400

    async def test_sales_cannot_assign_task_to_another_user(
        self, client: AsyncClient, admin_token: str, sales_token: str
    ):
        registration = await client.post(
            "/api/v1/auth/register",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "email": "another-sales@test.com",
                "password": "sales123",
                "full_name": "Another Sales",
                "role": "sales",
            },
        )
        assert registration.status_code == 201
        await client.post(
            "/api/v1/stages/seed",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        deal = await _setup_deal(client, sales_token, "sales-task@x.com")

        response = await client.post(
            "/api/v1/tasks/",
            headers={"Authorization": f"Bearer {sales_token}"},
            json={
                "title": "Assign away",
                "deal_id": deal["id"],
                "assignee_id": registration.json()["id"],
            },
        )
        assert response.status_code == 403

    async def test_sales_assignee_must_own_deal(
        self, client: AsyncClient, admin_token: str
    ):
        registration = await client.post(
            "/api/v1/auth/register",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "email": "task-owner@test.com",
                "password": "sales123",
                "full_name": "Task Owner",
                "role": "sales",
            },
        )
        assert registration.status_code == 201
        deal = await _setup_deal(client, admin_token, "admin-task@x.com")

        response = await client.post(
            "/api/v1/tasks/",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "title": "Wrong sales owner",
                "deal_id": deal["id"],
                "assignee_id": registration.json()["id"],
            },
        )
        assert response.status_code == 400

    async def test_soft_delete_deal_with_tasks_hides_it_from_lists(
        self, client: AsyncClient, admin_token: str
    ):
        deal = await _setup_deal(client, admin_token, "delete-task@x.com")
        task = await client.post(
            "/api/v1/tasks/",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"title": "Task", "deal_id": deal["id"]},
        )
        assert task.status_code == 201

        response = await client.delete(
            f"/api/v1/deals/{deal['id']}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 204

        list_response = await client.get(
            "/api/v1/deals/",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert all(item["id"] != deal["id"] for item in list_response.json()["items"])
