import pytest
from unittest.mock import AsyncMock, patch
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from packages.shared.models import Base, Site, CrawlRun, CrawlPage
from services.crawler.safe_client import FetchResponse, RedirectHop
from services.crawler.crawler_service import CrawlerService
from services.seo_engine.engine import SeoRuleEngine

def test_seo_rules_http_200_healthy():
    engine = SeoRuleEngine()
    page = {
        "url": "https://example.com/clean",
        "status_code": 200,
        "title": "Clean Page Title Here",
        "meta_description": "Clean meta description for test page here.",
        "headings": {"h1": ["Main Heading"]},
        "word_count": 200,
    }
    issues = engine.evaluate_page(page)
    assert len(issues) == 0

def test_seo_rules_http_301_permanent_redirect():
    engine = SeoRuleEngine()
    page = {
        "url": "https://example.com/old-page",
        "status_code": 301,
        "title": None,
        "meta_description": None,
        "headings": {},
        "word_count": 0
    }
    issues = engine.evaluate_page(page)
    # 301 redirect must not trigger content errors (missing title/h1/meta)
    rule_ids = [i.rule_id for i in issues]
    assert "RULE_TITLE_MISSING" not in rule_ids
    assert "RULE_META_DESC_MISSING" not in rule_ids
    assert "RULE_H1_MISSING" not in rule_ids
    assert "RULE_TEMPORARY_REDIRECT_302" not in rule_ids

def test_seo_rules_http_302_temporary_redirect():
    engine = SeoRuleEngine()
    page = {
        "url": "https://example.com/temp-page",
        "status_code": 302,
        "title": None,
        "meta_description": None,
        "headings": {},
        "word_count": 0
    }
    issues = engine.evaluate_page(page)
    rule_ids = [i.rule_id for i in issues]
    assert "RULE_TEMPORARY_REDIRECT_302" in rule_ids
    assert "RULE_TITLE_MISSING" not in rule_ids
    assert "RULE_META_DESC_MISSING" not in rule_ids
    assert "RULE_H1_MISSING" not in rule_ids

def test_seo_rules_http_404_not_found():
    engine = SeoRuleEngine()
    page = {
        "url": "https://example.com/missing-page",
        "status_code": 404,
        "title": None,
        "meta_description": None,
        "headings": {},
        "word_count": 0
    }
    issues = engine.evaluate_page(page)
    rule_ids = [i.rule_id for i in issues]
    assert "RULE_HTTP_4XX_CLIENT_ERROR" in rule_ids
    assert "RULE_TITLE_MISSING" not in rule_ids
    assert "RULE_META_DESC_MISSING" not in rule_ids
    assert "RULE_H1_MISSING" not in rule_ids
    
    # Verify 404 specific title
    issue_404 = next(i for i in issues if i.rule_id == "RULE_HTTP_4XX_CLIENT_ERROR")
    assert "404" in issue_404.title
    assert "Bulunamadı" in issue_404.title

def test_seo_rules_http_410_gone():
    engine = SeoRuleEngine()
    page = {
        "url": "https://example.com/purged-page",
        "status_code": 410,
        "title": None,
        "meta_description": None,
        "headings": {},
        "word_count": 0
    }
    issues = engine.evaluate_page(page)
    rule_ids = [i.rule_id for i in issues]
    assert "RULE_HTTP_4XX_CLIENT_ERROR" in rule_ids
    assert "RULE_TITLE_MISSING" not in rule_ids
    assert "RULE_META_DESC_MISSING" not in rule_ids
    assert "RULE_H1_MISSING" not in rule_ids
    
    # Verify 410 specific title
    issue_410 = next(i for i in issues if i.rule_id == "RULE_HTTP_4XX_CLIENT_ERROR")
    assert "410" in issue_410.title
    assert "Kaldırıldı" in issue_410.title

def test_seo_rules_http_5xx_server_errors():
    engine = SeoRuleEngine()
    for code in (500, 502, 503, 504):
        page = {
            "url": f"https://example.com/err-{code}",
            "status_code": code,
            "title": None,
            "meta_description": None,
            "headings": {},
            "word_count": 0
        }
        issues = engine.evaluate_page(page)
        rule_ids = [i.rule_id for i in issues]
        assert "RULE_HTTP_5XX_ERROR" in rule_ids
        assert "RULE_TITLE_MISSING" not in rule_ids
        assert "RULE_META_DESC_MISSING" not in rule_ids
        assert "RULE_H1_MISSING" not in rule_ids
        
        issue_5xx = next(i for i in issues if i.rule_id == "RULE_HTTP_5XX_ERROR")
        assert str(code) in issue_5xx.title

def test_seo_rules_canonical_to_redirect_and_404():
    engine = SeoRuleEngine()
    pages = [
        {"url": "https://example.com/page-1", "canonical_target": "https://example.com/redir-target", "status_code": 200},
        {"url": "https://example.com/redir-target", "status_code": 301},
        {"url": "https://example.com/page-2", "canonical_target": "https://example.com/broken-target", "status_code": 200},
        {"url": "https://example.com/broken-target", "status_code": 404}
    ]
    report = engine.evaluate_site(pages)
    rule_ids = [i.rule_id for i in report["issues"]]
    assert "RULE_CANONICAL_TO_REDIRECT" in rule_ids
    assert "RULE_CANONICAL_TO_404" in rule_ids

