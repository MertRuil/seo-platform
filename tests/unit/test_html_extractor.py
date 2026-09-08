import pytest
from services.crawler.html_extractor import HtmlExtractor

def test_html_extractor_complete_metadata():
    html = """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <title>Best Autonomous AI SEO Platform 2026</title>
        <meta name="description" content="Discover the leading autonomous AI SEO platform for modern enterprises.">
        <meta name="robots" content="noindex, follow">
        <link rel="canonical" href="https://example.com/platform">
        <link rel="alternate" hreflang="tr" href="https://example.com/tr/platform">
        <script type="application/ld+json">
        {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "SEO OS"
        }
        </script>
    </head>
    <body>
        <header><nav><a href="/home">Home</a></nav></header>
        <main>
            <h1>Production Grade AI SEO</h1>
            <h2>Deterministic Rule Engine</h2>
            <p>This is the main body text containing valuable indexable keywords and content.</p>
            <a href="/pricing" rel="nofollow">View Pricing</a>
            <a href="https://external.org/doc" rel="external">External Doc</a>
            <img src="/assets/logo.png" alt="SEO OS Logo" loading="lazy" width="200" height="50">
        </main>
        <footer><p>Copyright 2026</p></footer>
    </body>
    </html>
    """
    res = HtmlExtractor.extract(html, "https://example.com/platform")
    assert res.title == "Best Autonomous AI SEO Platform 2026"
    assert res.meta_description == "Discover the leading autonomous AI SEO platform for modern enterprises."
    assert res.has_noindex is True
    assert res.has_nofollow is False
    assert res.canonical_url == "https://example.com/platform"
    assert len(res.hreflangs) == 1
    assert res.hreflangs[0]["lang"] == "tr"
    assert res.hreflangs[0]["href"] == "https://example.com/tr/platform"
    assert res.headings["h1"] == ["Production Grade AI SEO"]
    assert res.headings["h2"] == ["Deterministic Rule Engine"]
    assert len(res.links) == 3
    # /pricing is internal
    pricing_link = next(l for l in res.links if "/pricing" in l.href)
    assert pricing_link.is_internal is True
    assert pricing_link.anchor_text == "View Pricing"
    # external is external
    ext_link = next(l for l in res.links if "external.org" in l.href)
    assert ext_link.is_internal is False
    # Schema check
    assert len(res.structured_data) == 1
    assert res.structured_data[0]["@type"] == "SoftwareApplication"
    assert res.structured_data[0]["name"] == "SEO OS"
    # Word count (header and footer decomposed)
    assert res.word_count > 10
    assert len(res.raw_html_hash) == 64
    assert len(res.main_content_hash) == 64
