import pytest
from unittest.mock import patch, AsyncMock
from services.crawler.html_extractor import HtmlExtractor
from services.crawler.safe_client import SafeHttpClient, GOOGLEBOT_MOBILE_USER_AGENT, GOOGLEBOT_DESKTOP_USER_AGENT
from services.crawler.headless_renderer import HeadlessRenderEngine
from services.seo_engine.base import RuleCategory, IssueSeverity
from services.seo_engine.engine import SeoRuleEngine
from services.seo_engine.rules.rules_impl import (
    MobileViewportMissingRule,
    MobileViewportInvalidRule,
    MobileViewportZoomRestrictedRule,
    MobileDesktopParityMismatchRule,
    MobileDynamicServingMissingVaryRule,
    MobileSeparateUrlMissingCanonicalRule
)

def test_html_extractor_viewport_and_mobile_tags():
    # 1. Standard valid responsive viewport
    html_responsive = """
    <!DOCTYPE html>
    <html>
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Responsive Site</title>
    </head>
    <body><h1>Responsive Page</h1></body>
    </html>
    """
    ext_resp = HtmlExtractor.extract(html_responsive, "https://example.com/")
    assert ext_resp.viewport == "width=device-width, initial-scale=1.0"
    assert ext_resp.is_responsive_viewport is True
    assert ext_resp.has_fixed_viewport_width is False
    assert ext_resp.prevents_user_scalable is False

    # 2. Missing viewport
    html_missing = """
    <!DOCTYPE html>
    <html>
    <head><title>Desktop Only Site</title></head>
    <body><h1>Desktop Only</h1></body>
    </html>
    """
    ext_miss = HtmlExtractor.extract(html_missing, "https://example.com/")
    assert ext_miss.viewport is None
    assert ext_miss.is_responsive_viewport is False
    assert ext_miss.has_fixed_viewport_width is False

    # 3. Fixed width viewport (e.g. width=1024)
    html_fixed = """
    <!DOCTYPE html>
    <html>
    <head><meta name="viewport" content="width=1024"></head>
    <body><h1>Fixed Width Page</h1></body>
    </html>
    """
    ext_fixed = HtmlExtractor.extract(html_fixed, "https://example.com/")
    assert ext_fixed.viewport == "width=1024"
    assert ext_fixed.has_fixed_viewport_width is True

    # 4. Viewport preventing zoom (accessibility issue)
    html_no_zoom = """
    <!DOCTYPE html>
    <html>
    <head><meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no, maximum-scale=1.0"></head>
    <body><h1>Zoom Blocked</h1></body>
    </html>
    """
    ext_no_zoom = HtmlExtractor.extract(html_no_zoom, "https://example.com/")
    assert ext_no_zoom.prevents_user_scalable is True

    # 5. Mobile alternate link (m-dot) & Vary header
    html_m_dot = """
    <!DOCTYPE html>
    <html>
    <head>
        <link rel="alternate" media="only screen and (max-width: 640px)" href="https://m.example.com/page">
    </head>
    <body><h1>Desktop Version</h1></body>
    </html>
    """
    ext_m_dot = HtmlExtractor.extract(
        html_m_dot,
        "https://example.com/page",
        response_headers={"vary": "Accept-Encoding, User-Agent"}
    )
    assert ext_m_dot.mobile_alternate_url == "https://m.example.com/page"
    assert ext_m_dot.has_vary_user_agent is True

def test_mobile_viewport_missing_rule():
    rule = MobileViewportMissingRule()
    assert rule.category == RuleCategory.MOBILE
    assert rule.default_severity == IssueSeverity.HIGH

    # Missing viewport on indexable 200 page
    page_missing = {
        "url": "https://example.com/page",
        "status_code": 200,
        "has_noindex": False,
        "viewport": None
    }
    result = rule.check(page_missing)
    assert result is not None
    assert result.passed is False
    assert result.rule_id == "RULE_MOBILE_VIEWPORT_MISSING"
    assert result.severity == IssueSeverity.HIGH

    # Present viewport passes
    page_ok = {
        "url": "https://example.com/page",
        "status_code": 200,
        "has_noindex": False,
        "viewport": "width=device-width, initial-scale=1"
    }
    assert rule.check(page_ok) is None

    # 404 or noindex pages are skipped
    page_404 = {
        "url": "https://example.com/404",
        "status_code": 404,
        "viewport": None
    }
    assert rule.check(page_404) is None

