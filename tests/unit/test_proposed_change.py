import json

import pytest

from services.agents.base import DeterministicTestLLMProvider, RecommendationOutput
from services.agents.orchestrator import AiOrchestrator
from services.agents.proposed_change import (
    build_proposed_change,
    plan_auto_change,
    validate_meta_description,
    validate_schema,
    validate_title,
)
from services.executor.connectors.wordpress import WordPressConnector
from services.rag.hybrid_store import HybridKnowledgeStore
from services.seo_engine.base import IssueSeverity, RuleCategory, RuleCheckResult

URL = "https://kayahukuk.example/is-hukuku"
PAGE = {
    "url": URL,
    "title": None,
    "h1": "İş Hukuku Danışmanlığı",
    "meta_description": "Kaya Hukuk Bürosu İstanbul'da 2009'dan beri iş hukuku davalarında işçi ve işverenlere danışmanlık verir.",
    "html_lang": "tr",
    "structured_data": [
        {"@context": "https://schema.org", "@type": "Article", "url": URL},
        {"@context": "https://schema.org", "@type": "Organization", "name": "Kaya Hukuk Bürosu"},
    ],
}
GOOD_META = "Kaya Hukuk Bürosu, 2009'dan beri İstanbul'da iş hukuku davalarında işçi ve işverenlere danışmanlık veriyor."


def test_title_accepts_grounded_text():
    assert validate_title("İş Hukuku Danışmanlığı | Kaya Hukuk Bürosu", PAGE) == ("İş Hukuku Danışmanlığı | Kaya Hukuk Bürosu", "")


def test_title_normalizes_whitespace():
    assert validate_title("  İş Hukuku   Danışmanlığı  ", PAGE)[0] == "İş Hukuku Danışmanlığı"


@pytest.mark.parametrize("value, reason", [
    ("Kısa", "uzunluk"),
    ("İş Hukuku Danışmanlığı ve Kıdem Tazminatı Davaları | Kaya Hukuk Bürosu", "uzunluk"),
    ("<b>İş Hukuku</b> Danışmanlığı", "HTML"),
    ("İş Hukuku Danışmanlığı\nKaya Hukuk", "çok satırlı"),
    ("İş Hukuku Danışmanlığında %50 İndirim", "sayfada olmayan sayı: 50"),
    ("İş Hukuku Danışmanlığı 2027", "sayfada olmayan sayı: 2027"),
    (None, "boş"),
])
def test_title_rejections(value, reason):
    result, why = validate_title(value, PAGE)
    assert result is None
    assert why.startswith(reason)


def test_title_must_differ_from_current_and_other_pages():
    page = dict(PAGE, title="İş Hukuku Danışmanlığı")
    assert validate_title("iş hukuku  danışmanlığı", page)[1] == "mevcut değerle aynı"
    assert validate_title("Kıdem Tazminatı Davaları", PAGE, taken=["kıdem tazminatı davaları"])[1] == "sitede başka bir sayfada kullanılıyor"


def test_meta_length_bounds():
    assert validate_meta_description(GOOD_META, PAGE)[0] == GOOD_META
    # Mevcut meta kaldırılınca "2009" sayfada geçmez; yıl uydurulmuş sayılır.
    assert validate_meta_description(GOOD_META, dict(PAGE, meta_description=None))[1] == "sayfada olmayan sayı: 2009"
    assert validate_meta_description("Çok kısa açıklama.", PAGE)[0] is None
    assert validate_meta_description("a " * 100, PAGE)[0] is None


def test_schema_accepts_missing_headline_filled_from_h1():
    fixed = {"@context": "https://schema.org", "@type": "Article", "url": URL, "headline": "İş Hukuku Danışmanlığı"}
    assert validate_schema(fixed, PAGE, URL) == (fixed, "")


