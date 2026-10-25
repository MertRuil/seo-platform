import json
from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select, func

from apps.api.main import app
from packages.config.settings import settings
from packages.shared.database import AsyncSessionLocal, Base, engine
from packages.shared.models import (
    AuditLog, BillingEvent, Invoice, Membership, Organization, Plan, PlanPrice, Subscription, UsageEvent, User,
)
from services.accounts.provisioning import create_owned_organization
from services.billing.entitlements import EntitlementGuard
from services.security.jwt_auth import create_access_token
from tests.auth_helpers import create_user_token


@pytest_asyncio.fixture(autouse=True)
async def prepare_database():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


async def make_org(owner_id: str, name: str = "Müşteri A") -> str:
    async with AsyncSessionLocal() as db:
        org = await create_owned_organization(db, owner_id, name)
        await db.commit()
        await EntitlementGuard.get_or_create_subscription(db, org.id)
        return org.id


async def audit_count() -> int:
    async with AsyncSessionLocal() as db:
        return (await db.execute(select(func.count(AuditLog.id)))).scalar_one()


ADMIN_CALLS = [
    ("GET", "/api/v1/admin/overview", None),
    ("GET", "/api/v1/admin/system", None),
    ("GET", "/api/v1/admin/users", None),
    ("GET", "/api/v1/admin/users/x", None),
    ("PATCH", "/api/v1/admin/users/x", {"is_active": False}),
    ("GET", "/api/v1/admin/organizations", None),
    ("POST", "/api/v1/admin/organizations", {"name": "X", "owner_email": "a@b.com"}),
    ("GET", "/api/v1/admin/organizations/x", None),
    ("POST", "/api/v1/admin/organizations/x/members", {"email": "a@b.com"}),
    ("PATCH", "/api/v1/admin/organizations/x/members/y", {"role": "VIEWER"}),
    ("DELETE", "/api/v1/admin/organizations/x/members/y", None),
    ("POST", "/api/v1/admin/organizations/x/plan", {"plan_code": "pro", "reason": "deneme"}),
    ("POST", "/api/v1/admin/organizations/x/credits", {"amount": 5, "reason": "deneme"}),
    ("GET", "/api/v1/admin/billing/summary", None),
    ("GET", "/api/v1/admin/billing/subscriptions", None),
    ("GET", "/api/v1/admin/billing/invoices", None),
    ("GET", "/api/v1/admin/billing/events", None),
    ("GET", "/api/v1/admin/usage", None),
    ("GET", "/api/v1/admin/usage/x", None),
    ("GET", "/api/v1/admin/audit", None),
]


@pytest.mark.asyncio
async def test_every_admin_endpoint_rejects_non_admins(client):
    assert len(ADMIN_CALLS) == 20
    _, user_token = await create_user_token(claims={"is_admin": True, "role": "OWNER"})
    admin_id, _ = await create_user_token(is_platform_admin=True)
    local_token = create_access_token({"sub": admin_id, "auth_source": "nextjs_local"})
    for method, path, body in ADMIN_CALLS:
        anon = await client.request(method, path, json=body)
        assert anon.status_code == 401, (method, path)
        forged = await client.request(method, path, json=body, headers=bearer(user_token))
        assert forged.status_code == 403, (method, path, forged.text)
        local = await client.request(method, path, json=body, headers=bearer(local_token))
        assert local.status_code == 401, (method, path)
    assert await audit_count() == 0


@pytest.mark.asyncio
async def test_revoked_admin_loses_access_on_next_request(client):
    admin_id, admin_token = await create_user_token(is_platform_admin=True)
    other_id, other_token = await create_user_token(is_platform_admin=True)
    assert (await client.get("/api/v1/admin/overview", headers=bearer(other_token))).status_code == 200

    res = await client.patch(f"/api/v1/admin/users/{other_id}", json={"is_platform_admin": False}, headers=bearer(admin_token))
    assert res.status_code == 200
    assert (await client.get("/api/v1/admin/overview", headers=bearer(other_token))).status_code == 403

    res = await client.patch(f"/api/v1/admin/users/{other_id}", json={"is_active": False}, headers=bearer(admin_token))
    assert res.status_code == 200
    # Pasif kullanıcının token'ı tüm API'de reddedilir
    assert (await client.get("/api/v1/organizations", headers=bearer(other_token))).status_code == 401
    assert await audit_count() == 2


