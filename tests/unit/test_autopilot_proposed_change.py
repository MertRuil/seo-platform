import json
import uuid

import pytest
from sqlalchemy.future import select

from apps.worker.tasks import autonomous_auto_execute_low_risk
from packages.shared.database import AsyncSessionLocal, Base, engine
from packages.shared.models import ChangeItem, ChangeSet, CrawlPage, CrawlRun, Organization, Recommendation, Site, SiteConnector
from services.security.crypto import encrypt_secret

ARTICLE = {"@context": "https://schema.org", "@type": "Article"}


async def _seed(connector_type: str, base_url: str, page_hash: str) -> tuple[str, str, str]:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    suffix = uuid.uuid4().hex[:8]
    domain = f"oto-{suffix}.example"
    org_id, site_id, run_id = f"org_{suffix}", f"site_{suffix}", f"run_{suffix}"
    async with AsyncSessionLocal() as db:
        db.add_all([
            Organization(id=org_id, name="Org", slug=f"org-{suffix}"),
            Site(
                id=site_id, organization_id=org_id, name="Site", domain=domain, normalized_domain=domain,
                primary_url=f"https://{domain}", preferred_protocol="https", verification_status="VERIFIED",
                execution_mode="AUTO_LOW_RISK",
            ),
            CrawlRun(id=run_id, site_id=site_id, crawl_mode="GOOGLEBOT_SIMULATION", max_pages=10, max_depth=2, status="COMPLETED"),
            SiteConnector(
                site_id=site_id, connector_type=connector_type, base_url=base_url,
                encrypted_credentials=encrypt_secret(json.dumps({"secret": "s", "username": "u", "app_password": "p"})),
            ),
        ])
        pages = {
            "a": dict(title=None, h1="Bahçe Mobilyası Takımları", meta_description=None),
            "b": dict(title=None, h1="Bahçe Mobilyası Takımları", meta_description=None),
            "c": dict(title="Teak Masa Modelleri", h1="Teak Masa Modelleri", meta_description=None),
            "d": dict(title="Rattan Koltuk", h1="Rattan Koltuk", meta_description=None,
                      structured_data_json=json.dumps([dict(ARTICLE, url=f"https://{domain}/d")])),
        }
        for slug, facts in pages.items():
            db.add(CrawlPage(
                site_id=site_id, crawl_run_id=run_id, url=f"https://{domain}/{slug}", normalized_url=f"https://{domain}/{slug}",
                status_code=200, raw_html_hash=page_hash, canonical_seo_hash=page_hash, **facts,
            ))
        await db.commit()
    return site_id, run_id, domain


async def _add_rec(site_id: str, url: str, rule_id: str, priority: float, proposed: dict | None, category: str = "CONTENT_OPTIMIZATION") -> str:
    async with AsyncSessionLocal() as db:
        rec = Recommendation(
            site_id=site_id, issue_id=rule_id, category=category, title="Öneri", description="Teşhis",
            reason="Gerekçe", risk_level="LOW", effort="LOW", priority_score=priority,
            evidence_json=json.dumps({"url": url}),
            proposed_change_json=json.dumps(proposed, ensure_ascii=False) if proposed is not None else None,
        )
        db.add(rec)
        await db.commit()
        return rec.id


async def _run(site_id: str, run_id: str) -> int:
    async with AsyncSessionLocal() as db:
        site = (await db.execute(select(Site).where(Site.id == site_id))).scalars().one()
        return await autonomous_auto_execute_low_risk(db, site, run_id)


async def _state(site_id: str) -> tuple[dict, dict]:
    async with AsyncSessionLocal() as db:
        recs = (await db.execute(select(Recommendation).where(Recommendation.site_id == site_id))).scalars().all()
        items = (await db.execute(
            select(ChangeItem, ChangeSet.recommendation_id).join(ChangeSet, ChangeItem.change_set_id == ChangeSet.id)
            .where(ChangeSet.site_id == site_id)
        )).all()
    return {r.id: r.status for r in recs}, {rec_id: (ci.operation, json.loads(ci.state_after)) for ci, rec_id in items}


@pytest.mark.anyio
async def test_autopilot_applies_only_validated_concrete_values():
    site_id, run_id, domain = await _seed("WEBHOOK", "mock://hook", "dummy-hash")
    url = lambda slug: f"https://{domain}/{slug}"
    fixed_schema = dict(ARTICLE, url=url("d"), headline="Rattan Koltuk")

    title_a = await _add_rec(site_id, url("a"), "RULE_TITLE_MISSING", 90, {"title": "Bahçe Mobilyası Takımları"})
    # Aynı başlık başka bir sayfaya bu çalıştırmada yazılmaz.
    title_b = await _add_rec(site_id, url("b"), "RULE_TITLE_MISSING", 80, {"title": "Bahçe Mobilyası Takımları"})
    # Sitede zaten kullanılan başlık yazılmaz.
    title_taken = await _add_rec(site_id, url("b"), "RULE_TITLE_MISSING", 70, {"title": "Teak Masa Modelleri"})
    # Kayıt sonradan bozulsa da uygulama anında tekrar kontrol edilir.
    title_tampered = await _add_rec(site_id, url("b"), "RULE_TITLE_MISSING", 60, {"title": "Bahçe Mobilyası %70 İndirimli Kampanya Fırsatı"})
    meta_without_value = await _add_rec(site_id, url("c"), "RULE_META_DESC_MISSING", 50, None)
    schema = await _add_rec(site_id, url("d"), "RULE_SCHEMA_MISSING_REQUIRED", 40, {"schema_json": fixed_schema}, "STRUCTURED_DATA")

    assert await _run(site_id, run_id) == 2

    statuses, items = await _state(site_id)
    assert items == {
        title_a: ("UPDATE_META", {"title": "Bahçe Mobilyası Takımları"}),
        schema: ("REPLACE_SCHEMA_JSONLD", {"schema_json": fixed_schema, "replaces": dict(ARTICLE, url=url("d"))}),
    }
    assert statuses[title_a] == statuses[schema] == "RESOLVED"
    for rec_id in (title_b, title_taken, title_tampered, meta_without_value):
        assert statuses[rec_id] == "PENDING"


@pytest.mark.anyio
async def test_wordpress_autopilot_skips_schema_it_cannot_write():
    site_id, run_id, domain = await _seed("WORDPRESS", "mock://wp", "wp-mock-hash")
    title = await _add_rec(site_id, f"https://{domain}/a", "RULE_TITLE_MISSING", 90, {"title": "Bahçe Mobilyası Takımları"})
    schema = await _add_rec(
        site_id, f"https://{domain}/d", "RULE_SCHEMA_MISSING_REQUIRED", 80,
        {"schema_json": dict(ARTICLE, url=f"https://{domain}/d", headline="Rattan Koltuk")}, "STRUCTURED_DATA",
    )

    assert await _run(site_id, run_id) == 1

    statuses, items = await _state(site_id)
    assert set(items) == {title}
    assert statuses[title] == "RESOLVED"
    assert statuses[schema] == "PENDING"


@pytest.mark.anyio
async def test_autopilot_does_not_fall_back_to_homepage_without_evidence_url():
    site_id, run_id, domain = await _seed("WEBHOOK", "mock://hook", "dummy-hash")
    async with AsyncSessionLocal() as db:
        db.add(Recommendation(
            site_id=site_id, issue_id="RULE_CANONICAL_MISSING", category="CANONICALIZATION", title="t", description="d",
            reason="r", risk_level="LOW", effort="LOW", evidence_json="{}",
        ))
        await db.commit()

    assert await _run(site_id, run_id) == 0
