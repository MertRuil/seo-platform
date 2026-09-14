import pytest
from unittest.mock import patch, MagicMock
from packages.shared.models import Site
from services.security.domain_verification import DomainVerificationService


@pytest.mark.anyio
async def test_domain_verification_meta_tag_success():
    site = Site(
        id="site_meta_test",
        domain="meta-example.com",
        primary_url="https://meta-example.com"
    )
    token = "seo-verify-abcdef123456"

    mock_html = f'<html><head><title>Test</title><meta name="seo-platform-verification" content="{token}"></head><body>Hi</body></html>'
    mock_res = MagicMock()
    mock_res.status_code = 200
    mock_res.text = mock_html

    with patch("services.crawler.safe_client.SafeHttpClient.fetch", return_value=mock_res):
        res = await DomainVerificationService.verify_meta_tag(site, token)
        assert res is True


@pytest.mark.anyio
async def test_domain_verification_meta_tag_failure():
    site = Site(
        id="site_meta_test_fail",
        domain="fail-example.com",
        primary_url="https://fail-example.com"
    )
    token = "seo-verify-correct-token"

    mock_html = '<html><head><title>Test</title><meta name="seo-platform-verification" content="wrong-token"></head><body>Hi</body></html>'
    mock_res = MagicMock()
    mock_res.status_code = 200
    mock_res.text = mock_html

    with patch("services.crawler.safe_client.SafeHttpClient.fetch", return_value=mock_res):
        res = await DomainVerificationService.verify_meta_tag(site, token)
        assert res is False


@pytest.mark.anyio
async def test_domain_verification_html_file_success():
    site = Site(
        id="site_file_test",
        domain="file-example.com",
        primary_url="https://file-example.com"
    )
    token = "seo-verify-filetoken789"

    mock_res = MagicMock()
    mock_res.status_code = 200
    mock_res.text = token

    with patch("services.crawler.safe_client.SafeHttpClient.fetch", return_value=mock_res):
        res = await DomainVerificationService.verify_html_file(site, token)
        assert res is True
