import pytest
from services.seo_engine.engine import SeoRuleEngine
from services.site_graph.graph_engine import SiteGraphEngine

def test_orphan_page_detected_when_zero_incoming_links():
    """Verify that a page with 0 incoming internal links is correctly detected as an orphan."""
    engine = SeoRuleEngine()
    pages = [
        {
            "url": "https://example.com/",
            "status_code": 200,
            "title": "Home Page",
            "internal_links": [
                {"href": "https://example.com/about", "anchor_text": "About Us", "is_internal": True}
            ]
        },
        {
            "url": "https://example.com/about",
            "status_code": 200,
            "title": "About Us",
            "internal_links": [
                {"href": "https://example.com/", "anchor_text": "Home", "is_internal": True}
            ]
        },
        {
            "url": "https://example.com/orphan-article",
            "status_code": 200,
            "title": "Forgotten Article",
            "in_sitemap": True,
            "internal_links": []
        }
    ]

    report = engine.evaluate_site(pages)
    issues = report["issues"]
    orphan_issues = [i for i in issues if i.rule_id == "RULE_INTERNAL_LINK_ORPHAN"]

    assert len(orphan_issues) == 1
    assert orphan_issues[0].evidence["url"] == "https://example.com/orphan-article"
    assert orphan_issues[0].evidence["incoming_internal_links_count"] == 0
    assert orphan_issues[0].evidence["is_orphan"] is True
    assert orphan_issues[0].evidence["in_sitemap"] is True
    assert orphan_issues[0].severity.value == "HIGH"
    assert orphan_issues[0].category.value == "INTERNAL_LINKING"

    # Verify orphan_stats
    assert report["orphan_stats"]["total_orphan_pages_count"] == 1
    assert report["orphan_stats"]["orphan_urls"] == ["https://example.com/orphan-article"]

def test_orphan_page_with_self_loop_still_detected():
    """Verify that a page linking ONLY to itself (self-loop) is still detected as an orphan page."""
    engine = SeoRuleEngine()
    pages = [
        {
            "url": "https://example.com/",
            "status_code": 200,
            "title": "Home Page",
            "internal_links": [
                {"href": "https://example.com/blog", "anchor_text": "Blog", "is_internal": True}
            ]
        },
        {
            "url": "https://example.com/blog",
            "status_code": 200,
            "title": "Blog",
            "internal_links": [
                {"href": "https://example.com/", "anchor_text": "Home", "is_internal": True}
            ]
        },
        {
            "url": "https://example.com/self-looping-orphan",
            "status_code": 200,
            "title": "Self Looping Orphan",
            "internal_links": [
                {"href": "https://example.com/self-looping-orphan", "anchor_text": "Self Link", "is_internal": True}
            ]
        }
    ]

    report = engine.evaluate_site(pages)
    orphan_issues = [i for i in report["issues"] if i.rule_id == "RULE_INTERNAL_LINK_ORPHAN"]

    assert len(orphan_issues) == 1
    assert orphan_issues[0].evidence["url"] == "https://example.com/self-looping-orphan"

def test_homepage_root_url_never_orphan():
    """Verify that the root homepage (with or without trailing slash) is never flagged as an orphan."""
    engine = SeoRuleEngine()

    # Case 1: Root URL with trailing slash, no other page links back to it
    pages_with_slash = [
        {
            "url": "https://example.com/",
            "status_code": 200,
            "depth": 0,
            "title": "Home",
            "internal_links": [
                {"href": "https://example.com/page-1", "anchor_text": "Page 1", "is_internal": True}
            ]
        },
        {
            "url": "https://example.com/page-1",
            "status_code": 200,
            "depth": 1,
            "title": "Page 1",
            "internal_links": []  # Does not link back to home
        }
    ]
    report1 = engine.evaluate_site(pages_with_slash)
    orphan_issues1 = [i for i in report1["issues"] if i.rule_id == "RULE_INTERNAL_LINK_ORPHAN"]
    assert not any(i.evidence["url"] == "https://example.com/" for i in orphan_issues1)

    # Case 2: Root URL without trailing slash
    pages_without_slash = [
        {
            "url": "https://example.com",
            "status_code": 200,
            "title": "Home No Slash",
            "internal_links": [
                {"href": "https://example.com/page-1", "anchor_text": "Page 1", "is_internal": True}
            ]
        },
        {
            "url": "https://example.com/page-1",
            "status_code": 200,
            "title": "Page 1",
            "internal_links": []
        }
    ]
    report2 = engine.evaluate_site(pages_without_slash)
    orphan_issues2 = [i for i in report2["issues"] if i.rule_id == "RULE_INTERNAL_LINK_ORPHAN"]
    assert not any(i.evidence["url"] == "https://example.com" for i in orphan_issues2)

