import pytest
import pytest_asyncio
import uuid
import time
from fastapi import FastAPI
from httpx import AsyncClient, ASGITransport
from apps.api.main import app as main_app
from services.security.jwt_auth import create_access_token
from services.executor.connectors.webhook import GenericWebhookConnector
from services.executor.connectors.wordpress import WordPressConnector
from services.crawler.sitemap_parser import SitemapParser
from packages.shared.database import engine, Base

@pytest_asyncio.fixture(autouse=True)
async def prepare_database():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield

@pytest.mark.anyio
async def test_knowledge_ingest_unauthenticated_blocked():
    transport = ASGITransport(app=main_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Request WITHOUT Authorization header must be 401
        res = await client.post("/api/v1/knowledge/verify-and-ingest", json={
            "id": "doc_unauth_01",
            "title": "Malicious Seed",
            "content": "Fake ranking factors",
            "canonical_url": "https://example.com/fake"
        })
        assert res.status_code == 401
        assert "authorization header missing" in res.json()["detail"].lower()

@pytest.mark.anyio
async def test_knowledge_ingest_authenticated_allowed():
    transport = ASGITransport(app=main_app)
    admin_token = create_access_token({"sub": "admin_user_01", "is_admin": True, "role": "ADMIN"})
    headers = {"Authorization": f"Bearer {admin_token}"}
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/v1/knowledge/verify-and-ingest", json={
            "id": "doc_auth_01",
            "title": "Google Search Central: Robots.txt Rules",
            "content": "# Robots.txt\nDefines crawler crawling rules.",
            "canonical_url": "https://developers.google.com/search/docs/crawling-indexing/robots/update"
        }, headers=headers)
        assert res.status_code == 200
        assert "verification_status" in res.json()

@pytest.mark.anyio
async def test_reset_password_one_time_and_ttl():
    transport = ASGITransport(app=main_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        test_email = f"security_{uuid.uuid4().hex[:8]}@example.com"
        reg_res = await client.post("/api/v1/auth/register", json={
            "email": test_email,
            "password": "InitialPassword123!",
            "full_name": "Security User"
        })
        assert reg_res.status_code == 201

        # Request reset
        forgot_res = await client.post("/api/v1/auth/forgot-password", json={"email": test_email})
        assert forgot_res.status_code == 200
        data = forgot_res.json()
        token = data.get("reset_token")
        assert token is not None

        # Reset password
        reset_res = await client.post("/api/v1/auth/reset-password", json={
            "token": token,
            "new_password": "BrandNewPassword123!"
        })
        assert reset_res.status_code == 200

        # Attempting reuse of the token must fail
        reuse_res = await client.post("/api/v1/auth/reset-password", json={
            "token": token,
            "new_password": "HackedPassword123!"
        })
        assert reuse_res.status_code == 400
        assert "geçersiz veya süresi dolmuş" in reuse_res.json()["detail"].lower()

@pytest.mark.anyio
async def test_webhook_ssrf_blocked():
    # Private / loopback metadata URLs must be rejected by GenericWebhookConnector
    private_webhook = GenericWebhookConnector("http://169.254.169.254/latest/meta-data", "secret123")
    assert await private_webhook.verify_connection() is False

    local_webhook = GenericWebhookConnector("http://127.0.0.1:8000/internal-api", "secret123")
    assert await local_webhook.verify_connection() is False

@pytest.mark.anyio
async def test_wordpress_ssrf_blocked():
    # Private / loopback metadata URLs must be rejected by WordPressConnector
    private_wp = WordPressConnector("http://192.168.1.1/wp-admin", "admin", "pass")
    assert await private_wp.verify_connection() is False

    cloud_wp = WordPressConnector("http://169.254.169.254/computeMetadata", "admin", "pass")
    assert await cloud_wp.verify_connection() is False

@pytest.mark.anyio
async def test_health_ready_sanitized():
    transport = ASGITransport(app=main_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/health/ready")
        assert res.status_code == 200
        data = res.json()
        assert "status" in data
        assert "database" in data
        # Ensure raw stack traces or internal passwords are never leaked
        assert "password" not in str(data).lower()
        assert "traceback" not in str(data).lower()

@pytest.mark.anyio
async def test_sitemap_xml_bomb_defused():
    # Billion Laughs XML payload
    malicious_xml = """<?xml version="1.0"?>
    <!DOCTYPE lolz [
      <!ENTITY lol "lol">
      <!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">
      <!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;">
    ]>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url><loc>https://example.com/&lol3;</loc></url>
    </urlset>
    """
    result = SitemapParser.parse_xml(malicious_xml)
    assert result.is_valid is False
    assert "Security policy violation" in result.error_message

@pytest.mark.anyio
async def test_quick_audit_rate_limiting():
    transport = ASGITransport(app=main_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Rapid fire 7 requests to trigger the 5-request rate limit
        responses = []
        for _ in range(7):
            res = await client.post("/api/v1/audit/quick", json={
                "url": "https://example.com"
            })
            responses.append(res.status_code)

        # At least one request should be HTTP 429 Too Many Requests
        assert 429 in responses
