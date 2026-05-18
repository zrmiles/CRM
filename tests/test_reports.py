import pytest
from httpx import AsyncClient

from app.services.stage import CLOSED_WON_STAGE, NEW_STAGE


async def _setup_funnel(client: AsyncClient, token: str) -> list:
    """Seed stages, create client + deals in different stages. Returns stages list."""
    await client.post(
        "/api/v1/stages/seed", headers={"Authorization": f"Bearer {token}"}
    )
    stages = (
        await client.get(
            "/api/v1/stages/", headers={"Authorization": f"Bearer {token}"}
        )
    ).json()
    client_resp = await client.post(
        "/api/v1/clients/",
        headers={"Authorization": f"Bearer {token}"},
        json={"first_name": "T", "last_name": "C", "email": "rc@x.com"},
    )
    client_id = client_resp.json()["id"]

    new_stage = next(s for s in stages if s["name"] == NEW_STAGE)
    closed_won = next(s for s in stages if s["name"] == CLOSED_WON_STAGE)

    # 2 сделки в начальной стадии, 1 успешно закрытая
    for i in range(2):
        await client.post(
            "/api/v1/deals/",
            headers={"Authorization": f"Bearer {token}"},
            json={"title": f"Deal {i}", "client_id": client_id, "stage_id": new_stage["id"], "amount": 1000},
        )
    await client.post(
        "/api/v1/deals/",
        headers={"Authorization": f"Bearer {token}"},
        json={"title": "Closed", "client_id": client_id, "stage_id": closed_won["id"], "amount": 5000},
    )
    return stages


@pytest.mark.asyncio
class TestReports:
    async def test_funnel_report_structure(self, client: AsyncClient, admin_token: str):
        await _setup_funnel(client, admin_token)
        response = await client.get(
            "/api/v1/reports/funnel",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "total_deals" in data
        assert "total_amount" in data
        assert "stages" in data
        assert "conversion_rate" in data

    async def test_funnel_report_totals(self, client: AsyncClient, admin_token: str):
        await _setup_funnel(client, admin_token)
        response = await client.get(
            "/api/v1/reports/funnel",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        data = response.json()
        assert data["total_deals"] == 3
        assert float(data["total_amount"]) == 7000.0

    async def test_funnel_report_conversion_rate(
        self, client: AsyncClient, admin_token: str
    ):
        """Конверсия = успешно закрытые / новые * 100"""
        await _setup_funnel(client, admin_token)
        response = await client.get(
            "/api/v1/reports/funnel",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        data = response.json()
        # 1 успешно закрытая / 2 новые = 50%
        assert data["conversion_rate"] == 50.0

    async def test_sales_sees_only_own_report(
        self, client: AsyncClient, admin_token: str, sales_token: str
    ):
        """Sales видит только свои сделки в отчёте"""
        # Admin создаёт сделки (они не принадлежат Sales)
        await _setup_funnel(client, admin_token)

        response = await client.get(
            "/api/v1/reports/funnel",
            headers={"Authorization": f"Bearer {sales_token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total_deals"] == 0

    async def test_funnel_requires_auth(self, client: AsyncClient):
        response = await client.get("/api/v1/reports/funnel")
        assert response.status_code == 401
