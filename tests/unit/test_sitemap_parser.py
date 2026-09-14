import pytest
import gzip
from unittest.mock import AsyncMock, patch
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.future import select
from packages.shared.models import Base, Site, CrawlRun, CrawlPage
from services.crawler.sitemap_parser import SitemapParser
from services.crawler.safe_client import FetchResponse
from services.crawler.crawler_service import CrawlerService
from services.seo_engine.engine import SeoRuleEngine

def test_parse_urlset_sitemap():
    xml = """<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
       <url>
          <loc>https://example.com/</loc>
          <lastmod>2026-01-01</lastmod>
          <changefreq>daily</changefreq>
          <priority>1.0</priority>
       </url>
       <url>
          <loc>https://example.com/about</loc>
          <priority>0.8</priority>
       </url>
    </urlset>
    """
    res = SitemapParser.parse_xml(xml)
    assert res.is_valid is True
    assert res.is_index is False
    assert len(res.urls) == 2
    assert res.urls[0].loc == "https://example.com/"
    assert res.urls[0].priority == 1.0
    assert res.urls[1].loc == "https://example.com/about"
    assert res.urls[1].priority == 0.8

def test_parse_sitemap_index():
    xml = """<?xml version="1.0" encoding="UTF-8"?>
    <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
       <sitemap>
          <loc>https://example.com/sitemap-posts.xml</loc>
       </sitemap>
       <sitemap>
          <loc>https://example.com/sitemap-products.xml</loc>
       </sitemap>
    </sitemapindex>
    """
    res = SitemapParser.parse_xml(xml)
    assert res.is_valid is True
    assert res.is_index is True
    assert len(res.sitemap_indices) == 2
    assert res.sitemap_indices[0] == "https://example.com/sitemap-posts.xml"

def test_parse_namespaces_and_cdata():
    xml = """<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
            xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
            xmlns:xhtml="http://www.w3.org/1999/xhtml">
       <url>
          <loc><![CDATA[https://example.com/product?id=42&color=blue]]></loc>
          <xhtml:link rel="alternate" hreflang="tr" href="https://example.com/tr/product" />
          <image:image>
             <image:loc>https://example.com/img.jpg</image:loc>
          </image:image>
          <lastmod>2026-09-14</lastmod>
       </url>
    </urlset>
    """
    res = SitemapParser.parse_xml(xml)
    assert res.is_valid is True
    assert len(res.urls) == 1
    assert res.urls[0].loc == "https://example.com/product?id=42&color=blue"

def test_parse_utf8_bom():
    xml = "\ufeff<?xml version=\"1.0\" encoding=\"UTF-8\"?><urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\"><url><loc>https://example.com/bom</loc></url></urlset>"
    res = SitemapParser.parse_xml(xml)
    assert res.is_valid is True
    assert len(res.urls) == 1
    assert res.urls[0].loc == "https://example.com/bom"

def test_parse_gzip_content():
    raw_xml = "<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\"><url><loc>https://example.com/compressed</loc></url></urlset>"
    gz_bytes = gzip.compress(raw_xml.encode("utf-8"))
    res = SitemapParser.parse_xml(gz_bytes)
    assert res.is_valid is True
    assert len(res.urls) == 1
    assert res.urls[0].loc == "https://example.com/compressed"

def test_parse_relative_urls_with_base():
    xml = """<urlset>
       <url><loc>/relative-page</loc></url>
       <url><loc>nested/page</loc></url>
    </urlset>"""
    res = SitemapParser.parse_xml(xml, base_url="https://example.com/dir/")
    assert res.is_valid is True
    assert res.urls[0].loc == "https://example.com/relative-page"
    assert res.urls[1].loc == "https://example.com/dir/nested/page"

def test_parse_plain_text_sitemap():
    text_content = """# Plain text sitemap
    https://example.com/page-1
    https://example.com/page-2
    https://example.com/page-3
    """
    res = SitemapParser.parse_xml(text_content)
    assert res.is_valid is True
    assert len(res.urls) == 3
    assert res.urls[0].loc == "https://example.com/page-1"
    assert res.urls[2].loc == "https://example.com/page-3"

def test_parse_rss_feed_sitemap():
    rss_xml = """<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0">
       <channel>
          <title>Example Feed</title>
          <item>
             <title>Post 1</title>
             <link>https://example.com/blog/post-1</link>
          </item>
          <item>
             <title>Post 2</title>
             <link>https://example.com/blog/post-2</link>
          </item>
       </channel>
    </rss>"""
    res = SitemapParser.parse_xml(rss_xml)
    assert res.is_valid is True
    assert len(res.urls) == 2
    assert res.urls[0].loc == "https://example.com/blog/post-1"
    assert res.urls[1].loc == "https://example.com/blog/post-2"

