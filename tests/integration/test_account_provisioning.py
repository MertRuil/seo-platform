import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from apps.api.main import app
from packages.shared.database import engine, Base
from packages.shared.models import Membership, Organization, Subscription, User
from services.accounts.provisioning import slugify
from services.security.crypto import hash_password
from scripts.provision_orphan_users import provision

Session = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture(autouse=True)
async def prepare_database():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


async def _register_and_login(client, email, full_name=None):
    body = {"email": email, "password": "Password123!"}
    if full_name:
        body["full_name"] = full_name
    assert (await client.post("/api/v1/auth/register", json=body)).status_code == 201
    token = (await client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_register_creates_owned_org_with_free_plan_and_site_can_be_added():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers = await _register_and_login(client, "ayse@ajans.com.tr", "Ayşe Çınar")

        orgs = (await client.get("/api/v1/organizations", headers=headers)).json()
        assert len(orgs) == 1
        assert orgs[0]["name"] == "Ayşe Çınar"
        assert orgs[0]["slug"] == "ayse-cinar"

        # Abonelik kayıt sırasında açılmış olmalı (GET ucu eksikse kendisi de oluşturduğu için önce tabloya bakılır)
        async with Session() as s:
            assert (await s.execute(select(Subscription).where(Subscription.organization_id == orgs[0]["id"]))).scalar_one()
        sub = (await client.get(f"/api/v1/organizations/{orgs[0]['id']}/billing/subscription", headers=headers)).json()
        assert sub["plan_code"] == "free"
        assert sub["ai_credit_balance"] == 10

        # Daha önce "Organizasyon bulunamadı" ile duran akış: site ekleme
        res = await client.post(
            f"/api/v1/organizations/{orgs[0]['id']}/sites",
            json={"name": "Ajans", "primary_url": "https://www.ajans.com.tr"},
            headers=headers,
        )
        assert res.status_code == 201

    async with Session() as s:
        roles = (await s.execute(select(Membership.role))).scalars().all()
        assert roles == ["OWNER"]


@pytest.mark.asyncio
async def test_first_oauth_login_creates_owned_org(monkeypatch):
    async def verified(**kwargs):
        return {"email": kwargs["expected_email"]}

    monkeypatch.setattr("apps.api.routes.auth.verify_oauth_token", verified)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        body = {"provider": "google", "token": "t", "email": "mehmet@ornek.com", "full_name": "Mehmet Öz"}
        token = (await client.post("/api/v1/auth/oauth", json=body)).json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        orgs = (await client.get("/api/v1/organizations", headers=headers)).json()
        # İkinci girişte yeni organizasyon açılmaz
        await client.post("/api/v1/auth/oauth", json=body)
        again = (await client.get("/api/v1/organizations", headers=headers)).json()

    assert [o["slug"] for o in orgs] == ["mehmet-oz"]
    assert again == orgs


@pytest.mark.asyncio
async def test_register_without_name_uses_email_and_keeps_slugs_unique():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        h1 = await _register_and_login(client, "info@birinci.com")
        h2 = await _register_and_login(client, "info@ikinci.com")
        o1 = (await client.get("/api/v1/organizations", headers=h1)).json()[0]
        o2 = (await client.get("/api/v1/organizations", headers=h2)).json()[0]

    assert o1["name"] == o2["name"] == "info"
    assert o1["slug"] == "info"
    assert o2["slug"].startswith("info-") and o2["slug"] != o1["slug"]


@pytest.mark.asyncio
async def test_orphan_script_lists_by_default_and_provisions_with_apply():
    async with Session() as s:
        s.add_all([
            User(email="eski@musteri.com", hashed_password=hash_password("Password123!"), full_name="Eski Müşteri"),
            User(email="uyeli@musteri.com", hashed_password=hash_password("Password123!")),
        ])
        await s.flush()
        member = (await s.execute(select(User).where(User.email == "uyeli@musteri.com"))).scalar_one()
        s.add(Organization(id="org-var", name="Var", slug="var"))
        await s.flush()
        s.add(Membership(user_id=member.id, organization_id="org-var", role="VIEWER"))
        await s.commit()

    async with Session() as s:
        assert await provision(s, apply=False) == 1
        assert (await s.execute(select(Organization))).scalars().all()[0].slug == "var"
        assert len((await s.execute(select(Organization))).scalars().all()) == 1

    async with Session() as s:
        assert await provision(s, apply=True) == 1
    async with Session() as s:
        assert await provision(s, apply=False) == 0
        org = (await s.execute(select(Organization).where(Organization.slug == "eski-musteri"))).scalar_one()
        sub = (await s.execute(select(Subscription).where(Subscription.organization_id == org.id))).scalar_one()
        assert sub.status == "ACTIVE"


def test_slugify_transliterates_turkish_and_has_fallback():
    assert slugify("Şık Ürünler Ğİ") == "sik-urunler-gi"
    assert slugify("!!!") == "calisma-alani"
