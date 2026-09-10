import re
import json
import logging
from typing import Dict, Any, List, Optional, Tuple
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
        2. Renders page via Playwright if available, or synthesizes de-hydrated DOM from state payload.
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
                    browser = await p.chromium.launch(headless=True)
                    page = await browser.new_page()
                    await page.goto(url, wait_until="networkidle", timeout=timeout_ms)
                    rendered_html = await page.content()
                    await browser.close()
            except Exception as e:
                logger.warning(f"Playwright rendering failed, falling back to simulated hydration: {e}")
                rendered_html = cls._synthesize_hydration(raw_html)
        elif spa_profile.is_spa:
            rendered_html = cls._synthesize_hydration(raw_html)

        diff = cls.reconcile_dom(raw_html, rendered_html, url)
        return rendered_html, diff, spa_profile

    @classmethod
    def _synthesize_hydration(cls, raw_html: str) -> str:
        """
        Extracts hydration state JSON (__NEXT_DATA__ or similar) and expands DOM
        when a full browser binary is not running.
        """
        tree = HTMLParser(raw_html)
        next_script = tree.css_first("script#__NEXT_DATA__")
        if not next_script or not next_script.text():
            return raw_html

        try:
            data = json.loads(next_script.text().strip())
            props = data.get("props", {}).get("pageProps", {})

            # If dynamic title or meta is in props, simulate hydrated DOM
            title = props.get("title") or props.get("meta", {}).get("title")
            canonical = props.get("canonical") or props.get("canonicalUrl")
            rendered = raw_html

            if title and "<title>" in rendered:
                rendered = re.sub(r"<title>.*?</title>", f"<title>{title}</title>", rendered, flags=re.IGNORECASE)
            if canonical:
                if "rel=\"canonical\"" not in rendered:
                    rendered = rendered.replace("</head>", f'<link rel="canonical" href="{canonical}" />\n</head>')

            return rendered
        except Exception:
            return raw_html
