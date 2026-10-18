import json
import pytest
from services.geo.llms_txt_service import LlmsTxtService
from services.geo.geo_tracker_service import GeoTrackerService
from services.executor.connectors.cloudflare import CloudflareWorkerConnector
from services.executor.connectors.git import GitBasedConnector


def test_parse_ai_bots_from_robots():
    robots_content = """
User-agent: GPTBot
Disallow: /

User-agent: PerplexityBot
Allow: /

User-agent: ClaudeBot
Disallow: /private/
"""
    status = LlmsTxtService.parse_ai_bots_from_robots(robots_content)
    assert status["GPTBot"] == "BLOCKED"
    assert status["PerplexityBot"] == "ALLOWED"
    assert status["ClaudeBot"] == "PARTIAL"
    assert status["OAI-SearchBot"] == "ALLOWED"


def test_llms_txt_build_bundle_with_crawled_pages():
    pages = [
        {
            "url": "https://calpeo.io/",
            "title": "Calpeo — Otonom SEO ve GEO Platformu",
            "meta_description": "Kaynak kod seviyesinde kalıcı SEO ve GEO otomasyonu.",
            "h1": "Otonom SEO Platformu",
            "word_count": 1500,
            "depth": 0,
            "status_code": 200,
            "has_noindex": False,
            "structured_data_json": json.dumps([{"@type": "Organization"}, {"@type": "WebSite"}]),
        },
        {
            "url": "https://calpeo.io/urunler/geo-motoru",
            "title": "GEO 2.0 Motoru Özellikleri",
            "meta_description": "Monte Carlo örnekleme ve /llms.txt dağıtımı.",
            "h1": "GEO 2.0 Motoru",
            "word_count": 1200,
            "depth": 1,
            "status_code": 200,
            "has_noindex": False,
            "structured_data_json": json.dumps([{"@type": "SoftwareApplication"}]),
        },
        {
            "url": "https://calpeo.io/rehber/llms-txt-nedir",
            "title": "/llms.txt Nedir ve Nasıl Kurulur?",
            "meta_description": "Yapay zeka arama motorları için standart Markdown rehberi.",
            "h1": "/llms.txt Rehberi",
            "word_count": 2100,
            "depth": 1,
            "status_code": 200,
            "has_noindex": False,
            "structured_data_json": json.dumps([{"@type": "FAQPage"}]),
        },
        {
            "url": "https://calpeo.io/kvkk-aydinlatma",
            "title": "KVKK ve Gizlilik Politikası",
            "meta_description": "Veri güvenliği ve KVKK uyumluluk bildirimi.",
            "h1": "KVKK Aydınlatma Metni",
            "word_count": 800,
            "depth": 2,
            "status_code": 200,
            "has_noindex": False,
            "structured_data_json": "[]",
        },
    ]

    bundle = LlmsTxtService.build_bundle(
        site_domain="calpeo.io",
        site_name="Calpeo",
        primary_url="https://calpeo.io",
        site_type="SAAS",
        language="tr",
        country="TR",
        crawled_pages=pages,
    )

    assert bundle["site_domain"] == "calpeo.io"
    assert bundle["pages_indexed_count"] == 4
    assert bundle["readiness_score"] >= 60
    assert "# Calpeo (calpeo.io)" in bundle["llms_txt_content"]
    assert "https://calpeo.io/urunler/geo-motoru" in bundle["llms_txt_content"]
    assert "https://calpeo.io/rehber/llms-txt-nedir" in bundle["llms_txt_content"]
    assert "FAQPage" in bundle["llms_full_txt_content"]
    assert len(bundle["audit_checks"]) == 5


@pytest.mark.asyncio
async def test_geo_simulate_monte_carlo_and_citations():
    res = await GeoTrackerService.simulate_ai_search(
        prompt="2026'da calpeo.io otonom SEO platformu nasıl çalışır?",
        site_domain="calpeo.io",
        brand_name="Calpeo",
        sample_runs=5,
        enable_web_grounding=False,
    )

    assert res["prompt"].startswith("2026'da calpeo.io")
    assert res["brand_mentioned"] is True
    assert "monte_carlo" in res
    mc = res["monte_carlo"]
    assert mc["sample_runs"] == 5
    assert len(mc["temperatures_tested"]) == 5
    assert 0.0 <= mc["mention_probability"] <= 1.0
    assert len(mc["confidence_interval_95"]) == 2
    assert mc["confidence_interval_95"][0] <= mc["confidence_interval_95"][1]
    assert 0 <= mc["stability_score"] <= 100

    assert len(res["cited_sources"]) >= 2
    source_types = {s["source_type"] for s in res["cited_sources"]}
    assert "OWNED" in source_types

    fix = res["recommended_fix"]
    assert fix["target_url"] == "https://calpeo.io/"
    assert "FAQPage" in json.dumps(fix["json_ld_schema"])


@pytest.mark.asyncio
async def test_geo_site_telemetry_includes_llms_and_monte_carlo():
    telemetry = await GeoTrackerService.get_site_geo_telemetry(
        site_domain="example-store.com",
        site_name="Example Store",
        sample_runs=3,
    )

    assert "overallVisibility" in telemetry
    assert "llmsTxtReadiness" in telemetry
    assert telemetry["llmsTxtReadiness"]["site_domain"] == "example-store.com"
    assert "citedSources" in telemetry
    assert len(telemetry["citedSources"]) > 0
    assert "monteCarloSummary" in telemetry
    assert telemetry["monteCarloSummary"]["sample_runs_per_prompt"] == 3
    assert any(a["action_type"] == "DEPLOY_LLMS_TXT" for a in telemetry["quickActions"])


@pytest.mark.asyncio
async def test_connectors_support_llms_txt_and_direct_answer():
    cf = CloudflareWorkerConnector(zone_id="mock_zone", api_token="mock_token", base_url="mock://calpeo.io")
    caps = await cf.get_capabilities()
    assert "CAN_DEPLOY_LLMS_TXT" in caps

    applied = await cf.apply_change({
        "target_url": "https://calpeo.io/llms.txt",
        "operation": "DEPLOY_LLMS_TXT",
        "state_after": {
            "llms_txt_content": "# Calpeo\n> Official LLMs index\n",
            "content_type": "text/plain; charset=utf-8",
        },
    })
    assert applied is True
    state = await cf.read_page_state("https://calpeo.io/llms.txt")
    assert state["edge_active"] is True
    assert "# Calpeo" in state["rule"]["static_body"]

    worker_js = CloudflareWorkerConnector.generate_edge_worker_script()
    assert "rule.static_body" in worker_js
    assert "rule.direct_answer_html" in worker_js

    git_conn = GitBasedConnector(repo_full_name="mock/repo", access_token="mock_token")
    git_caps = await git_conn.get_capabilities()
    assert "CAN_DEPLOY_LLMS_TXT" in git_caps
    assert await git_conn.apply_change({
        "target_url": "https://calpeo.io/llms.txt",
        "operation": "DEPLOY_LLMS_TXT",
        "state_after": {"llms_txt_content": "# Calpeo"},
    }) is True
