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
async def test_full_platform_api_flow():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Register & Login
        await client.post("/api/v1/auth/register", json={
            "email": "owner@platform.ai",
            "password": "Password123!",
            "full_name": "Platform Owner"
        })
        login_res = await client.post("/api/v1/auth/login", json={
            "email": "owner@platform.ai",
            "password": "Password123!"
        })
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Create Organization
        org_res = await client.post("/api/v1/organizations", json={
            "name": "Global SEO Media",
            "slug": "global-seo-media"
        }, headers=headers)
        org_id = org_res.json()["id"]

        # 3. Create Site
        site_res = await client.post(f"/api/v1/organizations/{org_id}/sites", json={
            "name": "Acme Store",
            "primary_url": "https://acmestore.com",
            "site_type": "ECOMMERCE",
            "language": "en",
            "country": "US",
            "execution_mode": "REVIEW_ALL"
        }, headers=headers)
        assert site_res.status_code == 201
        site_id = site_res.json()["id"]

        # 4. Trigger Crawl
        crawl_res = await client.post(f"/api/v1/organizations/{org_id}/sites/{site_id}/crawls", json={
            "crawl_mode": "GOOGLEBOT_SIMULATION",
            "max_pages": 50,
            "max_depth": 3
        }, headers=headers)
        assert crawl_res.status_code == 201
        crawl_id = crawl_res.json()["id"]
        assert crawl_res.json()["status"] == "QUEUED"

        # 5. List Crawls
        crawls_list = await client.get(f"/api/v1/organizations/{org_id}/sites/{site_id}/crawls", headers=headers)
        assert crawls_list.status_code == 200
        assert len(crawls_list.json()) == 1

        # 6. Strategic Roadmap
        roadmap_res = await client.get(f"/api/v1/organizations/{org_id}/sites/{site_id}/roadmap", headers=headers)
        assert roadmap_res.status_code == 200
        assert roadmap_res.json()["site_id"] == site_id

        # 7. Create & Execute ChangeSet
        cs_res = await client.post(f"/api/v1/organizations/{org_id}/sites/{site_id}/change-sets", json={
            "risk_level": "LOW",
            "items": [
                {
                    "target_url": "https://acmestore.com/products/shoes",
                    "operation": "OPTIMIZE_TITLE",
                    "state_before": '{"title": "Shoes"}',
                    "state_after": '{"title": "Running Shoes & Sneakers | Acme Store"}',
                    "expected_hash_before": "dummy-hash"
                }
            ]
        }, headers=headers)
        assert cs_res.status_code == 201
        cs_id = cs_res.json()["id"]

        exec_res = await client.post(f"/api/v1/organizations/{org_id}/sites/{site_id}/change-sets/{cs_id}/execute", headers=headers)
        assert exec_res.status_code == 200
        assert exec_res.json()["success"] is True

        # 8. Site Graph
        graph_res = await client.get(f"/api/v1/organizations/{org_id}/sites/{site_id}/graph", headers=headers)
        assert graph_res.status_code == 200
        assert "orphan_pages" in graph_res.json()

        # 9. Create Experiment
        exp_res = await client.post(f"/api/v1/organizations/{org_id}/sites/{site_id}/experiments", json={
            "name": "Title Tag CTR Optimization",
            "variant_pages": ["https://acmestore.com/shoes", "https://acmestore.com/boots"],
            "control_pages": ["https://acmestore.com/shirts", "https://acmestore.com/pants"]
        }, headers=headers)
        assert exp_res.status_code == 201
        assert exp_res.json()["diff_in_diff_lift"] > 0
