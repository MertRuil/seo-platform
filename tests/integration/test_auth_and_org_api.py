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
async def test_auth_and_tenant_flow():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Health check
        res = await client.get("/health/live")
        assert res.status_code == 200
        assert res.json()["status"] == "alive"

        # 2. Register user
        reg_payload = {
            "email": "seo_lead@acme.com",
            "password": "Password123!",
            "full_name": "SEO Lead"
        }
        res = await client.post("/api/v1/auth/register", json=reg_payload)
        assert res.status_code == 201
        user_data = res.json()
        assert user_data["email"] == "seo_lead@acme.com"

        # 3. Login
        login_payload = {
            "email": "seo_lead@acme.com",
            "password": "Password123!"
        }
        res = await client.post("/api/v1/auth/login", json=login_payload)
        assert res.status_code == 200
        token_data = res.json()
        access_token = token_data["access_token"]
        headers = {"Authorization": f"Bearer {access_token}"}

        # 4. Check /me
        res = await client.get("/api/v1/auth/me", headers=headers)
        assert res.status_code == 200
        assert res.json()["email"] == "seo_lead@acme.com"

        # 5. Create Organization
        org_payload = {
            "name": "Acme Corp",
            "slug": "acme-corp"
        }
        res = await client.post("/api/v1/organizations", json=org_payload, headers=headers)
        assert res.status_code == 201
        org = res.json()
        assert org["name"] == "Acme Corp"
        org_id = org["id"]

        # 6. List Organizations
        res = await client.get("/api/v1/organizations", headers=headers)
        assert res.status_code == 200
        orgs = res.json()
        assert len(orgs) == 1
        assert orgs[0]["id"] == org_id

        # 7. Create Site in Organization
        site_payload = {
            "name": "Acme Global E-Commerce",
            "primary_url": "https://www.acme.com",
            "site_type": "ECOMMERCE",
            "language": "en",
            "country": "US",
            "execution_mode": "REVIEW_ALL"
        }
        res = await client.post(f"/api/v1/organizations/{org_id}/sites", json=site_payload, headers=headers)
        assert res.status_code == 201
        site = res.json()
        assert site["domain"] == "www.acme.com"
        assert site["normalized_domain"] == "acme.com"
        assert site["verification_status"] == "UNVERIFIED"

        # 8. List Sites
        res = await client.get(f"/api/v1/organizations/{org_id}/sites", headers=headers)
        assert res.status_code == 200
        sites = res.json()
        assert len(sites) == 1
        assert sites[0]["id"] == site["id"]

@pytest.mark.asyncio
async def test_tenant_isolation_cross_organization_denial():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # User A
        await client.post("/api/v1/auth/register", json={"email": "alice@corp-a.com", "password": "Password123!"})
        res_a = await client.post("/api/v1/auth/login", json={"email": "alice@corp-a.com", "password": "Password123!"})
        headers_a = {"Authorization": f"Bearer {res_a.json()['access_token']}"}

        # User B
        await client.post("/api/v1/auth/register", json={"email": "bob@corp-b.com", "password": "Password123!"})
        res_b = await client.post("/api/v1/auth/login", json={"email": "bob@corp-b.com", "password": "Password123!"})
        headers_b = {"Authorization": f"Bearer {res_b.json()['access_token']}"}

        # Alice creates Org A
        res_org_a = await client.post("/api/v1/organizations", json={"name": "Org A", "slug": "org-a"}, headers=headers_a)
        org_a_id = res_org_a.json()["id"]

        # Bob attempts to access Org A sites -> MUST FAIL 403
        res_bob_denied = await client.get(f"/api/v1/organizations/{org_a_id}/sites", headers=headers_b)
        assert res_bob_denied.status_code == 403
        assert "Access denied" in res_bob_denied.json()["detail"]

        # Bob attempts to create site in Org A -> MUST FAIL 403
        res_bob_create_denied = await client.post(
            f"/api/v1/organizations/{org_a_id}/sites",
            json={"name": "Bob Infiltrates", "primary_url": "https://bob.com"},
            headers=headers_b
        )
        assert res_bob_create_denied.status_code == 403
