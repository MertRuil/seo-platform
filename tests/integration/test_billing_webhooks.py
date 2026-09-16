import pytest
import pytest_asyncio
import json
import time
import uuid
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
async def test_billing_checkout_portal_and_webhook_flow():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Register & Login
        reg_res = await client.post("/api/v1/auth/register", json={
            "email": "billing_admin@calpeo.ai",
            "password": "Password123!",
            "full_name": "Billing Admin"
        })
        assert reg_res.status_code == 201

        login_res = await client.post("/api/v1/auth/login", json={
            "email": "billing_admin@calpeo.ai",
            "password": "Password123!"
        })
        token = login_res.json()["access_token"]
        auth_headers = {"Authorization": f"Bearer {token}"}

        # 2. Create Org
        org_res = await client.post("/api/v1/organizations", json={
            "name": "Acme SaaS",
            "slug": "acme-saas"
        }, headers=auth_headers)
        assert org_res.status_code == 201
        org_id = org_res.json()["id"]

        # 3. List Billing Plans
        plans_res = await client.get("/api/v1/billing/plans")
        assert plans_res.status_code == 200
        plans = plans_res.json()
        assert len(plans) >= 4
        plan_codes = [p["code"] for p in plans]
        assert "free" in plan_codes
        assert "pro" in plan_codes

        # 4. Create Checkout Session
        checkout_res = await client.post(
            f"/api/v1/organizations/{org_id}/billing/checkout",
            json={"plan_code": "pro", "interval": "month"},
            headers=auth_headers
        )
        assert checkout_res.status_code == 200
        checkout_data = checkout_res.json()
        assert "checkout_url" in checkout_data
        assert checkout_data["provider"] == "PADDLE"
        assert f"org_id={org_id}" in checkout_data["checkout_url"]

        # 5. Get Customer Portal URL
        portal_res = await client.get(
            f"/api/v1/organizations/{org_id}/billing/portal",
            headers=auth_headers
        )
        assert portal_res.status_code == 200
        portal_data = portal_res.json()
        assert "portal_url" in portal_data
        assert f"org_id={org_id}" in portal_data["portal_url"]

        # 6. Webhook: Paddle subscription.activated
        webhook_event_id = f"evt_sub_{uuid.uuid4().hex[:8]}"
        webhook_payload = {
            "event_id": webhook_event_id,
            "event_type": "subscription.activated",
            "data": {
                "id": "sub_test_live_999",
                "customer_id": "ctm_test_999",
                "status": "active",
                "custom_data": {
                    "organization_id": org_id,
                    "plan_code": "pro"
                },
                "current_billing_period": {
                    "starts_at": "2026-09-01T00:00:00Z",
                    "ends_at": "2026-10-01T00:00:00Z"
                }
            }
        }
        wh_res = await client.post(
            "/api/v1/billing/webhooks/paddle",
            json=webhook_payload
        )
        assert wh_res.status_code == 200
        wh_data = wh_res.json()
        assert wh_data["status"] == "success"
        assert wh_data["event_type"] == "subscription.activated"

        # 7. Check Subscription Details - Org should now be on PRO plan!
        sub_details_res = await client.get(
            f"/api/v1/organizations/{org_id}/billing/subscription",
            headers=auth_headers
        )
        assert sub_details_res.status_code == 200
        sub_info = sub_details_res.json()
        assert sub_info["plan_code"] == "pro"
        assert sub_info["status"] == "ACTIVE"
        assert sub_info["provider"] == "PADDLE"
        assert sub_info["ai_credit_balance"] >= 500

        # 8. Webhook: Paddle transaction.completed -> generates Invoice
        txn_event_id = f"evt_txn_{uuid.uuid4().hex[:8]}"
        txn_payload = {
            "event_id": txn_event_id,
            "event_type": "transaction.completed",
            "data": {
                "id": "txn_test_777",
                "invoice_id": "inv_test_777",
                "invoice_number": "INV-2026-777",
                "currency_code": "USD",
                "invoice_pdf": "https://invoices.paddle.com/inv_test_777.pdf",
                "custom_data": {
                    "organization_id": org_id
                },
                "details": {
                    "totals": {
                        "subtotal": 11900,
                        "tax": 0,
                        "total": 11900
                    }
                }
            }
        }
        txn_wh_res = await client.post(
            "/api/v1/billing/webhooks/paddle",
            json=txn_payload
        )
        assert txn_wh_res.status_code == 200

        # 9. List Invoices - newly created invoice should be returned
        invoices_res = await client.get(
            f"/api/v1/organizations/{org_id}/billing/invoices",
            headers=auth_headers
        )
        assert invoices_res.status_code == 200
        invoices = invoices_res.json()
        assert len(invoices) >= 1
        assert invoices[0]["number"] == "INV-2026-777"
        assert invoices[0]["total_minor"] == 11900
        assert invoices[0]["status"] == "PAID"
        assert invoices[0]["currency"] == "USD"
        assert "119.00 USD" in invoices[0]["total_formatted"]
