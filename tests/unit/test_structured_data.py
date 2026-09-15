import pytest
import json
from services.crawler.html_extractor import HtmlExtractor
from packages.shared.models import CrawlPage
from services.seo_engine.rules.rules_impl import (
    SchemaSyntaxErrorRule,
    SchemaMissingRequiredFieldsRule,
    IssueSeverity
)
from services.seo_engine.engine import SeoRuleEngine


def test_schema_json_ld_with_charset_and_case():
    html = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Charset & Case Schema Test</title>
        <script type="Application/ld+json; charset=UTF-8">
        {
            "@context": "https://schema.org",
            "@type": "Product",
            "name": "Super AI Widget",
            "price": "99.99"
        }
        </script>
    </head>
    <body><h1>Product Page</h1></body>
    </html>
    """
    res = HtmlExtractor.extract(html, "https://example.com/item")
    assert len(res.structured_data) == 1
    assert "Product" in res.schema_types
    assert res.structured_data[0]["name"] == "Super AI Widget"
    assert len(res.schema_syntax_errors) == 0


def test_schema_json_ld_cdata_and_trailing_commas():
    html = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>WordPress CDATA Schema Test</title>
        <script type="application/ld+json">
        /* <![CDATA[ */
        {
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": "How to Automate Technical SEO in 2026",
            "author": "Ayberk",
        }
        /* ]]> */
        </script>
    </head>
    <body><h1>Article</h1></body>
    </html>
    """
    res = HtmlExtractor.extract(html, "https://example.com/blog/seo-guide")
    assert len(res.structured_data) == 1
    assert "Article" in res.schema_types
    assert res.structured_data[0]["headline"] == "How to Automate Technical SEO in 2026"
    assert len(res.schema_syntax_errors) == 0


def test_schema_graph_unpacking():
    html = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Yoast @graph Test</title>
        <script type="application/ld+json">
        {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "Organization",
                    "name": "Acme Corporation",
                    "url": "https://example.com"
                },
                {
                    "@type": "WebSite",
                    "name": "Acme Official Site",
                    "url": "https://example.com"
                },
                {
                    "@type": "FAQPage",
                    "mainEntity": [
                        {
                            "@type": "Question",
                            "name": "What is SEO OS?",
                            "acceptedAnswer": {
                                "@type": "Answer",
                                "text": "An autonomous AI SEO platform."
                            }
                        }
                    ]
                }
            ]
        }
        </script>
    </head>
    <body><h1>About Acme</h1></body>
    </html>
    """
    res = HtmlExtractor.extract(html, "https://example.com/about")
    assert "Organization" in res.schema_types
    assert "WebSite" in res.schema_types
    assert "FAQPage" in res.schema_types
    assert len(res.structured_data) >= 1
    assert len(res.schema_syntax_errors) == 0


def test_schema_html5_microdata_and_rdfa():
    html = """
    <!DOCTYPE html>
    <html>
    <head><title>Microdata and RDFa Page</title></head>
    <body>
        <div itemscope itemtype="https://schema.org/Product">
            <h1 itemprop="name">Ergonomic Office Chair</h1>
            <span itemprop="price">$299.00</span>
            <img itemprop="image" src="/chair.jpg" alt="Chair" />
        </div>
        <div typeof="https://schema.org/BreadcrumbList">
            <span>Home > Office</span>
        </div>
    </body>
    </html>
    """
    res = HtmlExtractor.extract(html, "https://example.com/chair")
    assert "Product" in res.schema_types
    assert "BreadcrumbList" in res.schema_types
    assert len(res.microdata) == 1
    assert res.microdata[0]["name"] == "Ergonomic Office Chair"
    assert res.microdata[0]["price"] == "$299.00"
    assert res.microdata[0]["@context"] == "https://schema.org"


def test_schema_syntax_error_detection():
    html = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Broken JSON-LD</title>
        <script type="application/ld+json">
        {
            "@context": "https://schema.org",
            "@type": "Product",
            "name": "Unfinished Quote ...
        </script>
    </head>
    <body><h1>Broken Page</h1></body>
    </html>
    """
    res = HtmlExtractor.extract(html, "https://example.com/broken")
    assert len(res.schema_syntax_errors) > 0
    assert "Invalid JSON-LD syntax" in res.schema_syntax_errors[0]

    # Test Rule
    rule = SchemaSyntaxErrorRule()
    result = rule.check({
        "url": "https://example.com/broken",
        "status_code": 200,
        "schema_syntax_errors": res.schema_syntax_errors
    })
    assert result is not None
    assert result.passed is False
    assert result.rule_id == "RULE_SCHEMA_SYNTAX_ERROR"
    assert result.severity == IssueSeverity.HIGH


