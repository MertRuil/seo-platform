import hashlib
import json
import re
from typing import Dict, Any, List, Optional
from selectolax.parser import HTMLParser
from services.crawler.url_normalizer import UrlNormalizer

class ExtractedLink:
    def __init__(self, href: str, anchor_text: str, rel: str, is_internal: bool):
        self.href = href
        self.anchor_text = anchor_text
        self.rel = rel
        self.is_internal = is_internal

class ExtractedImage:
    def __init__(self, src: str, alt: str, loading: Optional[str] = None, width: Optional[str] = None, height: Optional[str] = None):
        self.src = src
        self.alt = alt
        self.loading = loading
        self.width = width
        self.height = height

def compute_canonical_seo_hash(
    title: Optional[str] = None,
    canonical_url: Optional[str] = None,
    meta_description: Optional[str] = None,
    meta_robots: Optional[List[str]] = None
) -> str:
    """
    Computes a deterministic, normalized hash representing the canonical SEO state of a page.
    Unlike raw HTML SHA-256 hashes, this ignores nonces, timestamps, CSRF tokens, session IDs,
    and dynamic script variations to provide robust optimistic concurrency control.
    """
    norm_title = (title or "").strip()
    norm_canonical = (canonical_url or "").strip().rstrip("/")
    norm_desc = (meta_description or "").strip()
    clean_robots = sorted(set(d.strip().lower() for d in (meta_robots or []) if d.strip()))
    robots_str = ",".join(clean_robots)
    canonical_repr = f"title:{norm_title}|canonical:{norm_canonical}|desc:{norm_desc}|robots:{robots_str}"
    return hashlib.sha256(canonical_repr.encode("utf-8")).hexdigest()

class HtmlExtractionResult:
    def __init__(self):
        self.title: Optional[str] = None
        self.meta_description: Optional[str] = None
        self.meta_robots: List[str] = []
        self.has_noindex: bool = False
        self.has_nofollow: bool = False
        self.canonical_url: Optional[str] = None
        self.hreflangs: List[Dict[str, str]] = []
        self.headings: Dict[str, List[str]] = {f"h{i}": [] for i in range(1, 7)}
        self.links: List[ExtractedLink] = []
        self.images: List[ExtractedImage] = []
        self.structured_data: List[Dict[str, Any]] = []
        self.raw_json_ld: List[str] = []
        self.schema_syntax_errors: List[str] = []
        self.main_content_text: str = ""
        self.word_count: int = 0
        self.raw_html_hash: str = ""
        self.main_content_hash: str = ""
        self.canonical_seo_hash: str = ""

