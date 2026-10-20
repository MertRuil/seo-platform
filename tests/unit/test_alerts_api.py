import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

from apps.api.main import app
from apps.api.routes import alerts as alerts_route
from packages.shared.database import engine, Base


@pytest_asyncio.fixture(autouse=True)
async def prepare_database():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


async def _setup(client):
    await client.post("/api/v1/auth/register", json={"email": "alerts@company.com", "password": "Password123!", "full_name": "Alerts"})
    token = (await client.post("/api/v1/auth/login", json={"email": "alerts@company.com", "password": "Password123!"})).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    org = (await client.post("/api/v1/organizations", json={"name": "Alert Org", "slug": "alert-org"}, headers=headers)).json()
    site = (await client.post(f"/api/v1/organizations/{org['id']}/sites", json={"name": "Alert Site", "primary_url": "https://alerts.io"}, headers=headers)).json()
    return headers, f"/api/v1/organizations/{org['id']}/sites/{site['id']}/alerts/test"


@pytest.mark.asyncio
async def test_alert_test_delivers_through_dispatcher(monkeypatch):
    calls = []

    async def fake_slack(url, alert):
        calls.append((url, alert.site_domain, alert.event_type))
        return {"success": True, "channel": "SLACK", "status_code": 200, "message": "Slack bildirimi iletildi."}

    monkeypatch.setattr(alerts_route.AlertDispatcher, "send_slack_alert", fake_slack)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers, url = await _setup(client)
        res = await client.post(url, json={"channel": "SLACK", "target": "https://hooks.slack.com/services/T/B/X"}, headers=headers)
    assert res.status_code == 200
    assert res.json()["success"] is True
    assert calls == [("https://hooks.slack.com/services/T/B/X", "alerts.io", "TEST")]


@pytest.mark.asyncio
async def test_alert_test_blocks_private_targets():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers, url = await _setup(client)
        res = await client.post(url, json={"channel": "DISCORD", "target": "http://169.254.169.254/latest"}, headers=headers)
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is False
    assert "SSRF" in body["message"]


@pytest.mark.asyncio
async def test_alert_test_rejects_mock_targets_in_production(monkeypatch):
    monkeypatch.setattr(type(alerts_route.settings), "is_production_like", property(lambda self: True))
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers, url = await _setup(client)
        res = await client.post(url, json={"channel": "SLACK", "target": "mock://slack"}, headers=headers)
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_alert_test_requires_secret_for_telegram():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers, url = await _setup(client)
        res = await client.post(url, json={"channel": "TELEGRAM", "target": "-100123"}, headers=headers)
    assert res.status_code == 400
