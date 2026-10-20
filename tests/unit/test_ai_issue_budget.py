import uuid

import pytest
from sqlalchemy import func
from sqlalchemy.future import select

from packages.config.settings import settings
from packages.shared.database import AsyncSessionLocal, Base, engine
from packages.shared.models import CrawlPage, CrawlRun, Organization, Recommendation, Site
from services.agents.base import DeterministicTestLLMProvider, is_placeholder_provider
from services.agents.orchestrator import AiOrchestrator, select_issues_for_ai
from services.rag.hybrid_store import HybridKnowledgeStore
from services.seo_engine.base import IssueSeverity, RuleCategory, RuleCheckResult


def _issue(rule_id: str, severity: IssueSeverity, url: str) -> RuleCheckResult:
    return RuleCheckResult(
        passed=False,
        rule_id=rule_id,
        category=RuleCategory.STATUS_CODES,
        severity=severity,
        title=rule_id,
        description=rule_id,
        evidence={"url": url},
        recommendation_template="",
    )


class _CountingLLM(DeterministicTestLLMProvider):
    def __init__(self, fail_on: set[int] | None = None):
        self.calls = 0
        self.fail_on = fail_on or set()

    async def generate_structured(self, prompt, output_schema, system_instruction="", temperature=0.1):
        self.calls += 1
        if self.calls in self.fail_on:
            raise RuntimeError("model hatası")
        return await super().generate_structured(prompt, output_schema, system_instruction, temperature)


def test_select_issues_orders_by_severity_and_caps_per_rule():
    issues = [_issue("RULE_LOW", IssueSeverity.LOW, f"https://e.com/l{i}") for i in range(5)]
    issues += [_issue("RULE_META", IssueSeverity.MEDIUM, f"https://e.com/m{i}") for i in range(10)]
    issues.append(_issue("RULE_500", IssueSeverity.CRITICAL, "https://e.com/x"))

    selected = select_issues_for_ai(issues, max_issues=5, max_per_rule=3)

    assert [i.rule_id for i in selected] == ["RULE_500", "RULE_META", "RULE_META", "RULE_META", "RULE_LOW"]
    # Aynı önem derecesinde sayfa sırası korunur.
    assert [i.evidence["url"] for i in selected[1:4]] == ["https://e.com/m0", "https://e.com/m1", "https://e.com/m2"]


@pytest.mark.anyio
async def test_orchestrator_calls_model_at_most_max_issues_times():
    issues = [_issue(f"RULE_{i}", IssueSeverity.HIGH, f"https://e.com/{i}") for i in range(12)]
    llm = _CountingLLM()

    recs = await AiOrchestrator(llm, HybridKnowledgeStore()).process_crawl_issues("s", issues, {}, max_issues=4)

    assert llm.calls == 4
    assert len(recs) == 4


@pytest.mark.anyio
async def test_orchestrator_skips_single_failure():
    issues = [_issue(f"RULE_{i}", IssueSeverity.HIGH, f"https://e.com/{i}") for i in range(4)]
    llm = _CountingLLM(fail_on={2})

    recs = await AiOrchestrator(llm, HybridKnowledgeStore()).process_crawl_issues("s", issues, {})

    assert llm.calls == 4
    assert sorted(r["issue_id"] for r in recs) == ["RULE_0", "RULE_2", "RULE_3"]


@pytest.mark.anyio
async def test_orchestrator_stops_after_consecutive_failures():
    issues = [_issue(f"RULE_{i}", IssueSeverity.HIGH, f"https://e.com/{i}") for i in range(10)]
    llm = _CountingLLM(fail_on=set(range(1, 11)))

    recs = await AiOrchestrator(llm, HybridKnowledgeStore()).process_crawl_issues("s", issues, {})

    assert llm.calls == 3
    assert recs == []


def test_placeholder_provider_flagged_only_in_production(monkeypatch):
    provider = DeterministicTestLLMProvider()
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    assert is_placeholder_provider(provider) is False
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    assert is_placeholder_provider(provider) is True


