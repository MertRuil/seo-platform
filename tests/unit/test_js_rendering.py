import pytest
import asyncio
from services.crawler.headless_renderer import HeadlessRenderEngine, SPAProfile
from services.crawler.html_extractor import HtmlExtractor

@pytest.mark.asyncio
async def test_client_side_rendered_react_spa_with_playwright():
    """Verify that Playwright renders client-side JS DOM and captures H1, text, and links."""
    raw_html = """<!DOCTYPE html>
<html>
<head>
    <title>React App Shell</title>
</head>
<body>
    <div id="root"></div>
    <script>
        const root = document.getElementById('root');
        const h1 = document.createElement('h1');
        h1.textContent = 'Rendered Single Page App Title';
        const p = document.createElement('p');
        p.textContent = 'This is client-side rendered text content that search engines need to index properly.';
        const a = document.createElement('a');
        a.href = '/about-us';
        a.textContent = 'About Us Link';
        root.appendChild(h1);
        root.appendChild(p);
        root.appendChild(a);
    </script>
</body>
</html>"""

    rendered, diff, profile = await HeadlessRenderEngine.render_and_reconcile("https://example.com/", raw_html)
    assert profile.is_spa is True

    ext = HtmlExtractor.extract(rendered, "https://example.com/")
    assert ext.headings.get("h1") == ["Rendered Single Page App Title"]
    assert ext.word_count > 10
    assert any(l.href == "https://example.com/about-us" for l in ext.links)

def test_nextjs_hydration_payload_extraction_and_synthesis():
    """Verify that Next.js __NEXT_DATA__ JSON state is unpacked into full DOM elements."""
    next_html = """<!DOCTYPE html>
<html>
<head><title>App Shell</title></head>
<body>
    <div id="__next"></div>
    <script id="__NEXT_DATA__" type="application/json">
    {
      "props": {
        "pageProps": {
          "title": "Next.js Full Page Title",
          "heading": "Autonomous SEO Optimization Heading",
          "description": "Meta description from Next.js state props",
          "content": "This is fully captured body text ensuring zero words are missed in SPA indexing and crawling.",
          "links": ["/features", "/pricing", "/docs"]
        }
      }
    }
    </script>
</body>
</html>"""

    rendered = HeadlessRenderEngine._synthesize_hydration(next_html)
    ext = HtmlExtractor.extract(rendered, "https://example.com/")

    assert ext.title == "Next.js Full Page Title"
    assert ext.headings.get("h1") == ["Autonomous SEO Optimization Heading"]
    assert ext.meta_description == "Meta description from Next.js state props"
    assert ext.word_count > 10
    extracted_hrefs = [l.href for l in ext.links]
    assert "https://example.com/features" in extracted_hrefs
    assert "https://example.com/pricing" in extracted_hrefs
    assert "https://example.com/docs" in extracted_hrefs

def test_nuxt_vue_hydration_payload_extraction():
    """Verify that Nuxt/Vue state is synthesized and DOM is populated with content and links."""
    nuxt_html = """<!DOCTYPE html>
<html>
<head><title>Nuxt Loading...</title></head>
<body>
    <div id="__nuxt"></div>
    <script>
        window.__NUXT__ = {
            data: [{
                title: "Nuxt Enterprise Platform",
                h1: "High Performance Nuxt SEO",
                description: "Nuxt server and client hydration data description.",
                body: "Comprehensive architectural evaluation for modern search engine crawlers and bots.",
                route: "/services"
            }]
        };
    </script>
</body>
</html>"""

    rendered = HeadlessRenderEngine._synthesize_hydration(nuxt_html)
    ext = HtmlExtractor.extract(rendered, "https://example.com/")

    assert ext.title == "Nuxt Enterprise Platform"
    assert ext.headings.get("h1") == ["High Performance Nuxt SEO"]
    assert ext.meta_description == "Nuxt server and client hydration data description."
    assert ext.word_count > 8
    assert any(l.href == "https://example.com/services" for l in ext.links)

@pytest.mark.asyncio
async def test_spa_offline_and_mock_fallback_never_misses_content():
    """Verify that if live network navigation fails, client scripts via set_content still render."""
    raw_html = """<!DOCTYPE html>
<html>
<head><title>Offline Mock App</title></head>
<body>
    <div id="root"></div>
    <script>
        document.getElementById('root').innerHTML = '<h1>Offline Hydrated Heading</h1><p>Client side script executed in headless sandbox.</p><a href=\"/catalog\">Catalog</a>';
    </script>
</body>
</html>"""

    # Using an unreachable mock URL
    rendered, diff, profile = await HeadlessRenderEngine.render_and_reconcile("https://unreachable-mock-spa-domain-999.test/", raw_html)
    ext = HtmlExtractor.extract(rendered, "https://unreachable-mock-spa-domain-999.test/")

    assert ext.headings.get("h1") == ["Offline Hydrated Heading"]
    assert ext.word_count > 5
    assert any("catalog" in l.href for l in ext.links)

def test_spa_with_noscript_fallback_content():
    """Verify that noscript fallback content is preserved when the main container is empty."""
    raw_html = """<!DOCTYPE html>
<html>
<head><title>NoScript App</title></head>
<body>
    <div id="root"></div>
    <noscript>
        <h1>Static NoScript Fallback Heading</h1>
        <p>This is fallback content intended for search engine crawlers and users with JavaScript disabled.</p>
        <a href="/noscript-link">Fallback Link</a>
    </noscript>
</body>
</html>"""

    rendered = HeadlessRenderEngine._synthesize_hydration(raw_html)
    ext = HtmlExtractor.extract(rendered, "https://example.com/")

    assert ext.headings.get("h1") == ["Static NoScript Fallback Heading"]
    assert ext.word_count > 10
    assert any(l.href == "https://example.com/noscript-link" for l in ext.links)

@pytest.mark.asyncio
async def test_reconcile_dom_discrepancy_score():
    """Verify that DOM reconciliation computes proper discrepancy metrics when JS mutates SEO elements."""
    raw_html = """<!DOCTYPE html>
<html>
<head><title>Initial Shell</title></head>
<body><div id="root"></div></body>
</html>"""

    rendered_html = """<!DOCTYPE html>
<html>
<head>
    <title>Dynamic Mutated Title</title>
    <link rel="canonical" href="https://example.com/canonical-target">
    <meta name="robots" content="noindex">
</head>
<body>
    <div id="root">
        <h1>Rendered Main</h1>
        <a href="/link1">Link 1</a>
        <a href="/link2">Link 2</a>
    </div>
</body>
</html>"""

    diff = HeadlessRenderEngine.reconcile_dom(raw_html, rendered_html, "https://example.com/")
    assert diff.title_mismatch is True
    assert diff.canonical_mismatch is True
    assert diff.noindex_mismatch is True
    assert diff.js_injected_links_count == 2
    assert diff.hydration_discrepancy_score >= 45.0
