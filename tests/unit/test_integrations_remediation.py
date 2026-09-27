import pytest
import pytest_asyncio
from datetime import datetime, timezone, timedelta, date
from httpx import AsyncClient, ASGITransport
from apps.api.main import app
from packages.shared.database import engine, Base
from packages.shared.models import Site, OAuthCredential, GscSearchMetric, CruxMetric, Organization, User, Membership
from services.integrations.google_token import is_fixture_token, ensure_valid_google_token
from services.integrations.google_sync_hub import GoogleSyncHub
from services.integrations.gsc_sync_service import sync_gsc_and_crux_for_site
from services.security.crypto import encrypt_secret
from sqlalchemy.future import select

@pytest_asyncio.fixture(autouse=True)
async def prepare_database():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest.mark.asyncio
async def test_is_fixture_token_handles_all_formats():
    """Issue 9: Fixture-token detection recognizes exact and prefixed forms."""
    assert is_fixture_token("mock_token") is True
    assert is_fixture_token("mock_token_123") is True
    assert is_fixture_token("mock-gsc-token-code123") is True
    assert is_fixture_token("mock-gsc-refresh-code123") is True
    assert is_fixture_token("real-live-google-oauth-token-xyz") is False
    assert is_fixture_token("") is False
    assert is_fixture_token(None) is False

@pytest.mark.asyncio
async def test_google_sync_hub_missing_ga4_property_not_auth_failure():
    """Issue 8: Missing GA4 property must be reported as HEALTHY with no auth error."""
    result = await GoogleSyncHub.synchronize_site_telemetry(
        site_domain="example.com",
        gsc_site_url="sc-domain:example.com",
        ga4_property_id=None,
        access_token="mock_token"
    )
    assert result["status"] == "HEALTHY"
    assert result["error_code"] is None
    assert result["gsc"]["connected"] is True
    assert result["ga4"]["connected"] is False
    # Must NOT generate an INTEGRATION_BROKEN insight asking user to reauthorize
    assert not any(i.get("type") == "INTEGRATION_BROKEN" for i in result["insights"])

