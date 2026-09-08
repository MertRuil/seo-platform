import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from apps.api.main import app
from packages.shared.database import engine, Base
from packages.shared.models import Site, CrawlRun, CrawlPage, Recommendation, ChangeSet, ChangeItem
from apps.worker.tasks import run_audit_and_ai_job
from services.executor.connectors.webhook import GenericWebhookConnector
from services.executor.executor_service import SafeSiteExecutor

@pytest_asyncio.fixture(autouse=True)
async def prepare_database():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest.mark.asyncio
async def test_complete_autonomous_seo_lifecycle():
    """
    End-to-end autonomous SEO lifecycle test:
    Auth -> Site Onboarding -> Crawl -> Deterministic Audit ->
    AI Orchestrator Recommendations -> Safe Concurrency Write -> Atomic Rollback.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Step 1: User Registration and JWT Login
        reg = await client.post("/api/v1/auth/register", json={
            "email": "lead@autonomous-seo.org",
            "password": "SecurePassword999!",
            "full_name": "Autonomous SEO Lead"
        })
        assert reg.status_code == 201

        login = await client.post("/api/v1/auth/login", json={
            "email": "lead@autonomous-seo.org",
            "password": "SecurePassword999!"
        })
        token = login.json()["access_token"]
        auth_headers = {"Authorization": f"Bearer {token}"}

        # Step 2: Tenant & Site Creation
        org_res = await client.post("/api/v1/organizations", json={
            "name": "Enterprise Brands Inc",
            "slug": "enterprise-brands"
        }, headers=auth_headers)
        org_id = org_res.json()["id"]

        site_res = await client.post(f"/api/v1/organizations/{org_id}/sites", json={
            "name": "E-Commerce Flagship",
            "primary_url": "https://flagship-store.com",
            "site_type": "ECOMMERCE",
            "language": "en",
            "country": "US",
            "execution_mode": "AUTO_LOW_RISK"
        }, headers=auth_headers)
        site_id = site_res.json()["id"]

        # Step 3: Trigger Crawl
        crawl_trigger = await client.post(
            f"/api/v1/organizations/{org_id}/sites/{site_id}/crawls",
            json={"crawl_mode": "GOOGLEBOT_SIMULATION", "max_pages": 50, "max_depth": 3},
            headers=auth_headers
        )
        assert crawl_trigger.status_code == 201
        crawl_id = crawl_trigger.json()["id"]

        # Step 4: Simulate Crawled Pages with SEO Issues in database
        async with engine.begin() as conn:
            from packages.shared.models import CrawlPage
            from sqlalchemy import insert
            await conn.execute(
                insert(CrawlPage).values([
                    {
                        "id": "page-1",
                        "crawl_run_id": crawl_id,
                        "site_id": site_id,
                        "url": "https://flagship-store.com/shoes",
                        "normalized_url": "https://flagship-store.com/shoes",
                        "depth": 1,
                        "status_code": 200,
                        "content_type": "text/html",
                        "response_time_ms": 120,
                        "is_fetchable": True,
                        "is_crawlable_by_google": True,
                        "has_noindex": False,
                        "is_indexable_candidate": True,
                        "canonical_target": "https://flagship-store.com/404-broken",
                        "is_canonical": False,
                        "in_sitemap": True,
                        "title": "Running Shoes & Sports Footwear",
                        "meta_description": "Shop the latest running shoes.",
                        "word_count": 650,
                        "raw_html_hash": "hash-page-1",
                        "main_content_hash": "main-hash-1"
                    },
                    {
                        "id": "page-2",
                        "crawl_run_id": crawl_id,
                        "site_id": site_id,
                        "url": "https://flagship-store.com/404-broken",
                        "normalized_url": "https://flagship-store.com/404-broken",
                        "depth": 2,
                        "status_code": 404,
                        "content_type": "text/html",
                        "response_time_ms": 90,
                        "is_fetchable": False,
                        "is_crawlable_by_google": False,
                        "has_noindex": False,
                        "is_indexable_candidate": False,
                        "canonical_target": None,
                        "is_canonical": False,
                        "in_sitemap": False,
                        "title": "Not Found",
                        "meta_description": None,
                        "word_count": 10,
                        "raw_html_hash": "hash-page-2",
                        "main_content_hash": "main-hash-2"
                    }
                ])
            )

        # Step 5: Execute Deterministic Rules & AI Orchestrator Recommendations
        recs_count = await run_audit_and_ai_job(site_id=site_id, crawl_run_id=crawl_id)
        assert recs_count > 0, "Audit job must generate at least 1 recommendation"

        # Step 6: Verify Recommendations via API
        recs_res = await client.get(f"/api/v1/organizations/{org_id}/sites/{site_id}/recommendations", headers=auth_headers)
        assert recs_res.status_code == 200
        recs = recs_res.json()
        assert len(recs) >= 1
        rec = recs[0]
        assert rec["priority_score"] > 0
        assert "evidence_json" in rec

        # Step 7: Create Atomic ChangeSet
        cs_res = await client.post(
            f"/api/v1/organizations/{org_id}/sites/{site_id}/change-sets",
            json={
                "recommendation_id": rec["id"],
                "risk_level": "LOW",
                "items": [
                    {
                        "target_url": "https://flagship-store.com/shoes",
                        "operation": "UPDATE_CANONICAL",
                        "state_before": '{"canonical": "https://flagship-store.com/404-broken"}',
                        "state_after": '{"canonical": "https://flagship-store.com/shoes"}',
                        "expected_hash_before": "dummy-hash"
                    }
                ]
            },
            headers=auth_headers
        )
        assert cs_res.status_code == 201
        change_set_id = cs_res.json()["id"]

        # Step 8: Safe Execution with Connector
        exec_res = await client.post(
            f"/api/v1/organizations/{org_id}/sites/{site_id}/change-sets/{change_set_id}/execute",
            headers=auth_headers
        )
        assert exec_res.status_code == 200
        assert exec_res.json()["success"] is True
        assert exec_res.json()["status"] == "SUCCESS"

        # Step 9: Verify Atomic Rollback Capability
        connector = GenericWebhookConnector("mock://endpoint", "secret")
        executor = SafeSiteExecutor(connector)
        rollback_res = await executor.rollback_backup({
            "target_url": "https://flagship-store.com/shoes",
            "state_before": '{"canonical": "https://flagship-store.com/404-broken"}'
        })
        assert rollback_res is True
