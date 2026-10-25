import json
import time
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from apps.api.main import app
from packages.shared.database import engine, Base, AsyncSessionLocal
from packages.shared.models import CrawlRun, CrawlPage, GscSearchMetric
from services.billing.provider.paddle import PaddleBillingProvider
from services.executor.executor_service import SafeSiteExecutor
from services.executor.connectors.sandbox import SandboxSimulationConnector


@pytest_asyncio.fixture
async def client():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def setup_site(client):
    await client.post("/api/v1/auth/register", json={"email":"release@example.com","password":"ReleaseTest123!"})
    token = (await client.post("/api/v1/auth/login",json={"email":"release@example.com","password":"ReleaseTest123!"})).json()["access_token"]
    headers = {"Authorization":f"Bearer {token}"}
    org = (await client.post("/api/v1/organizations",json={"name":"Release Org","slug":"release-org"},headers=headers)).json()["id"]
    site = (await client.post(f"/api/v1/organizations/{org}/sites",json={"name":"Release Site","primary_url":"https://release.example"},headers=headers)).json()["id"]
    return headers,org,site


@pytest.mark.asyncio
async def test_pages_schema_and_gsc_period(client):
    headers,org,site = await setup_site(client)
    async with AsyncSessionLocal() as db:
        crawl = CrawlRun(site_id=site,status="COMPLETED")
        db.add(crawl); await db.flush()
        crawl_id=crawl.id
        for i in range(3):
            db.add(CrawlPage(site_id=site,crawl_run_id=crawl.id,url=f"https://release.example/{i}",normalized_url=f"https://release.example/{i}",status_code=200,depth=i,structured_data_json=json.dumps([{"@type":"Organization"}]) if i==0 else None))
        for days,clicks in [(1,10),(50,99)]:
            db.add(GscSearchMetric(site_id=site,metric_date=(datetime.now(timezone.utc)-timedelta(days=days)).date(),query="test",page="https://release.example/",clicks=clicks,impressions=100,ctr=.1,position=2))
        await db.commit()
    base=f"/api/v1/organizations/{org}/sites/{site}"
    pages=(await client.get(f"{base}/crawls/{crawl_id}/pages?limit=2&offset=1",headers=headers)).json()
    assert pages["total"]==3 and len(pages["items"])==2 and pages["offset"]==1
    filtered=(await client.get(f"{base}/crawls/{crawl_id}/pages?q=%2F2",headers=headers)).json()
    assert filtered["total"]==1 and filtered["items"][0]["url"].endswith("/2")
    schema=(await client.get(f"{base}/crawls/{crawl_id}/schema",headers=headers)).json()
    assert schema[0]["type"]=="Organization"
    assert schema[0]["status"]=="Uyarı"  # Presence does not establish Google eligibility.
    recent=(await client.get(f"{base}/integrations/gsc?days=7",headers=headers)).json()
    history=(await client.get(f"{base}/integrations/gsc?days=90",headers=headers)).json()
    assert sum(r["clicks"] for r in recent)==10
    assert sum(r["clicks"] for r in history)==109


@pytest.mark.asyncio
async def test_oauth_state_is_bound_to_requesting_browser(client):
    headers,org,site=await setup_site(client)
    auth=await client.get(f"/api/v1/organizations/{org}/sites/{site}/integrations/google/authorize",headers=headers)
    assert auth.status_code==200
    state=auth.json()["state"]
    assert (await client.get("/api/v1/integrations/google/callback",params={"code":"mock_code","state":state+"tampered"})).status_code==400
    assert (await client.get("/api/v1/integrations/google/callback",params={"code":"mock_code","state":state})).status_code==200
    client.cookies.clear()
    assert (await client.get("/api/v1/integrations/google/callback",params={"code":"mock_code","state":state})).status_code==400


@pytest.mark.asyncio
async def test_backup_is_persisted_before_mutation_and_restores_exact_state():
    connector=SandboxSimulationConnector("release.example")
    before=await connector.read_page_state("https://release.example/")
    backup={}
    async def persist(snapshot):
        assert not connector.applied_mutations
        backup.update(snapshot)
    result=await SafeSiteExecutor(connector).execute_change_item({"target_url":before["url"],"expected_hash_before":before["current_hash"],"state_after":"new"},require_approval=False,persist_backup=persist)
    assert result.success and backup==before
    assert await connector.rollback_change(backup)
    assert await connector.read_page_state(before["url"])==before


