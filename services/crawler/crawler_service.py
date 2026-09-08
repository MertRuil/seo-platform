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

class CrawlerService:
    def __init__(self, db: AsyncSession, crawl_run_id: str):
        self.db = db
        self.crawl_run_id = crawl_run_id
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
        robots_url = f"{site.preferred_protocol}://{site.domain}/robots.txt"
        try:
            robots_resp = await client.fetch(robots_url)
            if robots_resp.status_code == 200:
                self.robots_parser = RobotsParser(robots_resp.text)
            else:
                self.robots_parser = RobotsParser("")
        except Exception:
            self.robots_parser = RobotsParser("")

        # 3. Initialize seed URLs (homepage + sitemaps if any)
        start_url = UrlNormalizer.normalize(site.primary_url)
        self.queue.append((start_url, 0))
        self.visited_urls.add(start_url)

        pages_crawled = 0
        errors_count = 0

        # 4. BFS Crawl Loop
        while self.queue and pages_crawled < crawl_run.max_pages:
            current_url, depth = self.queue.popleft()

            # Respect robots.txt in Googlebot simulation mode
            if crawl_run.crawl_mode == "GOOGLEBOT_SIMULATION":
                if self.robots_parser and not self.robots_parser.is_allowed(current_url, "Googlebot"):
                    continue

            try:
                resp = await client.fetch(current_url)
            except Exception as e:
                errors_count += 1
                continue

            extracted = HtmlExtractor.extract(resp.text, resp.final_url) if resp.status_code == 200 else None

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
                is_crawlable_by_google=True,
                has_noindex=extracted.has_noindex if extracted else False,
                is_indexable_candidate=is_indexable,
                canonical_target=extracted.canonical_url if extracted else None,
                is_canonical=(extracted.canonical_url == current_url) if (extracted and extracted.canonical_url) else True,
                title=extracted.title if extracted else None,
                meta_description=extracted.meta_description if extracted else None,
                word_count=extracted.word_count if extracted else 0,
                raw_html_hash=extracted.raw_html_hash if extracted else None,
                main_content_hash=extracted.main_content_hash if extracted else None
            )
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

        # Finalize crawl run status
        crawl_run.status = "COMPLETED"
        crawl_run.total_urls_crawled = pages_crawled
        crawl_run.total_errors = errors_count
        await self.db.commit()
