import asyncio
import json
import re
from typing import Set, List, Dict, Any, Optional
from collections import deque
from urllib.parse import urljoin, urlparse
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
        self.sitemap_urls: Set[str] = set()
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
        visited_sitemaps = set()
        raw_sitemaps = list(self.robots_parser.sitemaps) if self.robots_parser else []
        sitemap_targets = []
        for sm in raw_sitemaps:
            full_sm = urljoin(f"{protocol}://{netloc}", sm.strip())
            if full_sm not in sitemap_targets:
                sitemap_targets.append(full_sm)

        # Fallback common sitemaps if not declared in robots.txt
        for default_sm in (f"{protocol}://{netloc}/sitemap.xml", f"{protocol}://{netloc}/sitemap_index.xml"):
            if default_sm not in sitemap_targets:
                sitemap_targets.append(default_sm)

        for sm_url in sitemap_targets[:10]:
            if sm_url in visited_sitemaps:
                continue
            visited_sitemaps.add(sm_url)
            try:
                sm_resp = await client.fetch(sm_url)
                if sm_resp.status_code == 200:
                    sm_result = SitemapParser.parse_xml(sm_resp.text, base_url=sm_url)
                    if sm_result.is_valid:
                        # If index sitemap, parse up to 50 sub-sitemaps
                        if sm_result.is_index:
                            for sub_url in sm_result.sitemap_indices[:50]:
                                full_sub = urljoin(sm_url, sub_url)
                                if full_sub in visited_sitemaps:
                                    continue
                                visited_sitemaps.add(full_sub)
                                try:
                                    sub_resp = await client.fetch(full_sub)
                                    if sub_resp.status_code == 200:
                                        sub_res = SitemapParser.parse_xml(sub_resp.text, base_url=full_sub)
                                        if sub_res.is_valid and not sub_res.is_index:
                                            for sm_item in sub_res.urls:
                                                try:
                                                    norm_sm = UrlNormalizer.normalize(sm_item.loc)
                                                    self.sitemap_urls.add(norm_sm)
                                                    self.sitemap_urls.add(sm_item.loc)
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
                                    self.sitemap_urls.add(norm_sm)
                                    self.sitemap_urls.add(sm_item.loc)
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
                try:
                    norm_current = UrlNormalizer.normalize(current_url)
                except Exception:
                    norm_current = current_url

                # Respect robots.txt in Googlebot simulation mode
                is_google_allowed = self.robots_parser.is_allowed(current_url, "Googlebot") if self.robots_parser else True
                if crawl_run.crawl_mode == "GOOGLEBOT_SIMULATION" and not is_google_allowed:
                    # Record page as blocked by robots.txt without fetching content or parsing links
                    is_in_sm = bool(norm_current in self.sitemap_urls or current_url in self.sitemap_urls)
                    page = CrawlPage(
                        crawl_run_id=crawl_run.id,
                        site_id=site.id,
                        url=current_url,
                        normalized_url=norm_current,
                        depth=depth,
                        status_code=0,
                        content_type=None,
                        response_time_ms=0,
                        is_fetchable=False,
                        is_crawlable_by_google=False,
                        has_noindex=False,
                        is_indexable_candidate=False,
                        in_sitemap=is_in_sm,
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
                norm_final = UrlNormalizer.normalize(resp.final_url) if resp.final_url else norm_current
                has_redirect = bool(resp.redirect_chain and (norm_current != norm_final or resp.is_redirect_loop))

                if has_redirect:
                    # current_url returned a 3xx redirect or redirect loop
                    initial_hop = resp.redirect_chain[0]
                    redirect_status = initial_hop.status_code
                    redirect_target = initial_hop.to_url

                    redirect_page = CrawlPage(
                        crawl_run_id=crawl_run.id,
                        site_id=site.id,
                        url=current_url,
                        normalized_url=norm_current,
                        depth=depth,
                        status_code=redirect_status,
                        content_type=resp.headers.get("content-type"),
                        response_time_ms=resp.response_time_ms,
                        is_fetchable=(not resp.is_redirect_loop),
                        is_crawlable_by_google=is_google_allowed,
                        has_noindex=False,
                        is_indexable_candidate=False,
                        canonical_target=redirect_target,
                        is_canonical=False,
                        title=None,
                        meta_description=None,
                        word_count=0,
                        raw_html_hash=None,
                        main_content_hash=None,
                        canonical_seo_hash=None
                    )
                    async with lock:
                        self.db.add(redirect_page)
                        pages_crawled += 1

                    # If circular redirect loop, record subsequent hops in the cycle and abort further crawling
                    if resp.is_redirect_loop:
                        if len(resp.redirect_chain) > 1:
                            for loop_hop in resp.redirect_chain[1:]:
                                try:
                                    hop_domain = UrlNormalizer.get_domain(loop_hop.from_url)
                                    is_hop_same_site = (hop_domain == site.normalized_domain or hop_domain.endswith("." + site.normalized_domain))
                                except Exception:
                                    is_hop_same_site = False

                                if is_hop_same_site and pages_crawled < crawl_run.max_pages:
                                    norm_hop_url = UrlNormalizer.normalize(loop_hop.from_url)
                                    if norm_hop_url not in self.visited_urls:
                                        self.visited_urls.add(norm_hop_url)
                                        cycle_page = CrawlPage(
                                            crawl_run_id=crawl_run.id,
                                            site_id=site.id,
                                            url=loop_hop.from_url,
                                            normalized_url=norm_hop_url,
                                            depth=depth + 1,
                                            status_code=loop_hop.status_code,
                                            content_type=None,
                                            response_time_ms=0,
                                            is_fetchable=False,
                                            is_crawlable_by_google=is_google_allowed,
                                            has_noindex=False,
                                            is_indexable_candidate=False,
                                            canonical_target=loop_hop.to_url,
                                            is_canonical=False,
                                            title=None,
                                            meta_description=None,
                                            word_count=0
                                        )
                                        async with lock:
                                            self.db.add(cycle_page)
                                            pages_crawled += 1
                        return

                    # Record any intermediate redirect hops in a redirect chain
                    if len(resp.redirect_chain) > 1:
                        for inter_hop in resp.redirect_chain[1:]:
                            try:
                                inter_domain = UrlNormalizer.get_domain(inter_hop.from_url)
                                is_inter_same_site = (inter_domain == site.normalized_domain or inter_domain.endswith("." + site.normalized_domain))
                            except Exception:
                                is_inter_same_site = False

                            if is_inter_same_site and pages_crawled < crawl_run.max_pages:
                                norm_inter_url = UrlNormalizer.normalize(inter_hop.from_url)
                                if norm_inter_url not in self.visited_urls:
                                    self.visited_urls.add(norm_inter_url)
                                    is_in_sm = bool(norm_inter_url in self.sitemap_urls or inter_hop.from_url in self.sitemap_urls)
                                    inter_page = CrawlPage(
                                        crawl_run_id=crawl_run.id,
                                        site_id=site.id,
                                        url=inter_hop.from_url,
                                        normalized_url=norm_inter_url,
                                        depth=depth,
                                        status_code=inter_hop.status_code,
                                        content_type=None,
                                        response_time_ms=0,
                                        is_fetchable=True,
                                        is_crawlable_by_google=True,
                                        has_noindex=False,
                                        is_indexable_candidate=False,
                                        in_sitemap=is_in_sm,
                                        canonical_target=inter_hop.to_url,
                                        is_canonical=False,
                                        title=None,
                                        meta_description=None,
                                        word_count=0
                                    )
                                    async with lock:
                                        self.db.add(inter_page)
                                        pages_crawled += 1

                    # If final destination is on the same site, process and record the destination page as well
                    try:
                        final_domain = UrlNormalizer.get_domain(resp.final_url)
                        is_same_site = (final_domain == site.normalized_domain or final_domain.endswith("." + site.normalized_domain))
                    except Exception:
                        is_same_site = False

                    if is_same_site and norm_final not in self.visited_urls and pages_crawled < crawl_run.max_pages:
                        self.visited_urls.add(norm_final)
                        final_google_allowed = self.robots_parser.is_allowed(resp.final_url, "Googlebot") if self.robots_parser else True

                        html_to_parse = resp.text
                        if resp.status_code == 200:
                            try:
                                spa_profile = HeadlessRenderEngine.detect_spa_profile(resp.text)
                                if spa_profile.is_spa:
                                    rendered_html, _, _ = await HeadlessRenderEngine.render_and_reconcile(resp.final_url, resp.text)
                                    html_to_parse = rendered_html
                            except Exception:
                                pass

                        extracted = HtmlExtractor.extract(html_to_parse, resp.final_url, response_headers=dict(resp.headers) if resp.headers else None) if resp.status_code == 200 else None
                        dest_has_noindex = (extracted.has_noindex if extracted else False)
                        dest_has_nofollow = (extracted.has_nofollow if extracted else False)
                        if resp.headers:
                            x_robots = (resp.headers.get("x-robots-tag") or "").lower()
                            if x_robots:
                                x_directives = [d.strip() for d in x_robots.split(",") if d.strip()]
                                if "noindex" in x_directives or "none" in x_directives:
                                    dest_has_noindex = True
                                if "nofollow" in x_directives or "none" in x_directives:
                                    dest_has_nofollow = True

                            if extracted and not extracted.canonical_url:
                                link_header = resp.headers.get("link", "")
                                if "canonical" in link_header.lower():
                                    match = re.search(r'<([^>]+)>;\s*rel=["\']?canonical["\']?', link_header, re.IGNORECASE)
                                    if match:
                                        extracted.canonical_url = match.group(1).strip()

                        def _is_self_canonical_dest(can_url: Optional[str], curr_url: str) -> bool:
                            if not can_url:
                                return True
                            try:
                                n_can = UrlNormalizer.normalize(can_url).rstrip("/")
                                n_curr = UrlNormalizer.normalize(curr_url).rstrip("/")
                                return n_can == n_curr
                            except Exception:
                                return can_url.rstrip("/") == curr_url.rstrip("/")

                        dest_is_self_canonical = _is_self_canonical_dest(extracted.canonical_url, resp.final_url) if (extracted and extracted.canonical_url) else True
                        dest_is_indexable = (
                            resp.status_code == 200 and
                            (extracted is not None and not dest_has_noindex)
                        )

                        is_in_sm = bool(norm_final in self.sitemap_urls or resp.final_url in self.sitemap_urls)
                        dest_page = CrawlPage(
                            crawl_run_id=crawl_run.id,
                            site_id=site.id,
                            url=resp.final_url,
                            normalized_url=norm_final,
                            depth=depth + 1,
                            status_code=resp.status_code,
                            content_type=resp.headers.get("content-type"),
                            response_time_ms=resp.response_time_ms,
                            is_fetchable=(resp.status_code < 400),
                            is_crawlable_by_google=final_google_allowed,
                            has_noindex=dest_has_noindex,
                            is_indexable_candidate=dest_is_indexable,
                            in_sitemap=is_in_sm,
                            canonical_target=extracted.canonical_url if extracted else None,
                            is_canonical=dest_is_self_canonical,
                            title=extracted.title if extracted else None,
                            meta_description=extracted.meta_description if extracted else None,
                            h1=(extracted.headings.get("h1", [None])[0] if (extracted and extracted.headings.get("h1")) else None),
                            word_count=extracted.word_count if extracted else 0,
                            raw_html_hash=extracted.raw_html_hash if extracted else None,
                            main_content_hash=extracted.main_content_hash if extracted else None,
                            canonical_seo_hash=extracted.canonical_seo_hash if extracted else None,
                            internal_links_json=(json.dumps([{"href": l.href, "anchor_text": l.anchor_text, "rel": l.rel} for l in extracted.links if l.is_internal]) if extracted else None),
                            structured_data_json=(json.dumps(extracted.structured_data) if (extracted and extracted.structured_data) else None),
                            html_lang=(extracted.html_lang if extracted else None),
                            hreflangs_json=(json.dumps(extracted.hreflangs) if (extracted and extracted.hreflangs) else None)
                        )

                        async with lock:
                            self.db.add(dest_page)
                            pages_crawled += 1

                            if extracted and (depth + 1) < crawl_run.max_depth:
                                if not (crawl_run.crawl_mode == "GOOGLEBOT_SIMULATION" and dest_has_nofollow):
                                    sorted_links = sorted(extracted.links, key=lambda l: str(l.href or ""))
                                    for link in sorted_links:
                                        if link.is_internal:
                                            link_rels = [r.lower() for r in (link.rel or "").split()]
                                            if crawl_run.crawl_mode == "GOOGLEBOT_SIMULATION" and "nofollow" in link_rels:
                                                continue
                                            norm_link = UrlNormalizer.normalize(link.href)
                                            if norm_link not in self.visited_urls:
                                                self.visited_urls.add(norm_link)
                                                self.queue.append((norm_link, depth + 2))
                    return

                # Standard non-redirect response (200, 404, 410, 500, etc.)
                html_to_parse = resp.text
                if resp.status_code == 200:
                    try:
                        spa_profile = HeadlessRenderEngine.detect_spa_profile(resp.text)
                        if spa_profile.is_spa:
                            rendered_html, _, _ = await HeadlessRenderEngine.render_and_reconcile(current_url, resp.text)
                            html_to_parse = rendered_html
                    except Exception:
                        pass

                extracted = HtmlExtractor.extract(html_to_parse, resp.final_url, response_headers=dict(resp.headers) if resp.headers else None) if resp.status_code == 200 else None

                # Detect X-Robots-Tag HTTP header and HTTP Link canonical header
                page_has_noindex = (extracted.has_noindex if extracted else False)
                page_has_nofollow = (extracted.has_nofollow if extracted else False)
                if resp.headers:
                    x_robots = (resp.headers.get("x-robots-tag") or "").lower()
                    if x_robots:
                        x_directives = [d.strip() for d in x_robots.split(",") if d.strip()]
                        if "noindex" in x_directives or "none" in x_directives:
                            page_has_noindex = True
                        if "nofollow" in x_directives or "none" in x_directives:
                            page_has_nofollow = True

                    # Fallback to Link: <...>; rel="canonical" header if canonical not in HTML
                    if extracted and not extracted.canonical_url:
                        link_header = resp.headers.get("link", "")
                        if "canonical" in link_header.lower():
                            match = re.search(r'<([^>]+)>;\s*rel=["\']?canonical["\']?', link_header, re.IGNORECASE)
                            if match:
                                extracted.canonical_url = match.group(1).strip()

                # Self-canonical comparison with trailing-slash and protocol tolerance
                def _is_self_canonical(can_url: Optional[str], curr_url: str) -> bool:
                    if not can_url:
                        return True
                    try:
                        n_can = UrlNormalizer.normalize(can_url).rstrip("/")
                        n_curr = UrlNormalizer.normalize(curr_url).rstrip("/")
                        return n_can == n_curr
                    except Exception:
                        return can_url.rstrip("/") == curr_url.rstrip("/")

                is_self_canonical = _is_self_canonical(extracted.canonical_url, current_url) if (extracted and extracted.canonical_url) else True

                # Create CrawlPage record
                is_indexable = (
                    resp.status_code == 200 and
                    (extracted is not None and not page_has_noindex)
                )

                is_in_sm = bool(norm_current in self.sitemap_urls or current_url in self.sitemap_urls)
                page = CrawlPage(
                    crawl_run_id=crawl_run.id,
                    site_id=site.id,
                    url=current_url,
                    normalized_url=norm_current,
                    depth=depth,
                    status_code=resp.status_code,
                    content_type=resp.headers.get("content-type"),
                    response_time_ms=resp.response_time_ms,
                    is_fetchable=(resp.status_code < 400),
                    is_crawlable_by_google=is_google_allowed,
                    has_noindex=page_has_noindex,
                    is_indexable_candidate=is_indexable,
                    in_sitemap=is_in_sm,
                    canonical_target=extracted.canonical_url if extracted else None,
                    is_canonical=is_self_canonical,
                    title=extracted.title if extracted else None,
                    meta_description=extracted.meta_description if extracted else None,
                    h1=(extracted.headings.get("h1", [None])[0] if (extracted and extracted.headings.get("h1")) else None),
                    word_count=extracted.word_count if extracted else 0,
                    raw_html_hash=extracted.raw_html_hash if extracted else None,
                    main_content_hash=extracted.main_content_hash if extracted else None,
                    canonical_seo_hash=extracted.canonical_seo_hash if extracted else None,
                    internal_links_json=(json.dumps([{"href": l.href, "anchor_text": l.anchor_text, "rel": l.rel} for l in extracted.links if l.is_internal]) if extracted else None),
                    structured_data_json=(json.dumps(extracted.structured_data) if (extracted and extracted.structured_data) else None),
                    html_lang=(extracted.html_lang if extracted else None),
                    hreflangs_json=(json.dumps(extracted.hreflangs) if (extracted and extracted.hreflangs) else None)
                )

                async with lock:
                    self.db.add(page)
                    pages_crawled += 1

                    # Discover internal links if depth permits and page is not nofollow
                    if extracted and depth < crawl_run.max_depth:
                        if not (crawl_run.crawl_mode == "GOOGLEBOT_SIMULATION" and page_has_nofollow):
                            sorted_links = sorted(extracted.links, key=lambda l: str(l.href or ""))
                            for link in sorted_links:
                                if link.is_internal:
                                    # In Googlebot simulation, respect rel="nofollow"
                                    link_rels = [r.lower() for r in (link.rel or "").split()]
                                    if crawl_run.crawl_mode == "GOOGLEBOT_SIMULATION" and "nofollow" in link_rels:
                                        continue
                                    norm_link = UrlNormalizer.normalize(link.href)
                                    if norm_link not in self.visited_urls:
                                        self.visited_urls.add(norm_link)
                                        self.queue.append((norm_link, depth + 1))

                    # Commit batch periodically
                    if pages_crawled % 20 == 0:
                        await self.db.commit()

        # 5. Concurrent BFS Crawl Loop with Deterministic Queue Ordering
        while self.queue and pages_crawled < crawl_run.max_pages:
            # Sort pending queue deterministically by (depth, normalized_url)
            self.queue = deque(sorted(self.queue, key=lambda x: (x[1], str(x[0]))))

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