@pytest.mark.asyncio
async def test_crux_synced_even_when_gsc_has_no_credentials():
    """Issue 3: CrUX metrics must be synced even when Google OAuth is disconnected."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Register user and org
        await client.post("/api/v1/auth/register", json={
            "email": "crux_user@example.com",
            "password": "Password123!",
            "full_name": "CrUX Tester"
        })
        login_res = await client.post("/api/v1/auth/login", json={
            "email": "crux_user@example.com",
            "password": "Password123!"
        })
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        org = (await client.post("/api/v1/organizations", json={"name": "CrUX Org", "slug": "crux-org"}, headers=headers)).json()
        site = (await client.post(f"/api/v1/organizations/{org['id']}/sites", json={
            "name": "CrUX Site",
            "primary_url": "https://crux-test.com",
            "site_type": "BLOG"
        }, headers=headers)).json()

        # Call POST /sync with NO Google credentials connected
        sync_res = await client.post(f"/api/v1/organizations/{org['id']}/sites/{site['id']}/integrations/sync", headers=headers)
        assert sync_res.status_code == 200
        sync_data = sync_res.json()
        assert sync_data["success"] is False
        assert sync_data["status"] == "DISCONNECTED"
        assert sync_data["error_code"] == "NO_CREDENTIALS"
        # Crux metrics must have synced!
        assert sync_data["crux_metrics_synced"] > 0

@pytest.mark.asyncio
async def test_google_status_sums_only_latest_sync_date():
    """Issue 1: /google/status must sum clicks and impressions only for the latest sync date."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post("/api/v1/auth/register", json={
            "email": "status_user@example.com",
            "password": "Password123!",
            "full_name": "Status Tester"
        })
        login_res = await client.post("/api/v1/auth/login", json={
            "email": "status_user@example.com",
            "password": "Password123!"
        })
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        org = (await client.post("/api/v1/organizations", json={"name": "Status Org", "slug": "status-org"}, headers=headers)).json()
        site = (await client.post(f"/api/v1/organizations/{org['id']}/sites", json={
            "name": "Status Site",
            "primary_url": "https://status-test.com",
            "site_type": "ECOMMERCE"
        }, headers=headers)).json()

        # Connect Google OAuth
        auth = (await client.get(f"/api/v1/organizations/{org['id']}/sites/{site['id']}/integrations/google/authorize", headers=headers)).json()
        state = auth["state"]
        await client.get(f"/api/v1/integrations/google/callback?code=mock_code&state={state}")

        # Insert GSC metrics for 2 different dates: 10 days ago (1000 clicks) and today (1000 clicks)
        from packages.shared.database import AsyncSessionLocal
        today = datetime.now(timezone.utc).date()
        past_date = today - timedelta(days=10)

        async with AsyncSessionLocal() as session:
            # 10 days ago rows: 1000 clicks total
            m1 = GscSearchMetric(site_id=site["id"], metric_date=past_date, query="query1", page="/p1", clicks=600, impressions=5000, ctr=0.12, position=2.0)
            m2 = GscSearchMetric(site_id=site["id"], metric_date=past_date, query="query2", page="/p2", clicks=400, impressions=4000, ctr=0.10, position=3.0)
            # Today rows: 1000 clicks total (the current 28-day totals)
            m3 = GscSearchMetric(site_id=site["id"], metric_date=today, query="query1", page="/p1", clicks=550, impressions=5200, ctr=0.105, position=2.1)
            m4 = GscSearchMetric(site_id=site["id"], metric_date=today, query="query2", page="/p2", clicks=450, impressions=4800, ctr=0.093, position=2.9)
            session.add_all([m1, m2, m3, m4])
            await session.commit()

        # Call GET /google/status
        status_res = await client.get(f"/api/v1/organizations/{org['id']}/sites/{site['id']}/integrations/google/status", headers=headers)
        assert status_res.status_code == 200
        data = status_res.json()
        # total_clicks must be 1000 (m3 + m4 from today), NOT 2000 (multiplied across both days)!
        assert data["gsc"]["total_clicks"] == 1000
        assert data["gsc"]["total_impressions"] == 10000

@pytest.mark.asyncio
async def test_oauth_callback_security_checks_user_org_membership():
    """Issue 6: Callback verifies that user_id in state belongs to org_id before writing credential."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # User 1 (Victim)
        await client.post("/api/v1/auth/register", json={
            "email": "victim@example.com",
            "password": "Password123!",
            "full_name": "Victim User"
        })
        login1 = await client.post("/api/v1/auth/login", json={
            "email": "victim@example.com",
            "password": "Password123!"
        })
        token1 = login1.json()["access_token"]
        headers1 = {"Authorization": f"Bearer {token1}"}
        org1 = (await client.post("/api/v1/organizations", json={"name": "Victim Org", "slug": "victim-org"}, headers=headers1)).json()
        site1 = (await client.post(f"/api/v1/organizations/{org1['id']}/sites", json={
            "name": "Victim Site",
            "primary_url": "https://victim.com",
            "site_type": "BLOG"
        }, headers=headers1)).json()

        # User 2 (Attacker)
        reg2 = await client.post("/api/v1/auth/register", json={
            "email": "attacker@example.com",
            "password": "Password123!",
            "full_name": "Attacker User"
        })
        attacker_user_id = reg2.json()["id"]

        # Attacker crafts state pointing to victim org with attacker's user_id
        malicious_state = f"{org1['id']}:{site1['id']}:{attacker_user_id}"

        # Attacker tries to complete OAuth callback
        cb_res = await client.get(f"/api/v1/integrations/google/callback?code=mock_code_attacker&state={malicious_state}")
        # Must be rejected with 403 Forbidden because attacker does not belong to victim org!
        assert cb_res.status_code == 403

