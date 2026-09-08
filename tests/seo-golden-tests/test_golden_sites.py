import pytest
from services.seo_engine.engine import SeoRuleEngine
from services.crawler.html_extractor import HtmlExtractor

def test_golden_site_healthy():
    html = """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <title>Healthy Enterprise AI Solution</title>
        <meta name="description" content="High performance enterprise AI optimization platform.">
        <link rel="canonical" href="https://healthy.com/">
    </head>
    <body>
        <main>
            <h1>Enterprise AI Platform</h1>
            <p>This is a complete, well-written technical article providing in-depth information on enterprise software architecture and scalability with verified industry benchmarks. Modern distributed systems require strong data isolation, deterministic verification pipelines, and high-performance background execution engines. By separating deterministic engineering facts from generative reasoning, platforms achieve both reliability and innovation across multi-cloud production infrastructure.</p>
        </main>
    </body>
    </html>
    """
    extracted = HtmlExtractor.extract(html, "https://healthy.com/")
    page = {
        "url": "https://healthy.com/",
        "status_code": 200,
        "title": extracted.title,
        "meta_description": extracted.meta_description,
        "canonical_target": extracted.canonical_url,
        "has_noindex": extracted.has_noindex,
        "word_count": extracted.word_count,
        "headings": extracted.headings
    }
    engine = SeoRuleEngine()
    report = engine.evaluate_site([page])
    assert report["total_issues_found"] == 0
    assert report["health_score"] == 100

def test_golden_site_canonical_loop():
    engine = SeoRuleEngine()
    pages = [
        {"url": "https://loop.com/product-a", "canonical_target": "https://loop.com/product-b", "status_code": 200},
        {"url": "https://loop.com/product-b", "canonical_target": "https://loop.com/product-a", "status_code": 200}
    ]
    report = engine.evaluate_site(pages)
    rule_ids = [i.rule_id for i in report["issues"]]
    assert "RULE_CANONICAL_LOOP" in rule_ids
    assert report["health_score"] < 100

def test_golden_site_noindex_blocked_by_robots():
    engine = SeoRuleEngine()
    page = {
        "url": "https://blocked.com/hidden-login",
        "status_code": 200,
        "has_noindex": True,
        "is_blocked_by_robots": True
    }
    issues = engine.evaluate_page(page)
    assert any(i.rule_id == "RULE_NOINDEX_BLOCKED_BY_ROBOTS" for i in issues)

def test_golden_site_redirect_chain_and_loop():
    engine = SeoRuleEngine()
    page_chain = {
        "url": "https://redirects.com/start",
        "status_code": 301,
        "redirect_chain": ["https://redirects.com/hop1", "https://redirects.com/hop2", "https://redirects.com/dest"]
    }
    issues_chain = engine.evaluate_page(page_chain)
    assert any(i.rule_id == "RULE_REDIRECT_CHAIN" for i in issues_chain)

    page_loop = {
        "url": "https://redirects.com/loop",
        "status_code": 301,
        "is_redirect_loop": True,
        "redirect_chain": ["https://redirects.com/loop", "https://redirects.com/loop"]
    }
    issues_loop = engine.evaluate_page(page_loop)
    assert any(i.rule_id == "RULE_REDIRECT_LOOP" for i in issues_loop)

def test_golden_site_broken_canonical_to_404():
    engine = SeoRuleEngine()
    pages = [
        {"url": "https://broken.com/page-1", "canonical_target": "https://broken.com/missing", "status_code": 200},
        {"url": "https://broken.com/missing", "status_code": 404}
    ]
    report = engine.evaluate_site(pages)
    rule_ids = [i.rule_id for i in report["issues"]]
    assert "RULE_CANONICAL_TO_404" in rule_ids
    assert "RULE_HTTP_4XX_CLIENT_ERROR" in rule_ids
