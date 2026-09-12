import pytest
import uuid
from unittest.mock import patch, AsyncMock
from httpx import AsyncClient, ASGITransport, Response
from fastapi import HTTPException
from apps.api.main import app as api_app
from packages.config.settings import Settings, settings
from services.security.oauth_verifier import verify_oauth_token, _check_google_audience
from services.security.ssrf import (
    is_ip_literal,
    is_ip_blocked,
    async_resolve_domain_ips,
    SSRFSecurityException
)
from services.crawler.safe_client import SSRFSafeNetworkBackend

@pytest.mark.anyio
async def test_oauth_tokenless_request_is_strictly_rejected():
    """Vulnerability 1: Tokenless OAuth request must be rejected with 401."""
    transport = ASGITransport(app=api_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Request with no token at all
        res = await client.post("/api/v1/auth/oauth", json={
            "provider": "google",
            "email": f"victim_{uuid.uuid4().hex[:6]}@example.com"
        })
        assert res.status_code == 401
        assert "belirteci (token) zorunludur" in res.json()["detail"]

        # Request with empty token
        res_empty = await client.post("/api/v1/auth/oauth", json={
            "provider": "google",
            "email": f"victim_{uuid.uuid4().hex[:6]}@example.com",
            "token": "   "
        })
        assert res_empty.status_code == 401

@pytest.mark.anyio
async def test_github_null_profile_email_and_fallback_checks():
    """Vulnerability 2: GitHub profile email null must query /user/emails and strictly fail on missing/mismatched email."""
    # Case A: GitHub /user email is None, but /user/emails contains the verified primary email
    async def mock_github_get(url, **kwargs):
        if "user/emails" in url:
            return Response(200, json=[
                {"email": "secondary@example.com", "primary": False, "verified": True},
                {"email": "correct@example.com", "primary": True, "verified": True},
            ])
        return Response(200, json={"email": None, "login": "testuser"})

    with patch("httpx.AsyncClient.get", side_effect=mock_github_get):
        data = await verify_oauth_token("github", "valid-gh-token", "correct@example.com")
        assert data is not None

    # Case B: GitHub /user email is None, and /user/emails has no matching verified email -> MUST raise 401
    async def mock_github_get_no_primary(url, **kwargs):
        if "user/emails" in url:
            return Response(200, json=[
                {"email": "other@example.com", "primary": False, "verified": True}
            ])
        return Response(200, json={"email": None, "login": "testuser"})

    with patch("httpx.AsyncClient.get", side_effect=mock_github_get_no_primary):
        with pytest.raises(HTTPException) as exc_info:
            await verify_oauth_token("github", "valid-gh-token", "correct@example.com")
        assert exc_info.value.status_code == 401

    # Case C: GitHub /user email is None, /user/emails has verified email, but it does NOT match expected_email -> MUST raise 401
    async def mock_github_get_mismatch(url, **kwargs):
        if "user/emails" in url:
            return Response(200, json=[
                {"email": "attacker@example.com", "primary": True, "verified": True}
            ])
        return Response(200, json={"email": None, "login": "testuser"})

    with patch("httpx.AsyncClient.get", side_effect=mock_github_get_mismatch):
        with pytest.raises(HTTPException) as exc_info:
            await verify_oauth_token("github", "valid-gh-token", "victim@example.com")
        assert exc_info.value.status_code == 401
        assert "eşleşmiyor" in exc_info.value.detail

@pytest.mark.anyio
async def test_google_audience_verification_prevents_token_substitution():
    """Vulnerability 3: Token substitution attack prevention via aud matching."""
    prev_aud = settings.GOOGLE_OAUTH_CLIENT_ID
    try:
        settings.GOOGLE_OAUTH_CLIENT_ID = "legitimate-app-client-id.apps.googleusercontent.com"

        # Case A: Audience matches -> succeeds
        valid_data = {
            "aud": "legitimate-app-client-id.apps.googleusercontent.com",
            "email": "user@example.com",
            "email_verified": True
        }
        _check_google_audience(valid_data)  # Should not raise

        # Case B: Audience belongs to attacker's application -> MUST raise 401
        attacker_data = {
            "aud": "attacker-rogue-app.apps.googleusercontent.com",
            "email": "user@example.com",
            "email_verified": True
        }
        with pytest.raises(HTTPException) as exc_info:
            _check_google_audience(attacker_data)
        assert exc_info.value.status_code == 401
        assert "hedef kitle (aud) uyuşmazlığı" in exc_info.value.detail

        # Case C: Audience missing from token -> MUST raise 401
        missing_aud_data = {
            "email": "user@example.com",
            "email_verified": True
        }
        with pytest.raises(HTTPException) as exc_info:
            _check_google_audience(missing_aud_data)
        assert exc_info.value.status_code == 401
    finally:
        settings.GOOGLE_OAUTH_CLIENT_ID = prev_aud

def test_settings_environment_and_test_token_guard():
    """Vulnerability 5: ALLOW_TEST_OAUTH_TOKENS is strictly clamped to False outside test environment."""
    # Even if ALLOW_TEST_OAUTH_TOKENS is set to True, when ENVIRONMENT is production or development, it gets forced to False
    cfg_prod = Settings(
        ENVIRONMENT="production",
        ALLOW_TEST_OAUTH_TOKENS=True,
        APP_SECRET_KEY="a" * 32,
        ENCRYPTION_KEY="fedcba9876543210" * 4
    )
    assert cfg_prod.ALLOW_TEST_OAUTH_TOKENS is False

    cfg_dev = Settings(
        ENVIRONMENT="development",
        ALLOW_TEST_OAUTH_TOKENS=True,
    )
    assert cfg_dev.ALLOW_TEST_OAUTH_TOKENS is False

    cfg_test = Settings(
        ENVIRONMENT="test",
        ALLOW_TEST_OAUTH_TOKENS=True,
    )
    assert cfg_test.ALLOW_TEST_OAUTH_TOKENS is True

@pytest.mark.anyio
async def test_safe_network_backend_non_blocking_dns_and_ip_literal():
    """Vulnerability 6: Backend correctly differentiates domain names from IP literals and resolves async DNS."""
    # is_ip_literal correctly flags IPs vs domains
    assert is_ip_literal("127.0.0.1") is True
    assert is_ip_literal("::1") is True
    assert is_ip_literal("example.com") is False
    assert is_ip_literal("google.com") is False

    # SSRFSafeNetworkBackend blocks direct connection to blocked IP literals
    backend = SSRFSafeNetworkBackend()
    with pytest.raises(SSRFSecurityException) as exc_info:
        await backend.connect_tcp("127.0.0.1", 80)
    assert "Direct connection to protected IP" in str(exc_info.value)

    # Async DNS resolution works without blocking event loop
    ips = await async_resolve_domain_ips("localhost")
    assert len(ips) > 0
    assert any(ip in ("127.0.0.1", "::1") for ip in ips)

@pytest.mark.anyio
async def test_safe_client_redirect_hop_ssrf_blocking():
    """Vulnerability 4 (Python crawler): Redirect hop to private IP / AWS metadata is blocked immediately."""
    from services.crawler.safe_client import SafeHttpClient

    client = SafeHttpClient()

    async def mock_fetch_send(*args, **kwargs):
        return Response(302, headers={"Location": "http://169.254.169.254/latest/meta-data/"})

    with patch("httpx.AsyncClient.send", side_effect=mock_fetch_send):
        try:
            res = await client.fetch("https://example.com/redirect-to-metadata")
            assert False, f"Should have raised SSRFSecurityException, got {res}"
        except SSRFSecurityException as e:
            assert "Direct IP access to private/metadata IP" in str(e)


@pytest.mark.anyio
async def test_login_lockout_after_five_failures():
    """Brute-force guard: 5 wrong passwords within 15 min must lock the account with HTTP 429."""
    import uuid
    from fastapi import FastAPI
    from httpx import AsyncClient, ASGITransport
    from apps.api.routes.auth import router as auth_router
    from packages.shared.database import engine, Base

    app = FastAPI()
    app.include_router(auth_router, prefix="/api/v1")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    email = f"lock_{uuid.uuid4().hex[:8]}@example.com"
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        assert (await client.post("/api/v1/auth/register", json={"email": email, "password": "CorrectPassword123!"})).status_code == 201
        for _ in range(5):
            assert (await client.post("/api/v1/auth/login", json={"email": email, "password": "wrong-password"})).status_code == 401
        # 6th attempt, even with the CORRECT password, must be refused while locked
        locked = await client.post("/api/v1/auth/login", json={"email": email, "password": "CorrectPassword123!"})
        assert locked.status_code == 429
        assert locked.headers.get("Retry-After") == "900"


@pytest.mark.anyio
async def test_github_token_from_other_oauth_app_is_rejected():
    """Token substitution: a GitHub token minted for a different client_id must not authenticate."""
    from unittest.mock import patch, AsyncMock, MagicMock
    from fastapi import HTTPException
    from services.security.oauth_verifier import _verify_generic_bearer_token
    from packages.config.settings import settings

    resp = MagicMock(status_code=200)
    resp.headers = {"x-oauth-client-id": "attacker-app-id"}
    resp.json.return_value = {"email": "victim@example.com"}
    mock_client = AsyncMock()
    mock_client.get.return_value = resp
    mock_client.__aenter__.return_value = mock_client

    with patch("services.security.oauth_verifier.httpx.AsyncClient", return_value=mock_client), \
         patch.object(settings, "GITHUB_OAUTH_CLIENT_ID", "our-app-id"):
        with pytest.raises(HTTPException) as exc_info:
            await _verify_generic_bearer_token("github", "ghu_token", "victim@example.com")
        assert exc_info.value.status_code == 401

    # Same token, matching client id -> passes
    resp.headers = {"x-oauth-client-id": "our-app-id"}
    with patch("services.security.oauth_verifier.httpx.AsyncClient", return_value=mock_client), \
         patch.object(settings, "GITHUB_OAUTH_CLIENT_ID", "our-app-id"):
        data = await _verify_generic_bearer_token("github", "ghu_token", "victim@example.com")
        assert data["email"] == "victim@example.com"
