import pytest
from fastapi import FastAPI
from httpx import AsyncClient, ASGITransport
from apps.api.routes.knowledge import router as knowledge_router
from services.security.jwt_auth import create_access_token

# Test FastAPI instance mounting the knowledge router under /api/v1
api_app = FastAPI(title="Knowledge API Test")
api_app.include_router(knowledge_router, prefix="/api/v1")

@pytest.mark.anyio
async def test_knowledge_stats_endpoint():
    transport = ASGITransport(app=api_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/knowledge/stats")
        assert res.status_code == 200
        data = res.json()
        assert data["total_chunks"] > 0
        assert data["verified_chunks"] > 0
        assert "rate_limit_metrics" in data
        metrics = data["rate_limit_metrics"]
        assert "current_rpm" in metrics
        assert metrics["daily_request_budget"] == 1500

@pytest.mark.anyio
async def test_knowledge_sources_endpoint():
    transport = ASGITransport(app=api_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/knowledge/sources")
        assert res.status_code == 200
        data = res.json()
        assert data["total_sources"] >= 14
        sources = data["sources"]
        assert any("Duplicate URLs" in s["title"] for s in sources)
        assert any("Robots.txt" in s["title"] for s in sources)
        assert all(s["canonical_url"].startswith("http") for s in sources)

@pytest.mark.anyio
async def test_knowledge_search_endpoint():
    transport = ASGITransport(app=api_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/v1/knowledge/search", json={
            "query": "canonical self-referential absolute url duplicate",
            "top_k": 3
        })
        assert res.status_code == 200
        data = res.json()
        assert data["results_count"] > 0
        top = data["results"][0]
        assert "chunk_id" in top
        assert "canonical_url" in top
        assert top["verification_status"] == "VERIFIED"

@pytest.mark.anyio
async def test_knowledge_verify_and_ingest_requires_auth():
    transport = ASGITransport(app=api_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Request WITHOUT token must return 401
        res = await client.post("/api/v1/knowledge/verify-and-ingest", json={
            "title": "Unauthorized Document",
            "content": "Malicious content without token",
            "canonical_url": "https://example.com/unauth"
        })
        assert res.status_code == 401

@pytest.mark.anyio
async def test_knowledge_verify_and_ingest_rejection():
    transport = ASGITransport(app=api_app)
    token = create_access_token({"sub": "admin_test", "is_admin": True, "role": "ADMIN"})
    headers = {"Authorization": f"Bearer {token}"}
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Submit debunked myth with authorized admin token
        res = await client.post("/api/v1/knowledge/verify-and-ingest", json={
            "title": "Quick SEO Hacks",
            "content": "Add 20 meta keywords to rank higher on Google search results pages.",
            "canonical_url": "https://developers.google.com/search/docs/fakes"
        }, headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert data["verification_status"] == "REJECTED"
        assert data["chunks_ingested"] == 0
        assert len(data["reasons"]) > 0

@pytest.mark.anyio
async def test_knowledge_verify_and_ingest_success():
    transport = ASGITransport(app=api_app)
    token = create_access_token({"sub": "admin_test", "is_admin": True, "role": "ADMIN"})
    headers = {"Authorization": f"Bearer {token}"}
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Submit valid Level 1 doc with authorized admin token
        res = await client.post("/api/v1/knowledge/verify-and-ingest", json={
            "title": "Google Search Central: Sitemaps Protocol Update",
            "content": "# XML Sitemaps Architecture\nSitemaps allow search engines to discover crawlable URLs across large sites.",
            "canonical_url": "https://developers.google.com/search/docs/crawling-indexing/sitemaps/update"
        }, headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert data["verification_status"] == "VERIFIED"
        assert data["chunks_ingested"] >= 1