def test_well_linked_site_has_zero_orphans():
    """Verify that a site where every page is properly linked has 0 orphan issues."""
    engine = SeoRuleEngine()
    pages = [
        {
            "url": "https://example.com/",
            "status_code": 200,
            "title": "Home",
            "internal_links": [
                {"href": "https://example.com/products", "anchor_text": "Products", "is_internal": True}
            ]
        },
        {
            "url": "https://example.com/products",
            "status_code": 200,
            "title": "Products",
            "internal_links": [
                {"href": "https://example.com/contact", "anchor_text": "Contact", "is_internal": True}
            ]
        },
        {
            "url": "https://example.com/contact",
            "status_code": 200,
            "title": "Contact",
            "internal_links": [
                {"href": "https://example.com/", "anchor_text": "Home", "is_internal": True}
            ]
        }
    ]

    report = engine.evaluate_site(pages)
    orphan_issues = [i for i in report["issues"] if i.rule_id == "RULE_INTERNAL_LINK_ORPHAN"]
    assert len(orphan_issues) == 0
    assert report["orphan_stats"]["total_orphan_pages_count"] == 0

def test_single_page_site_has_zero_orphans():
    """Single page crawls should not generate orphan page issues."""
    engine = SeoRuleEngine()
    page = {
        "url": "https://example.com/single-landing",
        "status_code": 200,
        "title": "Single Landing",
        "internal_links": []
    }
    report = engine.evaluate_site([page])
    orphan_issues = [i for i in report["issues"] if i.rule_id == "RULE_INTERNAL_LINK_ORPHAN"]
    assert len(orphan_issues) == 0

def test_non_indexable_pages_not_flagged_as_orphan():
    """404 or noindex pages without incoming links should not be flagged as indexable orphan pages."""
    engine = SeoRuleEngine()
    pages = [
        {
            "url": "https://example.com/",
            "status_code": 200,
            "title": "Home",
            "internal_links": []
        },
        {
            "url": "https://example.com/missing-page",
            "status_code": 404,
            "title": "404 Not Found",
            "internal_links": []
        },
        {
            "url": "https://example.com/noindex-secret",
            "status_code": 200,
            "has_noindex": True,
            "title": "Secret Page",
            "internal_links": []
        }
    ]
    report = engine.evaluate_site(pages)
    orphan_issues = [i for i in report["issues"] if i.rule_id == "RULE_INTERNAL_LINK_ORPHAN"]
    assert len(orphan_issues) == 0

def test_url_normalization_resolves_target_and_prevents_false_orphan():
    """A link to /about should satisfy incoming link requirement for /about/."""
    engine = SeoRuleEngine()
    pages = [
        {
            "url": "https://example.com/",
            "status_code": 200,
            "title": "Home",
            "internal_links": [
                {"href": "https://example.com/about", "anchor_text": "About Us", "is_internal": True}
            ]
        },
        {
            "url": "https://example.com/about/",
            "status_code": 200,
            "title": "About Us Trailing Slash",
            "internal_links": []
        }
    ]

    report = engine.evaluate_site(pages)
    orphan_issues = [i for i in report["issues"] if i.rule_id == "RULE_INTERNAL_LINK_ORPHAN"]
    assert len(orphan_issues) == 0

def test_site_graph_engine_orphan_detection_and_self_loops():
    """Test SiteGraphEngine orphan detection, self-loop handling, and link opportunities."""
    engine = SiteGraphEngine()
    pages = [
        {"url": "https://example.com/", "title": "Home", "status_code": 200},
        {"url": "https://example.com/services", "title": "Services", "status_code": 200},
        {"url": "https://example.com/orphan-case", "title": "Orphan Case", "status_code": 200}
    ]
    links = [
        {"source_url": "https://example.com/", "target_url": "https://example.com/services", "is_internal": True},
        # Self-loop on orphan
        {"source_url": "https://example.com/orphan-case", "target_url": "https://example.com/orphan-case", "is_internal": True}
    ]

    engine.build_graph(pages, links)
    # Pass root_url without trailing slash to test robust root matching
    metrics = engine.compute_metrics("https://example.com")

    # Orphan page must still be detected despite self-loop
    assert "https://example.com/orphan-case" in metrics["orphan_pages"]
    # Homepage must not be flagged as orphan
    assert "https://example.com/" not in metrics["orphan_pages"]
    # Depths must be computed correctly
    assert metrics["depths"].get("https://example.com/") == 0
    assert metrics["depths"].get("https://example.com/services") == 1

    # Opportunities to link hub to orphan
    opps = engine.find_internal_link_opportunities("https://example.com")
    assert len(opps) >= 1
    assert opps[0]["target_orphan"] == "https://example.com/orphan-case"
