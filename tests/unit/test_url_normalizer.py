import pytest
from services.crawler.url_normalizer import UrlNormalizer

def test_url_lowercase_and_ports():
    url = "HTTP://EXAMPLE.COM:80/Path"
    assert UrlNormalizer.normalize(url) == "http://example.com/Path"

    url_https = "HTTPS://WWW.EXAMPLE.COM:443/shop/"
    assert UrlNormalizer.normalize(url_https) == "https://www.example.com/shop/"

def test_strip_fragments():
    url = "https://example.com/about#team-section"
    assert UrlNormalizer.normalize(url) == "https://example.com/about"

def test_strip_tracking_parameters_and_sort_functional_params():
    url = "https://example.com/products?utm_source=google&category=shoes&gclid=123&page=2&b=test&a=alpha"
    # utm_source and gclid must be stripped, page, category, b, a sorted alphabetically: a=alpha&b=test&category=shoes&page=2
    expected = "https://example.com/products?a=alpha&b=test&category=shoes&page=2"
    assert UrlNormalizer.normalize(url) == expected

def test_disallow_non_crawlable_schemes():
    assert UrlNormalizer.is_crawlable_scheme("mailto:seo@example.com") is False
    assert UrlNormalizer.is_crawlable_scheme("tel:+123456789") is False
    assert UrlNormalizer.is_crawlable_scheme("javascript:void(0)") is False
    assert UrlNormalizer.is_crawlable_scheme("data:image/png;base64,...") is False
    assert UrlNormalizer.is_crawlable_scheme("https://example.com") is True

def test_resolve_relative_urls():
    base = "https://example.com/blog/article-1"
    assert UrlNormalizer.resolve_relative_url(base, "/about") == "https://example.com/about"
    assert UrlNormalizer.resolve_relative_url(base, "article-2") == "https://example.com/blog/article-2"
    assert UrlNormalizer.resolve_relative_url(base, "#heading") is None
    assert UrlNormalizer.resolve_relative_url(base, "javascript:click()") is None
