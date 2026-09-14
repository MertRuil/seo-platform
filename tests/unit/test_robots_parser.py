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

def test_robots_parser_empty_disallow_allows_all():
    content = """
    User-agent: *
    Disallow:
    """
    parser = RobotsParser(content)
    assert parser.is_allowed("https://example.com/", "Googlebot") is True
    assert parser.is_allowed("https://example.com/admin", "Googlebot") is True
    assert parser.is_allowed("https://example.com/products/123", "Googlebot") is True

def test_robots_parser_equal_length_allow_precedence():
    content = """
    User-agent: *
    Disallow: /checkout
    Allow: /checkout
    """
    parser = RobotsParser(content)
    # RFC 9309 Section 2.2.2: If allow and disallow have equal pattern length, allow takes precedence
    assert parser.is_allowed("https://example.com/checkout", "Googlebot") is True

def test_robots_parser_anchor_dollar_strictly_matches_end():
    content = """
    User-agent: *
    Disallow: /admin$
    """
    parser = RobotsParser(content)
    assert parser.is_allowed("https://example.com/admin", "Googlebot") is False
    assert parser.is_allowed("https://example.com/admin/dashboard", "Googlebot") is True
    assert parser.is_allowed("https://example.com/other/admin", "Googlebot") is True

def test_robots_parser_multi_agent_group_isolation():
    content = """
    User-agent: BadBot
    Disallow: /

    User-agent: Googlebot
    Disallow: /google-only/

    User-agent: *
    Disallow: /admin/
    """
    parser = RobotsParser(content)
    assert parser.is_allowed("https://example.com/public", "BadBot") is False
    assert parser.is_allowed("https://example.com/public", "Googlebot") is True
    # Googlebot has dedicated block, should NOT inherit '*' /admin/ disallow
    assert parser.is_allowed("https://example.com/admin/", "Googlebot") is True
    assert parser.is_allowed("https://example.com/google-only/", "Googlebot") is False
    # OtherBot falls back to '*'
    assert parser.is_allowed("https://example.com/public", "OtherBot") is True
    assert parser.is_allowed("https://example.com/admin/", "OtherBot") is False

def test_robots_parser_consecutive_user_agents_share_rules():
    content = """
    User-agent: Googlebot
    User-agent: Bingbot
    Disallow: /private/
    Crawl-delay: 5
    """
    parser = RobotsParser(content)
    assert parser.is_allowed("https://example.com/private/doc", "Googlebot") is False
    assert parser.is_allowed("https://example.com/private/doc", "Bingbot") is False
    assert parser.is_allowed("https://example.com/private/doc", "OtherBot") is True
    assert parser.crawl_delays.get("googlebot") == 5.0
    assert parser.crawl_delays.get("bingbot") == 5.0

def test_robots_parser_unicode_and_percent_encoded_paths():
    content = """
    User-agent: *
    Disallow: /ürünler/
    """
    parser = RobotsParser(content)
    # Direct unicode match
    assert parser.is_allowed("https://example.com/ürünler/detay", "Googlebot") is False
    # Percent-encoded match
    assert parser.is_allowed("https://example.com/%C3%BCr%C3%BCnler/detay", "Googlebot") is False
    # Unrelated path allowed
    assert parser.is_allowed("https://example.com/kategori", "Googlebot") is True