def test_mobile_viewport_invalid_rule():
    rule = MobileViewportInvalidRule()
    assert rule.category == RuleCategory.MOBILE
    assert rule.default_severity == IssueSeverity.MEDIUM

    # Fixed width triggers issue
    page_fixed = {
        "url": "https://example.com/fixed",
        "status_code": 200,
        "viewport": "width=960",
        "has_fixed_viewport_width": True
    }
    res = rule.check(page_fixed)
    assert res is not None
    assert res.rule_id == "RULE_MOBILE_VIEWPORT_INVALID"
    assert res.severity == IssueSeverity.MEDIUM

    # Valid responsive viewport passes
    page_valid = {
        "url": "https://example.com/responsive",
        "status_code": 200,
        "viewport": "width=device-width, initial-scale=1",
        "has_fixed_viewport_width": False
    }
    assert rule.check(page_valid) is None

def test_mobile_viewport_zoom_restricted_rule():
    rule = MobileViewportZoomRestrictedRule()
    assert rule.category == RuleCategory.MOBILE
    assert rule.default_severity == IssueSeverity.LOW

    # User scalable no triggers issue
    page_zoom_blocked = {
        "url": "https://example.com/no-zoom",
        "status_code": 200,
        "viewport": "width=device-width, initial-scale=1, user-scalable=0",
        "prevents_user_scalable": True
    }
    res = rule.check(page_zoom_blocked)
    assert res is not None
    assert res.rule_id == "RULE_MOBILE_VIEWPORT_ZOOM_RESTRICTED"

    # Standard scale allows zoom and passes
    page_zoom_allowed = {
        "url": "https://example.com/zoom-ok",
        "status_code": 200,
        "viewport": "width=device-width, initial-scale=1",
        "prevents_user_scalable": False
    }
    assert rule.check(page_zoom_allowed) is None

def test_mobile_dynamic_serving_missing_vary_rule():
    rule = MobileDynamicServingMissingVaryRule()
    assert rule.category == RuleCategory.MOBILE

    # Dynamic serving without Vary: User-Agent fails
    page_no_vary = {
        "url": "https://example.com/page",
        "mobile_alternate_url": "https://m.example.com/page",
        "has_vary_user_agent": False,
        "headers": {"content-type": "text/html"}
    }
    res = rule.check(page_no_vary)
    assert res is not None
    assert res.rule_id == "RULE_MOBILE_DYNAMIC_SERVING_MISSING_VARY"

    # With Vary: User-Agent passes
    page_with_vary = {
        "url": "https://example.com/page",
        "mobile_alternate_url": "https://m.example.com/page",
        "has_vary_user_agent": True,
        "headers": {"vary": "User-Agent"}
    }
    assert rule.check(page_with_vary) is None

def test_mobile_separate_url_missing_canonical_rule():
    rule = MobileSeparateUrlMissingCanonicalRule()
    assert rule.category == RuleCategory.MOBILE
    assert rule.default_severity == IssueSeverity.HIGH

    # m-dot page without canonical to desktop fails
    m_page_missing_canon = {
        "url": "https://m.example.com/product-123",
        "is_mobile_url": True,
        "canonical_target": None
    }
    res = rule.check(m_page_missing_canon)
    assert res is not None
    assert res.rule_id == "RULE_MOBILE_SEPARATE_URL_MISSING_CANONICAL"

    # m-dot page with self-canonical also fails
    m_page_self_canon = {
        "url": "https://m.example.com/product-123",
        "is_mobile_url": True,
        "canonical_target": "https://m.example.com/product-123"
    }
    res_self = rule.check(m_page_self_canon)
    assert res_self is not None
    assert res_self.rule_id == "RULE_MOBILE_SEPARATE_URL_MISSING_CANONICAL"

    # m-dot page pointing to desktop canonical passes
    m_page_desktop_canon = {
        "url": "https://m.example.com/product-123",
        "is_mobile_url": True,
        "canonical_target": "https://example.com/product-123"
    }
    assert rule.check(m_page_desktop_canon) is None

