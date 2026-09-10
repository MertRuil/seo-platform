import pytest
import json
from unittest.mock import AsyncMock, patch, MagicMock
from services.integrations.indexing_client import IndexNowClient, GoogleIndexingClient
from services.integrations.indexing_client import IndexNowClient, GoogleIndexingClient
from services.crawler.headless_renderer import HeadlessRenderEngine, SPAProfile, DomDiffResult
from services.seo_engine.schema_generator import SchemaGenerator
from services.executor.connectors.cloudflare import CloudflareWorkerConnector
from services.agents.orchestrator import AiOrchestrator, PriorityEngine
from services.agents.base import DeterministicTestLLMProvider
from services.rag.hybrid_store import HybridKnowledgeStore
from services.seo_engine.base import RuleCheckResult, RuleCategory, IssueSeverity

# =====================================================================
# 1. Instant Indexing Engine Tests (IndexNow & Google Indexing API)
# =====================================================================

def test_indexnow_client_key_validation():
    client = IndexNowClient()
    assert client.validate_key("valid-key-abcdef-123456789012345") is True
    assert client.validate_key("short") is False
    assert client.validate_key("key with spaces is not allowed!") is False

@pytest.mark.asyncio
async def test_indexnow_submit_urls():
    client = IndexNowClient(api_key="1234567890abcdef1234567890abcdef")

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = MagicMock(status_code=200, text="OK")
        res = await client.submit_urls(
            host="example.com",
            urls=["https://example.com/page1", "https://example.com/page2"]
        )

        assert res["success"] is True
        assert res["submitted_urls_count"] == 2
        assert res["status_code"] == 200

@pytest.mark.asyncio
async def test_google_indexing_submit_notification():
    client = GoogleIndexingClient(service_account_json={
        "client_email": "test-bot@serviceaccount.com",
        "private_key": "mock-private-key"
    })

    with patch.object(client, "_get_access_token", new_callable=AsyncMock) as mock_token:
        mock_token.return_value = "mock-bearer-token"
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = MagicMock(
                status_code=200,
                json=lambda: {"urlNotificationMetadata": {"latestUpdate": {"type": "URL_UPDATED"}}}
            )
            res = await client.submit_url_notification(
                url="https://example.com/new-product",
                action_type="URL_UPDATED"
            )
            assert res["success"] is True
            assert res["url"] == "https://example.com/new-product"
            assert res["action_type"] == "URL_UPDATED"

# =====================================================================
# 2. Headless JS Rendering & DOM Reconciliation Engine Tests
# =====================================================================

def test_headless_render_spa_detection():
    next_html = '<html><head></head><body><script id="__NEXT_DATA__" type="application/json">{"props":{}}</script></body></html>'
    profile_next = HeadlessRenderEngine.detect_spa_profile(next_html)
    assert profile_next.is_spa is True
    assert profile_next.framework == "Next.js"
    assert profile_next.hydration_data_found is True

    static_html = '<html><head><title>Static Blog</title></head><body><h1>Hello World</h1><p>Classic HTML page with sufficient content length to not look like an empty shell.</p></body></html>'
    profile_static = HeadlessRenderEngine.detect_spa_profile(static_html)
    assert profile_static.is_spa is False
    assert profile_static.framework is None

def test_headless_dom_reconciliation():
    raw_html = """
    <html>
      <head><title>Loading...</title></head>
      <body><div id="root">Initial loading</div></body>
    </html>
    """

    rendered_dom = """
    <html>
      <head>
        <title>Ultimate Guide to Autonomous SEO | MySite</title>
        <link rel="canonical" href="https://mysite.com/guide">
        <meta name="robots" content="noindex">
      </head>
      <body>
        <div id="root">
          <h1>Ultimate Guide</h1>
          <a href="https://mysite.com/page1">Page 1</a>
          <a href="https://mysite.com/page2">Page 2</a>
          <a href="https://mysite.com/page3">Page 3</a>
          <a href="https://mysite.com/page4">Page 4</a>
          <a href="https://mysite.com/page5">Page 5</a>
          <a href="https://mysite.com/page6">Page 6</a>
        </div>
      </body>
    </html>
    """

    result = HeadlessRenderEngine.reconcile_dom(raw_html=raw_html, rendered_html=rendered_dom, base_url="https://mysite.com")

    assert result.title_mismatch is True
    assert result.canonical_mismatch is True
    assert result.noindex_mismatch is True
    assert result.js_injected_links_count == 6
    assert result.hydration_discrepancy_score >= 45.0

