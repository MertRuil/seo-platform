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
async def test_leads_generation_and_listing():
    """Validates financial loss calculation, lead card generation, and listing."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Register & Login
        await client.post("/api/v1/auth/register", json={
            "email": "lead_hunter@company.com",
            "password": "Password123!",
            "full_name": "Lead Hunter"
        })
        login_res = await client.post("/api/v1/auth/login", json={
            "email": "lead_hunter@company.com",
            "password": "Password123!"
        })
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        org = (await client.post("/api/v1/organizations", json={"name": "Agency Group", "slug": "agency-group"}, headers=headers)).json()
        site = (await client.post(f"/api/v1/organizations/{org['id']}/sites", json={
            "name": "E-Commerce Titan",
            "primary_url": "https://titanshop.com",
            "site_type": "ECOMMERCE"
        }, headers=headers)).json()

        # 1. Test Listing (seeded auto-lead)
        list_res = await client.get(f"/api/v1/organizations/{org['id']}/sites/{site['id']}/leads", headers=headers)
        assert list_res.status_code == 200
        leads = list_res.json()
        assert len(leads) >= 1
        initial_lead = leads[0]
        assert "metrics" in initial_lead
        assert initial_lead["metrics"]["annual_revenue_loss"] > 0
        assert len(initial_lead["metrics"]["critical_barriers"]) > 0

        # 2. Test Custom Lead Generation
        gen_res = await client.post(f"/api/v1/organizations/{org['id']}/sites/{site['id']}/leads/generate", json={
            "url": "https://prospect-store.com",
            "company_name": "Prospect Store LLC",
            "contact_name": "Canan Demir",
            "contact_email": "canan@prospect-store.com",
            "monthly_traffic": 100000,
            "conversion_rate": 0.03,
            "average_order_value": 150.0,
            "currency": "USD"
        }, headers=headers)

        assert gen_res.status_code == 200
        new_lead = gen_res.json()
        assert new_lead["company_name"] == "Prospect Store LLC"
        assert new_lead["metrics"]["monthly_traffic"] == 100000
        assert new_lead["metrics"]["annual_revenue_loss"] > 50000
        assert "Prospect Store LLC" in new_lead["proposal_pitch"]
        assert "Enterprise" in new_lead["recommended_tier"] or "Growth" in new_lead["recommended_tier"]

@pytest.mark.asyncio
async def test_sistem_crm_export_and_quick_audit():
    """Validates Sistem CRM bridge export payload and rapid lead magnet endpoint."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post("/api/v1/auth/register", json={
            "email": "crm_director@company.com",
            "password": "Password123!",
            "full_name": "CRM Director"
        })
        login_res = await client.post("/api/v1/auth/login", json={
            "email": "crm_director@company.com",
            "password": "Password123!"
        })
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        org = (await client.post("/api/v1/organizations", json={"name": "Sales Corp", "slug": "sales-corp"}, headers=headers)).json()
        site = (await client.post(f"/api/v1/organizations/{org['id']}/sites", json={
            "name": "Global Retail",
            "primary_url": "https://globalretail.com",
            "site_type": "ECOMMERCE"
        }, headers=headers)).json()

        # 1. Test Quick Audit Lead Magnet
        quick_res = await client.post(f"/api/v1/organizations/{org['id']}/sites/{site['id']}/leads/quick-audit", json={
            "url": "https://fastbrand.com",
            "company_name": "FastBrand Digital",
            "contact_name": "Ahmet Yılmaz",
            "contact_email": "ahmet@fastbrand.com",
            "monthly_traffic": 75000,
            "conversion_rate": 0.025,
            "average_order_value": 85.0
        }, headers=headers)

        assert quick_res.status_code == 200
        audit_lead = quick_res.json()
        assert audit_lead["company_name"] == "FastBrand Digital"
        assert audit_lead["metrics"]["annual_revenue_loss"] > 0

        # 2. Test Export to Sistem CRM
        export_res = await client.post(f"/api/v1/organizations/{org['id']}/sites/{site['id']}/leads/export-crm", json={
            "lead_id": audit_lead["id"],
            "company_name": "FastBrand Digital",
            "contact_name": "Ahmet Yılmaz",
            "contact_email": "ahmet@fastbrand.com",
            "target_url": "https://fastbrand.com",
            "annual_value": audit_lead["metrics"]["annual_revenue_loss"],
            "proposal_pitch": audit_lead["proposal_pitch"],
            "destination_crm": "Sistem CRM",
            "custom_notes": "Sitede 18 canonical hata ve mobil LCP darboğazı var."
        }, headers=headers)

        assert export_res.status_code == 200
        crm_data = export_res.json()
        assert crm_data["success"] is True
        assert crm_data["destination"] == "Sistem CRM"
        assert "synced_payload" in crm_data
        
        # Verify lead & activity structure matching Sistem CRM
        payload = crm_data["synced_payload"]
        assert "lead" in payload
        assert "activity" in payload
        assert payload["lead"]["name"] == "Ahmet Yılmaz"
        assert payload["lead"]["company"] == "FastBrand Digital"
        assert payload["lead"]["pipeline"] == "Inbound SEO Audit"
        assert payload["lead"]["deal_value"] == audit_lead["metrics"]["annual_revenue_loss"]
        assert payload["activity"]["type"] == "AUDIT_GENERATED"
