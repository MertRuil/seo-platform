import pytest
import json
from services.seo_engine.engine import SeoRuleEngine
from services.crawler.html_extractor import HtmlExtractor
from services.site_graph.graph_engine import SiteGraphEngine

def test_broken_internal_link_to_404_detected():
    engine = SeoRuleEngine()
    pages = [
        {
            "url": "https://example.com/blog/article-1",
            "title": "Article One",
            "status_code": 200,
            "internal_links": [
                {"href": "https://example.com/missing-guide", "anchor_text": "Read our guide", "is_internal": True},
                {"href": "https://example.com/about", "anchor_text": "About Us", "is_internal": True}
            ]
        },
        {
            "url": "https://example.com/missing-guide",
            "title": "Not Found",
            "status_code": 404
        },
        {
            "url": "https://example.com/about",
            "title": "About Us",
            "status_code": 200
        }
    ]

    report = engine.evaluate_site(pages)
    issues_by_page = report["issues_by_page"]

    article_issues = issues_by_page.get("https://example.com/blog/article-1", [])
    rule_ids = [i.rule_id for i in article_issues]

    assert "RULE_INTERNAL_LINK_TO_404" in rule_ids
    issue = next(i for i in article_issues if i.rule_id == "RULE_INTERNAL_LINK_TO_404")
    assert issue.severity == "HIGH"
    assert issue.evidence["broken_count"] == 1
    assert issue.evidence["broken_links"][0]["target_url"] == "https://example.com/missing-guide"
    assert issue.evidence["broken_links"][0]["anchor_text"] == "Read our guide"
    assert issue.evidence["broken_links"][0]["status_code"] == 404

def test_broken_internal_link_to_410_detected():
    engine = SeoRuleEngine()
    pages = [
        {
            "url": "https://example.com/page",
            "status_code": 200,
            "internal_links": [
                {"href": "https://example.com/deleted-promo", "anchor_text": "Expired Promo", "is_internal": True}
            ]
        },
        {
            "url": "https://example.com/deleted-promo",
            "status_code": 410
        }
    ]

    report = engine.evaluate_site(pages)
    page_issues = report["issues_by_page"].get("https://example.com/page", [])
    assert any(i.rule_id == "RULE_INTERNAL_LINK_TO_404" for i in page_issues)

def test_broken_internal_link_to_5xx_detected():
    engine = SeoRuleEngine()
    pages = [
        {
            "url": "https://example.com/home",
            "status_code": 200,
            "internal_links": [
                {"href": "https://example.com/server-error-page", "anchor_text": "Live Demo", "is_internal": True}
            ]
        },
        {
            "url": "https://example.com/server-error-page",
            "status_code": 500
        }
    ]

    report = engine.evaluate_site(pages)
    page_issues = report["issues_by_page"].get("https://example.com/home", [])
    rule_ids = [i.rule_id for i in page_issues]

    assert "RULE_INTERNAL_LINK_TO_5XX" in rule_ids
    issue = next(i for i in page_issues if i.rule_id == "RULE_INTERNAL_LINK_TO_5XX")
    assert issue.severity == "CRITICAL"
    assert issue.evidence["server_error_count"] == 1
    assert issue.evidence["server_error_links"][0]["status_code"] == 500

def test_internal_link_to_3xx_redirect_detected():
    engine = SeoRuleEngine()
    pages = [
        {
            "url": "https://example.com/source",
            "status_code": 200,
            "internal_links": [
                {"href": "https://example.com/old-url", "anchor_text": "Old URL", "is_internal": True}
            ]
        },
        {
            "url": "https://example.com/old-url",
            "status_code": 301,
            "canonical_target": "https://example.com/new-url"
        },
        {
            "url": "https://example.com/new-url",
            "status_code": 200
        }
    ]

    report = engine.evaluate_site(pages)
    source_issues = report["issues_by_page"].get("https://example.com/source", [])
    rule_ids = [i.rule_id for i in source_issues]

    assert "RULE_INTERNAL_LINK_TO_3XX" in rule_ids
    issue = next(i for i in source_issues if i.rule_id == "RULE_INTERNAL_LINK_TO_3XX")
    assert issue.severity == "LOW"
    assert issue.evidence["redirect_links"][0]["target_url"] == "https://example.com/old-url"
    assert issue.evidence["redirect_links"][0]["status_code"] == 301

