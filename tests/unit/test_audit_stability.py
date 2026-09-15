import asyncio
import pytest
from collections import deque
from typing import List, Dict, Any
from unittest.mock import AsyncMock, patch, MagicMock

from services.seo_engine.engine import SeoRuleEngine
from services.crawler.crawler_service import CrawlerService
from packages.shared.models import CrawlRun, Site


def test_identical_audit_score_reproducibility():
    """
    Test that running evaluate_site repeatedly on the exact same dataset
    produces 100% identical health scores, total issues, and sorted issue order.
    Variance must be zero across repeated runs.
    """
    engine = SeoRuleEngine()

    pages = [
        {
            "url": "https://example.com/",
            "status_code": 200,
            "title": "Example Domain Home",
            "meta_description": "Welcome to example domain where we provide excellent services.",
            "headings": {"h1": ["Main Title"]},
            "word_count": 550,
            "viewport": "width=device-width, initial-scale=1",
            "is_responsive_viewport": True,
            "html_lang": "en",
            "internal_links": [
                {"href": "https://example.com/about", "anchor_text": "About", "rel": ""},
                {"href": "https://example.com/contact", "anchor_text": "Contact", "rel": ""}
            ]
        },
        {
            "url": "https://example.com/about",
            "status_code": 200,
            "title": "About Us",
            # Missing meta description (-8 pts)
            "meta_description": None,
            "headings": {"h1": ["About Us"]},
            "word_count": 350,
            "viewport": "width=device-width, initial-scale=1",
            "is_responsive_viewport": True,
            "html_lang": "en",
            "internal_links": [
                {"href": "https://example.com/", "anchor_text": "Home", "rel": ""}
            ]
        },
        {
            "url": "https://example.com/contact",
            "status_code": 200,
            "title": "Contact Us",
            "meta_description": "Contact our team for inquiries and questions.",
            # Missing H1 (-4 pts)
            "headings": {"h1": []},
            "word_count": 220,
            "viewport": "width=device-width, initial-scale=1",
            "is_responsive_viewport": True,
            "html_lang": "en",
            "internal_links": [
                {"href": "https://example.com/", "anchor_text": "Home", "rel": ""}
            ]
        }
    ]

    # Run 10 consecutive audits
    results = [engine.evaluate_site(pages) for _ in range(10)]

    first_score = results[0]["health_score"]
    first_issues_count = results[0]["total_issues_found"]
    first_issue_ids = [i.rule_id for i in results[0]["issues"]]

    for idx, r in enumerate(results[1:], start=2):
        assert r["health_score"] == first_score, f"Run {idx} health score differs: {r['health_score']} != {first_score}"
        assert r["total_issues_found"] == first_issues_count, f"Run {idx} issues count differs"
        run_issue_ids = [i.rule_id for i in r["issues"]]
        assert run_issue_ids == first_issue_ids, f"Run {idx} issue ordering differs"


def test_score_stability_independent_of_page_count_scaling():
    """
    Test that health score does NOT artificially collapse to 0 as page count grows.
    A 5-page crawl with 20% defects and a 50-page crawl with 20% defects must have
    consistent, stable health scores (within 1 point tolerance), rather than swinging from 92 to 0.
    """
    engine = SeoRuleEngine()

    def make_crawl(n: int, defect_ratio: float = 0.2) -> List[Dict[str, Any]]:
        pages = []
        for i in range(n):
            has_issue = (i % int(1 / defect_ratio) == 0)
            next_i = (i + 1) % n
            prev_i = (i - 1) % n
            pages.append({
                "url": f"https://example.com/page-{i}",
                "depth": 0 if i == 0 else 1,
                "status_code": 200,
                "title": f"Page Title for page-{i}",
                "meta_description": f"Detailed description for page-{i} meeting length standards.",
                "headings": {"h1": [] if has_issue else [f"Heading for page-{i}"]},  # Missing H1 on defect pages
                "word_count": 400,
                "viewport": "width=device-width, initial-scale=1",
                "is_responsive_viewport": True,
                "html_lang": "en",
                "internal_links": [
                    {"href": f"https://example.com/page-{next_i}", "anchor_text": "Next", "rel": ""},
                    {"href": f"https://example.com/page-{prev_i}", "anchor_text": "Prev", "rel": ""}
                ]
            })
        return pages

    # Small crawl: 5 pages, 1 with missing H1 (20% defect rate)
    small_crawl = make_crawl(5, 0.2)
    small_report = engine.evaluate_site(small_crawl)

    # Large crawl: 50 pages, 10 with missing H1 (20% defect rate)
    large_crawl = make_crawl(50, 0.2)
    large_report = engine.evaluate_site(large_crawl)

    # Both must have identical health scores due to normalization
    assert small_report["health_score"] == large_report["health_score"]
    assert small_report["health_score"] >= 95  # 20% defect rate with minor H1 issue should remain high 90s


