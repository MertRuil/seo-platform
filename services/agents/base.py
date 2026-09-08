from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional, Type
from pydantic import BaseModel, Field

class GroundedCitation(BaseModel):
    source_id: str
    document_title: str
    canonical_url: str
    excerpt: str

class RecommendationOutput(BaseModel):
    title: str = Field(..., max_length=150)
    category: str
    problem_diagnosis: str
    proposed_solution: str
    technical_reason: str
    confidence: float = Field(ge=0.0, le=1.0)
    expected_impact: str
    effort: str = Field(..., pattern=r"^(LOW|MEDIUM|HIGH)$")
    risk_level: str = Field(..., pattern=r"^(INFO|LOW|MEDIUM|HIGH|CRITICAL)$")
    citations: List[GroundedCitation]
    diff_preview: Optional[Dict[str, Any]] = None

class LLMProvider(ABC):
    @abstractmethod
    async def generate(self, prompt: str, system_instruction: str = "", temperature: float = 0.2) -> str:
        pass

    @abstractmethod
    async def generate_structured(
        self,
        prompt: str,
        output_schema: Type[BaseModel],
        system_instruction: str = "",
        temperature: float = 0.1
    ) -> BaseModel:
        pass

class DeterministicTestLLMProvider(LLMProvider):
    """Fallback / Mock LLM Provider ensuring deterministic tests run without live API keys."""
    async def generate(self, prompt: str, system_instruction: str = "", temperature: float = 0.2) -> str:
        return "Deterministic analysis response based on provided facts."

    async def generate_structured(
        self,
        prompt: str,
        output_schema: Type[BaseModel],
        system_instruction: str = "",
        temperature: float = 0.1
    ) -> BaseModel:
        # Returns a valid structured response matching schema
        return RecommendationOutput(
            title="Consolidate duplicate URLs with canonical link",
            category="CANONICALIZATION",
            problem_diagnosis="Multiple duplicate pages detected without authoritative canonical declaration.",
            proposed_solution="Specify an explicit self-referential canonical URL on the primary index page.",
            technical_reason="Canonical tags provide strong hints preventing Google from splitting ranking signals.",
            confidence=0.95,
            expected_impact="Consolidates crawl budget and unifies page authority in search results.",
            effort="LOW",
            risk_level="HIGH",
            citations=[
                GroundedCitation(
                    source_id="doc-canonical-guidelines",
                    document_title="Google Search Central: Consolidate Duplicate URLs",
                    canonical_url="https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls",
                    excerpt="Google uses various signals to determine the canonical page, including rel=canonical tags."
                )
            ]
        )
