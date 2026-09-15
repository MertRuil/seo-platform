import pytest
import json
from services.crawler.html_extractor import HtmlExtractor
from services.crawler.sitemap_parser import SitemapParser
from packages.shared.models import CrawlPage
from services.seo_engine.rules.rules_impl import (
    HtmlLangMissingRule,
    HtmlLangInvalidRule,
    HreflangInvalidCodeRule,
    HreflangMissingSelfReferenceRule,
    HreflangToNon200Rule,
    HreflangToNonCanonicalRule,
    HreflangNoReturnLinkRule,
    is_valid_hreflang_code,
    is_valid_html_lang
)
from services.seo_engine.engine import SeoRuleEngine


def test_html_extractor_language_and_hreflang_extraction():
    html = """
    <!DOCTYPE html>
    <html lang="en-US">
    <head>
        <title>International Multilingual Portal</title>
        <meta name="description" content="Global platform supporting multi-language users worldwide.">
        <link rel="canonical" href="https://example.com/en/portal">
        <link rel="alternate" hreflang="en-US" href="https://example.com/en/portal">
        <link rel="alternate" hreflang="tr-TR" href="/tr/portal">
        <link rel="alternate" hreflang="de" href="https://example.com/de/portal">
        <link rel="alternate" hreflang="x-default" href="https://example.com/portal">
    </head>
    <body>
        <h1>Welcome to Global SEO</h1>
        <p>This is a multilingual international portal for technical SEO automation and compliance.</p>
    </body>
    </html>
    """
    res = HtmlExtractor.extract(html, "https://example.com/en/portal")
    assert res.html_lang == "en-US"
    assert len(res.hreflangs) == 4

    langs = [h["lang"] for h in res.hreflangs]
    assert "en-US" in langs
    assert "tr-TR" in langs
    assert "de" in langs
    assert "x-default" in langs

    # Relative link /tr/portal resolved correctly
    tr_entry = next(h for h in res.hreflangs if h["lang"] == "tr-TR")
    assert tr_entry["href"] == "https://example.com/tr/portal"


def test_html_extractor_header_fallbacks_and_link_header():
    # 1. Content-Language fallback when <html> has no lang
    html_no_lang = "<html><head><title>No Lang</title></head><body><h1>Hi</h1></body></html>"
    res1 = HtmlExtractor.extract(
        html_no_lang,
        "https://example.com/page",
        response_headers={"content-language": "fr-FR, fr"}
    )
    assert res1.html_lang == "fr-FR"

    # 2. HTTP Link header for hreflangs
    headers = {
        "link": '<https://example.com/es/doc>; rel="alternate"; hreflang="es", <https://example.com/it/doc>; rel="alternate"; hreflang="it"'
    }
    res2 = HtmlExtractor.extract(html_no_lang, "https://example.com/doc", response_headers=headers)
    assert len(res2.hreflangs) == 2
    assert any(h["lang"] == "es" for h in res2.hreflangs)
    assert any(h["lang"] == "it" for h in res2.hreflangs)


def test_sitemap_parser_hreflang_support():
    xml = """<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
            xmlns:xhtml="http://www.w3.org/1999/xhtml">
      <url>
        <loc>https://example.com/en/item</loc>
        <xhtml:link rel="alternate" hreflang="en" href="https://example.com/en/item"/>
        <xhtml:link rel="alternate" hreflang="de" href="https://example.com/de/item"/>
      </url>
    </urlset>
    """
    res = SitemapParser.parse_xml(xml, "https://example.com")
    assert res.is_valid is True
    assert len(res.urls) == 1
    assert len(res.urls[0].hreflangs) == 2
    assert res.urls[0].hreflangs[0]["lang"] == "en"
    assert res.urls[0].hreflangs[1]["lang"] == "de"


def test_crawl_page_database_model_language_and_hreflang():
    page = CrawlPage(
        crawl_run_id="run-lang-123",
        site_id="site-lang-123",
        url="https://example.com/tr/page",
        normalized_url="https://example.com/tr/page",
        status_code=200,
        html_lang="tr",
        hreflangs_json=json.dumps([{"lang": "tr", "href": "https://example.com/tr/page"}])
    )
    assert page.html_lang == "tr"
    assert page.hreflangs_json is not None
    loaded = json.loads(page.hreflangs_json)
    assert loaded[0]["lang"] == "tr"


