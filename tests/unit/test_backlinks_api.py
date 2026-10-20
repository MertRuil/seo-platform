import uuid
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import func, select

from apps.api.main import app
from packages.shared.database import AsyncSessionLocal, engine, Base
from packages.shared.models import Backlink
from services.seo_engine.backlink_engine import (
    AnchorCategory,
    BacklinkDataProvider,
    BacklinkItem,
    ToxicityRisk,
)

TOXIC_SOURCE = "https://free-crypto-casino-bonus.xyz/links-list"


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
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


async def _auth_headers(client: AsyncClient) -> dict:
    email = f"backlinks_{uuid.uuid4().hex[:8]}@example.com"
    await client.post("/api/v1/auth/register", json={
        "email": email,
        "password": "Password123!",
        "full_name": "Backlink Tester",
    })
    login_res = await client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
    return {"Authorization": f"Bearer {login_res.json()['access_token']}"}


async def _create_site(client: AsyncClient, headers: dict, primary_url: str) -> str:
    slug = f"org-{uuid.uuid4().hex[:8]}"
    org = (await client.post("/api/v1/organizations", json={"name": slug, "slug": slug}, headers=headers)).json()
    site = (await client.post(f"/api/v1/organizations/{org['id']}/sites", json={
        "name": primary_url.split("//")[1],
        "primary_url": primary_url,
        "site_type": "ECOMMERCE",
    }, headers=headers)).json()
    return f"/api/v1/organizations/{org['id']}/sites/{site['id']}/backlinks"


async def _stored_count() -> int:
    async with AsyncSessionLocal() as session:
        return (await session.execute(select(func.count()).select_from(Backlink))).scalar_one()


@pytest.mark.asyncio
async def test_customer_site_starts_empty_and_persists_added_backlink(client):
    headers = await _auth_headers(client)
    base = await _create_site(client, headers, "https://titanshop.com")

    assert (await client.get(base, headers=headers)).json() == []

    res = await client.post(base, json={
        "source_url": "https://www.example-news.com/review",
        "anchor_text": "Titan Shop",
        "domain_authority": 60,
    }, headers=headers)
    assert res.status_code == 200
    created = res.json()
    assert created["source_domain"] == "example-news.com"
    assert created["data_source"] == "MANUAL_ENTRY"

    listed = (await client.get(base, headers=headers)).json()
    assert [b["id"] for b in listed] == [created["id"]]
    assert await _stored_count() == 1

    summary = (await client.get(f"{base}/summary", headers=headers)).json()
    assert summary["total_backlinks"] == 1


@pytest.mark.asyncio
async def test_re_adding_same_backlink_updates_instead_of_duplicating(client):
    headers = await _auth_headers(client)
    base = await _create_site(client, headers, "https://titanshop.com")
    body = {"source_url": "https://example-news.com/review", "anchor_text": "Titan Shop"}

    first = (await client.post(base, json=body, headers=headers)).json()
    second = (await client.post(base, json={**body, "anchor_text": "titan shop indirim"}, headers=headers)).json()

    assert second["id"] == first["id"]
    assert second["anchor_text"] == "titan shop indirim"
    listed = (await client.get(base, headers=headers)).json()
    assert len(listed) == 1
    assert listed[0]["anchor_text"] == "titan shop indirim"


@pytest.mark.asyncio
async def test_backlinks_are_isolated_per_site(client):
    headers = await _auth_headers(client)
    site_a = await _create_site(client, headers, "https://titanshop.com")
    site_b = await _create_site(client, headers, "https://otherbrand.com")

    await client.post(site_a, json={"source_url": "https://example-news.com/review", "anchor_text": "Titan"}, headers=headers)

    assert len((await client.get(site_a, headers=headers)).json()) == 1
    assert (await client.get(site_b, headers=headers)).json() == []
    assert (await client.get(f"{site_b}/summary", headers=headers)).json()["total_backlinks"] == 0

    # Another user cannot read site A's backlinks.
    outsider = await _auth_headers(client)
    assert (await client.get(site_a, headers=outsider)).status_code in (403, 404)


