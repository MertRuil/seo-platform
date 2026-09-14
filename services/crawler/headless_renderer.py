import re
import json
import logging
from typing import Dict, Any, List, Optional, Tuple, Set
from selectolax.parser import HTMLParser
from services.crawler.html_extractor import HtmlExtractor

logger = logging.getLogger("crawler.headless_renderer")

class SPAProfile:
    def __init__(
        self,
        is_spa: bool,
        framework: Optional[str] = None,
        has_client_routing: bool = False,
        hydration_data_found: bool = False,
        indicators: Optional[List[str]] = None
    ):
        self.is_spa = is_spa
        self.framework = framework
        self.has_client_routing = has_client_routing
        self.hydration_data_found = hydration_data_found
        self.indicators = indicators or []

    def to_dict(self) -> Dict[str, Any]:
        return {
            "is_spa": self.is_spa,
            "framework": self.framework,
            "has_client_routing": self.has_client_routing,
            "hydration_data_found": self.hydration_data_found,
            "indicators": self.indicators
        }

class DomDiffResult:
    def __init__(
        self,
        raw_title: Optional[str],
        rendered_title: Optional[str],
        title_mismatch: bool,
        raw_canonical: Optional[str],
        rendered_canonical: Optional[str],
        canonical_mismatch: bool,
        raw_has_noindex: bool,
        rendered_has_noindex: bool,
        noindex_mismatch: bool,
        raw_links_count: int,
        rendered_links_count: int,
        js_injected_links_count: int,
        hydration_discrepancy_score: float
    ):
        self.raw_title = raw_title
        self.rendered_title = rendered_title
        self.title_mismatch = title_mismatch
        self.raw_canonical = raw_canonical
        self.rendered_canonical = rendered_canonical
        self.canonical_mismatch = canonical_mismatch
        self.raw_has_noindex = raw_has_noindex
        self.rendered_has_noindex = rendered_has_noindex
        self.noindex_mismatch = noindex_mismatch
        self.raw_links_count = raw_links_count
        self.rendered_links_count = rendered_links_count
        self.js_injected_links_count = js_injected_links_count
        self.hydration_discrepancy_score = hydration_discrepancy_score

    def to_dict(self) -> Dict[str, Any]:
        return {
            "raw_title": self.raw_title,
            "rendered_title": self.rendered_title,
            "title_mismatch": self.title_mismatch,
            "raw_canonical": self.raw_canonical,
            "rendered_canonical": self.rendered_canonical,
            "canonical_mismatch": self.canonical_mismatch,
            "raw_has_noindex": self.raw_has_noindex,
            "rendered_has_noindex": self.rendered_has_noindex,
            "noindex_mismatch": self.noindex_mismatch,
            "raw_links_count": self.raw_links_count,
            "rendered_links_count": self.rendered_links_count,
            "js_injected_links_count": self.js_injected_links_count,
            "hydration_discrepancy_score": self.hydration_discrepancy_score
        }

