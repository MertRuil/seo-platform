import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from apps.api.main import app
from packages.shared.database import engine, Base

@pytest_asyncio.fixture(autouse=True)
async def prepare_database():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest.mark.asyncio
async def test_google_oauth_and_gsc_sync_flow():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Register & Login
        await client.post("/api/v1/auth/register", json={
            "email": "gsc_manager@agency.io",
            "password": "Password123!",
            "full_name": "GSC Manager"
        })
        login_res = await client.post("/api/v1/auth/login", json={
            "email": "gsc_manager@agency.io",
            "password": "Password123!"
        })
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Create Org & Site
        org_res = await client.post("/api/v1/organizations", json={
            "name": "Search Performance Ltd",
            "slug": "search-perf-ltd"
        }, headers=headers)
        org_id = org_res.json()["id"]

        site_res = await client.post(f"/api/v1/organizations/{org_id}/sites", json={
            "name": "Search Performance Store",
            "primary_url": "https://search-perf.com",
            "site_type": "ECOMMERCE",
            "language": "en",
            "country": "US",
            "execution_mode": "AUTO_LOW_RISK"
        }, headers=headers)
        site_id = site_res.json()["id"]

        # 3. Request Google OAuth Authorize URL
        auth_res = await client.get(
            f"/api/v1/organizations/{org_id}/sites/{site_id}/integrations/google/authorize",
            headers=headers
        )
        assert auth_res.status_code == 200
        auth_data = auth_res.json()
        assert "accounts.google.com" in auth_data["auth_url"]
        assert "webmasters.readonly" in auth_data["auth_url"]
        state = auth_data["state"]

        # 4. Simulate OAuth Callback
        cb_res = await client.get(
            f"/api/v1/integrations/google/callback?code=mock_code_abc123&state={state}"
        )
        assert cb_res.status_code == 200
        assert cb_res.json()["success"] is True

        # 5. Trigger GSC & CrUX Sync
        sync_res = await client.post(
            f"/api/v1/organizations/{org_id}/sites/{site_id}/integrations/sync",
            headers=headers
        )
        assert sync_res.status_code == 200
        sync_data = sync_res.json()
        assert sync_data["success"] is True
        assert sync_data["gsc_metrics_synced"] > 0
        assert sync_data["crux_metrics_synced"] > 0

        # 6. Verify GSC metrics endpoint returns stored data
        gsc_res = await client.get(
            f"/api/v1/organizations/{org_id}/sites/{site_id}/integrations/gsc",
            headers=headers
        )
        assert gsc_res.status_code == 200
        gsc_list = gsc_res.json()
        assert len(gsc_list) > 0

        # 7. Verify CrUX metrics endpoint returns stored data
        crux_res = await client.get(
            f"/api/v1/organizations/{org_id}/sites/{site_id}/integrations/crux",
            headers=headers
        )
        assert crux_res.status_code == 200
        crux_list = crux_res.json()
        assert len(crux_list) > 0

        # 8. Verify Opportunity Engine returns actionable SEO opportunities based on real synced GSC data
        opp_res = await client.get(
            f"/api/v1/organizations/{org_id}/sites/{site_id}/integrations/opportunities",
            headers=headers
        )
        assert opp_res.status_code == 200
        opps = opp_res.json()
        assert len(opps) > 0