def test_parse_security_rejections():
    # 1. XXE / DTD Rejection
    xxe_xml = """<?xml version="1.0"?>
    <!DOCTYPE foo [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]>
    <urlset><url><loc>&xxe;</loc></url></urlset>"""
    res_xxe = SitemapParser.parse_xml(xxe_xml)
    assert res_xxe.is_valid is False
    assert "Security policy violation" in res_xxe.error_message

    # 2. Oversize (>10MB) Rejection
    huge_xml = "<urlset>" + ("<url><loc>https://example.com/</loc></url>" * 300000) + "</urlset>"
    res_huge = SitemapParser.parse_xml(huge_xml)
    assert res_huge.is_valid is False
    assert "exceeds maximum limit" in res_huge.error_message

def test_sitemap_seo_rules():
    engine = SeoRuleEngine()

    # 1. Sitemap page returns 404
    page_404 = {
        "url": "https://example.com/broken",
        "status_code": 404,
        "in_sitemap": True,
        "title": None,
        "headings": {},
        "word_count": 0
    }
    issues_404 = engine.evaluate_page(page_404)
    rule_ids_404 = [i.rule_id for i in issues_404]
    assert "RULE_SITEMAP_PAGE_404" in rule_ids_404
    issue_404 = next(i for i in issues_404 if i.rule_id == "RULE_SITEMAP_PAGE_404")
    assert "Sitemap 404" in issue_404.title

    # 2. Sitemap page returns 301 redirect
    page_301 = {
        "url": "https://example.com/redirecting",
        "status_code": 301,
        "in_sitemap": True,
        "title": None,
        "headings": {},
        "word_count": 0
    }
    issues_301 = engine.evaluate_page(page_301)
    rule_ids_301 = [i.rule_id for i in issues_301]
    assert "RULE_SITEMAP_PAGE_REDIRECT" in rule_ids_301

    # 3. Sitemap page has noindex
    page_noindex = {
        "url": "https://example.com/secret",
        "status_code": 200,
        "in_sitemap": True,
        "has_noindex": True,
        "title": "Secret Page",
        "headings": {"h1": ["Secret"]},
        "word_count": 200
    }
    issues_noindex = engine.evaluate_page(page_noindex)
    rule_ids_noindex = [i.rule_id for i in issues_noindex]
    assert "RULE_SITEMAP_PAGE_NOINDEX" in rule_ids_noindex