def test_internal_link_empty_and_javascript_href():
    engine = SeoRuleEngine()
    page = {
        "url": "https://example.com/bad-links",
        "status_code": 200,
        "internal_links": [
            {"href": "", "anchor_text": "Empty Link", "is_internal": True},
            {"href": "#", "anchor_text": "Hash Link", "is_internal": True},
            {"href": "javascript:void(0)", "anchor_text": "JS Link", "is_internal": True},
            {"href": "https://example.com/valid", "anchor_text": "Valid", "is_internal": True}
        ]
    }

    issues = engine.evaluate_page(page)
    rule_ids = [i.rule_id for i in issues]

    assert "RULE_INTERNAL_LINK_EMPTY_HREF" in rule_ids
    issue = next(i for i in issues if i.rule_id == "RULE_INTERNAL_LINK_EMPTY_HREF")
    assert issue.evidence["empty_count"] == 3

def test_working_internal_links_produce_zero_issues():
    engine = SeoRuleEngine()
    pages = [
        {
            "url": "https://example.com/a",
            "title": "Page A",
            "headings": {"h1": ["Page A Heading"]},
            "meta_description": "Page A meta description.",
            "status_code": 200,
            "internal_links": [
                {"href": "https://example.com/b", "anchor_text": "Go to B", "is_internal": True}
            ]
        },
        {
            "url": "https://example.com/b",
            "title": "Page B",
            "headings": {"h1": ["Page B Heading"]},
            "meta_description": "Page B meta description.",
            "status_code": 200,
            "internal_links": [
                {"href": "https://example.com/a", "anchor_text": "Go to A", "is_internal": True}
            ]
        }
    ]

    report = engine.evaluate_site(pages)
    link_issue_ids = {
        "RULE_INTERNAL_LINK_TO_404",
        "RULE_INTERNAL_LINK_TO_5XX",
        "RULE_INTERNAL_LINK_TO_3XX",
        "RULE_INTERNAL_LINK_EMPTY_HREF"
    }

    found_link_issues = [i for i in report["issues"] if i.rule_id in link_issue_ids]
    assert len(found_link_issues) == 0

def test_broken_links_stats_in_site_evaluation():
    engine = SeoRuleEngine()
    pages = [
        {
            "url": "https://example.com/hub",
            "status_code": 200,
            "internal_links": [
                {"href": "https://example.com/ok", "is_internal": True},
                {"href": "https://example.com/not-found", "is_internal": True},
                {"href": "https://example.com/server-down", "is_internal": True},
                {"href": "https://example.com/moved", "is_internal": True}
            ]
        },
        {"url": "https://example.com/ok", "status_code": 200},
        {"url": "https://example.com/not-found", "status_code": 404},
        {"url": "https://example.com/server-down", "status_code": 503},
        {"url": "https://example.com/moved", "status_code": 301}
    ]

    report = engine.evaluate_site(pages)
    stats = report["broken_links_stats"]

    assert stats["total_internal_links"] == 4
    assert stats["broken_internal_links_404_count"] == 1
    assert stats["broken_internal_links_5xx_count"] == 1
    assert stats["redirecting_internal_links_count"] == 1

def test_html_extractor_and_site_graph_integration():
    html_a = """<!DOCTYPE html>
    <html><body>
        <a href="/about">About Us</a>
        <a href="/missing-404">Broken Target</a>
    </body></html>"""

    res = HtmlExtractor.extract(html_a, "https://example.com/")
    assert len(res.links) == 2
    assert res.links[0].href == "https://example.com/about"
    assert res.links[0].is_internal is True
    assert res.links[1].href == "https://example.com/missing-404"
    assert res.links[1].is_internal is True

    # Check site graph can build from serializable link data
    links = [
        {"source_url": "https://example.com/", "target_url": l.href, "anchor_text": l.anchor_text, "is_internal": True}
        for l in res.links
    ]
    graph_engine = SiteGraphEngine()
    graph_engine.build_graph(
        [
            {"url": "https://example.com/", "status_code": 200},
            {"url": "https://example.com/about", "status_code": 200},
            {"url": "https://example.com/missing-404", "status_code": 404}
        ],
        links
    )
    metrics = graph_engine.compute_metrics("https://example.com/")
    assert metrics["total_nodes"] == 3
    assert metrics["total_edges"] == 2
