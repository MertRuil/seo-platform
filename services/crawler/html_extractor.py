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

def _clean_json_ld(raw_text: str) -> str:
    """
    Strips CDATA wrappers, HTML comments, and trailing commas from CMS JSON-LD payloads.
    """
    cleaned = raw_text.strip()
    if cleaned.startswith("<!--"):
        cleaned = re.sub(r"^<!--", "", cleaned)
    if cleaned.endswith("-->"):
        cleaned = re.sub(r"-->$", "", cleaned)
    cleaned = re.sub(r"/\*\s*<!\[CDATA\[\s*\*/", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"/\*\s*\]\]>\s*\*/", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"//\s*<!\[CDATA\[", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"//\s*\]\]>", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r",\s*([\]}])", r"\1", cleaned)
    return cleaned.strip()

class HtmlExtractionResult:
    def __init__(self):
        self.title: Optional[str] = None
        self.all_titles: List[str] = []
        self.meta_description: Optional[str] = None
        self.all_meta_descriptions: List[str] = []
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
        self.schema_types: List[str] = []
        self.microdata: List[Dict[str, Any]] = []
        self.main_content_text: str = ""
        self.word_count: int = 0
        self.raw_html_hash: str = ""
        self.main_content_hash: str = ""
        self.canonical_seo_hash: str = ""
        self.viewport: Optional[str] = None
        self.is_responsive_viewport: bool = False
        self.has_fixed_viewport_width: bool = False
        self.prevents_user_scalable: bool = False
        self.mobile_alternate_url: Optional[str] = None
        self.has_vary_user_agent: bool = False