class HtmlExtractor:
    @staticmethod
    def extract(html_content: str, base_url: str) -> HtmlExtractionResult:
        result = HtmlExtractionResult()
        clean_html = html_content.strip()
        result.raw_html_hash = hashlib.sha256(clean_html.encode("utf-8")).hexdigest()

        if not clean_html:
            result.canonical_seo_hash = compute_canonical_seo_hash()
            return result

        tree = HTMLParser(clean_html)

        # 1. Title
        title_node = tree.css_first("title")
        if title_node and title_node.text():
            result.title = title_node.text().strip()

        # 2. Meta description & Meta robots
        for meta in tree.css("meta"):
            name = (meta.attributes.get("name") or meta.attributes.get("property") or "").lower()
            content = meta.attributes.get("content") or ""

            if name == "description":
                result.meta_description = content.strip()
            elif name in ("robots", "googlebot", "bingbot"):
                directives = [d.strip().lower() for d in content.split(",") if d.strip()]
                result.meta_robots.extend(directives)
                if "noindex" in directives or "none" in directives:
                    result.has_noindex = True
                if "nofollow" in directives or "none" in directives:
                    result.has_nofollow = True

        # 3. Base href tag support (RFC HTML standard)
        effective_base_url = base_url
        base_node = tree.css_first("base")
        if base_node and base_node.attributes.get("href"):
            raw_base = base_node.attributes.get("href", "").strip()
            if raw_base:
                resolved_base = UrlNormalizer.resolve_relative_url(base_url, raw_base)
                if resolved_base:
                    effective_base_url = resolved_base

        # 4. Canonical
        for link in tree.css("link"):
            rel = (link.attributes.get("rel") or "").lower()
            href = link.attributes.get("href")
            hreflang = link.attributes.get("hreflang")

            if "canonical" in rel and href:
                resolved_canonical = UrlNormalizer.resolve_relative_url(effective_base_url, href)
                result.canonical_url = resolved_canonical or href

            if "alternate" in rel and hreflang and href:
                resolved_alt = UrlNormalizer.resolve_relative_url(effective_base_url, href)
                result.hreflangs.append({"lang": hreflang.strip(), "href": resolved_alt or href})

        # 5. Headings (H1 - H6)
        for i in range(1, 7):
            tag = f"h{i}"
            for h in tree.css(tag):
                text = h.text()
                if text and text.strip():
                    result.headings[tag].append(text.strip())

        # 6. Links
        def _get_clean_host(u: str) -> str:
            try:
                norm = UrlNormalizer.normalize(u)
                host = norm.split("/")[2].split(":")[0].lower()
                if host.startswith("www."):
                    host = host[4:]
                return host
            except Exception:
                return ""

        base_host = _get_clean_host(base_url)
        for a in tree.css("a"):
            href = a.attributes.get("href")
            if not href:
                continue
            resolved = UrlNormalizer.resolve_relative_url(effective_base_url, href)
            if not resolved:
                continue

            anchor_text = a.text().strip() if a.text() else ""
            rel = a.attributes.get("rel") or ""
            target_host = _get_clean_host(resolved) if "://" in resolved else base_host
            is_internal = (target_host == base_host) and bool(base_host)

            result.links.append(ExtractedLink(
                href=resolved,
                anchor_text=anchor_text,
                rel=rel,
                is_internal=is_internal
            ))

        # 7. Images
        for img in tree.css("img"):
            src = img.attributes.get("src") or ""
            alt = img.attributes.get("alt")
            loading = img.attributes.get("loading")
            width = img.attributes.get("width")
            height = img.attributes.get("height")
            if src:
                resolved_src = UrlNormalizer.resolve_relative_url(effective_base_url, src) or src
                result.images.append(ExtractedImage(
                    src=resolved_src,
                    alt=alt if alt is not None else "",
                    loading=loading,
                    width=width,
                    height=height
                ))

        # 7. Structured Data (JSON-LD)
        for script in tree.css('script[type="application/ld+json"]'):
            raw_json = script.text()
            if not raw_json:
                continue
            result.raw_json_ld.append(raw_json.strip())
            try:
                parsed_json = json.loads(raw_json)
                if isinstance(parsed_json, dict):
                    result.structured_data.append(parsed_json)
                elif isinstance(parsed_json, list):
                    result.structured_data.extend(parsed_json)
            except Exception as e:
                result.schema_syntax_errors.append(f"Invalid JSON-LD syntax: {str(e)}")

        # 8. Main Body Text & Word Count (stripping scripts, styles, nav, footer)
        body = tree.css_first("body")
        if body:
            # Strip non-content nodes
            for tag in body.css("script, style, noscript, nav, footer, header"):
                tag.decompose()
            visible_text = body.text(separator=" ", strip=True)
            result.main_content_text = visible_text
            words = re.findall(r"\b\w+\b", visible_text, re.UNICODE)
            result.word_count = len(words)
            result.main_content_hash = hashlib.sha256(visible_text.encode("utf-8")).hexdigest()

        # 9. Compute Canonical SEO Concurrency Hash
        result.canonical_seo_hash = compute_canonical_seo_hash(
            title=result.title,
            canonical_url=result.canonical_url,
            meta_description=result.meta_description,
            meta_robots=result.meta_robots
        )

        return result
