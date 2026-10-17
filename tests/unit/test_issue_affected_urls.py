"""
Sağlık/sorun ucu her kural grubu için etkilenen sayfaları döndürmeli.
Önceden yalnızca sayı dönüyordu; kullanıcı sorunun hangi sayfada olduğunu göremiyordu.
"""
import uuid

import pytest
from httpx import AsyncClient, ASGITransport


@pytest.mark.asyncio
async def test_health_report_lists_affected_urls_per_rule():
    from apps.api.main import app
    from packages.shared.database import engine, Base, AsyncSessionLocal
    from packages.shared.models import CrawlPage

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        email = f"issues_{uuid.uuid4().hex[:8]}@example.com"
        await client.post("/api/v1/auth/register", json={"email": email, "password": "Password123!", "full_name": "Issue Owner"})
        login = await client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

        org = await client.post("/api/v1/organizations", json={"name": "Issue Org", "slug": f"issue-{uuid.uuid4().hex[:6]}"}, headers=headers)
        org_id = org.json()["id"]
        domain = f"issues-{uuid.uuid4().hex[:6]}.example.com"
        site = await client.post(f"/api/v1/organizations/{org_id}/sites", json={"name": "Issue Site", "primary_url": f"https://{domain}"}, headers=headers)
        assert site.status_code == 201
        site_id = site.json()["id"]
        crawl = await client.post(f"/api/v1/organizations/{org_id}/sites/{site_id}/crawls", json={"max_pages": 10}, headers=headers)
        crawl_id = crawl.json()["id"]

        base = f"https://{domain}"
        rows = [
            (f"{base}/", "Ana sayfa başlığı yeterince uzun", "Açıklama var"),
            (f"{base}/a", "A sayfası başlığı yeterince uzun", None),
            (f"{base}/b", "B sayfası başlığı yeterince uzun", None),
        ]
        async with AsyncSessionLocal() as db:
            for idx, (url, title, desc) in enumerate(rows):
                db.add(CrawlPage(
                    crawl_run_id=crawl_id, site_id=site_id, url=url, normalized_url=url,
                    depth=0 if idx == 0 else 1, status_code=200, title=title, meta_description=desc,
                    h1=title, word_count=400,
                ))
            await db.commit()

        res = await client.get(f"/api/v1/organizations/{org_id}/sites/{site_id}/crawls/{crawl_id}/health", headers=headers)
        assert res.status_code == 200
        issues = {i["rule_id"]: i for i in res.json()["issues"]}
        meta = issues.get("RULE_META_DESC_MISSING")
        assert meta is not None, list(issues)
        assert meta["affected_url_count"] == 2
        assert meta["affected_urls"] == [f"{base}/a", f"{base}/b"]