@pytest.mark.parametrize("schema, reason", [
    ({"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": []}, "sayfada aynı türde mevcut blok yok"),
    ({"@context": "https://schema.org", "@type": ["Article", "Product"], "url": URL, "headline": "İş Hukuku Danışmanlığı"}, "mevcut blokta olmayan tür"),
    ({"@context": "https://schema.org", "@type": "Article", "url": URL, "headline": "İş Hukuku Danışmanlığı", "author": {"@type": "Person", "name": "Av. Mehmet Kaya"}}, "mevcut blokta olmayan tür"),
    ({"@context": "https://schema.org", "@type": "Article", "url": URL, "headline": "İş Hukuku Danışmanlığı", "datePublished": "2026-01-10"}, "sayfada geçmeyen değer (datePublished)"),
    ({"@context": "https://schema.org", "@type": "Article", "url": URL, "headline": "İş Hukuku Danışmanlığı", "wordCount": 1200}, "sayfada geçmeyen değer (wordCount)"),
    ({"@context": "https://schema.org", "@type": "Article", "url": "https://baska-site.example/x", "headline": "İş Hukuku Danışmanlığı"}, "başka alan adına bağlantı"),
    ({"@context": "https://schema.org", "@type": "Article", "url": URL}, "mevcut blokla aynı"),
    ({"@context": "https://example.org", "@type": "Article", "headline": "İş Hukuku Danışmanlığı"}, "@context schema.org değil"),
])
def test_schema_rejections(schema, reason):
    result, why = validate_schema(schema, PAGE, URL)
    assert result is None
    assert why.startswith(reason), why


def test_schema_must_actually_fill_required_field():
    page = dict(PAGE, structured_data=[{"@context": "https://schema.org", "@type": "Organization", "logo": "https://kayahukuk.example/logo.png"}])
    still_missing = {"@context": "https://schema.org", "@type": "Organization", "logo": "https://kayahukuk.example/logo.png", "url": URL}
    assert validate_schema(still_missing, page, URL) == (None, "zorunlu alan hâlâ eksik")
    fixed = dict(still_missing, name="Kaya Hukuk Bürosu")
    assert validate_schema(fixed, page, URL) == (fixed, "")


def test_turkish_dotted_i_counts_as_same_title():
    page = dict(PAGE, title="İş Hukuku Danışmanlığı")
    assert validate_title("İŞ HUKUKU DANIŞMANLIĞI", page)[1] == "mevcut değerle aynı"


def _output(**proposed) -> RecommendationOutput:
    return RecommendationOutput(
        title="Başlık ekleyin", category="CONTENT_OPTIMIZATION", problem_diagnosis="x", proposed_solution="x",
        technical_reason="x", confidence=0.9, expected_impact="x", effort="LOW", risk_level="LOW", citations=[],
        **proposed,
    )


def test_build_proposed_change_keeps_only_fields_for_the_rule():
    out = _output(proposed_title="İş Hukuku Danışmanlığı | Kaya Hukuk", proposed_meta_description=GOOD_META)
    proposed, rejected = build_proposed_change("RULE_TITLE_MISSING", out, PAGE, URL)
    assert proposed == {"title": "İş Hukuku Danışmanlığı | Kaya Hukuk"}
    assert rejected == []
    # Sözdizimi hatası kuralında şema önerisi kabul edilmez: bozuk metin elimizde yok.
    out = _output(proposed_schema_json={"@context": "https://schema.org", "@type": "Article", "url": URL, "headline": "İş Hukuku Danışmanlığı"})
    assert build_proposed_change("RULE_SCHEMA_SYNTAX_ERROR", out, PAGE, URL) == ({}, [])


def test_build_proposed_change_reports_rejection():
    proposed, rejected = build_proposed_change("RULE_TITLE_MISSING", _output(proposed_title="En Ucuz Avukat %90 İndirim"), PAGE, URL)
    assert proposed == {}
    assert rejected == ["title: sayfada olmayan sayı: 90"]


ALL_CAPS = {"CAN_EDIT_TITLE", "CAN_EDIT_META", "CAN_EDIT_CANONICAL", "CAN_REPLACE_SCHEMA"}


def test_plan_title_change():
    plan = plan_auto_change("RULE_TITLE_MISSING", "CONTENT_OPTIMIZATION", {"title": "İş Hukuku Danışmanlığı | Kaya"}, PAGE, URL, ALL_CAPS)
    assert plan == ("UPDATE_META", {"title": ""}, {"title": "İş Hukuku Danışmanlığı | Kaya"})


def test_plan_requires_capability_and_unique_value():
    proposed = {"title": "İş Hukuku Danışmanlığı | Kaya"}
    assert plan_auto_change("RULE_TITLE_MISSING", "X", proposed, PAGE, URL, {"CAN_EDIT_META"}) is None
    assert plan_auto_change("RULE_TITLE_MISSING", "X", proposed, PAGE, URL, ALL_CAPS, taken_titles=["İş Hukuku Danışmanlığı | Kaya"]) is None
    assert plan_auto_change("RULE_TITLE_MISSING", "X", {}, PAGE, URL, ALL_CAPS) is None


