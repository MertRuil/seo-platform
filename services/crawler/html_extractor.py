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

class HtmlExtractor:
    @staticmethod
    def extract(html_content: str, base_url: str) -> HtmlExtractionResult:
        result = HtmlExtractionResult()
        clean_html = html_content.strip()
        result.raw_html_hash = hashlib.sha256(clean_html.encode("utf-8")).hexdigest()

        if not clean_html:
            return result

        tree = HTMLParser(clean_html)

        # 1. Title
        title_node = tree.css_first("title")
        if title_node and title_node.text():
            result.title = title_node.text().strip()

        # 2. Meta description & Meta robots
        for meta in tree.css("meta"):
            name = (meta.attributes.get("name") or "").lower()
            content = meta.attributes.get("content") or ""

            if name == "description":
                result.meta_description = content.strip()
            elif name in ("robots", "googlebot"):
                directives = [d.strip().lower() for d in content.split(",") if d.strip()]
                result.meta_robots.extend(directives)
                if "noindex" in directives:
                    result.has_noindex = True
                if "nofollow" in directives:
                    result.has_nofollow = True

        # 3. Canonical
        for link in tree.css("link"):
            rel = (link.attributes.get("rel") or "").lower()
            href = link.attributes.get("href")
            hreflang = link.attributes.get("hreflang")

            if "canonical" in rel and href:
                resolved_canonical = UrlNormalizer.resolve_relative_url(base_url, href)
                result.canonical_url = resolved_canonical or href

            if "alternate" in rel and hreflang and href:
                resolved_alt = UrlNormalizer.resolve_relative_url(base_url, href)
                result.hreflangs.append({"lang": hreflang.strip(), "href": resolved_alt or href})

        # 4. Headings (H1 - H6)
        for i in range(1, 7):
            tag = f"h{i}"
            for h in tree.css(tag):
                text = h.text()
                if text and text.strip():
                    result.headings[tag].append(text.strip())

        # 5. Links
        base_domain = UrlNormalizer.normalize(base_url).split("/")[2]
        for a in tree.css("a"):
            href = a.attributes.get("href")
            if not href:
                continue
            resolved = UrlNormalizer.resolve_relative_url(base_url, href)
            if not resolved:
                continue

            anchor_text = a.text().strip() if a.text() else ""
            rel = a.attributes.get("rel") or ""
            target_domain = UrlNormalizer.normalize(resolved).split("/")[2] if "://" in resolved else base_domain
            is_internal = (target_domain == base_domain)

            result.links.append(ExtractedLink(
                href=resolved,
                anchor_text=anchor_text,
                rel=rel,
                is_internal=is_internal
            ))

        # 6. Images
        for img in tree.css("img"):
            src = img.attributes.get("src") or ""
            alt = img.attributes.get("alt")
            loading = img.attributes.get("loading")
            width = img.attributes.get("width")
            height = img.attributes.get("height")
            if src:
                resolved_src = UrlNormalizer.resolve_relative_url(base_url, src) or src
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

        return result
