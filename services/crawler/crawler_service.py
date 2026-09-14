import asyncio
from typing import Set, List, Dict, Any, Optional
from collections import deque
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from packages.shared.models import CrawlRun, CrawlPage, Site
from services.crawler.url_normalizer import UrlNormalizer
from services.crawler.robots_parser import RobotsParser
from services.crawler.sitemap_parser import SitemapParser
from services.crawler.safe_client import SafeHttpClient
from services.crawler.html_extractor import HtmlExtractor
from services.crawler.headless_renderer import HeadlessRenderEngine

class CrawlerService:
    def __init__(self, db: AsyncSession, crawl_run_id: str, concurrency: int = 5):
        self.db = db
        self.crawl_run_id = crawl_run_id
        self.concurrency = concurrency
        self.visited_urls: Set[str] = set()
        self.queue: deque = deque()  # stores (normalized_url, depth)
        self.robots_parser: Optional[RobotsParser] = None

    async def run(self):
        # 1. Fetch crawl run and site
        run_res = await self.db.execute(select(CrawlRun).where(CrawlRun.id == self.crawl_run_id))
        crawl_run = run_res.scalars().first()
        if not crawl_run:
            raise ValueError(f"CrawlRun {self.crawl_run_id} not found")

        site_res = await self.db.execute(select(Site).where(Site.id == crawl_run.site_id))
        site = site_res.scalars().first()
        if not site:
            raise ValueError(f"Site {crawl_run.site_id} not found")

        crawl_run.status = "RUNNING"
        await self.db.commit()

        client = SafeHttpClient(mode=crawl_run.crawl_mode)

        # 2. Fetch robots.txt
        from urllib.parse import urlparse
        parsed_primary = urlparse(site.primary_url)
        netloc = parsed_primary.netloc or site.domain
        protocol = parsed_primary.scheme or site.preferred_protocol
        robots_url = f"{protocol}://{netloc}/robots.txt"
        try:
            robots_resp = await client.fetch(robots_url)
            if robots_resp.status_code == 200:
                self.robots_parser = RobotsParser(robots_resp.text)
            else:
                self.robots_parser = RobotsParser("")
        except Exception:
            self.robots_parser = RobotsParser("")

        # 3. Initialize seed URLs (homepage)
        start_url = UrlNormalizer.normalize(site.primary_url)
        self.queue.append((start_url, 0))
        self.visited_urls.add(start_url)

        # 4. Discover and seed URLs from Sitemap(s)
        sitemap_targets = list(self.robots_parser.sitemaps) if self.robots_parser else []
        default_sitemap = f"{protocol}://{netloc}/sitemap.xml"
        if default_sitemap not in sitemap_targets:
            sitemap_targets.append(default_sitemap)

        for sm_url in sitemap_targets[:5]:
            try:
                sm_resp = await client.fetch(sm_url)
                if sm_resp.status_code == 200:
                    sm_result = SitemapParser.parse_xml(sm_resp.text)
                    if sm_result.is_valid:
                        # If index sitemap, parse up to 5 sub-sitemaps
                        if sm_result.is_index:
                            for sub_url in sm_result.sitemap_indices[:5]:
                                try:
                                    sub_resp = await client.fetch(sub_url)
                                    if sub_resp.status_code == 200:
                                        sub_res = SitemapParser.parse_xml(sub_resp.text)
                                        if sub_res.is_valid and not sub_res.is_index:
                                            for sm_item in sub_res.urls:
                                                try:
                                                    norm_sm = UrlNormalizer.normalize(sm_item.loc)
                                                    if norm_sm not in self.visited_urls:
                                                        self.visited_urls.add(norm_sm)
                                                        self.queue.append((norm_sm, 1))
                                                except Exception:
                                                    pass
                                except Exception:
                                    pass
                        else:
                            for sm_item in sm_result.urls:
                                try:
                                    norm_sm = UrlNormalizer.normalize(sm_item.loc)
                                    if norm_sm not in self.visited_urls:
                                        self.visited_urls.add(norm_sm)
                                        self.queue.append((norm_sm, 1))
                                except Exception:
                                    pass
            except Exception:
                pass

        pages_crawled = 0
        errors_count = 0
        lock = asyncio.Lock()
        semaphore = asyncio.Semaphore(self.concurrency)

        async def process_url(current_url: str, depth: int):
            nonlocal pages_crawled, errors_count
            async with semaphore:
                # Respect robots.txt in Googlebot simulation mode
                is_google_allowed = self.robots_parser.is_allowed(current_url, "Googlebot") if self.robots_parser else True
                if crawl_run.crawl_mode == "GOOGLEBOT_SIMULATION" and not is_google_allowed:
                    # Record page as blocked by robots.txt without fetching content or parsing links
                    page = CrawlPage(
                        crawl_run_id=crawl_run.id,
                        site_id=site.id,
                        url=current_url,
                        normalized_url=UrlNormalizer.normalize(current_url),
                        depth=depth,
                        status_code=0,
                        content_type=None,
                        response_time_ms=0,
                        is_fetchable=False,
                        is_crawlable_by_google=False,
                        has_noindex=False,
                        is_indexable_candidate=False,
                        is_canonical=True
                    )
                    async with lock:
                        self.db.add(page)
                        pages_crawled += 1
                    return

                try:
                    resp = await client.fetch(current_url)
                except Exception:
                    async with lock:
                        errors_count += 1
                    return

                # If redirected to a new URL on the same site, record the final URL as visited to prevent duplicate crawling
                if resp.final_url and resp.final_url != current_url:
                    try:
                        norm_final = UrlNormalizer.normalize(resp.final_url)
                        self.visited_urls.add(norm_final)
                    except Exception:
                        pass

                html_to_parse = resp.text
                # Optional headless render for SPAs if dynamic content detected
                if resp.status_code == 200 and crawl_run.crawl_mode in ("GOOGLEBOT_SIMULATION", "RENDER_JS"):
                    try:
                        spa_profile = HeadlessRenderEngine.detect_spa_profile(resp.text)
                        if spa_profile.is_spa:
                            rendered_html, _, _ = await HeadlessRenderEngine.render_and_reconcile(current_url, resp.text)
                            html_to_parse = rendered_html
                    except Exception:
                        pass

                extracted = HtmlExtractor.extract(html_to_parse, resp.final_url) if resp.status_code == 200 else None

                # Create CrawlPage record
                is_indexable = (
                    resp.status_code == 200 and
                    (extracted is not None and not extracted.has_noindex)
                )

                page = CrawlPage(
                    crawl_run_id=crawl_run.id,
                    site_id=site.id,
                    url=current_url,
                    normalized_url=UrlNormalizer.normalize(current_url),
                    depth=depth,
                    status_code=resp.status_code,
                    content_type=resp.headers.get("content-type"),
                    response_time_ms=resp.response_time_ms,
                    is_fetchable=(resp.status_code < 400),
                    is_crawlable_by_google=is_google_allowed,
                    has_noindex=extracted.has_noindex if extracted else False,
                    is_indexable_candidate=is_indexable,
                    canonical_target=extracted.canonical_url if extracted else None,
                    is_canonical=(extracted.canonical_url == current_url) if (extracted and extracted.canonical_url) else True,
                    title=extracted.title if extracted else None,
                    meta_description=extracted.meta_description if extracted else None,
                    word_count=extracted.word_count if extracted else 0,
                    raw_html_hash=extracted.raw_html_hash if extracted else None,
                    main_content_hash=extracted.main_content_hash if extracted else None,
                    canonical_seo_hash=extracted.canonical_seo_hash if extracted else None
                )

                async with lock:
                    self.db.add(page)
                    pages_crawled += 1

                    # Discover internal links if depth permits
                    if extracted and depth < crawl_run.max_depth:
                        for link in extracted.links:
                            if link.is_internal:
                                norm_link = UrlNormalizer.normalize(link.href)
                                if norm_link not in self.visited_urls:
                                    self.visited_urls.add(norm_link)
                                    self.queue.append((norm_link, depth + 1))

                    # Commit batch periodically
                    if pages_crawled % 20 == 0:
                        await self.db.commit()

        # 5. Concurrent BFS Crawl Loop
        while self.queue and pages_crawled < crawl_run.max_pages:
            batch = []
            while self.queue and len(batch) < self.concurrency and (pages_crawled + len(batch)) < crawl_run.max_pages:
                batch.append(self.queue.popleft())

            if not batch:
                break

            await asyncio.gather(*[process_url(u, d) for u, d in batch])

        # Finalize crawl run status
        crawl_run.status = "COMPLETED"
        crawl_run.total_urls_discovered = len(self.visited_urls)
        crawl_run.total_urls_crawled = pages_crawled
        crawl_run.total_errors = errors_count
        await self.db.commit()