@pytest.mark.asyncio
async def test_admin_cannot_lock_themselves_out(client):
    admin_id, admin_token = await create_user_token(is_platform_admin=True)
    for body in ({"is_active": False}, {"is_platform_admin": False}):
        res = await client.patch(f"/api/v1/admin/users/{admin_id}", json=body, headers=bearer(admin_token))
        assert res.status_code == 400
    assert await audit_count() == 0


@pytest.mark.asyncio
async def test_users_list_search_and_detail(client):
    _, admin_token = await create_user_token(is_platform_admin=True)
    owner_id, _ = await create_user_token()
    org_id = await make_org(owner_id, "Çiçek Ajans")
    async with AsyncSessionLocal() as db:
        owner = await db.get(User, owner_id)
        owner.full_name = "Elif Kaya"
        await db.commit()

    res = await client.get("/api/v1/admin/users", params={"q": "elif"}, headers=bearer(admin_token))
    body = res.json()
    assert body["total"] == 1
    assert body["items"][0]["memberships"] == [{"organization_id": org_id, "organization_name": "Çiçek Ajans", "role": "OWNER"}]

    res = await client.get("/api/v1/admin/users", params={"admin": "true"}, headers=bearer(admin_token))
    assert res.json()["total"] == 1

    detail = (await client.get(f"/api/v1/admin/users/{owner_id}", headers=bearer(admin_token))).json()
    assert detail["memberships"][0]["role"] == "OWNER"
    assert (await client.get("/api/v1/admin/users/yok", headers=bearer(admin_token))).status_code == 404


@pytest.mark.asyncio
async def test_create_org_and_member_management_with_last_owner_guard(client):
    _, admin_token = await create_user_token(is_platform_admin=True)
    owner_id, _ = await create_user_token()
    member_id, _ = await create_user_token()
    async with AsyncSessionLocal() as db:
        owner_email = (await db.get(User, owner_id)).email
        member_email = (await db.get(User, member_id)).email

    res = await client.post("/api/v1/admin/organizations", json={"name": "Yeni Ajans", "owner_email": owner_email}, headers=bearer(admin_token))
    assert res.status_code == 201
    org_id = res.json()["id"]
    assert (await client.post("/api/v1/admin/organizations", json={"name": "X", "owner_email": "yok@yok.com"}, headers=bearer(admin_token))).status_code == 404

    base = f"/api/v1/admin/organizations/{org_id}/members"
    assert (await client.post(base, json={"email": member_email, "role": "SEO_MANAGER"}, headers=bearer(admin_token))).status_code == 201
    assert (await client.post(base, json={"email": member_email}, headers=bearer(admin_token))).status_code == 409
    assert (await client.patch(f"{base}/{owner_id}", json={"role": "VIEWER"}, headers=bearer(admin_token))).status_code == 400
    assert (await client.delete(f"{base}/{owner_id}", headers=bearer(admin_token))).status_code == 400

    assert (await client.patch(f"{base}/{member_id}", json={"role": "OWNER"}, headers=bearer(admin_token))).status_code == 200
    # Artık iki sahip var: ilk sahip çıkarılabilir
    assert (await client.delete(f"{base}/{owner_id}", headers=bearer(admin_token))).status_code == 204

    detail = (await client.get(f"/api/v1/admin/organizations/{org_id}", headers=bearer(admin_token))).json()
    assert [(m["user_id"], m["role"]) for m in detail["members"]] == [(member_id, "OWNER")]
    assert detail["subscription"]["plan_code"] == "free"

    actions = (await client.get("/api/v1/admin/audit", params={"org": org_id}, headers=bearer(admin_token))).json()
    assert sorted(i["action"] for i in actions["items"]) == sorted([
        "admin.org.create", "admin.member.add", "admin.member.update", "admin.member.remove",
    ])