class HtmlExtractor:
    @staticmethod
    def extract(html_content: str, base_url: str, response_headers: Optional[Dict[str, str]] = None) -> HtmlExtractionResult:
        result = HtmlExtractionResult()
        clean_html = html_content.strip()
        result.raw_html_hash = hashlib.sha256(clean_html.encode("utf-8")).hexdigest()

        if response_headers:
            vary_header = response_headers.get("vary") or response_headers.get("Vary") or ""
            if "user-agent" in vary_header.lower():
                result.has_vary_user_agent = True

        if not clean_html:
            result.canonical_seo_hash = compute_canonical_seo_hash()
            return result

        tree = HTMLParser(clean_html)

        # 1. Title (Capture primary and all title elements)
        for tn in tree.css("title"):
            t_text = tn.text()
            if t_text and t_text.strip():
                result.all_titles.append(t_text.strip())
        if result.all_titles:
            result.title = result.all_titles[0]

        # 2. Meta description, Meta robots, Viewport & Vary
        for meta in tree.css("meta"):
            name = (meta.attributes.get("name") or meta.attributes.get("property") or meta.attributes.get("http-equiv") or "").lower()
            content = meta.attributes.get("content") or ""

            if name == "description":
                desc_val = content.strip()
                if desc_val:
                    result.all_meta_descriptions.append(desc_val)
                    if not result.meta_description:
                        result.meta_description = desc_val
            elif name in ("robots", "googlebot", "bingbot"):
                directives = [d.strip().lower() for d in content.split(",") if d.strip()]
                result.meta_robots.extend(directives)
                if "noindex" in directives or "none" in directives:
                    result.has_noindex = True
                if "nofollow" in directives or "none" in directives:
                    result.has_nofollow = True
            elif name == "viewport":
                vp_val = content.strip()
                if vp_val:
                    result.viewport = vp_val
                    vp_lower = vp_val.lower()
                    if "width=device-width" in vp_lower or "initial-scale" in vp_lower:
                        result.is_responsive_viewport = True
                    width_match = re.search(r"width\s*=\s*(\d+)", vp_lower)
                    if width_match and "device-width" not in vp_lower:
                        result.has_fixed_viewport_width = True
                    if (
                        "user-scalable=no" in vp_lower
                        or "user-scalable=0" in vp_lower
                        or "maximum-scale=1.0" in vp_lower
                        or "maximum-scale=1" in vp_lower
                    ):
                        result.prevents_user_scalable = True
            elif name == "vary":
                if "user-agent" in content.lower():
                    result.has_vary_user_agent = True

        # 3. Base href tag support (RFC HTML standard)
        effective_base_url = base_url
        base_node = tree.css_first("base")
        if base_node and base_node.attributes.get("href"):
            raw_base = base_node.attributes.get("href", "").strip()
            if raw_base:
                resolved_base = UrlNormalizer.resolve_relative_url(base_url, raw_base)
                if resolved_base:
                    effective_base_url = resolved_base

        # 4. Canonical & Alternate links (including mobile m-dot alternates)
        for link in tree.css("link"):
            rel = (link.attributes.get("rel") or "").lower()
            href = link.attributes.get("href")
            hreflang = link.attributes.get("hreflang")
            media = (link.attributes.get("media") or "").lower()

            if "canonical" in rel and href:
                resolved_canonical = UrlNormalizer.resolve_relative_url(effective_base_url, href)
                result.canonical_url = resolved_canonical or href

            if "alternate" in rel and href:
                if hreflang:
                    resolved_alt = UrlNormalizer.resolve_relative_url(effective_base_url, href)
                    result.hreflangs.append({"lang": hreflang.strip(), "href": resolved_alt or href})
                if "max-width" in media or "handheld" in media or "mobile" in media:
                    resolved_mob = UrlNormalizer.resolve_relative_url(effective_base_url, href)
                    result.mobile_alternate_url = resolved_mob or href

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

        # 7. Structured Data (JSON-LD, HTML5 Microdata, and RDFa)
        # 7a. JSON-LD scripts (case-insensitive, charset-tolerant, CDATA/comment-cleaned, and @graph unpacked)
        for script in tree.css("script"):
            s_type = (script.attributes.get("type") or "").strip().lower()
            if "application/ld+json" not in s_type:
                continue

            raw_text = script.text()
            if not raw_text or not raw_text.strip():
                continue

            raw_clean = raw_text.strip()
            result.raw_json_ld.append(raw_clean)

            parsed_json = None
            try:
                parsed_json = json.loads(raw_clean)
            except Exception:
                try:
                    cleaned_str = _clean_json_ld(raw_clean)
                    parsed_json = json.loads(cleaned_str)
                except Exception as e:
                    result.schema_syntax_errors.append(f"Invalid JSON-LD syntax: {str(e)}")

            if parsed_json is not None:
                items_to_process = []
                if isinstance(parsed_json, dict):
                    result.structured_data.append(parsed_json)
                    items_to_process.append(parsed_json)
                    graph = parsed_json.get("@graph")
                    if isinstance(graph, list):
                        items_to_process.extend(graph)
                elif isinstance(parsed_json, list):
                    result.structured_data.extend(parsed_json)
                    items_to_process.extend(parsed_json)

                for item in items_to_process:
                    if isinstance(item, dict):
                        stype = item.get("@type")
                        if stype:
                            if isinstance(stype, list):
                                for st in stype:
                                    if st and str(st) not in result.schema_types:
                                        result.schema_types.append(str(st))
                            elif str(stype) not in result.schema_types:
                                result.schema_types.append(str(stype))

        # 7b. HTML5 Microdata (itemscope, itemtype, itemprop)
        for item_node in tree.css("[itemscope]"):
            item_type_raw = item_node.attributes.get("itemtype") or ""
            type_name = item_type_raw.rstrip("/").split("/")[-1] if item_type_raw else "Item"
            props: Dict[str, Any] = {"@type": type_name, "@context": "https://schema.org"}
            if item_type_raw:
                props["itemtype"] = item_type_raw

            for prop_node in item_node.css("[itemprop]"):
                prop_name = prop_node.attributes.get("itemprop")
                if not prop_name:
                    continue
                val = (
                    prop_node.attributes.get("content")
                    or prop_node.attributes.get("href")
                    or prop_node.attributes.get("src")
                    or (prop_node.text().strip() if prop_node.text() else "")
                )
                if val:
                    props[prop_name] = val

            if type_name and type_name != "Item" and type_name not in result.schema_types:
                result.schema_types.append(type_name)

            result.microdata.append(props)
            result.structured_data.append(props)

        # 7c. RDFa (vocab and typeof)
        for rdfa_node in tree.css("[typeof]"):
            typeof_val = rdfa_node.attributes.get("typeof") or ""
            type_name = typeof_val.rstrip("/").split("/")[-1] if typeof_val else ""
            if type_name and type_name not in result.schema_types:
                result.schema_types.append(type_name)

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