async def _seed_crawled_site() -> tuple[str, str]:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    suffix = uuid.uuid4().hex[:8]
    org_id, site_id, run_id = f"org_{suffix}", f"site_{suffix}", f"run_{suffix}"
    async with AsyncSessionLocal() as db:
        db.add_all([
            Organization(id=org_id, name="Org", slug=f"org-{suffix}"),
            Site(
                id=site_id,
                organization_id=org_id,
                name="Site",
                domain=f"{suffix}.local",
                normalized_domain=f"{suffix}.local",
                primary_url=f"https://{suffix}.local",
                preferred_protocol="https",
                verification_status="VERIFIED",
            ),
            CrawlRun(id=run_id, site_id=site_id, crawl_mode="GOOGLEBOT_SIMULATION", max_pages=10, max_depth=3, status="COMPLETED"),
        ])
        for i in range(3):
            db.add(CrawlPage(
                site_id=site_id,
                crawl_run_id=run_id,
                url=f"https://{suffix}.local/p{i}",
                normalized_url=f"https://{suffix}.local/p{i}",
                status_code=404,
                title=None,
                meta_description=None,
            ))
        await db.commit()
    return site_id, run_id


async def _rec_count(site_id: str) -> int:
    async with AsyncSessionLocal() as db:
        return (await db.execute(select(func.count()).where(Recommendation.site_id == site_id))).scalar()


@pytest.mark.anyio
async def test_worker_does_not_regenerate_open_recommendations():
    from apps.worker.tasks import run_audit_and_ai_job

    site_id, run_id = await _seed_crawled_site()

    first = await run_audit_and_ai_job(site_id, run_id)
    assert first > 0
    assert await _rec_count(site_id) == first

    second = await run_audit_and_ai_job(site_id, run_id)
    assert second == 0
    assert await _rec_count(site_id) == first


@pytest.mark.anyio
async def test_worker_skips_placeholder_provider_in_production(monkeypatch):
    from apps.worker import tasks

    site_id, run_id = await _seed_crawled_site()
    monkeypatch.setattr(tasks, "is_placeholder_provider", lambda provider: True)

    assert await tasks.run_audit_and_ai_job(site_id, run_id) == 0
    assert await _rec_count(site_id) == 0


async def _quick_audit(monkeypatch, placeholder: bool, llm) -> dict:
    from httpx import ASGITransport, AsyncClient

    from apps.api.main import app
    from apps.api.routes import quick_audit
    from services.crawler.safe_client import FetchResponse

    html = "<html><head></head><body><p>kısa</p><img src='a.png'></body></html>"

    async def fake_fetch(self, url, *args, **kwargs):
        return FetchResponse(
            requested_url=url, final_url=url, status_code=200,
            headers={"content-type": "text/html"}, text=html, response_time_ms=5, redirect_chain=[],
        )

    monkeypatch.setattr(quick_audit.SafeHttpClient, "fetch", fake_fetch)
    monkeypatch.setattr(quick_audit, "get_llm_provider", lambda: llm)
    monkeypatch.setattr(quick_audit, "is_placeholder_provider", lambda provider: placeholder)
    quick_audit._IP_AUDIT_HISTORY.clear()

    transport = ASGITransport(app=app, client=(f"10.9.{uuid.uuid4().int % 250}.{uuid.uuid4().int % 250}", 1234))
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/v1/audit/quick", json={"url": "https://example.com/"})
    assert res.status_code == 200, res.text
    return res.json()


@pytest.mark.anyio
async def test_quick_audit_hides_placeholder_recommendations(monkeypatch):
    llm = _CountingLLM()
    data = await _quick_audit(monkeypatch, placeholder=True, llm=llm)

    assert data["issues"]
    assert data["ai_recommendations"] == []
    assert llm.calls == 0


@pytest.mark.anyio
async def test_quick_audit_caps_model_calls(monkeypatch):
    from apps.api.routes.quick_audit import QUICK_AUDIT_MAX_AI_ISSUES

    llm = _CountingLLM()
    data = await _quick_audit(monkeypatch, placeholder=False, llm=llm)

    assert len(data["issues"]) > QUICK_AUDIT_MAX_AI_ISSUES
    assert llm.calls == QUICK_AUDIT_MAX_AI_ISSUES
    assert len(data["ai_recommendations"]) == QUICK_AUDIT_MAX_AI_ISSUES