@pytest.mark.asyncio
async def test_plan_and_credits_require_reason_and_are_audited(client):
    _, admin_token = await create_user_token(is_platform_admin=True)
    owner_id, _ = await create_user_token()
    org_id = await make_org(owner_id)
    base = f"/api/v1/admin/organizations/{org_id}"

    assert (await client.post(f"{base}/plan", json={"plan_code": "pro"}, headers=bearer(admin_token))).status_code == 422
    assert (await client.post(f"{base}/credits", json={"amount": 50}, headers=bearer(admin_token))).status_code == 422
    assert (await client.post(f"{base}/credits", json={"amount": 0, "reason": "kampanya"}, headers=bearer(admin_token))).status_code == 422
    assert (await client.post(f"{base}/plan", json={"plan_code": "yok", "reason": "deneme planı"}, headers=bearer(admin_token))).status_code == 404
    assert await audit_count() == 0

    res = await client.post(f"{base}/plan", json={"plan_code": "pro", "reason": "Kurumsal anlaşma"}, headers=bearer(admin_token))
    assert res.status_code == 200
    assert res.json() == {"organization_id": org_id, "plan_code": "pro", "status": "ACTIVE", "provider": "MANUAL"}

    before = (await client.get(base, headers=bearer(admin_token))).json()["ai_credit_balance"]
    res = await client.post(f"{base}/credits", json={"amount": 50, "reason": "Kampanya hediyesi"}, headers=bearer(admin_token))
    assert res.json()["balance"] == before + 50

    async with AsyncSessionLocal() as db:
        logs = (await db.execute(select(AuditLog).order_by(AuditLog.created_at))).scalars().all()
    assert [l.action for l in logs] == ["admin.plan.change", "admin.credits.grant"]
    assert json.loads(logs[0].state_before)["plan_code"] == "free"
    assert json.loads(logs[0].state_after)["reason"] == "Kurumsal anlaşma"
    assert json.loads(logs[1].state_after)["amount"] == 50


@pytest.mark.asyncio
async def test_billing_summary_mrr_rules(client):
    _, admin_token = await create_user_token(is_platform_admin=True)
    owner_id, _ = await create_user_token()
    now = datetime.now(timezone.utc)
    async with AsyncSessionLocal() as db:
        monthly = Plan(code="m", name="Aylık")
        yearly = Plan(code="y", name="Yıllık")
        db.add_all([monthly, yearly])
        await db.flush()
        db.add_all([
            PlanPrice(plan_id=monthly.id, interval="month", currency="USD", amount_minor=3900),
            PlanPrice(plan_id=monthly.id, interval="year", currency="USD", amount_minor=39000),
            PlanPrice(plan_id=yearly.id, interval="year", currency="TRY", amount_minor=120000),
        ])
        orgs = []
        for i in range(5):
            org = await create_owned_organization(db, owner_id, f"Org {i}")
            orgs.append(org.id)
        db.add_all([
            Subscription(organization_id=orgs[0], plan_id=monthly.id, status="ACTIVE"),
            Subscription(organization_id=orgs[1], plan_id=monthly.id, status="PAST_DUE"),
            Subscription(organization_id=orgs[2], plan_id=yearly.id, status="ACTIVE"),
            Subscription(organization_id=orgs[3], plan_id=monthly.id, status="TRIALING"),
            Subscription(organization_id=orgs[4], plan_id=monthly.id, status="CANCELED", canceled_at=now - timedelta(days=3)),
            Invoice(organization_id=orgs[0], status="PAID", currency="USD", total_minor=3900, paid_at=now),
            Invoice(organization_id=orgs[1], status="PENDING", currency="USD", total_minor=3900),
            BillingEvent(provider="PADDLE", external_event_id="evt_1", event_type="transaction.completed",
                         payload_json='{"customer": {"email": "gizli@musteri.com"}}', error="imza geçersiz"),
        ])
        await db.commit()

    s = (await client.get("/api/v1/admin/billing/summary", headers=bearer(admin_token))).json()
    # Aktif ve gecikmiş aylık abonelik: 2 x 39 USD; yıllık TRY planı 12'ye bölünür; deneme ve iptal girmez
    assert s["mrr_minor"] == {"USD": 7800, "TRY": 10000}
    assert s["collected_this_month_minor"] == {"USD": 3900}
    assert s["past_due"] == 1
    assert s["canceled_last_30_days"] == 1
    assert s["new_paid_last_30_days"] == 3

    events = (await client.get("/api/v1/admin/billing/events", params={"processed": "false"}, headers=bearer(admin_token))).json()
    assert events["items"][0]["error"] == "imza geçersiz"
    assert "gizli@musteri.com" not in json.dumps(events)

    invoices = (await client.get("/api/v1/admin/billing/invoices", params={"status": "paid"}, headers=bearer(admin_token))).json()
    assert invoices["total"] == 1
    subs = (await client.get("/api/v1/admin/billing/subscriptions", params={"status": "active"}, headers=bearer(admin_token))).json()
    assert subs["total"] == 2


