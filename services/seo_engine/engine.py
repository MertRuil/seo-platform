from typing import List, Dict, Any, Optional
from services.seo_engine.base import SeoRule, RuleCheckResult
from services.crawler.url_normalizer import UrlNormalizer
from services.seo_engine.rules.rules_impl import (
    CanonicalTo404Rule,
    CanonicalToRedirectRule,
    CanonicalLoopRule,
    NoindexBlockedByRobotsRule,
    Server5xxErrorRule,
    Client4xxErrorRule,
    TemporaryRedirect302Rule,
    RedirectChainRule,
    RedirectLoopRule,
    TitleMissingRule,
    TitleEmptyRule,
    MultipleTitlesOnPageRule,
    DuplicateTitleRule,
    MetaDescriptionMissingRule,
    MultipleMetaDescriptionsOnPageRule,
    DuplicateMetaDescriptionRule,
    H1MissingRule,
    MultipleH1Rule,
    DuplicateH1Rule,
    ThinContentRule,
    SchemaSyntaxErrorRule,
    SitemapPage404Rule,
    SitemapPageRedirectRule,
    SitemapPageNoindexRule,
    IndexablePageNotInSitemapRule,
    SitemapPageBlockedByRobotsRule,
    SitemapPageNonCanonicalRule,
    SitemapPage5xxRule,
    InternalLinkTo404Rule,
    InternalLinkTo5xxRule,
    InternalLinkToRedirectRule,
    InternalLinkEmptyHrefRule,
    InternalLinkOrphanRule,
    MobileViewportMissingRule,
    MobileViewportInvalidRule,
    MobileViewportZoomRestrictedRule,
    MobileDesktopParityMismatchRule,
    MobileDynamicServingMissingVaryRule,
    MobileSeparateUrlMissingCanonicalRule
)