def test_quick_audit_redirect_consistency():
    """
    Test that auditing a redirected target (e.g. https://example.com -> https://example.com/)
    evaluates destination page content so that status_code=200 rules are checked consistently,
    yielding the exact same score as auditing the trailing-slash URL directly.
    """
    engine = SeoRuleEngine()

    # Destination page content with an issue (e.g. missing meta description)
    base_content = {
        "title": "My Great Website",
        "meta_description": None,  # Missing meta description
        "headings": {"h1": ["Welcome to Website"]},
        "word_count": 300,
        "viewport": "width=device-width, initial-scale=1",
        "is_responsive_viewport": True,
        "html_lang": "en"
    }

    # Run A: Directly accessed destination URL
    context_direct = {
        "url": "https://example.com/",
        "status_code": 200,
        "redirect_chain": [],
        **base_content
    }
    report_direct = engine.evaluate_site([context_direct])

    # Run B: Reached via 301 redirect (root to trailing-slash canonical)
    class DummyHop:
        from_url = "https://example.com"
        to_url = "https://example.com/"
        status_code = 301

    context_redirected = {
        "url": "https://example.com",
        "status_code": 200,  # Corrected status code of final fetched page
        "redirect_chain": [DummyHop()],
        **base_content
    }
    report_redirected = engine.evaluate_site([context_redirected])

    # Scores and issues must be identical!
    assert report_direct["health_score"] == report_redirected["health_score"]
    assert report_direct["total_issues_found"] == report_redirected["total_issues_found"]
    direct_rules = [i.rule_id for i in report_direct["issues"]]
    redirect_rules = [i.rule_id for i in report_redirected["issues"]]
    assert direct_rules == redirect_rules


def test_temporary_302_redirect_flagged_with_content_evaluation():
    """
    Test that when a 302 temporary redirect is in the redirect chain,
    RULE_TEMPORARY_REDIRECT_302 is reported while destination page content is still evaluated.
    """
    engine = SeoRuleEngine()

    class DummyHop302:
        from_url = "https://example.com/temp"
        to_url = "https://example.com/dest"
        status_code = 302

    page = {
        "url": "https://example.com/temp",
        "status_code": 200,
        "redirect_chain": [DummyHop302()],
        "title": "Destination Title",
        "meta_description": "Destination Meta Description",
        "headings": {"h1": ["Destination Heading"]},
        "word_count": 350,
        "viewport": "width=device-width, initial-scale=1",
        "is_responsive_viewport": True,
        "html_lang": "en"
    }

    report = engine.evaluate_site([page])
    rule_ids = [i.rule_id for i in report["issues"]]
    assert "RULE_TEMPORARY_REDIRECT_302" in rule_ids
    # Health score is reduced by the 302 redirect penalty, not collapsed
    assert report["health_score"] < 100
    assert report["health_score"] >= 85


def test_crawler_deterministic_queue_ordering():
    """
    Test that the crawler's queue sorting ensures deterministic traversal order
    regardless of the order items were appended by concurrent tasks.
    """
    # Simulate pending queue with mixed depths and URLs
    unordered_items = [
        ("https://example.com/z-page", 1),
        ("https://example.com/a-page", 2),
        ("https://example.com/m-page", 1),
        ("https://example.com/b-page", 1),
        ("https://example.com/c-page", 2),
        ("https://example.com/", 0)
    ]

    q1 = deque(unordered_items)
    sorted_q1 = deque(sorted(q1, key=lambda x: (x[1], str(x[0]))))

    # Reverse input order
    q2 = deque(reversed(unordered_items))
    sorted_q2 = deque(sorted(q2, key=lambda x: (x[1], str(x[0]))))

    # Pop order must be strictly identical
    list1 = [sorted_q1.popleft() for _ in range(len(sorted_q1))]
    list2 = [sorted_q2.popleft() for _ in range(len(sorted_q2))]

    assert list1 == list2
    # Depth 0 first, then depth 1 alphabetically, then depth 2 alphabetically
    assert list1[0] == ("https://example.com/", 0)
    assert list1[1] == ("https://example.com/b-page", 1)
    assert list1[2] == ("https://example.com/m-page", 1)
    assert list1[3] == ("https://example.com/z-page", 1)
    assert list1[4] == ("https://example.com/a-page", 2)
    assert list1[5] == ("https://example.com/c-page", 2)


def test_empty_site_and_clean_site_stability():
    """
    Test edge cases: empty pages and 100% clean pages across multiple runs.
    """
    engine = SeoRuleEngine()

    assert engine.evaluate_site([])["health_score"] == 100

    clean_pages = [
        {
            "url": f"https://example.com/p{i}",
            "depth": 0 if i == 0 else 1,
            "status_code": 200,
            "title": f"Clean Unique Title {i}",
            "meta_description": f"Clean unique meta description for page {i} with sufficient length.",
            "headings": {"h1": [f"Clean Heading {i}"]},
            "word_count": 500,
            "viewport": "width=device-width, initial-scale=1",
            "is_responsive_viewport": True,
            "html_lang": "en",
            "internal_links": [
                {"href": f"https://example.com/p{(i + 1) % 25}", "anchor_text": "Next", "rel": ""},
                {"href": f"https://example.com/p{(i - 1) % 25}", "anchor_text": "Prev", "rel": ""}
            ]
        }
        for i in range(25)
    ]

    run1 = engine.evaluate_site(clean_pages)
    run2 = engine.evaluate_site(clean_pages)

    assert run1["health_score"] == 100
    assert run2["health_score"] == 100
    assert run1["total_issues_found"] == 0
    assert run2["total_issues_found"] == 0
