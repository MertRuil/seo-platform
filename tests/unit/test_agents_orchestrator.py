import pytest
from services.agents.base import DeterministicTestLLMProvider
from services.agents.orchestrator import PriorityEngine, AiOrchestrator
from services.agents.technical_agent import TechnicalSEOAgent
from services.rag.hybrid_store import HybridKnowledgeStore
from services.seo_engine.base import RuleCheckResult, RuleCategory, IssueSeverity

def test_priority_engine_score_calculation():
    # Critical issue with low effort: high score
    score_critical = PriorityEngine.calculate_priority_score(
        impact=5.0, confidence=1.0, reach=3.0, business_value=2.0, effort="LOW", risk_level="CRITICAL"
    )
    assert 50.0 <= score_critical <= 100.0

    # Low issue with high effort: low score
    score_low = PriorityEngine.calculate_priority_score(
        impact=1.0, confidence=0.8, reach=1.0, business_value=1.0, effort="HIGH", risk_level="LOW"
    )
    assert score_low < score_critical

@pytest.mark.asyncio
async def test_ai_orchestrator_issue_pipeline():
    rag = HybridKnowledgeStore()
    rag.add_chunk(
        chunk_id="chk-1",
        document_title="Google Search Central: Canonical",
        heading_path=["Canonicalization"],
        content="Specify canonical links to consolidate ranking signals.",
        status="ACTIVE"
    )

    llm = DeterministicTestLLMProvider()
    orchestrator = AiOrchestrator(llm_provider=llm, knowledge_store=rag)

    mock_issue = RuleCheckResult(
        passed=False,
        rule_id="RULE_CANONICAL_TO_404",
        category=RuleCategory.CANONICALIZATION,
        severity=IssueSeverity.CRITICAL,
        confidence=1.0,
        title="Canonical points to 404",
        description="Canonical destination is missing",
        evidence={"url": "https://example.com/broken", "status": 404},
        recommendation_template="Fix canonical target"
    )

    pages = {"https://example.com/broken": {"url": "https://example.com/broken", "status_code": 200}}
    recs = await orchestrator.process_crawl_issues("site-123", [mock_issue], pages)

    assert len(recs) == 1
    rec = recs[0]
    assert rec["site_id"] == "site-123"
    assert rec["issue_id"] == "RULE_CANONICAL_TO_404"
    assert rec["risk_level"] == "CRITICAL"
    assert rec["priority_score"] > 0
    assert "Google Search Central" in rec["rag_sources_json"]
