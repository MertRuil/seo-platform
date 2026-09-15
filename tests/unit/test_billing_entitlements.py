import pytest
import uuid
from datetime import datetime, timezone
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.future import select

from packages.shared.database import Base
from packages.shared.models import (
    Organization,
    User,
    Membership,
    Plan,
    PlanPrice,
    PlanLimit,
    PlanFeature,
    Subscription
)
from services.billing.plans import seed_billing_plans, DEFAULT_PLANS
from services.billing.usage import UsageService
from services.billing.entitlements import EntitlementGuard


@pytest.fixture
async def async_db():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with async_session() as session:
        yield session

    await engine.dispose()


@pytest.mark.asyncio
async def test_seed_billing_plans(async_db: AsyncSession):
    """
    Test that default billing plans are seeded properly with prices, limits, and features.
    """
    plans = await seed_billing_plans(async_db)

    assert "free" in plans
    assert "starter" in plans
    assert "pro" in plans
    assert "agency" in plans
    assert "enterprise" in plans

    free_plan = plans["free"]
    assert free_plan.name == "Free"

    # Verify Free limits
    limits_map = {lim.metric: lim.hard_limit for lim in free_plan.limits}
    assert limits_map["pages_crawled"] == 500
    assert limits_map["ai_credits"] == 10
    assert limits_map["auto_fixes"] == 0

    # Verify Free features
    features_map = {feat.feature_key: feat.enabled for feat in free_plan.features}
    assert features_map["js_render"] is False
    assert features_map["experiments"] is False

    # Verify Pro features
    pro_plan = plans["pro"]
    pro_limits = {lim.metric: lim.hard_limit for lim in pro_plan.limits}
    assert pro_limits["pages_crawled"] == 100000
    assert pro_limits["ai_credits"] == 750
    assert pro_limits["auto_fixes"] == 300

    pro_features = {feat.feature_key: feat.enabled for feat in pro_plan.features}
    assert pro_features["js_render"] is True
    assert pro_features["experiments"] is True
    assert pro_features["api_access"] is True


@pytest.mark.asyncio
async def test_entitlement_guard_auto_assign_free_and_feature_gates(async_db: AsyncSession):
    """
    Test that an organization without a subscription is automatically assigned Free plan,
    and feature gates properly enforce access (e.g. 402 Payment Required for locked features).
    """
    org_id = str(uuid.uuid4())
    org = Organization(id=org_id, name="Acme Corp", slug="acme-corp")
    async_db.add(org)
    await async_db.commit()

    # Initially no subscription, get_or_create_subscription creates Free plan
    sub = await EntitlementGuard.get_or_create_subscription(async_db, org_id)
    assert sub.plan.code == "free"
    assert sub.status == "ACTIVE"

    # Free plan initial AI credits
    balance = await UsageService.get_credit_balance(async_db, org_id)
    assert balance == 10

    # Feature gate: js_render is locked on Free
    assert await EntitlementGuard.check_feature(async_db, org_id, "js_render") is False

    with pytest.raises(HTTPException) as exc_info:
        await EntitlementGuard.ensure_feature(async_db, org_id, "js_render")
    assert exc_info.value.status_code == 402
    assert exc_info.value.detail["error"] == "PAYMENT_REQUIRED"


