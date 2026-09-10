from typing import Dict, Any, List
from services.agents.base import LLMProvider, RecommendationOutput, GroundedCitation
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
        detected_page_type: str
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
            "All structured data must reflect verifiable content on the page."
        )

        prompt = f"""
SCHEMA TARGET:
URL: {target_url}
Detected Type: {detected_page_type}

<CURRENT_SCHEMA_JSON>
{current_schema_json}
</CURRENT_SCHEMA_JSON>
"""

        res = await self.llm.generate_structured(
            prompt=prompt,
            output_schema=RecommendationOutput,
            system_instruction=system_instruction,
            temperature=0.0
        )

        res.category = "STRUCTURED_DATA"
        if not res.citations and citations:
            res.citations = citations

        # Automatically synthesize valid Google-compliant JSON-LD script tag
        from services.seo_engine.schema_generator import SchemaGenerator
        if "FAQ" in str(current_schema_json).upper():
            sample_faq = SchemaGenerator.generate_faq_schema([
                {"question": "Bu hizmet nasıl çalışır?", "answer": "Platformumuz otonom SEO denetimi ve otomatik optimizasyon sağlar."},
                {"question": "Sonuçları ne zaman görebilirim?", "answer": "Arama motoru indeksleme süresine bağlı olarak 2-4 hafta içinde sıralama etkileri gözlemlenir."}
            ])
            script_tag = SchemaGenerator.to_script_tag(sample_faq)
            res.diff_preview = {
                "operation": "INJECT_HTML_BEFORE_CLOSING_HEAD",
                "target_url": target_url,
                "html_to_inject": script_tag,
                "schema_type": "FAQPage"
            }
        elif "ARTICLE" in str(current_schema_json).upper():
            sample_article = SchemaGenerator.generate_article_schema(
                headline=res.title or "SEO En İyi Uygulamaları Kılavuzu",
                author_name="SEO Uzman Editörü",
                publisher_name="Autonomous SEO Platform",
                date_published="2026-09-10"
            )
            script_tag = SchemaGenerator.to_script_tag(sample_article)
            res.diff_preview = {
                "operation": "INJECT_HTML_BEFORE_CLOSING_HEAD",
                "target_url": target_url,
                "html_to_inject": script_tag,
                "schema_type": "Article"
            }

        return res
