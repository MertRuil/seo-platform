import pytest
import pytest_asyncio
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
from packages.shared.database import engine, Base


@pytest_asyncio.fixture(autouse=True)
async def prepare_database():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield

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
        ENCRYPTION_KEY="fedcba9876543210" * 4,
        DATABASE_URL="postgresql+asyncpg://u:p@db:5432/seo",
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

def test_settings_production_requires_postgresql():
    """Production/staging must run on PostgreSQL; sqlite (the local test default) is rejected."""
    secure = dict(APP_SECRET_KEY="a" * 32, ENCRYPTION_KEY="fedcba9876543210" * 4)
    for env in ("production", "staging"):
        with pytest.raises(ValueError, match="PostgreSQL"):
            Settings(ENVIRONMENT=env, DATABASE_URL="sqlite+aiosqlite:///./test.db", **secure)
        assert Settings(ENVIRONMENT=env, DATABASE_URL="postgresql+asyncpg://u:p@db/seo", **secure).is_production_like

    cfg_dev = Settings(ENVIRONMENT="development", DATABASE_URL="sqlite+aiosqlite:///./test.db")
    assert cfg_dev.is_production_like is False

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
async def test_safe_client_redirect_hop_ssrf_blocking(monkeypatch):
    """Vulnerability 4 (Python crawler): Redirect hop to private IP / AWS metadata is blocked immediately."""
    from services.crawler.safe_client import SafeHttpClient

    client = SafeHttpClient()
    # This test exercises redirect validation, independently of public DNS access.
    monkeypatch.setattr("services.security.ssrf.resolve_domain_ips", lambda hostname: ["93.184.216.34"])

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


def test_normalize_domain_name_blocks_resolved_private_ips_and_rebinding(monkeypatch):
    """ORTA-08: normalize_domain_name must not swallow HTTPException when DNS resolves to private/metadata IPs."""
    from apps.api.routes.sites import normalize_domain_name

    # Wildcard DNS rebinding domains must be rejected immediately
    with pytest.raises(HTTPException) as exc_nip:
        normalize_domain_name("https://169.254.169.254.nip.io/latest")
    assert exc_nip.value.status_code == 400

    # Domain resolving to private IP via DNS must raise 400 (not be swallowed by broad except)
    monkeypatch.setattr(
        "socket.getaddrinfo",
        lambda host, port: [(2, 1, 6, "", ("169.254.169.254", 0))],
    )
    with pytest.raises(HTTPException) as exc_dns:
        normalize_domain_name("https://evil-rebind.example.com")
    assert exc_dns.value.status_code == 400
    assert "private or cloud metadata IP" in exc_dns.value.detail


def test_staging_environment_rejects_default_secrets(monkeypatch):
    """ORTA-09: Staging environment must enforce non-default APP_SECRET_KEY and ENCRYPTION_KEY."""
    # conftest.py ve yerel .env geçerli anahtarlar tanımlar; varsayılan değerlerin denetlenmesi için devre dışı bırakılır
    monkeypatch.delenv("APP_SECRET_KEY", raising=False)
    monkeypatch.delenv("ENCRYPTION_KEY", raising=False)
    with pytest.raises(ValueError, match="APP_SECRET_KEY"):
        Settings(
            _env_file=None,
            ENVIRONMENT="staging",
            DATABASE_URL="postgresql+asyncpg://u:p@db:5432/seo",
            ENCRYPTION_KEY="fedcba9876543210" * 4,
        )
    with pytest.raises(ValueError, match="ENCRYPTION_KEY"):
        Settings(
            _env_file=None,
            ENVIRONMENT="staging",
            DATABASE_URL="postgresql+asyncpg://u:p@db:5432/seo",
            APP_SECRET_KEY="a" * 32,
        )