@pytest.mark.asyncio
async def test_crawler_service_records_accurate_status_codes_for_all_http_types():
    test_engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    AsyncSessionLocal = sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    async with AsyncSessionLocal() as session:
        site = Site(
            id="s-status",
            organization_id="org-status",
            name="Status Test",
            domain="statustest.com",
            normalized_domain="statustest.com",
            primary_url="https://statustest.com"
        )
        session.add(site)
        run = CrawlRun(
            id="r-status",
            site_id="s-status",
            status="PENDING",
            crawl_mode="FAST_CONCURRENT",
            max_pages=20,
            max_depth=3
        )
        session.add(run)
        await session.commit()
        
        home_html = """
        <html>
        <head><title>Home Page</title></head>
        <body>
            <a href="/p301">301 Page</a>
            <a href="/p302">302 Page</a>
            <a href="/p404">404 Page</a>
            <a href="/p410">410 Page</a>
            <a href="/p500">500 Page</a>
        </body>
        </html>
        """
        
        responses = {
            "https://statustest.com": FetchResponse("https://statustest.com", "https://statustest.com", 200, {"content-type": "text/html"}, home_html, 20, []),
            "https://statustest.com/": FetchResponse("https://statustest.com/", "https://statustest.com/", 200, {"content-type": "text/html"}, home_html, 20, []),
            "https://statustest.com/p301": FetchResponse(
                "https://statustest.com/p301",
                "https://statustest.com/dest-301",
                200,
                {"content-type": "text/html"},
                "<html><head><title>Destination 301</title></head><body>301 Dest</body></html>",
                30,
                [RedirectHop("https://statustest.com/p301", "https://statustest.com/dest-301", 301)]
            ),
            "https://statustest.com/p302": FetchResponse(
                "https://statustest.com/p302",
                "https://statustest.com/dest-302",
                200,
                {"content-type": "text/html"},
                "<html><head><title>Destination 302</title></head><body>302 Dest</body></html>",
                30,
                [RedirectHop("https://statustest.com/p302", "https://statustest.com/dest-302", 302)]
            ),
            "https://statustest.com/p404": FetchResponse("https://statustest.com/p404", "https://statustest.com/p404", 404, {}, "Not Found", 25, []),
            "https://statustest.com/p410": FetchResponse("https://statustest.com/p410", "https://statustest.com/p410", 410, {}, "Gone", 25, []),
            "https://statustest.com/p500": FetchResponse("https://statustest.com/p500", "https://statustest.com/p500", 500, {}, "Server Error", 40, []),
        }
        
        async def mock_fetch(url):
            if "robots.txt" in url or "sitemap.xml" in url:
                return FetchResponse(url, url, 404, {}, "", 10, [])
            clean = url.rstrip("/") if url.endswith("/") and url.count("/") > 3 else url
            return responses.get(clean, FetchResponse(url, url, 404, {}, "Not Found", 10, []))
            
        with patch("services.crawler.safe_client.SafeHttpClient.fetch", new=AsyncMock(side_effect=mock_fetch)):
            crawler = CrawlerService(session, "r-status", concurrency=1)
            await crawler.run()
            
        from sqlalchemy.future import select
        res = await session.execute(select(CrawlPage).where(CrawlPage.crawl_run_id == "r-status"))
        crawled_pages = {p.url: p for p in res.scalars().all()}
        
        # 1. Verify 200 OK
        home_page = crawled_pages.get("https://statustest.com/") or crawled_pages.get("https://statustest.com")
        assert home_page is not None
        assert home_page.status_code == 200
        assert home_page.is_fetchable is True
        assert home_page.is_indexable_candidate is True
        assert home_page.title == "Home Page"
        
        # 2. Verify 301 Permanent Redirect
        p301 = crawled_pages.get("https://statustest.com/p301")
        assert p301 is not None
        assert p301.status_code == 301
        assert p301.is_fetchable is True
        assert p301.is_indexable_candidate is False
        assert p301.canonical_target == "https://statustest.com/dest-301"
        
        # 3. Verify 302 Temporary Redirect
        p302 = crawled_pages.get("https://statustest.com/p302")
        assert p302 is not None
        assert p302.status_code == 302
        assert p302.is_fetchable is True
        assert p302.is_indexable_candidate is False
        assert p302.canonical_target == "https://statustest.com/dest-302"
        
        # 4. Verify 404 Not Found
        p404 = crawled_pages.get("https://statustest.com/p404")
        assert p404 is not None
        assert p404.status_code == 404
        assert p404.is_fetchable is False
        assert p404.is_indexable_candidate is False
        
        # 5. Verify 410 Gone
        p410 = crawled_pages.get("https://statustest.com/p410")
        assert p410 is not None
        assert p410.status_code == 410
        assert p410.is_fetchable is False
        assert p410.is_indexable_candidate is False
        
        # 6. Verify 500 Internal Server Error
        p500 = crawled_pages.get("https://statustest.com/p500")
        assert p500 is not None
        assert p500.status_code == 500
        assert p500.is_fetchable is False
        assert p500.is_indexable_candidate is False