def test_unsigned_payment_webhooks_are_rejected(monkeypatch):
    from packages.config.settings import settings
    monkeypatch.setattr(settings,"PADDLE_WEBHOOK_SECRET",None)
    assert not PaddleBillingProvider().verify_webhook_signature({},b'{}')


def test_paddle_reads_keys_from_settings(monkeypatch):
    # .env dosyası os.environ'a değil settings'e yüklenir.
    from packages.config.settings import settings
    monkeypatch.delenv("PADDLE_API_KEY",raising=False)
    monkeypatch.setattr(settings,"PADDLE_API_KEY","from-settings")
    monkeypatch.setattr(settings,"PADDLE_SANDBOX",False)
    provider=PaddleBillingProvider()
    assert provider.api_key=="from-settings"
    assert provider.api_base_url=="https://api.paddle.com"


@pytest.mark.asyncio
async def test_password_codes_are_durable_hashed_and_single_use(client, monkeypatch):
    from sqlalchemy import select
    from packages.shared.models import PasswordResetChallenge
    from apps.api.routes import auth
    from services.security.rate_limiter import _MEMORY_STORE
    _MEMORY_STORE.clear()
    await setup_site(client)
    monkeypatch.setattr(auth.settings, "ENVIRONMENT", "development")
    sender = AsyncMock()
    monkeypatch.setattr(auth, "send_password_code", sender)
    response = await client.post("/api/v1/auth/forgot-password",json={"email":"release@example.com"})
    assert response.status_code == 200
    token = response.json()["reset_token"]
    email,code = sender.call_args.args
    async with AsyncSessionLocal() as db:
        challenge = (await db.execute(select(PasswordResetChallenge))).scalars().one()
        assert challenge.token_hash != token and challenge.code_hash != code
        assert len(challenge.token_hash) == len(challenge.code_hash) == 64
    # Use a separate HTTP client / DB session, as after a process restart.
    async with AsyncClient(transport=ASGITransport(app=app),base_url="http://test") as other:
        for _ in range(2):
            invalid = await other.post("/api/v1/auth/reset-password",json={"email":email,"token":"wrong","new_password":"NewPassword123!"})
            assert invalid.status_code == 400
        payload={"email":email,"token":code,"new_password":"NewPassword123!"}
        assert (await other.post("/api/v1/auth/reset-password",json=payload)).status_code == 200
        assert (await other.post("/api/v1/auth/reset-password",json=payload)).status_code == 400
    assert (await client.post("/api/v1/auth/login",json={"email":email,"password":"NewPassword123!"})).status_code==200
    # Delivery failure must not retain a usable reset challenge or report success.
    sender.side_effect=RuntimeError("mail unavailable")
    assert (await client.post("/api/v1/auth/forgot-password",json={"email":email})).status_code==503
    async with AsyncSessionLocal() as db:
        assert (await db.execute(select(PasswordResetChallenge))).scalars().first() is None


@pytest.mark.asyncio
async def test_password_code_five_attempt_limit(client, monkeypatch):
    from apps.api.routes import auth
    from services.security.rate_limiter import _MEMORY_STORE
    _MEMORY_STORE.clear()
    await setup_site(client)
    monkeypatch.setattr(auth.settings,"ENVIRONMENT","development")
    sender=AsyncMock()
    monkeypatch.setattr(auth,"send_password_code",sender)
    await client.post("/api/v1/auth/forgot-password",json={"email":"release@example.com"})
    email,code=sender.call_args.args
    for _ in range(5):
        assert (await client.post("/api/v1/auth/reset-password",json={"email":email,"token":"wrong","new_password":"NewPassword123!"})).status_code==400
    assert (await client.post("/api/v1/auth/reset-password",json={"email":email,"token":code,"new_password":"NewPassword123!"})).status_code==400


