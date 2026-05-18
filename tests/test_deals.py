import pytest
from httpx import AsyncClient

from app.services.stage import CLOSED_WON_STAGE, NEW_STAGE


async def _seed_stages_and_get_new(client: AsyncClient, token: str) -> dict:
    await client.post(
        "/api/v1/stages/seed",
        headers={"Authorization": f"Bearer {token}"}
    )
    stages = (
        await client.get(
            "/api/v1/stages/",
            headers={"Authorization": f"Bearer {token}"}
        )
    ).json()
    return next(s for s in stages if s["name"] == NEW_STAGE)


@pytest.mark.asyncio
class TestStagesAndDeals:
    async def test_seed_stages(self, client: AsyncClient, admin_token: str):
        """Создание seed-данных для стадий"""
        response = await client.post(
            "/api/v1/stages/seed",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 201
        stages = response.json()
        assert len(stages) == 6
        assert stages[0]["name"] == NEW_STAGE
        assert stages[0]["is_default"] is True

    async def test_deal_stage_transition_to_closed_won(
        self, client: AsyncClient, admin_token: str
    ):
        """При переходе в успешно закрытую стадию автоматически заполняется closed_at"""
        # Seed stages
        await client.post(
            "/api/v1/stages/seed",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        # Создаем клиента
        client_resp = await client.post(
            "/api/v1/clients/",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "first_name": "Test",
                "last_name": "Client",
                "email": "test@example.com"
            }
        )
        client_id = client_resp.json()["id"]
        
        # Получаем стадии
        stages_resp = await client.get(
            "/api/v1/stages/",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        stages = stages_resp.json()
        new_stage = next(s for s in stages if s["name"] == NEW_STAGE)
        closed_won_stage = next(s for s in stages if s["name"] == CLOSED_WON_STAGE)
        
        # Создаем сделку в начальной стадии
        deal_resp = await client.post(
            "/api/v1/deals/",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "title": "Test Deal",
                "client_id": client_id,
                "stage_id": new_stage["id"],
                "amount": 10000
            }
        )
        assert deal_resp.status_code == 201
        deal = deal_resp.json()
        assert deal["closed_at"] is None
        
        # Переводим в успешно закрытую стадию
        update_resp = await client.patch(
            f"/api/v1/deals/{deal['id']}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"stage_id": closed_won_stage["id"]}
        )
        assert update_resp.status_code == 200
        updated_deal = update_resp.json()
        assert updated_deal["closed_at"] is not None

    async def test_cannot_delete_stage_with_deals(
        self, client: AsyncClient, admin_token: str
    ):
        """Нельзя удалить стадию с привязанными сделками"""
        # Seed stages
        await client.post(
            "/api/v1/stages/seed",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        # Создаем клиента и сделку
        client_resp = await client.post(
            "/api/v1/clients/",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "first_name": "Test",
                "last_name": "Client",
                "email": "test2@example.com"
            }
        )
        client_id = client_resp.json()["id"]
        
        stages_resp = await client.get(
            "/api/v1/stages/",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        new_stage = stages_resp.json()[0]
        
        await client.post(
            "/api/v1/deals/",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "title": "Deal",
                "client_id": client_id,
                "stage_id": new_stage["id"],
                "amount": 5000
            }
        )
        
        # Попытка удалить стадию
        delete_resp = await client.delete(
            f"/api/v1/stages/{new_stage['id']}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert delete_resp.status_code == 400
        assert "связанных сделок" in delete_resp.json()["detail"].lower()

    async def test_create_deal_rejects_missing_client(
        self, client: AsyncClient, admin_token: str
    ):
        new_stage = await _seed_stages_and_get_new(client, admin_token)

        response = await client.post(
            "/api/v1/deals/",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"title": "No client", "client_id": 999, "stage_id": new_stage["id"]},
        )
        assert response.status_code == 404

    async def test_sales_cannot_move_deal_to_other_client(
        self, client: AsyncClient, admin_token: str, sales_token: str
    ):
        new_stage = await _seed_stages_and_get_new(client, admin_token)
        own_client = (
            await client.post(
                "/api/v1/clients/",
                headers={"Authorization": f"Bearer {sales_token}"},
                json={"first_name": "Own", "last_name": "Client", "email": "own@x.com"},
            )
        ).json()
        other_client = (
            await client.post(
                "/api/v1/clients/",
                headers={"Authorization": f"Bearer {admin_token}"},
                json={"first_name": "Other", "last_name": "Client", "email": "other@x.com"},
            )
        ).json()
        deal = (
            await client.post(
                "/api/v1/deals/",
                headers={"Authorization": f"Bearer {sales_token}"},
                json={
                    "title": "Own deal",
                    "client_id": own_client["id"],
                    "stage_id": new_stage["id"],
                },
            )
        ).json()

        response = await client.patch(
            f"/api/v1/deals/{deal['id']}",
            headers={"Authorization": f"Bearer {sales_token}"},
            json={"client_id": other_client["id"]},
        )
        assert response.status_code == 403

    async def test_reassign_to_sales_requires_sales_owned_client(
        self, client: AsyncClient, admin_token: str
    ):
        new_stage = await _seed_stages_and_get_new(client, admin_token)
        sales_user = (
            await client.post(
                "/api/v1/auth/register",
                headers={"Authorization": f"Bearer {admin_token}"},
                json={
                    "email": "deal-owner@test.com",
                    "password": "sales123",
                    "full_name": "Deal Owner",
                    "role": "sales",
                },
            )
        ).json()
        admin_client = (
            await client.post(
                "/api/v1/clients/",
                headers={"Authorization": f"Bearer {admin_token}"},
                json={"first_name": "Admin", "last_name": "Client", "email": "admin-client@x.com"},
            )
        ).json()
        deal = (
            await client.post(
                "/api/v1/deals/",
                headers={"Authorization": f"Bearer {admin_token}"},
                json={
                    "title": "Admin deal",
                    "client_id": admin_client["id"],
                    "stage_id": new_stage["id"],
                },
            )
        ).json()

        response = await client.patch(
            f"/api/v1/deals/{deal['id']}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"owner_id": sales_user["id"]},
        )
        assert response.status_code == 400

    async def test_negative_amount_is_rejected(
        self, client: AsyncClient, admin_token: str
    ):
        new_stage = await _seed_stages_and_get_new(client, admin_token)
        client_data = (
            await client.post(
                "/api/v1/clients/",
                headers={"Authorization": f"Bearer {admin_token}"},
                json={"first_name": "Amount", "last_name": "Client", "email": "amount@x.com"},
            )
        ).json()

        response = await client.post(
            "/api/v1/deals/",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "title": "Negative amount",
                "client_id": client_data["id"],
                "stage_id": new_stage["id"],
                "amount": -1,
            },
        )
        assert response.status_code == 422
