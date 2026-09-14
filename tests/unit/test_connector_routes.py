import pytest
import uuid
import json
from httpx import AsyncClient, ASGITransport
from apps.api.main import app
from packages.shared.database import engine, Base, AsyncSessionLocal
from packages.shared.models import User, Organization, Membership, Site, SiteConnector
from services.security.crypto import hash_password, encrypt_secret
from services.security.jwt_auth import create_access_token

@pytest.mark.asyncio
async def test_connector_lifecycle_and_security():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        user_id = str(uuid.uuid4())
        org_id = str(uuid.uuid4())
        site_id = str(uuid.uuid4())

        user = User(
            id=user_id,
            email="connector_admin@example.com",
            hashed_password=hash_password("Pass123!"),
            full_name="Connector Admin",
            is_active=True
        )
        org = Organization(id=org_id, name="Connector Org", slug="conn-org")
        mem = Membership(id=str(uuid.uuid4()), user_id=user_id, organization_id=org_id, role="OWNER")
        site = Site(
            id=site_id,
            organization_id=org_id,
            name="Connector Site",
            domain="conn-site.com",
            normalized_domain="conn-site.com",
            primary_url="https://conn-site.com"
        )
        session.add_all([user, org, mem, site])
        await session.commit()

    token = create_access_token({"sub": user_id, "email": "connector_admin@example.com", "is_admin": True})
    headers = {"Authorization": f"Bearer {token}"}

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Initial list should be empty
        res = await client.get(f"/api/v1/organizations/{org_id}/sites/{site_id}/connectors", headers=headers)
        assert res.status_code == 200
        assert res.json() == []

        # 2. Create a WordPress connector
        create_payload = {
            "connector_type": "WORDPRESS_REST",
            "base_url": "mock://wordpress.site",
            "credentials": {
                "username": "wp_user",
                "app_password": "secret_app_password"
            },
            "is_active": True
        }
        res = await client.post(f"/api/v1/organizations/{org_id}/sites/{site_id}/connectors", json=create_payload, headers=headers)
        assert res.status_code == 201
        data = res.json()
        assert data["connector_type"] == "WORDPRESS_REST"
        assert "wp_user / secr••••••••" in data["token_masked"]
        assert len(data["capabilities"]) > 0
        connector_id = data["id"]

        # 3. Test the connector with mock URL -> should succeed
        test_payload = {
            "connector_id": connector_id,
            "connector_type": "WORDPRESS_REST",
            "base_url": "mock://wordpress.site",
            "credentials": {
                "username": "wp_user",
                "app_password": "secret_app_password"
            }
        }
        res = await client.post(f"/api/v1/organizations/{org_id}/sites/{site_id}/connectors/test", json=test_payload, headers=headers)
        assert res.status_code == 200
        test_res = res.json()
        assert test_res["success"] is True
        assert "CAN_EDIT_TITLE" in test_res["capabilities"]

        # 4. SSRF Defense: Test with internal loopback IP -> should be blocked
        ssrf_payload = {
            "connector_type": "WORDPRESS_REST",
            "base_url": "http://127.0.0.1:9090",
            "credentials": {"username": "admin", "app_password": "pwd"}
        }
        res = await client.post(f"/api/v1/organizations/{org_id}/sites/{site_id}/connectors/test", json=ssrf_payload, headers=headers)
        assert res.status_code == 200
        ssrf_res = res.json()
        assert ssrf_res["success"] is False
        assert ssrf_res["status_code"] == 400
        assert "SSRF" in ssrf_res["message"]

        # 5. List connectors again -> should have 1 connector
        res = await client.get(f"/api/v1/organizations/{org_id}/sites/{site_id}/connectors", headers=headers)
        assert res.status_code == 200
        assert len(res.json()) == 1

        # 6. Delete connector
        res = await client.delete(f"/api/v1/organizations/{org_id}/sites/{site_id}/connectors/{connector_id}", headers=headers)
        assert res.status_code == 204

        # 7. List connectors again -> should be empty
        res = await client.get(f"/api/v1/organizations/{org_id}/sites/{site_id}/connectors", headers=headers)
        assert res.status_code == 200
        assert res.json() == []
