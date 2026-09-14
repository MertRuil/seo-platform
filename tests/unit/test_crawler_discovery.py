import pytest
import asyncio
from unittest.mock import AsyncMock, patch
from services.crawler.html_extractor import HtmlExtractor
from services.crawler.url_normalizer import UrlNormalizer
from services.crawler.crawler_service import CrawlerService
from services.crawler.safe_client import FetchResponse
from packages.shared.models import Organization, Site, CrawlRun, CrawlPage
from packages.shared.database import engine, Base, AsyncSessionLocal

def test_html_extractor_base_href_support():
    html = """
    <!DOCTYPE html>
    <html>
    <head>
        <base href="https://example.com/subfolder/">
        <link rel="canonical" href="canonical-page">
    </head>
    <body>
        <a href="relative-page">Relative Link</a>
        <a href="/root-page">Root Link</a>
        <a href="https://www.example.com/www-link">WWW Link</a>
        <a href="https://external.org/test">External Link</a>
        <a href="mailto:contact@example.com">Email</a>
        <a href="javascript:void(0)">JS</a>
        <img src="banner.png" alt="Banner">
    </body>
    </html>
    """
    res = HtmlExtractor.extract(html, "https://example.com/different/path")
    assert res.canonical_url == "https://example.com/subfolder/canonical-page"
    
    # Check relative link resolved against base href
    rel_link = next(l for l in res.links if "relative-page" in l.href)
    assert rel_link.href == "https://example.com/subfolder/relative-page"
    assert rel_link.is_internal is True

    # Check root link resolved against domain
    root_link = next(l for l in res.links if "root-page" in l.href)
    assert root_link.href == "https://example.com/root-page"
    assert root_link.is_internal is True

    # Check www link recognized as internal to example.com
    www_link = next(l for l in res.links if "www-link" in l.href)
    assert www_link.href == "https://www.example.com/www-link"
    assert www_link.is_internal is True

    # Check external link recognized as external
    ext_link = next(l for l in res.links if "external.org" in l.href)
    assert ext_link.is_internal is False

    # Image source resolved against base href
    assert len(res.images) == 1
    assert res.images[0].src == "https://example.com/subfolder/banner.png"

import uuid

@pytest.mark.asyncio
async def test_crawler_service_auto_seeds_sitemap():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    run_id = f"run_{uuid.uuid4().hex[:8]}"
    org_id = f"org_{uuid.uuid4().hex[:8]}"
    site_id = f"site_{uuid.uuid4().hex[:8]}"

    async with AsyncSessionLocal() as session:
        org = Organization(id=org_id, name="Test Org", slug=f"test-org-{uuid.uuid4().hex[:6]}")
        site = Site(
            id=site_id,
            organization_id=org_id,
            name="Test Site",
            domain="testsite.local",
            normalized_domain="testsite.local",
            primary_url="https://testsite.local",
            preferred_protocol="https",
            verification_status="VERIFIED"
        )
        crawl_run = CrawlRun(
            id=run_id,
            site_id=site_id,
            crawl_mode="GOOGLEBOT_SIMULATION",
            max_pages=10,
            max_depth=3,
            status="PENDING"
        )
        session.add_all([org, site, crawl_run])
        await session.commit()

        sitemap_xml = """<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <url><loc>https://testsite.local/sitemap-orphan-1</loc></url>
            <url><loc>https://testsite.local/sitemap-orphan-2</loc></url>
        </urlset>"""

        responses = {
            "https://testsite.local/robots.txt": FetchResponse(
                requested_url="https://testsite.local/robots.txt",
                final_url="https://testsite.local/robots.txt",
                status_code=200,
                headers={"content-type": "text/plain"},
                text="User-agent: *\nDisallow: /admin/\nSitemap: https://testsite.local/custom-sitemap.xml",
                response_time_ms=10,
                redirect_chain=[]
            ),
            "https://testsite.local/custom-sitemap.xml": FetchResponse(
                requested_url="https://testsite.local/custom-sitemap.xml",
                final_url="https://testsite.local/custom-sitemap.xml",
                status_code=200,
                headers={"content-type": "application/xml"},
                text=sitemap_xml,
                response_time_ms=10,
                redirect_chain=[]
            ),
            "https://testsite.local": FetchResponse(
                requested_url="https://testsite.local",
                final_url="https://testsite.local",
                status_code=200,
                headers={"content-type": "text/html"},
                text="<html><head><title>Home</title></head><body><h1>Welcome</h1></body></html>",
                response_time_ms=15,
                redirect_chain=[]
            ),
            "https://testsite.local/sitemap-orphan-1": FetchResponse(
                requested_url="https://testsite.local/sitemap-orphan-1",
                final_url="https://testsite.local/sitemap-orphan-1",
                status_code=200,
                headers={"content-type": "text/html"},
                text="<html><head><title>Orphan 1</title></head><body><h1>Orphan 1</h1></body></html>",
                response_time_ms=15,
                redirect_chain=[]
            ),
            "https://testsite.local/sitemap-orphan-2": FetchResponse(
                requested_url="https://testsite.local/sitemap-orphan-2",
                final_url="https://testsite.local/sitemap-orphan-2",
                status_code=200,
                headers={"content-type": "text/html"},
                text="<html><head><title>Orphan 2</title></head><body><h1>Orphan 2</h1></body></html>",
                response_time_ms=15,
                redirect_chain=[]
            ),
        }

        async def mock_fetch(url):
            clean = url.rstrip("/") if url.endswith("/") and url.count("/") > 3 else url
            return responses.get(clean, FetchResponse(
                requested_url=url,
                final_url=url,
                status_code=404,
                headers={},
                text="Not found",
                response_time_ms=10,
                redirect_chain=[]
            ))

        with patch("services.crawler.safe_client.SafeHttpClient.fetch", new=AsyncMock(side_effect=mock_fetch)):
            crawler = CrawlerService(session, run_id, concurrency=2)
            await crawler.run()

        from sqlalchemy.future import select
        pages_res = await session.execute(select(CrawlPage).where(CrawlPage.crawl_run_id == run_id))
        crawled = pages_res.scalars().all()

        crawled_urls = [p.url for p in crawled]
        assert ("https://testsite.local/" in crawled_urls or "https://testsite.local" in crawled_urls)
        assert "https://testsite.local/sitemap-orphan-1" in crawled_urls
        assert "https://testsite.local/sitemap-orphan-2" in crawled_urls
        assert len(crawled) == 3

        run_res = await session.execute(select(CrawlRun).where(CrawlRun.id == run_id))
        run = run_res.scalars().first()
        assert run.status == "COMPLETED"
        assert run.total_urls_crawled == 3
        assert run.total_urls_discovered >= 3