def test_is_valid_hreflang_code_helper():
    assert is_valid_hreflang_code("en") is True
    assert is_valid_hreflang_code("tr") is True
    assert is_valid_hreflang_code("en-US") is True
    assert is_valid_hreflang_code("de-AT") is True
    assert is_valid_hreflang_code("zh-Hans-CN") is True
    assert is_valid_hreflang_code("x-default") is True
    assert is_valid_hreflang_code("es-419") is True

    # Invalid formats
    assert is_valid_hreflang_code("en_US") is False  # Underscore is invalid
    assert is_valid_hreflang_code("english") is False  # Plain word is invalid
    assert is_valid_hreflang_code("turkish") is False
    assert is_valid_hreflang_code("") is False
    assert is_valid_hreflang_code("123") is False


def test_html_lang_missing_and_invalid_rules():
    rule_missing = HtmlLangMissingRule()
    rule_invalid = HtmlLangInvalidRule()

    # Case 1: Missing html_lang
    bad_page = {
        "url": "https://example.com/no-lang",
        "status_code": 200,
        "html_lang": None
    }
    res_m = rule_missing.check(bad_page)
    assert res_m is not None
    assert res_m.passed is False
    assert res_m.rule_id == "RULE_HTML_LANG_MISSING"

    # Case 2: Invalid html_lang (underscore)
    invalid_page = {
        "url": "https://example.com/bad-lang",
        "status_code": 200,
        "html_lang": "en_US"
    }
    res_inv = rule_invalid.check(invalid_page)
    assert res_inv is not None
    assert res_inv.passed is False
    assert res_inv.rule_id == "RULE_HTML_LANG_INVALID"

    # Case 3: Valid html_lang
    valid_page = {
        "url": "https://example.com/ok",
        "status_code": 200,
        "html_lang": "en-US"
    }
    assert rule_missing.check(valid_page) is None
    assert rule_invalid.check(valid_page) is None


def test_hreflang_invalid_code_rule():
    rule = HreflangInvalidCodeRule()

    page = {
        "url": "https://example.com/page",
        "status_code": 200,
        "hreflangs": [
            {"lang": "en-US", "href": "https://example.com/page"},
            {"lang": "tr_TR", "href": "https://example.com/tr/page"},  # Underscore
            {"lang": "german", "href": "https://example.com/de/page"}  # Full name
        ]
    }
    res = rule.check(page)
    assert res is not None
    assert res.passed is False
    assert res.rule_id == "RULE_HREFLANG_INVALID_CODE"
    assert len(res.evidence["invalid_entries"]) == 2


def test_hreflang_missing_self_reference_rule():
    rule = HreflangMissingSelfReferenceRule()

    # Page lacks alternate pointing to itself
    page_missing_self = {
        "url": "https://example.com/en/page",
        "status_code": 200,
        "html_lang": "en",
        "hreflangs": [
            {"lang": "fr", "href": "https://example.com/fr/page"},
            {"lang": "de", "href": "https://example.com/de/page"}
        ]
    }
    res = rule.check(page_missing_self)
    assert res is not None
    assert res.passed is False
    assert res.rule_id == "RULE_HREFLANG_MISSING_SELF_REFERENCE"

    # Page includes self-referential alternate
    page_with_self = {
        "url": "https://example.com/en/page",
        "status_code": 200,
        "html_lang": "en",
        "hreflangs": [
            {"lang": "en", "href": "https://example.com/en/page"},
            {"lang": "fr", "href": "https://example.com/fr/page"}
        ]
    }
    assert rule.check(page_with_self) is None


def test_hreflang_to_non_200_and_non_canonical_rules():
    r_non_200 = HreflangToNon200Rule()
    r_non_canon = HreflangToNonCanonicalRule()

    site_context = {
        "pages_by_norm": {
            "https://example.com/dead": {"url": "https://example.com/dead", "status_code": 404},
            "https://example.com/redirect": {"url": "https://example.com/redirect", "status_code": 301},
            "https://example.com/duplicate": {
                "url": "https://example.com/duplicate",
                "status_code": 200,
                "is_canonical": False,
                "canonical_target": "https://example.com/original"
            },
            "https://example.com/good": {"url": "https://example.com/good", "status_code": 200, "is_canonical": True}
        }
    }

    page = {
        "url": "https://example.com/page",
        "status_code": 200,
        "hreflangs": [
            {"lang": "de", "href": "https://example.com/dead"},
            {"lang": "fr", "href": "https://example.com/redirect"},
            {"lang": "es", "href": "https://example.com/duplicate"},
            {"lang": "en", "href": "https://example.com/good"}
        ]
    }

    res_200 = r_non_200.check(page, site_context)
    assert res_200 is not None
    assert res_200.passed is False
    assert res_200.rule_id == "RULE_HREFLANG_TO_NON_200"
    assert len(res_200.evidence["broken_targets"]) == 2

    res_canon = r_non_canon.check(page, site_context)
    assert res_canon is not None
    assert res_canon.passed is False
    assert res_canon.rule_id == "RULE_HREFLANG_TO_NON_CANONICAL"
    assert len(res_canon.evidence["non_canonical_targets"]) == 1


