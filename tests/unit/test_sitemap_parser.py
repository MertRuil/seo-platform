import pytest
from services.crawler.sitemap_parser import SitemapParser

def test_parse_urlset_sitemap():
    xml = """<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
       <url>
          <loc>https://example.com/</loc>
          <lastmod>2026-01-01</lastmod>
          <changefreq>daily</changefreq>
          <priority>1.0</priority>
       </url>
       <url>
          <loc>https://example.com/about</loc>
          <priority>0.8</priority>
       </url>
    </urlset>
    """
    res = SitemapParser.parse_xml(xml)
    assert res.is_valid is True
    assert res.is_index is False
    assert len(res.urls) == 2
    assert res.urls[0].loc == "https://example.com/"
    assert res.urls[0].priority == 1.0
    assert res.urls[1].loc == "https://example.com/about"
    assert res.urls[1].priority == 0.8

def test_parse_sitemap_index():
    xml = """<?xml version="1.0" encoding="UTF-8"?>
    <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
       <sitemap>
          <loc>https://example.com/sitemap-posts.xml</loc>
       </sitemap>
       <sitemap>
          <loc>https://example.com/sitemap-products.xml</loc>
       </sitemap>
    </sitemapindex>
    """
    res = SitemapParser.parse_xml(xml)
    assert res.is_valid is True
    assert res.is_index is True
    assert len(res.sitemap_indices) == 2
    assert res.sitemap_indices[0] == "https://example.com/sitemap-posts.xml"

def test_parse_invalid_xml():
    xml = "Not an xml string at all"
    res = SitemapParser.parse_xml(xml)
    assert res.is_valid is False
    assert "XML parse error" in res.error_message