def test_schema_missing_required_fields_rule():
    rule = SchemaMissingRequiredFieldsRule()

    # Case 1: Product missing 'name'
    bad_page = {
        "url": "https://example.com/products/unknown",
        "status_code": 200,
        "structured_data": [
            {
                "@context": "https://schema.org",
                "@type": "Product",
                "price": "49.99"
            }
        ]
    }
    res = rule.check(bad_page)
    assert res is not None
    assert res.passed is False
    assert res.rule_id == "RULE_SCHEMA_MISSING_REQUIRED"
    assert any("Product" in m for m in res.evidence["missing_properties"])

    # Case 2: Product with 'name' present -> passes
    good_page = {
        "url": "https://example.com/products/chair",
        "status_code": 200,
        "structured_data": [
            {
                "@context": "https://schema.org",
                "@type": "Product",
                "name": "Modern Leather Chair",
                "price": "149.99"
            }
        ]
    }
    assert rule.check(good_page) is None

    # Case 3: @graph Article missing headline/name
    bad_graph_page = {
        "url": "https://example.com/posts/incomplete",
        "status_code": 200,
        "structured_data": [
            {
                "@context": "https://schema.org",
                "@graph": [
                    {
                        "@type": "Article",
                        "author": "Ayberk"
                    }
                ]
            }
        ]
    }
    res_graph = rule.check(bad_graph_page)
    assert res_graph is not None
    assert res_graph.passed is False
    assert any("Article" in m for m in res_graph.evidence["missing_properties"])


def test_crawl_page_database_model_structured_data():
    sdata = [
        {"@context": "https://schema.org", "@type": "WebSite", "name": "SEO Platform"}
    ]
    page = CrawlPage(
        crawl_run_id="run-test-123",
        site_id="site-test-123",
        url="https://example.com",
        normalized_url="https://example.com",
        status_code=200,
        structured_data_json=json.dumps(sdata)
    )
    assert page.structured_data_json is not None
    deserialized = json.loads(page.structured_data_json)
    assert deserialized[0]["name"] == "SEO Platform"


def test_site_level_schema_stats():
    engine = SeoRuleEngine()
    pages = [
        {
            "url": "https://example.com/",
            "status_code": 200,
            "structured_data": [{"@type": "Organization", "name": "Acme"}],
            "schema_types": ["Organization"],
            "schema_syntax_errors": []
        },
        {
            "url": "https://example.com/products/item1",
            "status_code": 200,
            "structured_data": [{"@type": "Product", "name": "Item 1"}],
            "schema_types": ["Product"],
            "schema_syntax_errors": []
        },
        {
            "url": "https://example.com/broken-schema",
            "status_code": 200,
            "structured_data": [],
            "schema_types": [],
            "schema_syntax_errors": ["Invalid JSON-LD syntax: unterminated string"]
        },
        {
            "url": "https://example.com/plain",
            "status_code": 200,
            "structured_data": [],
            "schema_types": [],
            "schema_syntax_errors": []
        }
    ]

    site_eval = engine.evaluate_site(pages)
    assert "schema_stats" in site_eval
    stats = site_eval["schema_stats"]
    assert stats["total_pages_evaluated"] == 4
    assert stats["pages_with_schema"] == 2
    assert stats["pages_with_schema_errors"] == 1
    assert stats["schema_coverage_percent"] == 50.0
    assert stats["schema_types_found"].get("Organization") == 1
    assert stats["schema_types_found"].get("Product") == 1


def test_end_to_end_schema_extraction_and_rules():
    """Tests the full flow from raw HTML to Extractor to RuleEngine."""
    html = """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <title>Great Product Store</title>
        <meta name="description" content="Shop the finest quality products online.">
        <link rel="canonical" href="https://example.com/product/1">
        <script type="application/ld+json">
        {
            "@context": "https://schema.org",
            "@type": "Product",
            "name": "Acme Super Clean",
            "offers": {
                "@type": "Offer",
                "price": "29.99"
            }
        }
        </script>
        <script type="application/ld+json">
        {
            "@context": "https://schema.org",
            "@type": "Organization",
            "url": "https://example.com"
        }
        </script>
    </head>
    <body>
        <h1>Acme Super Clean</h1>
        <p>This is a complete product description with more than thirty words to satisfy the content length requirements and verify structured data handling.</p>
    </body>
    </html>
    """
    extracted = HtmlExtractor.extract(html, "https://example.com/product/1")
    assert "Product" in extracted.schema_types
    assert "Organization" in extracted.schema_types
    assert len(extracted.structured_data) == 2

    # Organization is missing 'name' -> should trigger RULE_SCHEMA_MISSING_REQUIRED
    page_context = {
        "url": "https://example.com/product/1",
        "status_code": 200,
        "title": extracted.title,
        "meta_description": extracted.meta_description,
        "canonical_target": extracted.canonical_url,
        "is_canonical": True,
        "headings": extracted.headings,
        "structured_data": extracted.structured_data,
        "schema_types": extracted.schema_types,
        "schema_syntax_errors": extracted.schema_syntax_errors,
        "word_count": extracted.word_count
    }

    engine = SeoRuleEngine()
    issues = engine.evaluate_page(page_context)
    rule_ids = [i.rule_id for i in issues]
    assert "RULE_SCHEMA_MISSING_REQUIRED" in rule_ids
    missing_issue = next(i for i in issues if i.rule_id == "RULE_SCHEMA_MISSING_REQUIRED")
    assert any("Organization" in p for p in missing_issue.evidence["missing_properties"])