@pytest.mark.asyncio
async def test_crawler_sitemap_discovery_and_db_persistence():
    test_engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    AsyncSessionLocal = sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        site = Site(
            id="s-sitemap-flow",
            organization_id="org-sm",
            name="Sitemap Integration Test",
            domain="sitemapflow.com",
            normalized_domain="sitemapflow.com",
            primary_url="https://sitemapflow.com"
        )
        session.add(site)
        run = CrawlRun(
            id="r-sitemap-flow",
            site_id="s-sitemap-flow",
            status="PENDING",
            crawl_mode="FAST_CONCURRENT",
            max_pages=20,
            max_depth=3
        )
        session.add(run)
        await session.commit()

        robots_content = """User-agent: *
Allow: /
Sitemap: /relative-sitemap.xml
"""
        sitemap_content = """<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
           <url>
              <loc>https://sitemapflow.com/sm-page-live</loc>
           </url>
           <url>
              <loc>https://sitemapflow.com/sm-page-dead</loc>
           </url>
        </urlset>"""

        home_html = """<html><body>
        <a href="/organic-only">Organic Link</a>
        <a href="/sm-page-live">Sitemap Link</a>
        </body></html>"""

        responses = {
            "https://sitemapflow.com/robots.txt": FetchResponse("https://sitemapflow.com/robots.txt", "https://sitemapflow.com/robots.txt", 200, {}, robots_content, 10, []),
            "https://sitemapflow.com/relative-sitemap.xml": FetchResponse("https://sitemapflow.com/relative-sitemap.xml", "https://sitemapflow.com/relative-sitemap.xml", 200, {}, sitemap_content, 10, []),
            "https://sitemapflow.com/sitemap.xml": FetchResponse("https://sitemapflow.com/sitemap.xml", "https://sitemapflow.com/sitemap.xml", 404, {}, "Not found", 10, []),
            "https://sitemapflow.com/sitemap_index.xml": FetchResponse("https://sitemapflow.com/sitemap_index.xml", "https://sitemapflow.com/sitemap_index.xml", 404, {}, "Not found", 10, []),
            "https://sitemapflow.com": FetchResponse("https://sitemapflow.com", "https://sitemapflow.com", 200, {}, home_html, 10, []),
            "https://sitemapflow.com/": FetchResponse("https://sitemapflow.com/", "https://sitemapflow.com/", 200, {}, home_html, 10, []),
            "https://sitemapflow.com/organic-only": FetchResponse("https://sitemapflow.com/organic-only", "https://sitemapflow.com/organic-only", 200, {}, "<html><body>Organic</body></html>", 10, []),
            "https://sitemapflow.com/sm-page-live": FetchResponse("https://sitemapflow.com/sm-page-live", "https://sitemapflow.com/sm-page-live", 200, {}, "<html><head><title>Live</title></head><body>Live SM</body></html>", 10, []),
            "https://sitemapflow.com/sm-page-dead": FetchResponse("https://sitemapflow.com/sm-page-dead", "https://sitemapflow.com/sm-page-dead", 404, {}, "Not found", 10, []),
        }

        async def mock_fetch(url):
            clean = url.rstrip("/") if url.endswith("/") and url.count("/") > 3 else url
            return responses.get(clean, FetchResponse(url, url, 404, {}, "Not Found", 10, []))

        with patch("services.crawler.safe_client.SafeHttpClient.fetch", new=AsyncMock(side_effect=mock_fetch)):
            crawler = CrawlerService(session, "r-sitemap-flow", concurrency=1)
            await crawler.run()

        res = await session.execute(select(CrawlPage).where(CrawlPage.crawl_run_id == "r-sitemap-flow"))
        crawled_pages = {p.url: p for p in res.scalars().all()}

        # 1. Verify sitemap URL was found and has in_sitemap=True
        assert "https://sitemapflow.com/sm-page-live" in crawled_pages
        live_p = crawled_pages["https://sitemapflow.com/sm-page-live"]
        assert live_p.status_code == 200
        assert live_p.in_sitemap is True

        # 2. Verify 404 page in sitemap was crawled, recorded as 404, and has in_sitemap=True
        assert "https://sitemapflow.com/sm-page-dead" in crawled_pages
        dead_p = crawled_pages["https://sitemapflow.com/sm-page-dead"]
        assert dead_p.status_code == 404
        assert dead_p.in_sitemap is True

        # 3. Verify page NOT in sitemap has in_sitemap=False
        assert "https://sitemapflow.com/organic-only" in crawled_pages
        organic_p = crawled_pages["https://sitemapflow.com/organic-only"]
        assert organic_p.status_code == 200
        assert organic_p.in_sitemap is False

        # 4. Run SEO engine to verify RULE_SITEMAP_PAGE_404 triggers
        pages_dict = [
            {
                "url": p.url,
                "status_code": p.status_code,
                "in_sitemap": p.in_sitemap,
                "has_noindex": p.has_noindex,
                "title": p.title,
                "headings": {},
                "word_count": p.word_count
            }
            for p in crawled_pages.values()
        ]
        report = SeoRuleEngine().evaluate_site(pages_dict)
        rule_ids = [i.rule_id for i in report["issues"]]
        assert "RULE_SITEMAP_PAGE_404" in rule_ids
        assert report["sitemap_reconciliation"]["has_sitemap"] is True
        assert report["sitemap_reconciliation"]["total_sitemap_urls"] == 2