def test_plan_schema_replacement_names_the_replaced_block():
    fixed = {"@context": "https://schema.org", "@type": "Article", "url": URL, "headline": "İş Hukuku Danışmanlığı"}
    operation, before, after = plan_auto_change("RULE_SCHEMA_MISSING_REQUIRED", "STRUCTURED_DATA", {"schema_json": fixed}, PAGE, URL, ALL_CAPS)
    assert operation == "REPLACE_SCHEMA_JSONLD"
    assert after == {"schema_json": fixed, "replaces": PAGE["structured_data"][0]}
    assert before == {"schema_json": PAGE["structured_data"][0]}
    # WordPress şema yazamaz; öneri onay bekler.
    assert plan_auto_change("RULE_SCHEMA_MISSING_REQUIRED", "STRUCTURED_DATA", {"schema_json": fixed}, PAGE, URL, {"CAN_EDIT_TITLE", "CAN_EDIT_META"}) is None


def test_wordpress_seo_title_does_not_touch_post_title():
    payload = WordPressConnector.build_update_payload({"title": "Yeni SEO Başlığı", "meta_description": "Açıklama"})
    assert "title" not in payload
    assert payload["meta"] == {
        "_yoast_wpseo_title": "Yeni SEO Başlığı",
        "rank_math_title": "Yeni SEO Başlığı",
        "_yoast_wpseo_metadesc": "Açıklama",
        "rank_math_description": "Açıklama",
    }
    assert WordPressConnector.build_update_payload({"post_title": "Görünen Başlık"}) == {"title": "Görünen Başlık"}


@pytest.mark.anyio
async def test_wordpress_rejects_change_it_cannot_apply():
    wp = WordPressConnector("mock://blog.example", "u", "p")
    assert await wp.apply_change({"post_id": 5, "state_after": {"schema_json": {"@type": "Article"}}}) is False
    assert await wp.apply_change({"post_id": 5, "state_after": {"title": "Yeni SEO Başlığı"}}) is True


@pytest.mark.anyio
async def test_wordpress_rollback_uses_backup_url():
    wp = WordPressConnector("mock://blog.example", "u", "p")
    backup = await wp.read_page_state("https://blog.example/yazi")
    assert await wp.rollback_change(backup) is True


class _ProposingLLM(DeterministicTestLLMProvider):
    def __init__(self, **proposed):
        self.proposed = proposed

    async def generate_structured(self, prompt, output_schema, system_instruction="", temperature=0.1):
        res = await super().generate_structured(prompt, output_schema, system_instruction, temperature)
        return res.model_copy(update=self.proposed)


def _issue(rule_id: str) -> RuleCheckResult:
    return RuleCheckResult(
        passed=False, rule_id=rule_id, category=RuleCategory.TITLES, severity=IssueSeverity.HIGH,
        title=rule_id, description=rule_id, evidence={"url": URL}, recommendation_template="",
    )


@pytest.mark.anyio
async def test_orchestrator_stores_only_validated_values():
    llm = _ProposingLLM(proposed_title="İş Hukuku Danışmanlığı | Kaya Hukuk", proposed_meta_description="Kısa.")
    recs = await AiOrchestrator(llm, HybridKnowledgeStore()).process_crawl_issues(
        "s", [_issue("RULE_TITLE_MISSING"), _issue("RULE_META_DESC_MISSING"), _issue("RULE_HTTP_4XX_CLIENT_ERROR")], {URL: PAGE}
    )
    by_rule = {r["issue_id"]: r["proposed_change_json"] for r in recs}
    assert json.loads(by_rule["RULE_TITLE_MISSING"]) == {"title": "İş Hukuku Danışmanlığı | Kaya Hukuk"}
    assert by_rule["RULE_META_DESC_MISSING"] is None
    assert by_rule["RULE_HTTP_4XX_CLIENT_ERROR"] is None


@pytest.mark.anyio
async def test_content_agent_prompt_carries_issue_and_page_facts():
    from services.agents.content_agent import ContentSEOAgent

    prompts = []

    class _Recorder(DeterministicTestLLMProvider):
        async def generate_structured(self, prompt, output_schema, system_instruction="", temperature=0.1):
            prompts.append((prompt, system_instruction))
            return await super().generate_structured(prompt, output_schema, system_instruction, temperature)

    await ContentSEOAgent(_Recorder(), HybridKnowledgeStore()).analyze_content(
        URL, PAGE, issue={"rule_id": "RULE_TITLE_MISSING", "title": "Başlık eksik", "description": "d"}
    )
    prompt, system = prompts[0]
    assert "Rule ID: RULE_TITLE_MISSING" in prompt
    assert "H1: İş Hukuku Danışmanlığı" in prompt
    assert "Page Language (html_lang): tr" in prompt
    assert "proposed_title" in system