# =====================================================================
# 3. Automated JSON-LD Schema Generator & Google Validator Tests
# =====================================================================

def test_schema_generator_faq_page():
    qa_list = [
        {"question": "How does IndexNow work?", "answer": "It instantly notifies search engines of URL changes."},
        {"question": "Is Cloudflare Worker supported?", "answer": "Yes, through edge HTMLRewriter injection."}
    ]
    schema = SchemaGenerator.generate_faq_schema(qa_list)
    assert schema["@type"] == "FAQPage"
    assert len(schema["mainEntity"]) == 2
    assert schema["mainEntity"][0]["name"] == "How does IndexNow work?"

    val = SchemaGenerator.validate_google_guidelines(schema)
    assert val["valid"] is True
    assert len(val["errors"]) == 0

    script_tag = SchemaGenerator.generate_script_tag(schema)
    assert '<script type="application/ld+json">' in script_tag
    assert "FAQPage" in script_tag

def test_schema_generator_article_and_validation():
    article = SchemaGenerator.generate_article_schema(
        headline="Complete AI SEO Architecture",
        author_name="Ayberk SEO Lead",
        publisher_name="Autonomous SEO Platform",
        date_published="2026-09-10T12:00:00Z",
        image_url="https://example.com/images/cover.jpg",
        description="Comprehensive technical deep dive into autonomous search engines."
    )

    assert article["@type"] == "Article"
    assert article["headline"] == "Complete AI SEO Architecture"
    assert article["author"]["name"] == "Ayberk SEO Lead"

    validation = SchemaGenerator.validate_google_guidelines(article)
    assert validation["valid"] is True

    # Test incomplete article
    incomplete_article = {"@context": "https://schema.org", "@type": "Article"}
    invalid_res = SchemaGenerator.validate_google_guidelines(incomplete_article)
    assert invalid_res["valid"] is False
    assert len(invalid_res["errors"]) > 0

def test_schema_generator_product_and_local_business():
    product = SchemaGenerator.generate_product_schema(
        name="Enterprise SEO Bot",
        price=199.0,
        currency="USD",
        description="Auto-remediating SEO agent",
        rating_value=4.9,
        review_count=120
    )
    assert product["@type"] == "Product"
    assert product["offers"]["price"] == 199.0
    val_prod = SchemaGenerator.validate_google_guidelines(product)
    assert val_prod["valid"] is True

    business = SchemaGenerator.generate_local_business_schema(
        name="Istanbul Tech Hub",
        telephone="+902125550000",
        street_address="Levent Mah. Buyukdere Cad. No:100",
        locality="Istanbul",
        postal_code="34394",
        country="TR",
        latitude=41.077,
        longitude=29.012
    )
    assert business["@type"] == "LocalBusiness"
    val_biz = SchemaGenerator.validate_google_guidelines(business)
    assert val_biz["valid"] is True

# =====================================================================
# 4. Edge SEO / CDN Worker Connector Tests
# =====================================================================

@pytest.mark.asyncio
async def test_cloudflare_worker_connector_lifecycle():
    connector = CloudflareWorkerConnector(
        zone_id="mock_zone_12345",
        api_token="mock_token_secret",
        account_id="mock_account",
        kv_namespace_id="mock_kv_seo"
    )

    # 1. Verify connection
    assert await connector.verify_connection() is True

    # 2. Check capabilities
    caps = await connector.get_capabilities()
    assert "CAN_EDIT_CANONICAL" in caps
    assert "CAN_EDIT_SCHEMA" in caps
    assert "CAN_EDIT_REDIRECT" in caps
    assert "EDGE_HTML_REWRITE" in caps

    # 3. Apply Edge Canonical & Schema
    target_url = "https://example.com/edge-optimized-page"
    applied = await connector.apply_change({
        "target_url": target_url,
        "operation": "EDGE_OVERRIDE",
        "state_after": {
            "canonical": "https://example.com/canonical-source",
            "title": "Edge SEO Optimized Title",
            "meta_description": "Injected at Cloudflare Edge without origin server hit.",
            "schema_json": {"@type": "FAQPage", "mainEntity": []}
        }
    })
    assert applied is True

    # 4. Read edge page state
    state = await connector.read_page_state(target_url)
    assert state["edge_active"] is True
    assert state["rule"]["canonical"] == "https://example.com/canonical-source"

    # 5. Rollback change
    rolled_back = await connector.rollback_change({"target_url": target_url})
    assert rolled_back is True

    # Post-rollback verify
    state_after_rollback = await connector.read_page_state(target_url)
    assert state_after_rollback["edge_active"] is False