@pytest.mark.asyncio
async def test_disavow_contains_only_this_sites_toxic_links(client):
    headers = await _auth_headers(client)
    site_a = await _create_site(client, headers, "https://titanshop.com")
    site_b = await _create_site(client, headers, "https://otherbrand.com")

    await client.post(site_a, json={
        "source_url": TOXIC_SOURCE,
        "anchor_text": "online casino baccarat win free",
        "domain_authority": 4,
        "spam_score": 88,
    }, headers=headers)
    await client.post(site_a, json={"source_url": "https://example-news.com/review", "anchor_text": "Titan"}, headers=headers)
    await client.post(site_b, json={"source_url": "https://spambot-linkfarm.click/viagra", "anchor_text": "buy viagra online", "domain_authority": 2, "spam_score": 96}, headers=headers)

    disavow_a = (await client.get(f"{site_a}/disavow", headers=headers)).json()
    assert disavow_a["has_toxic_links"] is True
    assert disavow_a["toxic_domains_count"] == 1
    assert "domain:free-crypto-casino-bonus.xyz" in disavow_a["disavow_text"]
    assert "example-news.com" not in disavow_a["disavow_text"]
    assert "spambot-linkfarm.click" not in disavow_a["disavow_text"]

    disavow_b = (await client.get(f"{site_b}/disavow", headers=headers)).json()
    assert "free-crypto-casino-bonus.xyz" not in disavow_b["disavow_text"]


@pytest.mark.asyncio
async def test_gsc_import_twice_does_not_duplicate(client):
    headers = await _auth_headers(client)
    base = await _create_site(client, headers, "https://titanshop.com")
    csv_text = "Linking page\nhttps://blog-one.com/post\nhttps://blog-two.com/review\n"

    first = (await client.post(f"{base}/import-gsc", json={"raw_csv_or_urls": csv_text}, headers=headers)).json()
    assert first["synced_count"] == 2
    second = (await client.post(f"{base}/import-gsc", json={"raw_csv_or_urls": csv_text}, headers=headers)).json()
    assert second["synced_count"] == 0
    assert len(second["items"]) == 2
    assert await _stored_count() == 2


@pytest.mark.asyncio
async def test_sync_live_twice_upserts_provider_links(client, monkeypatch):
    headers = await _auth_headers(client)
    base = await _create_site(client, headers, "https://titanshop.com")

    def provider_item(domain_authority: int) -> BacklinkItem:
        return BacklinkItem(
            id="bl-dfs-1",
            source_url="https://partner-site.com/links",
            source_domain="partner-site.com",
            target_url="https://titanshop.com/",
            anchor_text="Titan Shop",
            anchor_category=AnchorCategory.BRAND,
            is_dofollow=True,
            domain_authority=domain_authority,
            page_authority=max(1, domain_authority - 10),
            spam_score=1,
            is_toxic=False,
            toxicity_risk=ToxicityRisk.CLEAN,
            data_source="DATAFORSEO_LIVE",
        )

    monkeypatch.setattr(BacklinkDataProvider, "fetch_from_dataforseo", AsyncMock(return_value=[provider_item(40)]))
    first = (await client.post(f"{base}/sync-live", json={}, headers=headers)).json()
    assert first["synced_count"] == 1

    monkeypatch.setattr(BacklinkDataProvider, "fetch_from_dataforseo", AsyncMock(return_value=[provider_item(55)]))
    second = (await client.post(f"{base}/sync-live", json={}, headers=headers)).json()
    assert second["synced_count"] == 0
    assert len(second["items"]) == 1
    assert second["items"][0]["domain_authority"] == 55
    assert await _stored_count() == 1


@pytest.mark.asyncio
async def test_demo_site_is_seeded_once(client):
    headers = await _auth_headers(client)
    base = await _create_site(client, headers, "https://acmestore.io")

    first = (await client.get(base, headers=headers)).json()
    assert len(first) == 6
    assert all(b["data_source"] == "DEMO_SEED" for b in first)
    assert len((await client.get(base, headers=headers)).json()) == 6
    assert (await client.get(f"{base}/disavow", headers=headers)).json()["toxic_domains_count"] == 3
    assert await _stored_count() == 6


@pytest.mark.asyncio
async def test_overlong_source_url_is_rejected(client):
    headers = await _auth_headers(client)
    base = await _create_site(client, headers, "https://titanshop.com")
    res = await client.post(base, json={"source_url": "https://example.com/" + "a" * 2100}, headers=headers)
    assert res.status_code == 400
    assert await _stored_count() == 0


@pytest.mark.asyncio
async def test_large_gsc_import_is_written_in_batches(client):
    # 2.000 satır x 21 sütun tek INSERT'te SQLite/asyncpg parametre sınırını (32.766) aşar.
    headers = await _auth_headers(client)
    base = await _create_site(client, headers, "https://bulk-import.example")
    csv_text = "\n".join(f"s{i}.co" for i in range(2000))

    res = await client.post(f"{base}/import-gsc", json={"raw_csv_or_urls": csv_text}, headers=headers)

    assert res.status_code == 200, res.text
    assert res.json()["synced_count"] == 2000
    async with AsyncSessionLocal() as db:
        assert (await db.execute(select(func.count()).select_from(Backlink))).scalar() == 2000