@pytest.mark.asyncio
async def test_usage_counter_and_quota_enforcement(async_db: AsyncSession):
    """
    Test usage tracking, soft limit alerts, and 429 Quota Exceeded blocking.
    """
    org_id = str(uuid.uuid4())
    org = Organization(id=org_id, name="SEO Agency", slug="seo-agency")
    async_db.add(org)
    await async_db.commit()

    # Free plan has 500 pages_crawled limit
    await EntitlementGuard.get_or_create_subscription(async_db, org_id)

    # Initial usage should be 0
    used = await UsageService.get_usage(async_db, org_id, "pages_crawled")
    assert used == 0

    # Consume 200 pages
    await UsageService.consume(async_db, org_id, "pages_crawled", quantity=200, ref_type="crawl_run", ref_id="crawl_1")
    assert await UsageService.get_usage(async_db, org_id, "pages_crawled") == 200

    # Consume another 210 pages -> 410 / 500 (Soft limit is 400 = 80%)
    await UsageService.consume(async_db, org_id, "pages_crawled", quantity=210)
    allowed, status_code, info = await EntitlementGuard.check_limit(async_db, org_id, "pages_crawled", requested_qty=1)
    assert allowed is True
    assert status_code == "SOFT_LIMIT_REACHED"

    # Consume 90 more -> 500 / 500 (Hard limit reached)
    await UsageService.consume(async_db, org_id, "pages_crawled", quantity=90)
    assert await UsageService.get_usage(async_db, org_id, "pages_crawled") == 500

    # Attempt to consume 1 more page -> Quota Exceeded!
    allowed, reason, info = await EntitlementGuard.check_limit(async_db, org_id, "pages_crawled", requested_qty=1)
    assert allowed is False
    assert reason == "QUOTA_EXCEEDED"

    with pytest.raises(HTTPException) as exc_info:
        await EntitlementGuard.ensure_limit(async_db, org_id, "pages_crawled", requested_qty=1)
    assert exc_info.value.status_code == 429
    assert exc_info.value.detail["error"] == "QUOTA_EXCEEDED"


@pytest.mark.asyncio
async def test_reserve_crawl_budget(async_db: AsyncSession):
    """
    Test that reserve_crawl_budget caps the crawl run to the remaining quota.
    """
    org_id = str(uuid.uuid4())
    org = Organization(id=org_id, name="Budget Corp", slug="budget-corp")
    async_db.add(org)
    await async_db.commit()

    # Free plan has 500 pages limit
    await EntitlementGuard.get_or_create_subscription(async_db, org_id)

    # 400 pages already used
    await UsageService.consume(async_db, org_id, "pages_crawled", quantity=400)

    # User requested 250 pages crawl, but only 100 pages remain in monthly quota
    allocated = await EntitlementGuard.reserve_crawl_budget(async_db, org_id, requested_pages=250)
    assert allocated == 100

    # Consume the remaining 100
    await UsageService.consume(async_db, org_id, "pages_crawled", quantity=100)

    # Now budget is exhausted -> should raise 429
    with pytest.raises(HTTPException) as exc_info:
        await EntitlementGuard.reserve_crawl_budget(async_db, org_id, requested_pages=50)
    assert exc_info.value.status_code == 429


@pytest.mark.asyncio
async def test_credit_ledger_and_ai_credits(async_db: AsyncSession):
    """
    Test AI credit ledger balance, grants, consumption, and insufficient credit blocking.
    """
    org_id = str(uuid.uuid4())
    org = Organization(id=org_id, name="AI Studio", slug="ai-studio")
    async_db.add(org)
    await async_db.commit()

    # Subscribes to Free with initial 10 credits
    await EntitlementGuard.get_or_create_subscription(async_db, org_id)
    assert await UsageService.get_credit_balance(async_db, org_id) == 10

    # Grant 50 additional credits
    new_bal = await UsageService.grant_credits(async_db, org_id, amount=50, reason="ADDON")
    assert new_bal == 60
    assert await UsageService.get_credit_balance(async_db, org_id) == 60

    # Consume 3 credits for strategic roadmap
    await UsageService.consume(async_db, org_id, "ai_credits", quantity=3, ref_type="strategic_roadmap")
    assert await UsageService.get_credit_balance(async_db, org_id) == 57

    # Check limit when asking for 100 credits -> Insufficient
    allowed, reason, info = await EntitlementGuard.check_limit(async_db, org_id, "ai_credits", requested_qty=100)
    assert allowed is False
    assert reason == "INSUFFICIENT_CREDITS"