def test_mobile_desktop_parity_engine_and_rule():
    desktop_html = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Full Desktop Page</title>
        <script type="application/ld+json">{"@context": "https://schema.org", "@type": "Product", "name": "Shoe"}</script>
    </head>
    <body>
        <h1>Primary Desktop Heading</h1>
        <p>Comprehensive long-form guide detailing complete features and specifications across hundreds of words of high quality copy.</p>
        <p>Another detailed paragraph explaining benefits, technical documentation, and user satisfaction details.</p>
    </body>
    </html>
    """

    # Mobile version stripped H1, stripped schema, stripped text, and injected noindex!
    mobile_html = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Full Desktop Page</title>
        <meta name="robots" content="noindex">
    </head>
    <body>
        <h2>Mobile Summary</h2>
        <p>Short snippet only.</p>
    </body>
    </html>
    """

    parity_res = HeadlessRenderEngine.compare_mobile_desktop_parity(
        desktop_html=desktop_html,
        mobile_html=mobile_html,
        base_url="https://example.com/"
    )

    assert parity_res.has_parity is False
    assert any("H1" in d for d in parity_res.discrepancies)
    assert any("noindex" in d for d in parity_res.discrepancies)
    assert any("JSON-LD" in d for d in parity_res.discrepancies)

    # Test MobileDesktopParityMismatchRule
    rule = MobileDesktopParityMismatchRule()
    page_context = {
        "url": "https://example.com/",
        "mobile_parity": parity_res.to_dict(),
        "parity_discrepancies": parity_res.discrepancies
    }
    rule_res = rule.check(page_context)
    assert rule_res is not None
    assert rule_res.rule_id == "RULE_MOBILE_PARITY_MISMATCH"
    assert rule_res.severity == IssueSeverity.HIGH

def test_safe_client_user_agents_mobile_first():
    # Googlebot simulation defaults to mobile
    client_mobile = SafeHttpClient(mode="GOOGLEBOT_SIMULATION")
    assert client_mobile.user_agent == GOOGLEBOT_MOBILE_USER_AGENT
    assert "Nexus 5X" in client_mobile.user_agent
    assert "Mobile" in client_mobile.user_agent

    # Desktop Googlebot can be explicitly selected
    client_desktop = SafeHttpClient(mode="GOOGLEBOT_SIMULATION", device="desktop")
    assert client_desktop.user_agent == GOOGLEBOT_DESKTOP_USER_AGENT
    assert "Nexus 5X" not in client_desktop.user_agent

def test_seo_rule_engine_site_evaluation_mobile_stats():
    engine = SeoRuleEngine()
    pages = [
        {
            "url": "https://example.com/responsive",
            "status_code": 200,
            "viewport": "width=device-width, initial-scale=1",
            "has_noindex": False,
            "is_canonical": True,
            "word_count": 400
        },
        {
            "url": "https://example.com/missing-viewport",
            "status_code": 200,
            "viewport": None,
            "has_noindex": False,
            "is_canonical": True,
            "word_count": 300
        },
        {
            "url": "https://example.com/zoom-restricted",
            "status_code": 200,
            "viewport": "width=device-width, initial-scale=1, user-scalable=no",
            "prevents_user_scalable": True,
            "has_noindex": False,
            "is_canonical": True,
            "word_count": 350
        }
    ]

    report = engine.evaluate_site(pages)
    rule_ids = [i.rule_id for i in report["issues"]]
    assert "RULE_MOBILE_VIEWPORT_MISSING" in rule_ids
    assert "RULE_MOBILE_VIEWPORT_ZOOM_RESTRICTED" in rule_ids

    mobile_stats = report["mobile_stats"]
    assert mobile_stats["total_pages_checked"] == 3
    assert mobile_stats["pages_with_valid_viewport"] == 2
    assert mobile_stats["pages_missing_viewport"] == 1
    assert mobile_stats["pages_zoom_restricted"] == 1
    assert mobile_stats["mobile_friendly_percent"] == 66.7

@pytest.mark.asyncio
async def test_quick_audit_mobile_response():
    from apps.api.routes.quick_audit import perform_quick_site_audit, QuickAuditRequest
    from starlette.requests import Request

    html_content = """
    <!DOCTYPE html>
    <html>
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Quick Audit Mobile Test</title>
        <meta name="description" content="A fully responsive site for testing mobile page analysis in quick audit.">
    </head>
    <body>
        <h1>Responsive Heading</h1>
        <p>This is a complete responsive page with more than enough indexable content words for testing.</p>
    </body>
    </html>
    """

    mock_resp = AsyncMock()
    mock_resp.status_code = 200
    mock_resp.final_url = "https://example.com/"
    mock_resp.text = html_content
    mock_resp.headers = {"content-type": "text/html"}
    mock_resp.response_time_ms = 45
    mock_resp.redirect_chain = []
    mock_resp.is_redirect_loop = False

    req = QuickAuditRequest(url="https://example.com/", max_pages=1)
    fake_request = Request({"type": "http", "client": ("127.0.0.1", 12345), "headers": []})

    with patch("services.crawler.safe_client.SafeHttpClient.fetch", return_value=mock_resp):
        response = await perform_quick_site_audit(req, fake_request)
        assert response.status_code == 200
        assert response.page_info["viewport"] == "width=device-width, initial-scale=1"
        assert response.page_info["is_mobile_friendly"] is True
        # Ensure no viewport missing issues
        assert not any(i.rule_id == "RULE_MOBILE_VIEWPORT_MISSING" for i in response.issues)
