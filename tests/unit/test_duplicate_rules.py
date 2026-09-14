import pytest
from services.seo_engine.engine import SeoRuleEngine
from services.crawler.html_extractor import HtmlExtractor

def test_duplicate_title_detection():
    engine = SeoRuleEngine()
    pages = [
        {
            "url": "https://example.com/products/shoes",
            "title": "Buy Best Shoes Online | MyShop",
            "headings": {"h1": ["Best Shoes"]},
            "meta_description": "Great shoes for sale.",
            "status_code": 200,
            "is_canonical": True,
            "has_noindex": False
        },
        {
            "url": "https://example.com/category/footwear",
            "title": "  buy best shoes online | myshop  ",  # duplicate with different spacing and case
            "headings": {"h1": ["Footwear Store"]},
            "meta_description": "Exclusive footwear here.",
            "status_code": 200,
            "is_canonical": True,
            "has_noindex": False
        },
        {
            "url": "https://example.com/about",
            "title": "About Our Company",
            "headings": {"h1": ["About Us"]},
            "meta_description": "Learn more about our company.",
            "status_code": 200,
            "is_canonical": True,
            "has_noindex": False
        }
    ]

    report = engine.evaluate_site(pages)
    issues_by_url = report["issues_by_page"]

    shoes_issues = [i.rule_id for i in issues_by_url.get("https://example.com/products/shoes", [])]
    footwear_issues = [i.rule_id for i in issues_by_url.get("https://example.com/category/footwear", [])]
    about_issues = [i.rule_id for i in issues_by_url.get("https://example.com/about", [])]

    assert "RULE_DUPLICATE_TITLE" in shoes_issues
    assert "RULE_DUPLICATE_TITLE" in footwear_issues
    assert "RULE_DUPLICATE_TITLE" not in about_issues

    # Check evidence details
    shoes_dup = next(i for i in issues_by_url["https://example.com/products/shoes"] if i.rule_id == "RULE_DUPLICATE_TITLE")
    assert "https://example.com/category/footwear" in shoes_dup.evidence["duplicate_urls"]
    assert shoes_dup.evidence["duplicate_count"] == 2

def test_duplicate_title_ignores_non_200_and_canonicalized():
    engine = SeoRuleEngine()
    pages = [
        {
            "url": "https://example.com/page-a",
            "title": "Unique Landing Page",
            "status_code": 200,
            "is_canonical": True,
            "has_noindex": False
        },
        {
            "url": "https://example.com/page-b-variant",
            "title": "Unique Landing Page",
            "status_code": 200,
            "is_canonical": False,  # explicit non-canonical pointing to page-a
            "canonical_target": "https://example.com/page-a"
        },
        {
            "url": "https://example.com/page-c-deleted",
            "title": "Unique Landing Page",
            "status_code": 404
        }
    ]

    report = engine.evaluate_site(pages)
    # Page A should NOT be flagged because other pages are non-canonical / 404
    issues_a = [i.rule_id for i in report["issues_by_page"].get("https://example.com/page-a", [])]
    assert "RULE_DUPLICATE_TITLE" not in issues_a

def test_duplicate_h1_detection():
    engine = SeoRuleEngine()
    pages = [
        {
            "url": "https://example.com/service-1",
            "title": "SEO Consulting Service",
            "headings": {"h1": ["Professional SEO Consulting"]},
            "status_code": 200,
            "is_canonical": True
        },
        {
            "url": "https://example.com/service-2",
            "title": "Digital Marketing Consulting",
            "headings": {"h1": ["professional seo consulting"]},  # Duplicate H1 (case-insensitive)
            "status_code": 200,
            "is_canonical": True
        }
    ]

    report = engine.evaluate_site(pages)
    issues_1 = [i.rule_id for i in report["issues_by_page"].get("https://example.com/service-1", [])]
    issues_2 = [i.rule_id for i in report["issues_by_page"].get("https://example.com/service-2", [])]

    assert "RULE_DUPLICATE_H1" in issues_1
    assert "RULE_DUPLICATE_H1" in issues_2

def test_duplicate_meta_description_detection():
    engine = SeoRuleEngine()
    pages = [
        {
            "url": "https://example.com/blog/post-1",
            "title": "First Blog Post",
            "headings": {"h1": ["Post One"]},
            "meta_description": "Welcome to our company blog where we share industry updates.",
            "status_code": 200,
            "is_canonical": True
        },
        {
            "url": "https://example.com/blog/post-2",
            "title": "Second Blog Post",
            "headings": {"h1": ["Post Two"]},
            "meta_description": "Welcome to our company blog where we share industry updates.",  # Duplicate meta description
            "status_code": 200,
            "is_canonical": True
        }
    ]

    report = engine.evaluate_site(pages)
    issues_1 = [i.rule_id for i in report["issues_by_page"].get("https://example.com/blog/post-1", [])]
    issues_2 = [i.rule_id for i in report["issues_by_page"].get("https://example.com/blog/post-2", [])]

    assert "RULE_DUPLICATE_META_DESCRIPTION" in issues_1
    assert "RULE_DUPLICATE_META_DESCRIPTION" in issues_2