def test_cloudflare_worker_script_generator():
    script = CloudflareWorkerConnector.generate_edge_worker_script()
    assert "HTMLRewriter" in script
    assert "canonical" in script
    assert "application/ld+json" in script
    assert "Response.redirect" in script

# =====================================================================
# 5. Smart Orchestrator Multi-Agent Routing Tests
# =====================================================================

@pytest.mark.asyncio
async def test_orchestrator_smart_multi_agent_dispatching():
    rag = HybridKnowledgeStore()
    rag.add_chunk(
        chunk_id="chunk-seo-standards",
        document_title="Search Standards",
        heading_path=["Standards"],
        content="Always provide structured data, optimal content depth, and strong internal links.",
        status="ACTIVE"
    )
    llm = DeterministicTestLLMProvider()
    orchestrator = AiOrchestrator(llm_provider=llm, knowledge_store=rag)

    # 4 issues covering all agent disciplines
    issues = [
        RuleCheckResult(
            passed=False,
            rule_id="RULE_SCHEMA_MISSING_FAQ",
            category=RuleCategory.STRUCTURED_DATA,
            severity=IssueSeverity.HIGH,
            confidence=0.95,
            title="Missing FAQ Schema",
            description="Page contains Q&A content without JSON-LD",
            evidence={"url": "https://example.com/faq", "page_type": "FAQPage"},
            recommendation_template="Add FAQPage schema"
        ),
        RuleCheckResult(
            passed=False,
            rule_id="RULE_CONTENT_THIN_PAGE",
            category=RuleCategory.INDEXABILITY,
            severity=IssueSeverity.MEDIUM,
            confidence=0.90,
            title="Thin content detected",
            description="Page word count is below 200 words",
            evidence={"url": "https://example.com/thin", "word_count": 120},
            recommendation_template="Expand content"
        ),
        RuleCheckResult(
            passed=False,
            rule_id="RULE_INTERNAL_LINK_ORPHAN",
            category=RuleCategory.INTERNAL_LINKING,
            severity=IssueSeverity.HIGH,
            confidence=0.88,
            title="Orphan page without inlinks",
            description="No internal pages link to this document",
            evidence={"url": "https://example.com/orphan", "target_topic": "Cloud SEO"},
            recommendation_template="Add internal link"
        ),
        RuleCheckResult(
            passed=False,
            rule_id="RULE_HTTP_500_SERVER_ERROR",
            category=RuleCategory.INDEXABILITY,
            severity=IssueSeverity.CRITICAL,
            confidence=1.0,
            title="Internal Server Error 500",
            description="Origin responds with HTTP 500",
            evidence={"url": "https://example.com/broken", "status_code": 500},
            recommendation_template="Resolve server crash"
        )
    ]

    pages = {
        "https://example.com/faq": {"url": "https://example.com/faq", "page_type": "FAQPage", "status_code": 200},
        "https://example.com/thin": {"url": "https://example.com/thin", "title": "Thin Page", "word_count": 120},
        "https://example.com/orphan": {"url": "https://example.com/orphan", "title": "Orphan Hub"},
        "https://example.com/broken": {"url": "https://example.com/broken", "status_code": 500}
    }

    recs = await orchestrator.process_crawl_issues(
        site_id="site-autonomous-test",
        issues=issues,
        pages_by_url=pages
    )

    assert len(recs) == 4

    # Verify each agent handled its assigned issue category
    issue_id_to_rec = {r["issue_id"]: r for r in recs}

    # Schema agent recommendation
    schema_rec = issue_id_to_rec["RULE_SCHEMA_MISSING_FAQ"]
    assert schema_rec["category"] == "STRUCTURED_DATA"

    # Content agent recommendation
    content_rec = issue_id_to_rec["RULE_CONTENT_THIN_PAGE"]
    assert content_rec["category"] in ("CONTENT_OPTIMIZATION", "TECHNICAL_SEO", "INTERNAL_LINKING")

    # Link agent recommendation
    link_rec = issue_id_to_rec["RULE_INTERNAL_LINK_ORPHAN"]
    assert link_rec["category"] in ("INTERNAL_LINKING", "TECHNICAL_SEO")

    # Technical agent recommendation
    tech_rec = issue_id_to_rec["RULE_HTTP_500_SERVER_ERROR"]
    assert tech_rec["risk_level"] in ("CRITICAL", "HIGH", "MEDIUM")

    # All recs have positive priority scores and are sorted descending
    for i in range(len(recs) - 1):
        assert recs[i]["priority_score"] >= recs[i+1]["priority_score"]
