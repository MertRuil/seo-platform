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


class GoogleGenAIProvider(LLMProvider):
    """Production LLM provider using Google Gemini via async REST API."""
    def __init__(self, api_key: str, model: str = "gemini-1.5-pro", rate_limiter=None):
        self.api_key = api_key
        self.model = model
        self.rate_limiter = rate_limiter
        self.endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

    async def generate(self, prompt: str, system_instruction: str = "", temperature: float = 0.2) -> str:
        import httpx
        if self.rate_limiter:
            await self.rate_limiter.acquire(estimated_tokens=len(prompt.split()) * 2)

        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": temperature}
        }
        if system_instruction:
            payload["systemInstruction"] = {"parts": [{"text": system_instruction}]}

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                self.endpoint,
                params={"key": self.api_key},
                headers={"Content-Type": "application/json"},
                json=payload
            )
            resp.raise_for_status()
            data = resp.json()
            return data["candidates"][0]["content"]["parts"][0]["text"]

    async def generate_structured(
        self,
        prompt: str,
        output_schema: Type[BaseModel],
        system_instruction: str = "",
        temperature: float = 0.1
    ) -> BaseModel:
        import json
        import httpx
        if self.rate_limiter:
            await self.rate_limiter.acquire(estimated_tokens=len(prompt.split()) * 2)

        schema_json = json.dumps(output_schema.model_json_schema())
        augmented_prompt = f"{prompt}\n\nRespond strictly with valid JSON conforming to this schema:\n{schema_json}"

        payload = {
            "contents": [{"parts": [{"text": augmented_prompt}]}],
            "generationConfig": {
                "temperature": temperature,
                "responseMimeType": "application/json"
            }
        }
        if system_instruction:
            payload["systemInstruction"] = {"parts": [{"text": system_instruction}]}

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                self.endpoint,
                params={"key": self.api_key},
                headers={"Content-Type": "application/json"},
                json=payload
            )
            resp.raise_for_status()
            data = resp.json()
            raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
            parsed_json = json.loads(raw_text)
            return output_schema.model_validate(parsed_json)


class OpenAIProvider(LLMProvider):
    """Production LLM provider for OpenAI GPT models."""
    def __init__(self, api_key: str, model: str = "gpt-4o", rate_limiter=None):
        self.api_key = api_key
        self.model = model
        self.rate_limiter = rate_limiter
        self.endpoint = "https://api.openai.com/v1/chat/completions"

    async def generate(self, prompt: str, system_instruction: str = "", temperature: float = 0.2) -> str:
        import httpx
        if self.rate_limiter:
            await self.rate_limiter.acquire(estimated_tokens=len(prompt.split()) * 2)

        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt})

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(self.endpoint, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]

    async def generate_structured(
        self,
        prompt: str,
        output_schema: Type[BaseModel],
        system_instruction: str = "",
        temperature: float = 0.1
    ) -> BaseModel:
        import json
        import httpx
        if self.rate_limiter:
            await self.rate_limiter.acquire(estimated_tokens=len(prompt.split()) * 2)

        schema_json = json.dumps(output_schema.model_json_schema())
        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": f"{system_instruction}\nRespond ONLY in valid JSON matching this schema: {schema_json}"})
        messages.append({"role": "user", "content": prompt})

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "response_format": {"type": "json_object"}
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(self.endpoint, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
            raw_text = data["choices"][0]["message"]["content"]
            parsed_json = json.loads(raw_text)
            return output_schema.model_validate(parsed_json)


def get_llm_provider(rate_limiter=None) -> LLMProvider:
    """
    Factory function returning the configured LLM provider.
    Falls back gracefully to DeterministicTestLLMProvider if no live keys are configured.
    """
    from packages.config.settings import settings
    provider_name = (settings.LLM_PROVIDER or "").lower()

    if provider_name == "google" and settings.GOOGLE_API_KEY:
        return GoogleGenAIProvider(
            api_key=settings.GOOGLE_API_KEY,
            model=settings.DEFAULT_LLM_MODEL or "gemini-1.5-pro",
            rate_limiter=rate_limiter
        )
    elif provider_name == "openai" and settings.OPENAI_API_KEY:
        return OpenAIProvider(
            api_key=settings.OPENAI_API_KEY,
            model=settings.DEFAULT_LLM_MODEL or "gpt-4o",
            rate_limiter=rate_limiter
        )

    return DeterministicTestLLMProvider()