def test_multiple_h1_on_single_page():
    engine = SeoRuleEngine()
    page = {
        "url": "https://example.com/multi-h1",
        "title": "Multi H1 Page",
        "headings": {"h1": ["First Main Heading", "Second Main Heading"]},
        "status_code": 200
    }

    issues = engine.evaluate_page(page)
    rule_ids = [i.rule_id for i in issues]

    assert "RULE_MULTIPLE_H1" in rule_ids
    multi_issue = next(i for i in issues if i.rule_id == "RULE_MULTIPLE_H1")
    assert multi_issue.evidence["h1_count"] == 2
    assert "First Main Heading" in multi_issue.evidence["h1_list"]

def test_multiple_titles_and_metas_on_single_page():
    engine = SeoRuleEngine()
    page = {
        "url": "https://example.com/broken-head",
        "title": "Title One",
        "all_titles": ["Title One", "Title Two"],
        "meta_description": "Description One",
        "all_meta_descriptions": ["Description One", "Description Two"],
        "headings": {"h1": ["Single H1"]},
        "status_code": 200
    }

    issues = engine.evaluate_page(page)
    rule_ids = [i.rule_id for i in issues]

    assert "RULE_MULTIPLE_TITLES_ON_PAGE" in rule_ids
    assert "RULE_MULTIPLE_META_DESCRIPTIONS" in rule_ids

def test_html_extractor_collects_all_titles_and_metas():
    raw_html = """<!DOCTYPE html>
    <html>
    <head>
        <title>Primary Title</title>
        <title>Secondary Duplicate Title</title>
        <meta name="description" content="First description snippet.">
        <meta name="description" content="Second description snippet.">
    </head>
    <body>
        <h1>Primary Heading</h1>
        <h1>Secondary Heading</h1>
    </body>
    </html>
    """
    res = HtmlExtractor.extract(raw_html, "https://example.com")
    assert res.title == "Primary Title"
    assert res.all_titles == ["Primary Title", "Secondary Duplicate Title"]
    assert res.meta_description == "First description snippet."
    assert res.all_meta_descriptions == ["First description snippet.", "Second description snippet."]
    assert len(res.headings["h1"]) == 2

def test_site_evaluation_duplicate_stats():
    engine = SeoRuleEngine()
    pages = [
        {
            "url": "https://example.com/p1",
            "title": "Shared Title",
            "headings": {"h1": ["Shared H1"]},
            "meta_description": "Shared Description",
            "status_code": 200,
            "is_canonical": True
        },
        {
            "url": "https://example.com/p2",
            "title": "Shared Title",
            "headings": {"h1": ["Shared H1"]},
            "meta_description": "Shared Description",
            "status_code": 200,
            "is_canonical": True
        },
        {
            "url": "https://example.com/p3",
            "title": "Unique Title",
            "headings": {"h1": ["Unique H1"]},
            "meta_description": "Unique Description",
            "status_code": 200,
            "is_canonical": True
        }
    ]

    report = engine.evaluate_site(pages)
    stats = report["duplicate_stats"]
    assert stats["duplicate_titles_count"] == 2
    assert stats["duplicate_h1s_count"] == 2
    assert stats["duplicate_meta_descs_count"] == 2

def test_clean_pages_have_zero_duplicate_issues():
    engine = SeoRuleEngine()
    pages = [
        {
            "url": "https://example.com/home",
            "title": "Homepage - MySite",
            "headings": {"h1": ["Welcome to MySite"]},
            "meta_description": "This is our homepage.",
            "status_code": 200,
            "is_canonical": True,
            "word_count": 200
        },
        {
            "url": "https://example.com/contact",
            "title": "Contact Us - MySite",
            "headings": {"h1": ["Get In Touch"]},
            "meta_description": "Contact our support team 24/7.",
            "status_code": 200,
            "is_canonical": True,
            "word_count": 150
        }
    ]

    report = engine.evaluate_site(pages)
    duplicate_rule_ids = {
        "RULE_DUPLICATE_TITLE",
        "RULE_DUPLICATE_H1",
        "RULE_DUPLICATE_META_DESCRIPTION",
        "RULE_MULTIPLE_H1",
        "RULE_MULTIPLE_TITLES_ON_PAGE",
        "RULE_MULTIPLE_META_DESCRIPTIONS"
    }

    found_duplicate_rules = [i.rule_id for i in report["issues"] if i.rule_id in duplicate_rule_ids]
    assert len(found_duplicate_rules) == 0
    assert report["duplicate_stats"]["duplicate_titles_count"] == 0
    assert report["duplicate_stats"]["duplicate_h1s_count"] == 0
    assert report["duplicate_stats"]["duplicate_meta_descs_count"] == 0