def test_sitemap_vs_indexable_reconciliation_and_all_rules():
    engine = SeoRuleEngine()
    pages = [
        # 1. Healthy indexable page in sitemap
        {
            "url": "https://example.com/good",
            "status_code": 200,
            "in_sitemap": True,
            "has_noindex": False,
            "is_canonical": True,
            "is_crawlable_by_google": True,
            "title": "Good Page",
            "headings": {"h1": ["Good"]},
            "word_count": 100
        },
        # 2. 404 broken in sitemap
        {
            "url": "https://example.com/broken-404",
            "status_code": 404,
            "in_sitemap": True,
            "has_noindex": False,
            "is_canonical": True,
            "is_crawlable_by_google": True,
            "title": None,
            "headings": {},
            "word_count": 0
        },
        # 3. 301 redirect in sitemap
        {
            "url": "https://example.com/redirect-301",
            "status_code": 301,
            "in_sitemap": True,
            "has_noindex": False,
            "is_canonical": False,
            "is_crawlable_by_google": True,
            "title": None,
            "headings": {},
            "word_count": 0
        },
        # 4. Noindex page in sitemap
        {
            "url": "https://example.com/secret-noindex",
            "status_code": 200,
            "in_sitemap": True,
            "has_noindex": True,
            "is_canonical": True,
            "is_crawlable_by_google": True,
            "title": "Noindex",
            "headings": {"h1": ["Noindex"]},
            "word_count": 100
        },
        # 5. Non-canonical page in sitemap pointing to another URL
        {
            "url": "https://example.com/duplicate",
            "canonical_target": "https://example.com/good",
            "status_code": 200,
            "in_sitemap": True,
            "has_noindex": False,
            "is_canonical": False,
            "is_crawlable_by_google": True,
            "title": "Duplicate",
            "headings": {"h1": ["Duplicate"]},
            "word_count": 100
        },
        # 6. Page in sitemap blocked by robots.txt
        {
            "url": "https://example.com/admin-blocked",
            "status_code": 0,
            "in_sitemap": True,
            "has_noindex": False,
            "is_canonical": True,
            "is_crawlable_by_google": False,
            "title": None,
            "headings": {},
            "word_count": 0
        },
        # 7. Page in sitemap returning 500 error
        {
            "url": "https://example.com/error-500",
            "status_code": 500,
            "in_sitemap": True,
            "has_noindex": False,
            "is_canonical": True,
            "is_crawlable_by_google": True,
            "title": None,
            "headings": {},
            "word_count": 0
        },
        # 8. Real indexable page NOT in sitemap (discovered via links)
        {
            "url": "https://example.com/orphan-indexable",
            "status_code": 200,
            "in_sitemap": False,
            "has_noindex": False,
            "is_canonical": True,
            "is_crawlable_by_google": True,
            "title": "Orphan Indexable",
            "headings": {"h1": ["Orphan"]},
            "word_count": 120
        }
    ]

    report = engine.evaluate_site(pages)
    rule_ids = [i.rule_id for i in report["issues"]]

    # Verify all reconciliation rules triggered
    assert "RULE_INDEXABLE_PAGE_NOT_IN_SITEMAP" in rule_ids
    assert "RULE_SITEMAP_PAGE_404" in rule_ids
    assert "RULE_SITEMAP_PAGE_REDIRECT" in rule_ids
    assert "RULE_SITEMAP_PAGE_NOINDEX" in rule_ids
    assert "RULE_SITEMAP_PAGE_BLOCKED_BY_ROBOTS" in rule_ids
    assert "RULE_SITEMAP_PAGE_NON_CANONICAL" in rule_ids
    assert "RULE_SITEMAP_PAGE_5XX" in rule_ids

    # Verify reconciliation statistics
    recon = report["sitemap_reconciliation"]
    assert recon["has_sitemap"] is True
    assert recon["total_sitemap_urls"] == 7
    assert recon["total_indexable_pages"] == 2  # good + orphan-indexable
    assert recon["indexable_in_sitemap"] == 1  # good
    assert recon["non_indexable_in_sitemap"] == 6  # 404, 301, noindex, non-canonical, blocked, 500
    assert recon["indexable_not_in_sitemap"] == 1  # orphan-indexable
    assert recon["sitemap_coverage_percent"] == 50.0
    assert recon["sitemap_cleanliness_percent"] == 14.3

@pytest.mark.asyncio
async def test_pages_api_in_sitemap_filtering():
    test_engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    AsyncSessionLocal = sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        site = Site(
            id="s-filter",
            organization_id="org-filter",
            name="Filter Site",
            domain="filter.com",
            normalized_domain="filter.com",
            primary_url="https://filter.com"
        )
        session.add(site)
        run = CrawlRun(
            id="r-filter",
            site_id="s-filter",
            status="COMPLETED",
            crawl_mode="FAST_CONCURRENT",
            max_pages=20,
            max_depth=3
        )
        session.add(run)

        # Page in sitemap
        p_in = CrawlPage(
            crawl_run_id="r-filter",
            site_id="s-filter",
            url="https://filter.com/in-sm",
            normalized_url="https://filter.com/in-sm",
            depth=1,
            status_code=200,
            in_sitemap=True,
            is_indexable_candidate=True
        )
        # Page NOT in sitemap
        p_out = CrawlPage(
            crawl_run_id="r-filter",
            site_id="s-filter",
            url="https://filter.com/out-sm",
            normalized_url="https://filter.com/out-sm",
            depth=1,
            status_code=200,
            in_sitemap=False,
            is_indexable_candidate=True
        )
        session.add_all([p_in, p_out])
        await session.commit()

        # Query in_sitemap=True
        res_in = await session.execute(
            select(CrawlPage).where(CrawlPage.crawl_run_id == "r-filter", CrawlPage.in_sitemap == True)
        )
        pages_in = res_in.scalars().all()
        assert len(pages_in) == 1
        assert pages_in[0].url == "https://filter.com/in-sm"

        # Query in_sitemap=False
        res_out = await session.execute(
            select(CrawlPage).where(CrawlPage.crawl_run_id == "r-filter", CrawlPage.in_sitemap == False)
        )
        pages_out = res_out.scalars().all()
        assert len(pages_out) == 1
        assert pages_out[0].url == "https://filter.com/out-sm"