@pytest.mark.anyio
async def test_password_change_revokes_existing_jwt_and_nextjs_local_blocked_in_prod():
    """DÜŞÜK-12 & KRİTİK-02: Password change invalidates prior JWTs via pwd_fp, and nextjs_local tokens are blocked in production."""
    from services.security.jwt_auth import create_access_token, invalidate_user_auth_cache
    from services.security.crypto import hash_password
    from packages.shared.database import engine, Base, AsyncSessionLocal
    from packages.shared.models import User
    from sqlalchemy import select

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    email = f"revoke_{uuid.uuid4().hex[:8]}@example.com"
    transport = ASGITransport(app=api_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        reg = await client.post("/api/v1/auth/register", json={"email": email, "password": "OldPassword123!"})
        assert reg.status_code == 201

        login = await client.post("/api/v1/auth/login", json={"email": email, "password": "OldPassword123!"})
        assert login.status_code == 200
        old_token = login.json()["access_token"]

        # Token works before password change
        me_ok = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {old_token}"})
        assert me_ok.status_code == 200

        # Simulate password change in database
        async with AsyncSessionLocal() as db:
            res_u = await db.execute(select(User).where(User.email == email))
            user_obj = res_u.scalars().first()
            user_obj.hashed_password = hash_password("NewPassword456!")
            await db.commit()
            # Doğrudan DB yazımı şifre sıfırlama ucunu atladığı için önbelleği o ucun yaptığı gibi temizle
            invalidate_user_auth_cache(user_obj.id)

        # Old token must now be rejected with 401
        me_revoked = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {old_token}"})
        assert me_revoked.status_code == 401

        # KRİTİK-02: nextjs_local token rejected when ENVIRONMENT is production
        local_token = create_access_token({
            "sub": me_ok.json()["id"],
            "email": email,
            "role": "SUPER_ADMIN",
            "auth_source": "nextjs_local",
        })
        with patch.object(settings, "ENVIRONMENT", "production"):
            res_local = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {local_token}"})
            assert res_local.status_code == 401



def _fake_request(peer: str, headers: dict):
    from starlette.requests import Request
    scope = {
        "type": "http",
        "headers": [(k.lower().encode(), v.encode()) for k, v in headers.items()],
        "client": (peer, 1234),
    }
    return Request(scope)


def test_get_client_ip_ignores_spoofable_headers_without_trusted_proxy():
    from services.security.rate_limiter import get_client_ip

    req = _fake_request("10.0.0.5", {"x-real-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2"})
    with patch.object(settings, "TRUSTED_PROXY_HOPS", 0):
        assert get_client_ip(req) == "10.0.0.5"


def test_get_client_ip_uses_proxy_appended_hop():
    from services.security.rate_limiter import get_client_ip

    # İstemci soldaki girdiyi taklit eder, yük dengeleyici gerçek IP'yi sona ekler
    req = _fake_request("10.0.0.5", {"x-real-ip": "1.1.1.1", "x-forwarded-for": "6.6.6.6, 203.0.113.7"})
    with patch.object(settings, "TRUSTED_PROXY_HOPS", 1):
        assert get_client_ip(req) == "203.0.113.7"
    with patch.object(settings, "TRUSTED_PROXY_HOPS", 2):
        assert get_client_ip(req) == "6.6.6.6"
    with patch.object(settings, "TRUSTED_PROXY_HOPS", 1):
        assert get_client_ip(_fake_request("10.0.0.5", {})) == "10.0.0.5"


@pytest.mark.anyio
async def test_auth_state_cache_avoids_repeat_queries_and_invalidates():
    from services.security import jwt_auth

    calls = {"n": 0}

    class _User:
        is_active = True
        hashed_password = "hash-1"

    class _Result:
        def scalars(self):
            return self

        def first(self):
            return _User()

    class _Session:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

        async def execute(self, _query):
            calls["n"] += 1
            return _Result()

    jwt_auth.invalidate_user_auth_cache("cache-user")
    with patch("packages.shared.database.AsyncSessionLocal", _Session):
        first = await jwt_auth._load_user_auth_state("cache-user")
        second = await jwt_auth._load_user_auth_state("cache-user")
        assert first == second == (True, jwt_auth.password_fingerprint("hash-1"))
        assert calls["n"] == 1

        jwt_auth.invalidate_user_auth_cache("cache-user")
        await jwt_auth._load_user_auth_state("cache-user")
        assert calls["n"] == 2
    jwt_auth.invalidate_user_auth_cache("cache-user")