@pytest.mark.asyncio
async def test_experiments_use_measured_cohorts_and_reject_missing_baselines(client):
    headers,org,site=await setup_site(client)
    change=(datetime.now(timezone.utc)-timedelta(days=14)).date()
    v="https://release.example/variant"; c="https://release.example/control"
    url=f"/api/v1/organizations/{org}/sites/{site}/experiments"
    request={"name":"Measured","variant_pages":[v],"control_pages":[c],"change_date":str(change),"window_days":7}
    assert (await client.post(url,json=request,headers=headers)).status_code==409
    async with AsyncSessionLocal() as db:
        for page,before,after in [(v,100,150),(c,100,110)]:
            for days,clicks in [(-1,before),(1,after)]:
                db.add(GscSearchMetric(site_id=site,metric_date=change+timedelta(days=days),query="measured",page=page,clicks=clicks,impressions=1000,ctr=.1,position=2))
        await db.commit()
    result=await client.post(url,json=request,headers=headers)
    assert result.status_code==201, result.text
    assert result.json()["diff_in_diff_lift"]==40
    assert result.json()["variant_relative_lift_percent"]==40
    assert result.json()["is_statistically_significant"] is False
    assert (await client.post(url,json={**request,"control_pages":[v]},headers=headers)).status_code==400


@pytest.mark.asyncio
async def test_crm_records_survive_cache_clear_are_site_scoped_and_preserve_zero(client,monkeypatch):
    from types import SimpleNamespace
    from services.crm.lead_engine import lead_engine
    monkeypatch.setattr("apps.api.routes.leads.observe_health",AsyncMock(return_value={"health_score":60,"issues":[SimpleNamespace(title="Observed issue",recommendation_template="Observed fix")]}))
    headers,org,site=await setup_site(client)
    base=f"/api/v1/organizations/{org}/sites/{site}/leads"
    assert (await client.get(base,headers=headers)).json()==[]
    lead=(await client.post(base+"/generate",json={"monthly_traffic":0,"average_order_value":0,"conversion_rate":0},headers=headers)).json()
    assert lead["metrics"]["annual_revenue_loss"]==0 and lead["contact_email"] is None
    assert lead["metrics"]["critical_barriers"]==["Observed issue"]
    lead_engine._org_leads.clear()
    assert (await client.get(base,headers=headers)).json()[0]["id"]==lead["id"]
    site2=(await client.post(f"/api/v1/organizations/{org}/sites",json={"name":"Other","primary_url":"https://other.example"},headers=headers)).json()["id"]
    assert (await client.get(f"/api/v1/organizations/{org}/sites/{site2}/leads",headers=headers)).json()==[]
    export={"lead_id":lead["id"],"company_name":"Release","contact_name":"","contact_email":"","target_url":lead["target_url"],"annual_value":0}
    result=(await client.post(base+"/export-crm",json=export,headers=headers)).json()
    assert result["delivered"] is False and not result["crm_lead_id"]
    assert result["synced_payload"]["lead"]["deal_value"]==0
    assert (await client.get(base,headers=headers)).json()[0]["crm_status"]=="exported"

    monkeypatch.setattr(lead_engine,"export_to_sistem_crm",AsyncMock(side_effect=RuntimeError("delivery failed")))
    assert (await client.post(base+"/export-crm",json=export,headers=headers)).status_code==502
    assert (await client.get(base,headers=headers)).json()[0]["crm_status"]=="exported"


@pytest.mark.asyncio
async def test_paddle_portal_session_and_failed_cancel_preserve_state(client, monkeypatch):
    from services.billing.entitlements import EntitlementGuard
    from httpx import Response, Request
    _,org,_=await setup_site(client)
    async with AsyncSessionLocal() as db:
        sub=await EntitlementGuard.get_or_create_subscription(db,org)
        sub.external_customer_id="ctm_"+"a"*26
        sub.external_subscription_id="sub_"+"b"*26
        await db.commit()
        provider=PaddleBillingProvider(api_key="test-real-shaped-key",is_sandbox=True)
        class ProviderClient:
            async def __aenter__(self): return self
            async def __aexit__(self,*args): pass
            async def post(self,url,**kwargs):
                if url.endswith('/portal-sessions'):
                    assert kwargs['headers']['Authorization']=="Bearer test-real-shaped-key"
                    return Response(201,json={"data":{"urls":{"general":{"overview":"https://sandbox-customer-portal.paddle.com/verified-session"}}}},request=Request("POST",url))
                return Response(503,json={"error":"unavailable"},request=Request("POST",url))
        monkeypatch.setattr("services.billing.provider.paddle.httpx.AsyncClient",lambda **kw:ProviderClient())
        portal=await provider.get_portal_url(db,org)
        assert portal.portal_url.endswith('/verified-session')
        with pytest.raises(ValueError,match="doğrulanamadı"):
            await provider.cancel_subscription(db,org)
        await db.refresh(sub)
        assert sub.cancel_at_period_end is False and sub.status=="ACTIVE"
