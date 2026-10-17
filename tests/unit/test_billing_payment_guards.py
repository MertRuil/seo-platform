"""
Üretim benzeri ortamda ödeme sağlayıcısını atlayan faturalama uçlarının kapalı olduğunu doğrular:
organizasyon sahibi ücretli plana doğrudan geçemez, kendine AI kredisi tanımlayamaz,
mobil yükseltme ucu ödeme almadan başarı döndürmez.
"""
import uuid

import pytest
from httpx import AsyncClient, ASGITransport

from packages.config.settings import Settings


@pytest.fixture
def production_like(monkeypatch):
    monkeypatch.setattr(Settings, "is_production_like", property(lambda self: True))


async def _owner_headers(client: AsyncClient) -> tuple[dict, str]:
    email = f"guard_{uuid.uuid4().hex[:8]}@example.com"
    await client.post("/api/v1/auth/register", json={"email": email, "password": "Password123!", "full_name": "Guard Owner"})
    login = await client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    org = await client.post("/api/v1/organizations", json={"name": "Guard Org", "slug": f"guard-{uuid.uuid4().hex[:6]}"}, headers=headers)
    assert org.status_code == 201
    return headers, org.json()["id"]


@pytest.mark.asyncio
async def test_owner_cannot_bypass_payment_in_production(production_like):
    from apps.api.main import app
    from packages.shared.database import engine, Base

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.get("/api/v1/billing/plans")  # plan kataloğunu tohumlar
        headers, org_id = await _owner_headers(client)

        switch = await client.post(f"/api/v1/organizations/{org_id}/billing/plan", json={"plan_code": "pro"}, headers=headers)
        assert switch.status_code == 402

        downgrade = await client.post(f"/api/v1/organizations/{org_id}/billing/plan", json={"plan_code": "free"}, headers=headers)
        assert downgrade.status_code == 200
        assert downgrade.json()["plan_code"] == "free"

        grant = await client.post(f"/api/v1/organizations/{org_id}/billing/credits/grant", json={"amount": 500, "reason": "SELF"}, headers=headers)
        assert grant.status_code == 403

        mobile = await client.post("/api/v1/billing/upgrade", json={"plan_name": "PRO"})
        assert mobile.status_code == 501
