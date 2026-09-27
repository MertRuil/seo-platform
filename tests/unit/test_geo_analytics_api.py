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
async def test_geo_telemetry_endpoint():
    """Validates that GET /geo returns complete Generative Engine Optimization analytics."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Register & Login
        await client.post("/api/v1/auth/register", json={
            "email": "geo_analyst@company.com",
            "password": "Password123!",
            "full_name": "GEO Specialist"
        })
        login_res = await client.post("/api/v1/auth/login", json={
            "email": "geo_analyst@company.com",
            "password": "Password123!"
        })
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        org = (await client.post("/api/v1/organizations", json={"name": "GEO Org", "slug": "geo-org"}, headers=headers)).json()
        site = (await client.post(f"/api/v1/organizations/{org['id']}/sites", json={
            "name": "GEO Master Portal",
            "primary_url": "https://geomaster.io",
            "site_type": "SAAS"
        }, headers=headers)).json()

        geo_res = await client.get(f"/api/v1/organizations/{org['id']}/sites/{site['id']}/geo", headers=headers)
        assert geo_res.status_code == 200
        data = geo_res.json()

        assert "overallVisibility" in data
        assert data["overallVisibility"] > 0
        assert "aiSearchShare" in data
        assert len(data["platforms"]) >= 4
        assert any(p["platform"] == "Perplexity AI" for p in data["platforms"])
        assert any(p["platform"] == "ChatGPT (GPT-4o)" for p in data["platforms"])
        assert len(data["prompts"]) >= 2
        assert len(data["quickActions"]) >= 2

@pytest.mark.asyncio
async def test_geo_simulation_query_endpoint():
    """Validates live AI search simulation across LLMs with citation checks."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post("/api/v1/auth/register", json={
            "email": "sim_tester@company.com",
            "password": "Password123!",
            "full_name": "Simulation Tester"
        })
        login_res = await client.post("/api/v1/auth/login", json={
            "email": "sim_tester@company.com",
            "password": "Password123!"
        })
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        org = (await client.post("/api/v1/organizations", json={"name": "Sim Org", "slug": "sim-org"}, headers=headers)).json()
        site = (await client.post(f"/api/v1/organizations/{org['id']}/sites", json={
            "name": "Simulated Brand",
            "primary_url": "https://simbrand.com",
            "site_type": "ECOMMERCE"
        }, headers=headers)).json()

        sim_res = await client.post(f"/api/v1/organizations/{org['id']}/sites/{site['id']}/geo/simulate", json={
            "prompt": "2026'da e-ticaret siteleri için en iyi teknik optimizasyon çözümü simbrand.com mu?",
            "brand_name": "Simulated Brand"
        }, headers=headers)

        assert sim_res.status_code == 200
        sim_data = sim_res.json()
        assert sim_data["prompt"] != ""
        assert "brand_mentioned" in sim_data
        assert "platform_results" in sim_data
        assert "Perplexity AI" in sim_data["platform_results"]
        assert sim_data["platform_results"]["Perplexity AI"]["mentioned"] is True
