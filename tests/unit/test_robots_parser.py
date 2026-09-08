import pytest
from services.crawler.robots_parser import RobotsParser

def test_robots_parser_basic_disallow():
    content = """
    User-agent: *
    Disallow: /admin/
    Disallow: /private/
    Allow: /admin/public/
    Sitemap: https://example.com/sitemap.xml
    """
    parser = RobotsParser(content)
    assert parser.sitemaps == ["https://example.com/sitemap.xml"]
    assert parser.is_allowed("https://example.com/", "Googlebot") is True
    assert parser.is_allowed("https://example.com/admin/settings", "Googlebot") is False
    assert parser.is_allowed("https://example.com/private/data", "Googlebot") is False
    # Longest match wins: /admin/public/ is allow
    assert parser.is_allowed("https://example.com/admin/public/info", "Googlebot") is True

def test_robots_parser_agent_specific_override():
    content = """
    User-agent: *
    Disallow: /

    User-agent: Googlebot
    Allow: /
    Disallow: /no-google/
    """
    parser = RobotsParser(content)
    # Generic bot is blocked
    assert parser.is_allowed("https://example.com/page", "OtherBot") is False
    # Googlebot is allowed on /page, blocked on /no-google/
    assert parser.is_allowed("https://example.com/page", "Googlebot") is True
    assert parser.is_allowed("https://example.com/no-google/page", "Googlebot") is False

def test_robots_parser_wildcard_patterns():
    content = """
    User-agent: Googlebot
    Disallow: /*.pdf$
    Disallow: /temp*
    """
    parser = RobotsParser(content)
    assert parser.is_allowed("https://example.com/document.pdf", "Googlebot") is False
    assert parser.is_allowed("https://example.com/document.pdf?param=1", "Googlebot") is True  # $ specifies end of path
    assert parser.is_allowed("https://example.com/temp-files/1", "Googlebot") is False
