import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

from apps.api.main import app
from apps.api.routes import copilot as copilot_route
from packages.shared.database import engine, Base, AsyncSessionLocal
from packages.shared.models import GscSearchMetric
from services.agents.base import DeterministicTestLLMProvider, LLMProvider


@pytest_asyncio.fixture(autouse=True)
async def prepare_database():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


class RecordingProvider(LLMProvider):
    def __init__(self):
        self.prompts = []

    async def generate(self, prompt, system_instruction="", temperature=0.2):
        self.prompts.append(prompt)
        return "  Meta açıklaması eksik sayfaları düzeltin.  "

    async def generate_structured(self, prompt, output_schema, system_instruction="", temperature=0.1):
        raise NotImplementedError


async def _setup(client):
    await client.post("/api/v1/auth/register", json={"email": "copilot@company.com", "password": "Password123!", "full_name": "Copilot"})
    token = (await client.post("/api/v1/auth/login", json={"email": "copilot@company.com", "password": "Password123!"})).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    org = (await client.post("/api/v1/organizations", json={"name": "Copilot Org", "slug": "copilot-org"}, headers=headers)).json()
    site = (await client.post(f"/api/v1/organizations/{org['id']}/sites", json={"name": "Copilot Site", "primary_url": "https://copilot.io"}, headers=headers)).json()
    return headers, f"/api/v1/organizations/{org['id']}/sites/{site['id']}/copilot/chat", site["id"]


@pytest.mark.asyncio
async def test_copilot_returns_503_without_configured_model(monkeypatch):
    monkeypatch.setattr(copilot_route, "get_llm_provider", lambda: DeterministicTestLLMProvider())
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers, url, _ = await _setup(client)
        res = await client.post(url, json={"message": "Ne yapmalıyım?"}, headers=headers)
    assert res.status_code == 503
    assert "yapılandırılmadı" in res.json()["detail"]


@pytest.mark.asyncio
async def test_copilot_sends_site_context_to_model(monkeypatch):
    provider = RecordingProvider()
    monkeypatch.setattr(copilot_route, "get_llm_provider", lambda: provider)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers, url, site_id = await _setup(client)
        from datetime import date
        async with AsyncSessionLocal() as db:
            db.add(GscSearchMetric(site_id=site_id, metric_date=date(2026, 10, 1), query="seo aracı", page="https://copilot.io/", clicks=12, impressions=400, ctr=0.03, position=6.5))
            await db.commit()
        res = await client.post(url, json={"message": "Fırsatlar neler?", "history": [{"role": "user", "text": "merhaba"}]}, headers=headers)
    assert res.status_code == 200
    body = res.json()
    assert body["reply"] == "Meta açıklaması eksik sayfaları düzeltin."
    assert body["context_sources"] == ["gsc"]
    assert "seo aracı | 12 | 400 | 6.5" in provider.prompts[0]
    assert "Tamamlanmış tarama yok." in provider.prompts[0]
    assert "Kullanıcı: merhaba" in provider.prompts[0]


@pytest.mark.asyncio
async def test_copilot_rejects_other_users_site(monkeypatch):
    monkeypatch.setattr(copilot_route, "get_llm_provider", lambda: RecordingProvider())
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        _, url, _ = await _setup(client)
        await client.post("/api/v1/auth/register", json={"email": "intruder@company.com", "password": "Password123!", "full_name": "X"})
        token = (await client.post("/api/v1/auth/login", json={"email": "intruder@company.com", "password": "Password123!"})).json()["access_token"]
        res = await client.post(url, json={"message": "veri ver"}, headers={"Authorization": f"Bearer {token}"})
    assert res.status_code in (403, 404)