def test_hreflang_no_return_link_rule():
    rule = HreflangNoReturnLinkRule()

    # Page A links to Page B, but Page B does NOT link back to Page A
    page_a = {
        "url": "https://example.com/en/article",
        "status_code": 200,
        "hreflangs": [
            {"lang": "en", "href": "https://example.com/en/article"},
            {"lang": "fr", "href": "https://example.com/fr/article"}
        ]
    }
    page_b_no_return = {
        "url": "https://example.com/fr/article",
        "status_code": 200,
        "hreflangs": [
            {"lang": "fr", "href": "https://example.com/fr/article"}
            # Missing return link to /en/article!
        ]
    }

    site_context = {
        "pages_by_norm": {
            "https://example.com/en/article": page_a,
            "https://example.com/fr/article": page_b_no_return
        }
    }

    res = rule.check(page_a, site_context)
    assert res is not None
    assert res.passed is False
    assert res.rule_id == "RULE_HREFLANG_NO_RETURN_LINK"
    assert res.evidence["missing_returns"][0]["target_url"] == "https://example.com/fr/article"

    # When Page B links back reciprocally -> passes!
    page_b_with_return = {
        "url": "https://example.com/fr/article",
        "status_code": 200,
        "hreflangs": [
            {"lang": "fr", "href": "https://example.com/fr/article"},
            {"lang": "en", "href": "https://example.com/en/article"}
        ]
    }
    site_context_fixed = {
        "pages_by_norm": {
            "https://example.com/en/article": page_a,
            "https://example.com/fr/article": page_b_with_return
        }
    }
    assert rule.check(page_a, site_context_fixed) is None


def test_site_level_hreflang_stats_and_complete_pipeline():
    engine = SeoRuleEngine()

    pages = [
        {
            "url": "https://example.com/en",
            "status_code": 200,
            "html_lang": "en",
            "hreflangs": [
                {"lang": "en", "href": "https://example.com/en"},
                {"lang": "tr", "href": "https://example.com/tr"}
            ]
        },
        {
            "url": "https://example.com/tr",
            "status_code": 200,
            "html_lang": "tr",
            "hreflangs": [
                {"lang": "tr", "href": "https://example.com/tr"},
                {"lang": "en", "href": "https://example.com/en"}
            ]
        },
        {
            "url": "https://example.com/de",
            "status_code": 200,
            "html_lang": None,  # missing html_lang
            "hreflangs": [
                {"lang": "de_DE", "href": "https://example.com/de"}  # invalid code & missing self ref (de_DE vs norm)
            ]
        }
    ]

    report = engine.evaluate_site(pages)
    assert "hreflang_stats" in report
    stats = report["hreflang_stats"]
    assert stats["total_pages_evaluated"] == 3
    assert stats["pages_with_hreflang"] == 3
    assert stats["hreflang_coverage_percent"] == 100.0
    assert "en" in stats["languages_detected"]
    assert "tr" in stats["languages_detected"]
    assert stats["pages_missing_html_lang"] == 1
    assert stats["invalid_hreflang_codes_count"] >= 1


def test_quick_audit_hreflang_pipeline():
    html = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Quick Audit Hreflang Test</title>
        <meta name="description" content="Auditing multi language setup for global domains.">
        <link rel="canonical" href="https://example.com/en/shop">
        <link rel="alternate" hreflang="es_ES" href="https://example.com/es/shop">
    </head>
    <body>
        <h1>Global Shop</h1>
        <p>This is a complete content paragraph to provide sufficient word count for the test runner.</p>
    </body>
    </html>
    """
    extracted = HtmlExtractor.extract(html, "https://example.com/en/shop")
    assert extracted.html_lang is None
    assert len(extracted.hreflangs) == 1
    assert extracted.hreflangs[0]["lang"] == "es_ES"

    page_ctx = {
        "url": "https://example.com/en/shop",
        "status_code": 200,
        "title": extracted.title,
        "meta_description": extracted.meta_description,
        "canonical_target": extracted.canonical_url,
        "is_canonical": True,
        "headings": extracted.headings,
        "html_lang": extracted.html_lang,
        "hreflangs": extracted.hreflangs,
        "word_count": extracted.word_count
    }

    engine = SeoRuleEngine()
    issues = engine.evaluate_page(page_ctx)
    rule_ids = [i.rule_id for i in issues]
    assert "RULE_HTML_LANG_MISSING" in rule_ids
    assert "RULE_HREFLANG_INVALID_CODE" in rule_ids
    assert "RULE_HREFLANG_MISSING_SELF_REFERENCE" in rule_ids

