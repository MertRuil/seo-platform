import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from apps.api.main import app
from packages.shared.database import engine, Base

@pytest_asyncio.fixture(autouse=True)
async def prepare_database():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest.mark.asyncio
async def test_self_healing_lifecycle_and_rollback():
    """Validates autonomous self-healing, listing, and atomic rollback endpoints."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Register & Login
        await client.post("/api/v1/auth/register", json={
            "email": "selfheal@agency.io",
            "password": "Password123!",
            "full_name": "Self Heal Engineer"
        })
        login_res = await client.post("/api/v1/auth/login", json={
            "email": "selfheal@agency.io",
            "password": "Password123!"
        })
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Create Organization & Site
        org_res = await client.post("/api/v1/organizations", json={
            "name": "Self Healing Corp",
            "slug": "self-heal-corp"
        }, headers=headers)
        org_id = org_res.json()["id"]

        site_res = await client.post(f"/api/v1/organizations/{org_id}/sites", json={
            "name": "Auto Fix Store",
            "primary_url": "https://autofix.store",
            "site_type": "ECOMMERCE"
        }, headers=headers)
        site_id = site_res.json()["id"]

        # 3. Trigger 1-Click Self-Heal on a Canonical issue
        heal_res = await client.post(f"/api/v1/organizations/{org_id}/sites/{site_id}/self-heal", json={
            "issue_id": "ISSUE-CANONICAL-404",
            "issue_title": "Eksik Canonical Etiketi",
            "target_url": "https://autofix.store/product-10",
            "category": "CANONICAL",
            "risk_level": "LOW",
            "auto_execute": True,
            "state_before": "<title>Product 10</title>",
            "state_after": "<title>Product 10</title><link rel='canonical' href='https://autofix.store/product-10' />"
        }, headers=headers)

        assert heal_res.status_code == 200
        heal_data = heal_res.json()
        assert heal_data["success"] is True
        assert heal_data["change_set"]["status"] == "SUCCESS"
        assert heal_data["connector_type"] in ("SANDBOX", "CLOUDFLARE_WORKER", "WORDPRESS_REST")
        cs_id = heal_data["change_set"]["id"]

        # 4. List ChangeSets - must contain the self-healed changeset
        list_res = await client.get(f"/api/v1/organizations/{org_id}/sites/{site_id}/change-sets", headers=headers)
        assert list_res.status_code == 200
        sets = list_res.json()
        assert len(sets) >= 1
        assert sets[0]["id"] == cs_id
        assert sets[0]["status"] == "SUCCESS"

        # 5. Rollback the ChangeSet
        rollback_res = await client.post(f"/api/v1/organizations/{org_id}/sites/{site_id}/change-sets/{cs_id}/rollback", headers=headers)
        assert rollback_res.status_code == 200
        rb_data = rollback_res.json()
        assert rb_data["success"] is True
        assert rb_data["rolled_back"] is True
        assert rb_data["status"] == "ROLLED_BACK"

        # 6. Verify status updated to ROLLED_BACK
        get_res = await client.get(f"/api/v1/organizations/{org_id}/sites/{site_id}/change-sets/{cs_id}", headers=headers)
        assert get_res.status_code == 200
        assert get_res.json()["status"] == "ROLLED_BACK"

@pytest.mark.asyncio
async def test_self_healing_critical_risk_requires_approval():
    """Validates that CRITICAL risk self-heal items are gated by human approval."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post("/api/v1/auth/register", json={
            "email": "critical@agency.io",
            "password": "Password123!",
            "full_name": "Critical Risk Lead"
        })
        login_res = await client.post("/api/v1/auth/login", json={
            "email": "critical@agency.io",
            "password": "Password123!"
        })
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        org = (await client.post("/api/v1/organizations", json={"name": "Crit Org", "slug": "crit-org"}, headers=headers)).json()
        site = (await client.post(f"/api/v1/organizations/{org['id']}/sites", json={
            "name": "Crit Site",
            "primary_url": "https://crit-site.io",
            "site_type": "BLOG"
        }, headers=headers)).json()

        # Critical self-heal cannot auto-execute without explicit approval
        crit_res = await client.post(f"/api/v1/organizations/{org['id']}/sites/{site['id']}/self-heal", json={
            "issue_id": "CRIT-REDIRECT-CHAIN",
            "target_url": "https://crit-site.io/deep-page",
            "category": "REDIRECT_301",
            "risk_level": "CRITICAL",
            "auto_execute": True
        }, headers=headers)

        assert crit_res.status_code == 200
        crit_data = crit_res.json()
        assert crit_data["change_set"]["status"] == "WAITING_APPROVAL"