class HeadlessRenderEngine:
    """
    Autonomous Headless Browser & Client-Side JavaScript Hydration Engine.
    Detects Single Page Applications (SPAs), reconciles Raw Server HTML vs Rendered Client DOM,
    and identifies critical SEO discrepancies (such as client-side noindex injections,
    canonical mutations, and dynamically inserted internal links).
    """

    @staticmethod
    def detect_spa_profile(html_content: str) -> SPAProfile:
        """
        Analyzes raw HTML to determine if the page relies heavily on client-side JS rendering.
        """
        tree = HTMLParser(html_content)
        indicators = []
        framework = None

        # Check Next.js
        if tree.css_first("script#__NEXT_DATA__") or "__NEXT_DATA__" in html_content:
            indicators.append("Next.js Hydration Payload found")
            framework = "Next.js"

        # Check React Root
        if tree.css_first("div#root") or tree.css_first("div#react-root"):
            indicators.append("React Root Container (<div id='root'>) detected")
            if not framework:
                framework = "React SPA"

        # Check Vue / Nuxt
        if tree.css_first("div#__nuxt") or "__NUXT__" in html_content or tree.css_first("div#app"):
            indicators.append("Vue/Nuxt Container detected")
            if not framework:
                framework = "Nuxt/Vue"

        # Check Angular
        if tree.css_first("[ng-version]") or tree.css_first("app-root"):
            indicators.append("Angular app-root container detected")
            if not framework:
                framework = "Angular"

        # Check Noscript warning
        noscript = tree.css_first("noscript")
        if noscript and any(w in noscript.text().lower() for w in ["enable javascript", "requires javascript", "need to enable"]):
            indicators.append("NoScript fallback warning detected")

        # Check if body is suspiciously empty (< 200 chars text) while scripts exist
        body_text = tree.body.text().strip() if tree.body else ""
        scripts = tree.css("script")
        if len(body_text) < 150 and len(scripts) >= 2:
            indicators.append("Empty DOM Shell with client scripts detected")

        is_spa = len(indicators) > 0
        has_client_routing = is_spa and any("router" in s.attributes.get("src", "").lower() for s in scripts if "src" in s.attributes)

        return SPAProfile(
            is_spa=is_spa,
            framework=framework,
            has_client_routing=has_client_routing,
            hydration_data_found="__NEXT_DATA__" in html_content or "__INITIAL_STATE__" in html_content,
            indicators=indicators
        )

    @classmethod
    def reconcile_dom(cls, raw_html: str, rendered_html: str, base_url: str) -> DomDiffResult:
        """
        Compares static raw HTML vs fully rendered HTML to detect critical Googlebot discrepancies.
        """
        raw_ext = HtmlExtractor.extract(raw_html, base_url)
        ren_ext = HtmlExtractor.extract(rendered_html, base_url)

        title_mismatch = (raw_ext.title or "").strip() != (ren_ext.title or "").strip()
        canonical_mismatch = (raw_ext.canonical_url or "").strip() != (ren_ext.canonical_url or "").strip()
        noindex_mismatch = raw_ext.has_noindex != ren_ext.has_noindex

        raw_links = len(raw_ext.links)
        ren_links = len(ren_ext.links)
        js_injected_links = max(0, ren_links - raw_links)

        # Calculate discrepancy score (0.0 to 100.0)
        score = 0.0
        if noindex_mismatch:
            score += 45.0  # Critical: Client-side JS injected or removed noindex
        if canonical_mismatch:
            score += 30.0  # High: Canonical tag altered by client JS
        if title_mismatch:
            score += 15.0  # Medium: Title tag mutated
        if js_injected_links > 5:
            score += 10.0  # Links only exist after JS execution

        return DomDiffResult(
            raw_title=raw_ext.title,
            rendered_title=ren_ext.title,
            title_mismatch=title_mismatch,
            raw_canonical=raw_ext.canonical_url,
            rendered_canonical=ren_ext.canonical_url,
            canonical_mismatch=canonical_mismatch,
            raw_has_noindex=raw_ext.has_noindex,
            rendered_has_noindex=ren_ext.has_noindex,
            noindex_mismatch=noindex_mismatch,
            raw_links_count=raw_links,
            rendered_links_count=ren_links,
            js_injected_links_count=js_injected_links,
            hydration_discrepancy_score=min(100.0, score)
        )

    @classmethod
    async def render_and_reconcile(
        cls,
        url: str,
        raw_html: str,
        timeout_ms: int = 15000
    ) -> Tuple[str, DomDiffResult, SPAProfile]:
        """
        Main execution point:
        1. Evaluates SPA profile.
        2. Renders page via Playwright if available (with routed raw_html and fresh page fallback),
           or synthesizes de-hydrated DOM from state payload if headless browser unavailable.
        3. Generates reconciliation diff report.
        """
        spa_profile = cls.detect_spa_profile(raw_html)
        rendered_html = raw_html

        # Check if Playwright is available in current environment
        playwright_available = False
        try:
            from playwright.async_api import async_playwright
            playwright_available = True
        except ImportError:
            playwright_available = False

        if playwright_available and spa_profile.is_spa:
            try:
                from playwright.async_api import async_playwright
                async with async_playwright() as p:
                    browser = await p.chromium.launch(
                        headless=True,
                        args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
                    )
                    page = await browser.new_page()

                    rendered_candidate = None
                    # 1. Attempt intercepted navigation so raw_html is loaded under the correct origin
                    if url and (url.startswith("http://") or url.startswith("https://")) and raw_html:
                        try:
                            await page.route(url, lambda route: route.fulfill(status=200, body=raw_html, content_type="text/html"))
                            await page.goto(url, wait_until="domcontentloaded", timeout=min(timeout_ms, 8000))
                            try:
                                await page.wait_for_load_state("networkidle", timeout=2000)
                            except Exception:
                                pass
                            await page.wait_for_timeout(400)
                            rendered_candidate = await page.content()
                        except Exception as nav_err:
                            logger.debug(f"Intercepted page.goto failed ({nav_err}), falling back to fresh set_content")

                    # 2. If goto failed or URL was unreachable/mock, use a fresh page with set_content
                    if not rendered_candidate and raw_html:
                        try:
                            fresh_page = await browser.new_page()
                            await fresh_page.set_content(raw_html, wait_until="domcontentloaded", timeout=5000)
                            await fresh_page.wait_for_timeout(400)
                            rendered_candidate = await fresh_page.content()
                            await fresh_page.close()
                        except Exception as set_err:
                            logger.debug(f"set_content failed: {set_err}")

                    await browser.close()
                    if rendered_candidate:
                        rendered_html = rendered_candidate
            except Exception as e:
                logger.warning(f"Playwright rendering failed, falling back to simulated hydration: {e}")
                rendered_html = cls._synthesize_hydration(raw_html)
        elif spa_profile.is_spa:
            rendered_html = cls._synthesize_hydration(raw_html)

        # 3. If rendered_html still looks like an empty shell (< 30 words) while hydration payload exists,
        # supplement it with synthesized hydration so nothing is missed
        if spa_profile.is_spa:
            tree = HTMLParser(rendered_html)
            body = tree.body
            body_text = body.text().strip() if body else ""
            if len(body_text.split()) < 30 and (spa_profile.hydration_data_found or "noscript" in rendered_html.lower()):
                rendered_html = cls._synthesize_hydration(rendered_html)

        diff = cls.reconcile_dom(raw_html, rendered_html, url)
        return rendered_html, diff, spa_profile

    @classmethod
    def _extract_state_data(
        cls,
        obj: Any,
        titles: List[str],
        descriptions: List[str],
        canonicals: List[str],
        headings: List[str],
        texts: List[str],
        links: Set[str],
        depth: int = 0
    ):
        if depth > 12:
            return
        if isinstance(obj, str):
            v_clean = obj.strip()
            if v_clean.startswith("/") and not v_clean.startswith(("//", "/_next", "/_nuxt", "/static/")):
                if not v_clean.endswith((".js", ".css", ".png", ".jpg", ".svg", ".woff", ".ico")):
                    links.add(v_clean)
        elif isinstance(obj, dict):
            for k, v in obj.items():
                k_lower = str(k).lower()
                if isinstance(v, str):
                    v_clean = v.strip()
                    if not v_clean:
                        continue
                    if k_lower in ("h1", "heading", "header", "pageheading") and len(v_clean) < 200:
                        headings.append(v_clean)
                    elif k_lower in ("title", "pagetitle", "metatitle", "seotitle") and len(v_clean) < 200:
                        titles.append(v_clean)
                    elif k_lower in ("description", "metadescription", "summary", "excerpt") and len(v_clean) < 500:
                        descriptions.append(v_clean)
                    elif k_lower in ("canonical", "canonicalurl"):
                        canonicals.append(v_clean)
                    elif k_lower in ("href", "url", "link", "path", "slug", "route"):
                        if not v_clean.endswith((".js", ".css", ".png", ".jpg", ".svg", ".woff", ".ico")):
                            links.add(v_clean)
                    elif v_clean.startswith("/") and not v_clean.startswith(("//", "/_next", "/_nuxt", "/static/")):
                        if not v_clean.endswith((".js", ".css", ".png", ".jpg", ".svg", ".woff", ".ico")):
                            links.add(v_clean)
                    elif len(v_clean.split()) >= 3 and not v_clean.startswith(("http://", "https://", "data:", "{", "<", "webpack")):
                        texts.append(v_clean)
                elif isinstance(v, (dict, list)):
                    cls._extract_state_data(v, titles, descriptions, canonicals, headings, texts, links, depth + 1)
        elif isinstance(obj, list):
            for item in obj:
                cls._extract_state_data(item, titles, descriptions, canonicals, headings, texts, links, depth + 1)

    @classmethod
    def _synthesize_hydration(cls, raw_html: str) -> str:
        """
        Extracts hydration state JSON (__NEXT_DATA__, __NUXT_DATA__, __INITIAL_STATE__, etc.)
        and expands DOM when a full browser binary is not running or client scripts failed to hydrate.
        """
        tree = HTMLParser(raw_html)
        titles: List[str] = []
        descriptions: List[str] = []
        canonicals: List[str] = []
        headings: List[str] = []
        texts: List[str] = []
        links: Set[str] = set()

        # 1. Parse JSON state scripts
        scripts = tree.css("script")
        for s in scripts:
            s_id = (s.attributes.get("id") or "").lower()
            s_type = (s.attributes.get("type") or "").lower()
            text = s.text().strip() if s.text() else ""
            if not text:
                continue

            data = None
            if s_id in ("__next_data__", "__nuxt_data__", "__initial_state__", "__preloaded_state__") or s_type == "application/json":
                try:
                    data = json.loads(text)
                except Exception:
                    pass
            elif "__next_data__" in s_id or "__nuxt" in s_id:
                try:
                    data = json.loads(text)
                except Exception:
                    pass
            elif "window.__INITIAL_STATE__" in text or "window.__NUXT__" in text:
                m = re.search(r"window\.__[A-Z_]+__\s*=\s*(\{.+?\});", text, re.DOTALL)
                if m:
                    raw_dict_str = m.group(1)
                    try:
                        data = json.loads(raw_dict_str)
                    except Exception:
                        # Parse JS object literal using regex key-value extraction
                        kv_pairs = re.findall(r"(\b[a-zA-Z0-9_$]+\b)\s*:\s*[\"']([^\"']+)[\"']", raw_dict_str)
                        for k, v in kv_pairs:
                            k_l = k.lower()
                            if k_l in ("h1", "heading", "header"):
                                headings.append(v)
                            elif k_l in ("title", "pagetitle", "metatitle"):
                                titles.append(v)
                            elif k_l in ("description", "metadescription", "summary"):
                                descriptions.append(v)
                            elif k_l in ("canonical", "canonicalurl"):
                                canonicals.append(v)
                            elif k_l in ("href", "url", "link", "path", "slug", "route") or v.startswith("/"):
                                links.add(v)
                            elif len(v.split()) >= 3:
                                texts.append(v)

            if data:
                cls._extract_state_data(data, titles, descriptions, canonicals, headings, texts, links)

        rendered = raw_html

        # Update title if title is missing or generic
        if titles:
            best_title = titles[0]
            existing_title = tree.css_first("title")
            existing_text = existing_title.text().strip() if existing_title else ""
            if not existing_text or any(g in existing_text.lower() for g in ["loading", "app shell", "react app", "next.js app", "create react app"]):
                if "<title>" in rendered:
                    rendered = re.sub(r"<title>.*?</title>", f"<title>{best_title}</title>", rendered, flags=re.IGNORECASE)
                elif "</head>" in rendered:
                    rendered = rendered.replace("</head>", f"<title>{best_title}</title>\n</head>")

        # Update meta description if missing
        if descriptions and 'name="description"' not in rendered and "name='description'" not in rendered:
            best_desc = descriptions[0]
            if "</head>" in rendered:
                rendered = rendered.replace("</head>", f'<meta name="description" content="{best_desc}">\n</head>')

        # Update canonical if missing
        if canonicals and 'rel="canonical"' not in rendered and "rel='canonical'" not in rendered:
            best_canon = canonicals[0]
            if "</head>" in rendered:
                rendered = rendered.replace("</head>", f'<link rel="canonical" href="{best_canon}">\n</head>')

        # If noscript tag exists with content, unwrap it so it doesn't get decomposed
        noscript = tree.css_first("noscript")
        if noscript and noscript.text() and len(noscript.text().strip()) > 15:
            rendered = re.sub(r"<noscript[^>]*>([\s\S]*?)</noscript>", r'<div id="noscript-hydrated">\1</div>', rendered, flags=re.IGNORECASE)

        # Build injected HTML elements
        injected_parts = []
        if headings:
            injected_parts.append(f"<h1>{headings[0]}</h1>")
            for h in headings[1:4]:
                injected_parts.append(f"<h2>{h}</h2>")

        for t in texts[:30]:
            injected_parts.append(f"<p>{t}</p>")

        for lk in sorted(links)[:50]:
            injected_parts.append(f'<a href="{lk}">{lk}</a>')

        if injected_parts:
            injected_html = "\n".join(injected_parts)
            mounted = False
            for container_id in ("__next", "root", "__nuxt", "app"):
                match = re.search(
                    rf'(<[a-z0-9\-]+[^>]*id=["\']{re.escape(container_id)}["\'][^>]*>)(\s*)(</[a-z0-9\-]+>)',
                    rendered,
                    re.IGNORECASE
                )
                if match:
                    rendered = rendered[:match.start(2)] + f"\n{injected_html}\n" + rendered[match.start(3):]
                    mounted = True
                    break

            if not mounted:
                if "</body>" in rendered:
                    rendered = rendered.replace("</body>", f'<div id="synthesized-hydration">\n{injected_html}\n</div>\n</body>')
                else:
                    rendered += f'\n<div id="synthesized-hydration">\n{injected_html}\n</div>'

        return rendered