@pytest.mark.asyncio
async def test_usage_list_flags_orgs_near_limit(client):
    from services.billing.usage import UsageService
    _, admin_token = await create_user_token(is_platform_admin=True)
    owner_id, _ = await create_user_token()
    busy = await make_org(owner_id, "Yoğun")
    await make_org(owner_id, "Sakin")
    async with AsyncSessionLocal() as db:
        await UsageService.consume(db, busy, "pages_crawled", 450, ref_type="crawl_run", ref_id="c1")

    body = (await client.get("/api/v1/admin/usage", headers=bearer(admin_token))).json()
    first = body["items"][0]
    assert first["organization_name"] == "Yoğun"
    assert first["metrics"]["pages_crawled"] == {"used": 450, "limit": 500, "ratio": 0.9, "level": "warn"}
    assert body["items"][1]["metrics"]["pages_crawled"]["used"] == 0

    detail = (await client.get(f"/api/v1/admin/usage/{busy}", headers=bearer(admin_token))).json()
    assert detail["daily"][0]["metric"] == "pages_crawled" and detail["daily"][0]["quantity"] == 450
    assert detail["events"][0]["ref_id"] == "c1"


@pytest.mark.asyncio
async def test_overview_and_system_do_not_leak_secrets(client):
    _, admin_token = await create_user_token(is_platform_admin=True)
    overview = (await client.get("/api/v1/admin/overview", headers=bearer(admin_token))).json()
    assert overview["users"] == {"total": 1, "active": 1}
    system = (await client.get("/api/v1/admin/system", headers=bearer(admin_token))).json()
    assert system["database"] is True
    assert set(system["llm"]) == {"provider", "model", "api_key_configured"}
    dumped = json.dumps(system)
    for secret in (settings.APP_SECRET_KEY, settings.ENCRYPTION_KEY, settings.DATABASE_URL):
        assert secret not in dumped


@pytest.mark.asyncio
async def test_paid_plan_bypass_uses_database_admin_flag_in_production(client, monkeypatch):
    owner_id, _ = await create_user_token()
    org_id = await make_org(owner_id)
    forged = create_access_token({"sub": owner_id, "is_admin": True})
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    res = await client.post(f"/api/v1/organizations/{org_id}/billing/plan", json={"plan_code": "pro"}, headers=bearer(forged))
    assert res.status_code == 402
    res = await client.post(f"/api/v1/organizations/{org_id}/billing/credits/grant", json={"amount": 1000}, headers=bearer(forged))
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_login_records_last_login(client):
    res = await client.post("/api/v1/auth/register", json={"email": "son@giris.com", "password": "Password123!"})
    assert res.status_code == 201
    await client.post("/api/v1/auth/login", json={"email": "son@giris.com", "password": "Password123!"})
    async with AsyncSessionLocal() as db:
        user = (await db.execute(select(User).where(User.email == "son@giris.com"))).scalar_one()
    assert user.last_login_at is not None
