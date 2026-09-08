import pytest
from services.seo_engine.engine import SeoRuleEngine

def test_canonical_to_404_rule():
    engine = SeoRuleEngine()
    pages = [
        {"url": "https://example.com/page-1", "canonical_target": "https://example.com/broken-target", "status_code": 200},
        {"url": "https://example.com/broken-target", "status_code": 404}
    ]
    report = engine.evaluate_site(pages)
    rule_ids = [i.rule_id for i in report["issues"]]
    assert "RULE_CANONICAL_TO_404" in rule_ids
    assert "RULE_HTTP_4XX_CLIENT_ERROR" in rule_ids

def test_canonical_loop_detection():
    engine = SeoRuleEngine()
    pages = [
        {"url": "https://example.com/a", "canonical_target": "https://example.com/b", "status_code": 200},
        {"url": "https://example.com/b", "canonical_target": "https://example.com/a", "status_code": 200}
    ]
    report = engine.evaluate_site(pages)
    rule_ids = [i.rule_id for i in report["issues"]]
    assert "RULE_CANONICAL_LOOP" in rule_ids

def test_noindex_blocked_by_robots_rule():
    engine = SeoRuleEngine()
    page = {
        "url": "https://example.com/secret",
        "has_noindex": True,
        "is_blocked_by_robots": True,
        "status_code": 200
    }
    issues = engine.evaluate_page(page)
    rule_ids = [i.rule_id for i in issues]
    assert "RULE_NOINDEX_BLOCKED_BY_ROBOTS" in rule_ids

def test_title_and_heading_checks():
    engine = SeoRuleEngine()
    page_missing_title = {
        "url": "https://example.com/no-title",
        "title": None,
        "headings": {"h1": ["Heading 1"]},
        "status_code": 200
    }
    issues = engine.evaluate_page(page_missing_title)
    assert any(i.rule_id == "RULE_TITLE_MISSING" for i in issues)

    page_missing_h1 = {
        "url": "https://example.com/no-h1",
        "title": "Good Title",
        "headings": {},
        "status_code": 200
    }
    issues = engine.evaluate_page(page_missing_h1)
    assert any(i.rule_id == "RULE_H1_MISSING" for i in issues)

def test_health_score_calculation():
    engine = SeoRuleEngine()
    # Healthy page: no issues
    healthy_page = {
        "url": "https://example.com/healthy",
        "title": "A Great Title",
        "meta_description": "A meta description.",
        "headings": {"h1": ["Main Heading"]},
        "status_code": 200,
        "word_count": 500
    }
    report = engine.evaluate_site([healthy_page])
    assert report["total_issues_found"] == 0
    assert report["health_score"] == 100
