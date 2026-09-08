from typing import Dict, Any, List
from services.agents.base import LLMProvider, RecommendationOutput, GroundedCitation
from services.rag.hybrid_store import HybridKnowledgeStore

class SEOStrategyAgent:
    """Specialist agent synthesizing crawl health and search traffic into phased 30/60/90-day roadmaps."""
    def __init__(self, llm_provider: LLMProvider, knowledge_store: HybridKnowledgeStore):
        self.llm = llm_provider
        self.rag = knowledge_store

    async def generate_roadmap(
        self,
        domain: str,
        health_score: int,
        critical_issues_count: int,
        opportunities_count: int
    ) -> RecommendationOutput:
        rag_results = self.rag.search_hybrid("SEO strategy crawl budget site architecture roadmap", top_k=2)

        citations: List[GroundedCitation] = [
            GroundedCitation(
                source_id=r.chunk_id,
                document_title=r.document_title,
                canonical_url="https://developers.google.com/search/docs",
                excerpt=r.content[:300]
            )
            for r in rag_results
        ]

        system_instruction = (
            "You are a Principal SEO Strategist. "
            "Formulate a pragmatic 30/60/90-day execution roadmap. "
            "DO NOT guarantee search ranking positions. Prioritize crawl-blocking issues first."
        )

        prompt = f"""
SITE STRATEGY INPUTS:
Domain: {domain}
Health Score: {health_score}/100
Critical Crawl Issues: {critical_issues_count}
Search Performance Opportunities: {opportunities_count}
"""

        res = await self.llm.generate_structured(
            prompt=prompt,
            output_schema=RecommendationOutput,
            system_instruction=system_instruction,
            temperature=0.3
        )

        res.category = "STRATEGY_ROADMAP"
        if not res.citations and citations:
            res.citations = citations

        return res
