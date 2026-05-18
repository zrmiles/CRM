import pytest
from httpx import AsyncClient

from app.services.stage import CLOSED_LOST_STAGE, CLOSED_WON_STAGE, NEW_STAGE


@pytest.mark.asyncio
class TestStages:
    async def test_seed_stages(self, client: AsyncClient, admin_token: str):
        response = await client.post(
            "/api/v1/stages/seed",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 201
        stages = response.json()
        assert len(stages) == 6
        names = [s["name"] for s in stages]
        assert NEW_STAGE in names
        assert CLOSED_WON_STAGE in names
        assert CLOSED_LOST_STAGE in names

    async def test_seed_stages_idempotent(self, client: AsyncClient, admin_token: str):
        await client.post(
            "/api/v1/stages/seed",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        response = await client.post(
            "/api/v1/stages/seed",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 201
        assert response.json() == []

    async def test_list_stages_ordered(self, client: AsyncClient, admin_token: str):
        await client.post(
            "/api/v1/stages/seed",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        response = await client.get(
            "/api/v1/stages/",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 200
        stages = response.json()
        positions = [s["position"] for s in stages]
        assert positions == sorted(positions)

    async def test_sales_cannot_create_stage(
        self, client: AsyncClient, sales_token: str
    ):
        response = await client.post(
            "/api/v1/stages/",
            headers={"Authorization": f"Bearer {sales_token}"},
            json={"name": "Дополнительная стадия", "position": 10},
        )
        assert response.status_code == 403

    async def test_admin_can_create_stage(self, client: AsyncClient, admin_token: str):
        response = await client.post(
            "/api/v1/stages/",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"name": "Дополнительная стадия", "position": 10},
        )
        assert response.status_code == 201
        assert response.json()["name"] == "Дополнительная стадия"

    async def test_cannot_delete_stage_with_deals(
        self, client: AsyncClient, admin_token: str
    ):
        await client.post(
            "/api/v1/stages/seed",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        client_resp = await client.post(
            "/api/v1/clients/",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"first_name": "Test", "last_name": "Client", "email": "tc@x.com"},
        )
        stages = (
            await client.get(
                "/api/v1/stages/",
                headers={"Authorization": f"Bearer {admin_token}"},
            )
        ).json()
        stage_id = stages[0]["id"]

        await client.post(
            "/api/v1/deals/",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "title": "Deal",
                "client_id": client_resp.json()["id"],
                "stage_id": stage_id,
            },
        )
        response = await client.delete(
            f"/api/v1/stages/{stage_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 400
        assert "связанных сделок" in response.json()["detail"].lower()

    async def test_reorder_stages(self, client: AsyncClient, admin_token: str):
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
        reversed_ids = [s["id"] for s in reversed(stages)]

        response = await client.put(
            "/api/v1/stages/reorder",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"stage_ids": reversed_ids},
        )
        assert response.status_code == 200
        reordered = response.json()
        assert [s["id"] for s in reordered] == reversed_ids
