import pytest
from services.executor.connectors.wordpress import WordPressConnector
from services.executor.connectors.git import GitBasedConnector
from services.executor.connectors.webhook import GenericWebhookConnector
from services.executor.executor_service import SafeSiteExecutor

@pytest.mark.asyncio
async def test_wordpress_connector():
    wp = WordPressConnector("mock://myblog.com", "admin", "app-pass-123")
    assert await wp.verify_connection() is True
    caps = await wp.get_capabilities()
    assert "CAN_EDIT_TITLE" in caps
    assert "CAN_EDIT_META" in caps

    state = await wp.read_page_state("https://myblog.com/post-1")
    assert "current_hash" in state

    applied = await wp.apply_change({
        "post_id": 10,
        "state_after": {"title": "New Optimized Title"}
    })
    assert applied is True

@pytest.mark.asyncio
async def test_git_connector():
    git = GitBasedConnector("mock/repo", "token123")
    assert await git.verify_connection() is True
    caps = await git.get_capabilities()
    assert "CAN_EDIT_SCHEMA" in caps
    assert "CAN_EDIT_ROBOTS" in caps

    applied = await git.apply_change({"file": "src/pages/index.astro", "diff": "+ canonical"})
    assert applied is True

@pytest.mark.asyncio
async def test_safe_executor_with_wordpress():
    wp = WordPressConnector("mock://myblog.com", "admin", "pass")
    executor = SafeSiteExecutor(wp)

    change_item = {
        "target_url": "https://myblog.com/post-1",
        "expected_hash_before": "wp-mock-hash",
        "risk_level": "LOW",
        "operation": "UPDATE_TITLE",
        "state_after": {"title": "Updated Title"}
    }

    res = await executor.execute_change_item(change_item, require_approval=False)
    assert res.success is True
    assert res.status == "SUCCESS"

@pytest.mark.asyncio
async def test_wordpress_dynamic_slug_resolution():
    wp = WordPressConnector("mock://myblog.com", "admin", "pass")
    post_id = await wp.resolve_post_id("https://myblog.com/blog/2026/my-seo-guide")
    assert post_id is not None
    assert post_id > 0

    # Applying change with target_url but without post_id dynamically resolves slug
    applied = await wp.apply_change({
        "target_url": "https://myblog.com/blog/2026/my-seo-guide",
        "state_after": {"title": "New Title", "meta_description": "New Desc"}
    })
    assert applied is True

    # When target_url is completely missing and no post_id is given, rejects rather than mutating ID 1
    unresolvable = await wp.apply_change({
        "target_url": "",
        "state_after": {"title": "Corrupt ID 1"}
    })
    assert unresolvable is False

@pytest.mark.asyncio
async def test_git_connector_live_pr_flow(monkeypatch):
    import httpx
    git = GitBasedConnector("owner/my-seo-site", "ghp_validtoken123", default_branch="main")

    async def mock_handler(request: httpx.Request):
        url = str(request.url)
        if "/git/ref/heads/main" in url:
            return httpx.Response(200, json={"object": {"sha": "base-sha-123"}})
        elif "/git/refs" in url and request.method == "POST":
            return httpx.Response(201, json={"ref": "refs/heads/seo-opt-test"})
        elif "/contents/" in url and request.method == "GET":
            return httpx.Response(404, json={"message": "Not found"})
        elif "/contents/" in url and request.method == "PUT":
            return httpx.Response(201, json={"content": {"sha": "new-file-sha"}})
        elif "/pulls" in url and request.method == "POST":
            return httpx.Response(201, json={"html_url": "https://github.com/owner/my-seo-site/pull/42", "number": 42})
        elif url == "https://api.github.com/repos/owner/my-seo-site":
            return httpx.Response(200, json={"id": 12345})
        return httpx.Response(404)

    transport = httpx.MockTransport(mock_handler)
    real_client_init = httpx.AsyncClient.__init__

    def patched_init(self, *args, **kwargs):
        kwargs["transport"] = transport
        real_client_init(self, *args, **kwargs)

    monkeypatch.setattr(httpx.AsyncClient, "__init__", patched_init)

    assert await git.verify_connection() is True
    applied = await git.apply_change({
        "target_url": "https://mysite.com/products/shoes",
        "operation": "UPDATE_TITLE",
        "state_after": {"title": "Optimized Shoes Title"}
    })
    assert applied is True

@pytest.mark.asyncio
async def test_canonical_seo_concurrency_hash():
    from services.crawler.html_extractor import HtmlExtractor, compute_canonical_seo_hash

    html_v1 = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Best Shoes</title>
        <link rel="canonical" href="https://example.com/shoes" />
        <meta name="description" content="Shop shoes." />
        <meta name="robots" content="index, follow" />
        <meta name="csrf-token" content="TOKEN_ABC_123" />
    </head>
    <body>
        <div>Current time: 10:00:01 AM</div>
        <p>Welcome to our shoe store.</p>
    </body>
    </html>
    """

    html_v2_dynamic_variation = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Best Shoes</title>
        <link rel="canonical" href="https://example.com/shoes" />
        <meta name="description" content="Shop shoes." />
        <meta name="robots" content="index, follow" />
        <meta name="csrf-token" content="TOKEN_XYZ_999_DIFFERENT" />
    </head>
    <body>
        <div>Current time: 11:45:22 PM (Dynamic Timestamp Changed)</div>
        <p>Welcome to our shoe store.</p>
    </body>
    </html>
    """

    res1 = HtmlExtractor.extract(html_v1, "https://example.com/shoes")
    res2 = HtmlExtractor.extract(html_v2_dynamic_variation, "https://example.com/shoes")

    # Raw HTML hashes must differ because of dynamic nonces and timestamps
    assert res1.raw_html_hash != res2.raw_html_hash

    # Canonical SEO hashes MUST be identical because SEO elements are unchanged
    assert res1.canonical_seo_hash == res2.canonical_seo_hash

    # An out-of-band SEO modification (e.g. title changed) MUST change canonical SEO hash
    html_v3_seo_modified = html_v1.replace("Best Shoes", "Out Of Band Modified Title")
    res3 = HtmlExtractor.extract(html_v3_seo_modified, "https://example.com/shoes")
    assert res1.canonical_seo_hash != res3.canonical_seo_hash
