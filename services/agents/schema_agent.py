from typing import Dict, Any, List, Optional
import json
from services.agents.base import LLMProvider, RecommendationOutput, GroundedCitation, TURKISH_OUTPUT_RULE, PROPOSED_VALUES_RULE
from services.rag.hybrid_store import HybridKnowledgeStore

class StructuredDataAgent:
    """Specialist agent for Schema.org structured data and Google Rich Results."""
    def __init__(self, llm_provider: LLMProvider, knowledge_store: HybridKnowledgeStore):
        self.llm = llm_provider
        self.rag = knowledge_store

    async def analyze_schema(
        self,
        target_url: str,
        current_schema_json: str,
        detected_page_type: str,
        page_data: Optional[Dict[str, Any]] = None
    ) -> RecommendationOutput:
        rag_results = self.rag.search_hybrid("Schema org structured data Google rich results json-ld", top_k=2)

        citations: List[GroundedCitation] = [
            GroundedCitation(
                source_id=r.chunk_id,
                document_title=r.document_title,
                canonical_url=r.canonical_url or "https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data",
                excerpt=r.content[:300]
            )
            for r in rag_results
        ]

        system_instruction = (
            "You are a Structured Data Architect. "
            "Validate JSON-LD syntax according to schema.org standards. "
            "DO NOT fabricate facts, fake reviews, fake ratings, or prices. "
            "All structured data must reflect verifiable content on the page. "
            + TURKISH_OUTPUT_RULE + " " + PROPOSED_VALUES_RULE
        )

        page_data = page_data or {}
        prompt = f"""
SCHEMA TARGET:
URL: {target_url}
Detected Type: {detected_page_type}
Page Language (html_lang): {page_data.get('html_lang') or 'unknown'}

<ISSUE_EVIDENCE>
{current_schema_json}
</ISSUE_EVIDENCE>

<UNTRUSTED_PAGE_FACTS>
Title: {page_data.get('title') or ''}
H1: {page_data.get('h1') or ''}
Meta Description: {page_data.get('meta_description') or ''}
Existing JSON-LD blocks: {json.dumps(page_data.get('structured_data') or [], ensure_ascii=False)[:6000]}
</UNTRUSTED_PAGE_FACTS>
"""

        res = await self.llm.generate_structured(
            prompt=prompt,
            output_schema=RecommendationOutput,
            system_instruction=system_instruction,
            temperature=0.0
        )

        res.category = "STRUCTURED_DATA"
        res.risk_level = "LOW"
        if not res.citations and citations:
            res.citations = citations

        return res