@pytest.mark.asyncio
async def test_plan_upgrade_unlocks_features_and_quota(async_db: AsyncSession):
    """
    Test switching from Free to Pro unlocks js_render, experiments, and increases limits.
    """
    org_id = str(uuid.uuid4())
    org = Organization(id=org_id, name="E-Commerce Brand", slug="e-com-brand")
    async_db.add(org)
    await async_db.commit()

    # Start with Free
    sub = await EntitlementGuard.get_or_create_subscription(async_db, org_id)
    assert await EntitlementGuard.check_feature(async_db, org_id, "js_render") is False
    assert await EntitlementGuard.check_feature(async_db, org_id, "experiments") is False

    # Switch to Pro
    plans = await seed_billing_plans(async_db)
    pro_plan = plans["pro"]
    sub.plan = pro_plan
    sub.plan_id = pro_plan.id
    await async_db.commit()

    # Re-evaluate
    assert await EntitlementGuard.check_feature(async_db, org_id, "js_render") is True
    assert await EntitlementGuard.check_feature(async_db, org_id, "experiments") is True
    assert await EntitlementGuard.check_feature(async_db, org_id, "auto_fixes") is True

    # Quota is now 100,000 pages
    allowed, _, info = await EntitlementGuard.check_limit(async_db, org_id, "pages_crawled", requested_qty=5000)
    assert allowed is True
    assert info["limit"] == 100000


@pytest.mark.asyncio
async def test_billing_api_endpoints():
    """
    Test billing FastAPI endpoints: public plan catalog, subscription details,
    plan switching, and AI credit grants.
    """
    from httpx import AsyncClient, ASGITransport
    from apps.api.main import app
    from packages.shared.database import engine, Base

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Public plan catalog
        plans_res = await client.get("/api/v1/billing/plans")
        assert plans_res.status_code == 200
        plan_codes = [p["code"] for p in plans_res.json()]
        assert "free" in plan_codes
        assert "pro" in plan_codes
        assert "agency" in plan_codes

        # 2. Register & Login
        email = f"billing_test_{uuid.uuid4().hex[:6]}@example.com"
        await client.post("/api/v1/auth/register", json={
            "email": email,
            "password": "Password123!",
            "full_name": "Billing Admin"
        })
        login_res = await client.post("/api/v1/auth/login", json={
            "email": email,
            "password": "Password123!"
        })
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 3. Create Org
        org_res = await client.post("/api/v1/organizations", json={
            "name": "Billing Org",
            "slug": f"billing-org-{uuid.uuid4().hex[:6]}"
        }, headers=headers)
        assert org_res.status_code == 201
        org_id = org_res.json()["id"]

        # 4. Get Subscription Details (Auto-created Free plan)
        sub_res = await client.get(f"/api/v1/organizations/{org_id}/billing/subscription", headers=headers)
        assert sub_res.status_code == 200
        sub_data = sub_res.json()
        assert sub_data["plan_code"] == "free"
        assert sub_data["status"] == "ACTIVE"
        assert sub_data["ai_credit_balance"] == 10
        assert sub_data["features"]["js_render"] is False

        # 5. Grant AI credits
        grant_res = await client.post(
            f"/api/v1/organizations/{org_id}/billing/credits/grant",
            json={"amount": 40, "reason": "PROMO"},
            headers=headers
        )
        assert grant_res.status_code == 200
        assert grant_res.json()["new_balance"] == 50

        # 6. Switch plan to Pro
        switch_res = await client.post(
            f"/api/v1/organizations/{org_id}/billing/plan",
            json={"plan_code": "pro"},
            headers=headers
        )
        assert switch_res.status_code == 200
        switch_data = switch_res.json()
        assert switch_data["plan_code"] == "pro"
        assert switch_data["features"]["js_render"] is True
        assert switch_data["features"]["experiments"] is True
        assert switch_data["usages"]["pages_crawled"]["limit"] == 100000