class SeoRuleEngine:
    def __init__(self):
        self.rules: List[SeoRule] = [
            CanonicalTo404Rule(),
            CanonicalToRedirectRule(),
            CanonicalLoopRule(),
            NoindexBlockedByRobotsRule(),
            Server5xxErrorRule(),
            Client4xxErrorRule(),
            TemporaryRedirect302Rule(),
            RedirectChainRule(),
            RedirectLoopRule(),
            TitleMissingRule(),
            TitleEmptyRule(),
            MultipleTitlesOnPageRule(),
            DuplicateTitleRule(),
            MetaDescriptionMissingRule(),
            MultipleMetaDescriptionsOnPageRule(),
            DuplicateMetaDescriptionRule(),
            H1MissingRule(),
            MultipleH1Rule(),
            DuplicateH1Rule(),
            ThinContentRule(),
            SchemaSyntaxErrorRule(),
            SitemapPage404Rule(),
            SitemapPageRedirectRule(),
            SitemapPageNoindexRule(),
            IndexablePageNotInSitemapRule(),
            SitemapPageBlockedByRobotsRule(),
            SitemapPageNonCanonicalRule(),
            SitemapPage5xxRule(),
            InternalLinkTo404Rule(),
            InternalLinkTo5xxRule(),
            InternalLinkToRedirectRule(),
            InternalLinkEmptyHrefRule(),
            InternalLinkOrphanRule(),
            MobileViewportMissingRule(),
            MobileViewportInvalidRule(),
            MobileViewportZoomRestrictedRule(),
            MobileDesktopParityMismatchRule(),
            MobileDynamicServingMissingVaryRule(),
            MobileSeparateUrlMissingCanonicalRule(),
        ]

    def register_rule(self, rule: SeoRule):
        self.rules.append(rule)

    def evaluate_page(self, page_context: Dict[str, Any], site_context: Optional[Dict[str, Any]] = None) -> List[RuleCheckResult]:
        """Evaluates all registered deterministic rules against a single page context."""
        issues: List[RuleCheckResult] = []
        for rule in self.rules:
            try:
                res = rule.check(page_context, site_context)
                if res and not res.passed:
                    issues.append(res)
            except Exception as e:
                # Rule execution should not crash the engine
                continue
        return issues

    def evaluate_site(self, pages: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Evaluates a complete crawl dataset. Builds global site index (pages by URL)
        to detect cross-page anomalies like canonical loops, duplicate titles, duplicate H1s,
        duplicate meta descriptions, and 404 targets.
        """
        pages_by_url = {p["url"]: p for p in pages if "url" in p}
        pages_by_norm: Dict[str, Dict[str, Any]] = {}
        for p in pages:
            u = p.get("url")
            if u:
                pages_by_norm[u] = p
                pages_by_norm[u.rstrip("/")] = p
                try:
                    pages_by_norm[UrlNormalizer.normalize(u)] = p
                except Exception:
                    pass

        has_sitemap = any(p.get("in_sitemap") for p in pages)

        # Build duplicate indexes for 200 OK indexable/canonical pages
        titles_index: Dict[str, List[str]] = {}
        h1_index: Dict[str, List[str]] = {}
        meta_desc_index: Dict[str, List[str]] = {}

        for p in pages:
            if p.get("status_code", 200) != 200 or p.get("has_noindex") or p.get("is_canonical") is False:
                continue
            url = p.get("url", "")
            if not url:
                continue

            # Title
            t = p.get("title")
            if t and str(t).strip():
                norm_t = " ".join(str(t).split()).strip().lower()
                titles_index.setdefault(norm_t, []).append(url)

            # H1
            h_list = p.get("headings", {}).get("h1", []) if isinstance(p.get("headings"), dict) else []
            if not h_list and p.get("h1"):
                h_list = [p["h1"]]
            for h_item in h_list:
                if h_item and str(h_item).strip():
                    norm_h = " ".join(str(h_item).split()).strip().lower()
                    if url not in h1_index.setdefault(norm_h, []):
                        h1_index[norm_h].append(url)

            # Meta Description
            m = p.get("meta_description")
            if m and str(m).strip():
                norm_m = " ".join(str(m).split()).strip().lower()
                meta_desc_index.setdefault(norm_m, []).append(url)

        # Root URL detection
        root_url = None
        for p in pages:
            if p.get("depth") == 0 and p.get("url"):
                root_url = p["url"]
                break
        if not root_url:
            from urllib.parse import urlparse
            for p in pages:
                u = p.get("url")
                if u and urlparse(u).path in ("", "/"):
                    root_url = u
                    break
        if not root_url and pages:
            valid_urls = [p["url"] for p in pages if p.get("url")]
            if valid_urls:
                root_url = min(valid_urls, key=len)

        # Check if site crawl provided internal links data
        has_links_data = any(("internal_links" in p or "links" in p) for p in pages)

        def _is_same(u1: str, u2: str) -> bool:
            if not u1 or not u2:
                return False
            if u1 == u2 or u1.rstrip("/") == u2.rstrip("/"):
                return True
            try:
                return UrlNormalizer.normalize(u1) == UrlNormalizer.normalize(u2)
            except Exception:
                return False

        incoming_links_map: Dict[str, Set[str]] = {p["url"]: set() for p in pages if "url" in p}
        incoming_links_by_norm: Dict[str, Set[str]] = {}

        if has_links_data and len(pages) > 1:
            for p in pages:
                source_url = p.get("url")
                if not source_url:
                    continue
                raw_links = p.get("internal_links") or p.get("links") or []
                for l in raw_links:
                    href = (l.get("href") if isinstance(l, dict) else getattr(l, "href", None)) if l else None
                    if not href:
                        continue
                    is_internal = l.get("is_internal", True) if isinstance(l, dict) else getattr(l, "is_internal", True)
                    if not is_internal:
                        continue

                    if _is_same(source_url, href):
                        continue

                    target_page = pages_by_url.get(href) or pages_by_norm.get(href.rstrip("/")) or pages_by_norm.get(href)
                    target_canon_url = target_page.get("url") if target_page else href
                    incoming_links_map.setdefault(target_canon_url, set()).add(source_url)
                    incoming_links_by_norm.setdefault(target_canon_url.rstrip("/"), set()).add(source_url)

        orphan_pages: Set[str] = set()
        incoming_links_count: Dict[str, int] = {}

        if has_links_data and len(pages) > 1:
            for p in pages:
                u = p.get("url")
                if not u:
                    continue
                if root_url and _is_same(u, root_url):
                    continue
                if p.get("status_code", 200) != 200:
                    continue
                if p.get("has_noindex") or p.get("is_canonical") is False:
                    continue

                in_links = incoming_links_map.get(u) or incoming_links_by_norm.get(u.rstrip("/")) or set()
                count = len(in_links)
                incoming_links_count[u] = count
                incoming_links_count[u.rstrip("/")] = count
                if count == 0:
                    orphan_pages.add(u)
                    orphan_pages.add(u.rstrip("/"))

        site_context = {
            "pages_by_url": pages_by_url,
            "pages_by_norm": pages_by_norm,
            "has_sitemap": has_sitemap,
            "titles_index": titles_index,
            "h1_index": h1_index,
            "meta_desc_index": meta_desc_index,
            "root_url": root_url,
            "has_links_data": has_links_data,
            "orphan_pages": orphan_pages,
            "incoming_links_count": incoming_links_count
        }

        all_issues: List[RuleCheckResult] = []
        issues_by_page: Dict[str, List[RuleCheckResult]] = {}

        for page in pages:
            url = page.get("url", "unknown")
            page_issues = self.evaluate_page(page, site_context)
            if page_issues:
                issues_by_page[url] = page_issues
                all_issues.extend(page_issues)

        # Calculate deterministic health score (0 - 100)
        # Deductions: CRITICAL: -15, HIGH: -8, MEDIUM: -4, LOW: -1
        deductions = 0
        for issue in all_issues:
            if issue.severity == "CRITICAL":
                deductions += 15
            elif issue.severity == "HIGH":
                deductions += 8
            elif issue.severity == "MEDIUM":
                deductions += 4
            elif issue.severity == "LOW":
                deductions += 1

        health_score = max(0, 100 - deductions)

        # Sitemap vs Indexable Pages Reconciliation Stats
        sitemap_urls_count = sum(1 for p in pages if p.get("in_sitemap"))
        indexable_pages_count = sum(
            1 for p in pages
            if p.get("status_code", 200) == 200
            and not p.get("has_noindex")
            and p.get("is_canonical", True)
            and p.get("is_crawlable_by_google", True)
        )
        indexable_in_sitemap = sum(
            1 for p in pages
            if p.get("in_sitemap")
            and p.get("status_code", 200) == 200
            and not p.get("has_noindex")
            and p.get("is_canonical", True)
            and p.get("is_crawlable_by_google", True)
        )
        non_indexable_in_sitemap = sum(
            1 for p in pages
            if p.get("in_sitemap")
            and (
                p.get("status_code", 200) != 200
                or p.get("has_noindex")
                or not p.get("is_canonical", True)
                or not p.get("is_crawlable_by_google", True)
            )
        )
        indexable_not_in_sitemap = sum(
            1 for p in pages
            if not p.get("in_sitemap")
            and p.get("status_code", 200) == 200
            and not p.get("has_noindex")
            and p.get("is_canonical", True)
            and p.get("is_crawlable_by_google", True)
        )

        sitemap_reconciliation = {
            "has_sitemap": has_sitemap,
            "total_sitemap_urls": sitemap_urls_count,
            "total_indexable_pages": indexable_pages_count,
            "indexable_in_sitemap": indexable_in_sitemap,
            "non_indexable_in_sitemap": non_indexable_in_sitemap,
            "indexable_not_in_sitemap": indexable_not_in_sitemap,
            "sitemap_coverage_percent": round((indexable_in_sitemap / indexable_pages_count * 100), 1) if indexable_pages_count > 0 else (100.0 if not has_sitemap else 0.0),
            "sitemap_cleanliness_percent": round((indexable_in_sitemap / sitemap_urls_count * 100), 1) if sitemap_urls_count > 0 else 100.0,
        }

        duplicate_stats = {
            "duplicate_titles_count": sum(len(urls) for urls in titles_index.values() if len(urls) > 1),
            "duplicate_h1s_count": sum(len(urls) for urls in h1_index.values() if len(urls) > 1),
            "duplicate_meta_descs_count": sum(len(urls) for urls in meta_desc_index.values() if len(urls) > 1),
        }

        total_internal_links = 0
        broken_404_count = 0
        broken_5xx_count = 0
        redirect_links_count = 0

        for p in pages:
            raw_links = p.get("internal_links") or p.get("links") or []
            for l in raw_links:
                href = (l.get("href") if isinstance(l, dict) else getattr(l, "href", None)) if l else None
                if not href:
                    continue
                is_internal = l.get("is_internal", True) if isinstance(l, dict) else getattr(l, "is_internal", True)
                if not is_internal:
                    continue
                total_internal_links += 1
                tp = pages_by_url.get(href) or pages_by_norm.get(href.rstrip("/")) or pages_by_norm.get(href)
                if tp:
                    sc = tp.get("status_code", 200)
                    if sc in (404, 410) or (400 <= sc < 500):
                        broken_404_count += 1
                    elif sc >= 500:
                        broken_5xx_count += 1
                    elif sc in (301, 302, 303, 307, 308):
                        redirect_links_count += 1

        broken_links_stats = {
            "total_internal_links": total_internal_links,
            "broken_internal_links_404_count": broken_404_count,
            "broken_internal_links_5xx_count": broken_5xx_count,
            "redirecting_internal_links_count": redirect_links_count
        }

        orphan_stats = {
            "total_orphan_pages_count": len([p for p in pages if p.get("url") in orphan_pages]),
            "orphan_urls": [p.get("url") for p in pages if p.get("url") in orphan_pages]
        }

        # Mobile-First Indexing & Viewport Statistics
        pages_with_mobile_context = [p for p in pages if p.get("status_code", 200) == 200 and not p.get("has_noindex")]
        pages_with_valid_viewport = sum(
            1 for p in pages_with_mobile_context
            if p.get("viewport") and ("device-width" in str(p.get("viewport")).lower() or "initial-scale" in str(p.get("viewport")).lower())
            and not p.get("has_fixed_viewport_width")
        )
        pages_missing_viewport = sum(
            1 for p in pages_with_mobile_context
            if ("viewport" in p and not p.get("viewport"))
        )
        pages_zoom_restricted = sum(
            1 for p in pages_with_mobile_context
            if p.get("prevents_user_scalable") or any(r in str(p.get("viewport", "")).lower() for r in ["user-scalable=no", "user-scalable=0", "maximum-scale=1"])
        )
        total_checked = len(pages_with_mobile_context)
        mobile_friendly_percent = round((pages_with_valid_viewport / total_checked * 100), 1) if total_checked > 0 else 100.0

        mobile_stats = {
            "total_pages_checked": total_checked,
            "pages_with_valid_viewport": pages_with_valid_viewport,
            "pages_missing_viewport": pages_missing_viewport,
            "pages_zoom_restricted": pages_zoom_restricted,
            "mobile_friendly_percent": mobile_friendly_percent
        }

        return {
            "total_pages_evaluated": len(pages),
            "total_issues_found": len(all_issues),
            "health_score": health_score,
            "issues": all_issues,
            "issues_by_page": issues_by_page,
            "sitemap_reconciliation": sitemap_reconciliation,
            "duplicate_stats": duplicate_stats,
            "broken_links_stats": broken_links_stats,
            "orphan_stats": orphan_stats,
            "mobile_stats": mobile_stats
        }
