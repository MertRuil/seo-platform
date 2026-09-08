import pytest
from services.agents.base import DeterministicTestLLMProvider
from services.agents.content_agent import ContentSEOAgent
from services.agents.link_agent import InternalLinkingAgent
from services.agents.schema_agent import StructuredDataAgent
from services.agents.strategy_agent import SEOStrategyAgent
from services.agents.orchestrator import AiOrchestrator
from services.rag.hybrid_store import HybridKnowledgeStore

@pytest.fixture
def rag_store():
    store = HybridKnowledgeStore()
    store.add_chunk(
        chunk_id="doc-test-1-chunk-0",
        document_title="Google Guidelines",
        heading_path=["Google Guidelines"],
        content="Creating helpful, reliable, people-first content. Rel=canonical tags. Schema structured data.",
        vector=[0.1] * 128,
        status="ACTIVE"
    )
    return store

@pytest.fixture
def llm():
    return DeterministicTestLLMProvider()

@pytest.mark.anyio
async def test_content_agent(llm, rag_store):
    agent = ContentSEOAgent(llm, rag_store)
    res = await agent.analyze_content(
        target_url="https://example.com/health/treatment",
        page_data={"title": "Treatment Guide", "word_count": 450, "meta_description": "Guide details"},
        is_ymyl=True
    )
    assert res.risk_level == "HIGH"
    assert "YMYL" in res.expected_impact

@pytest.mark.anyio
async def test_link_agent(llm, rag_store):
    agent = InternalLinkingAgent(llm, rag_store)
    res = await agent.analyze_link_opportunity(
        source_url="https://example.com/blog/hub",
        target_url="https://example.com/products/target",
        target_topic="organic coffee",
        source_snippet="We source the finest organic coffee beans directly from farms."
    )
    assert res.category == "INTERNAL_LINKING"
    assert res.citations is not None

@pytest.mark.anyio
async def test_schema_agent(llm, rag_store):
    agent = StructuredDataAgent(llm, rag_store)
    res = await agent.analyze_schema(
        target_url="https://example.com/article",
        current_schema_json='{"@context": "https://schema.org", "@type": "Article"}',
        detected_page_type="Article"
    )
    assert res.category == "STRUCTURED_DATA"

@pytest.mark.anyio
async def test_strategy_agent(llm, rag_store):
    agent = SEOStrategyAgent(llm, rag_store)
    res = await agent.generate_roadmap(
        domain="example.com",
        health_score=68,
        critical_issues_count=4,
        opportunities_count=12
    )
    assert res.category == "STRATEGY_ROADMAP"

@pytest.mark.anyio
async def test_orchestrator_full_suite(llm, rag_store):
    orchestrator = AiOrchestrator(llm, rag_store)
    roadmap = await orchestrator.generate_strategic_roadmap(
        site_id="site-123",
        domain="example.com",
        health_score=80,
        critical_issues_count=2,
        opportunities_count=5
    )
    assert roadmap["site_id"] == "site-123"
    assert roadmap["category"] == "STRATEGY_ROADMAP"
