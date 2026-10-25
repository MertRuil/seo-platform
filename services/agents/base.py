from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional, Type
from pydantic import BaseModel, Field

from services.agents.proposed_change import META_MAX, META_MIN, TITLE_MAX, TITLE_MIN

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
    # Siteye yazılabilecek somut değerler. Uzunluk ve dayanak kontrolü services/agents/proposed_change.py'de;
    # burada sınır konmaz ki tek alan taşınca önerinin tamamı düşmesin.
    proposed_title: Optional[str] = Field(None, description="New <title> text for the page, or null.")
    proposed_meta_description: Optional[str] = Field(None, description="New meta description text for the page, or null.")
    proposed_schema_json: Optional[Dict[str, Any]] = Field(None, description="Complete corrected JSON-LD object, or null.")

# Öneriler panelde kullanıcıya olduğu gibi gösterilir; enum alanları şema ve puanlama için İngilizce kalır.
TURKISH_OUTPUT_RULE = (
    "Write every free-text field (title, problem_diagnosis, proposed_solution, technical_reason, "
    "expected_impact) in Turkish. Keep category, effort, risk_level, URLs and citation fields unchanged."
)

PROPOSED_VALUES_RULE = (
    "Fill proposed_title, proposed_meta_description or proposed_schema_json only when the issue is about that "
    "value and the page data contains enough facts; otherwise leave them null. Write proposed_title and "
    "proposed_meta_description in the page language (html_lang), not necessarily Turkish. Use only facts present "
    "in the page data: never invent prices, discounts, ratings, reviews, authors, dates, numbers or claims. "
    f"proposed_title: {TITLE_MIN}-{TITLE_MAX} characters, proposed_meta_description: {META_MIN}-{META_MAX} "
    "characters, plain text without HTML. proposed_schema_json: keep the existing block's @type and properties, "
    "only add the missing required ones from the page's title or H1."
)

class LLMProvider(ABC):
    # Sağlayıcının yanıtta bildirdiği token sayıları birikir; çağıran işin sonunda take_tokens() ile organizasyona yazar.
    _tokens_used: int = 0

    def _add_tokens(self, input_tokens, output_tokens) -> None:
        self._tokens_used = self._tokens_used + int(input_tokens or 0) + int(output_tokens or 0)

    def take_tokens(self) -> int:
        used, self._tokens_used = self._tokens_used, 0
        return used

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
    def __init__(self, api_key: str, model: str = "gemini-3.8-flash", rate_limiter=None):
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
            meta = data.get("usageMetadata") or {}
            self._add_tokens(meta.get("promptTokenCount"), meta.get("candidatesTokenCount"))
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
            meta = data.get("usageMetadata") or {}
            self._add_tokens(meta.get("promptTokenCount"), meta.get("candidatesTokenCount"))
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
            meta = data.get("usage") or {}
            self._add_tokens(meta.get("prompt_tokens"), meta.get("completion_tokens"))
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
            meta = data.get("usage") or {}
            self._add_tokens(meta.get("prompt_tokens"), meta.get("completion_tokens"))
            raw_text = data["choices"][0]["message"]["content"]
            parsed_json = json.loads(raw_text)
            return output_schema.model_validate(parsed_json)


class AnthropicProvider(LLMProvider):
    """Production LLM provider for Anthropic Claude models."""
    def __init__(self, api_key: str, model: str = "claude-opus-5-5", rate_limiter=None):
        self.api_key = api_key
        self.model = model
        self.rate_limiter = rate_limiter
        self.endpoint = "https://api.anthropic.com/v1/messages"

    async def generate(self, prompt: str, system_instruction: str = "", temperature: float = 0.2) -> str:
        import httpx
        if self.rate_limiter:
            await self.rate_limiter.acquire(estimated_tokens=len(prompt.split()) * 2)

        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }
        payload = {
            "model": self.model,
            "max_tokens": 4096,
            "temperature": temperature,
            "messages": [{"role": "user", "content": prompt}]
        }
        if system_instruction:
            payload["system"] = system_instruction

        async with httpx.AsyncClient(timeout=45.0) as client:
            resp = await client.post(self.endpoint, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
            meta = data.get("usage") or {}
            self._add_tokens(meta.get("input_tokens"), meta.get("output_tokens"))
            return data["content"][0]["text"]

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
        augmented_system = (
            f"{system_instruction}\n"
            f"You MUST respond ONLY with a raw, valid JSON object strictly matching this schema. Do not enclose in markdown code fences.\n"
            f"JSON Schema: {schema_json}"
        )
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }
        payload = {
            "model": self.model,
            "max_tokens": 4096,
            "temperature": temperature,
            "system": augmented_system,
            "messages": [{"role": "user", "content": prompt}]
        }

        async with httpx.AsyncClient(timeout=45.0) as client:
            resp = await client.post(self.endpoint, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
            meta = data.get("usage") or {}
            self._add_tokens(meta.get("input_tokens"), meta.get("output_tokens"))
            raw_text = data["content"][0]["text"].strip()
            if raw_text.startswith("```"):
                lines = raw_text.splitlines()
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines and lines[-1].startswith("```"):
                    lines = lines[:-1]
                raw_text = "\n".join(lines).strip()
            parsed_json = json.loads(raw_text)
            return output_schema.model_validate(parsed_json)


def is_placeholder_provider(provider: LLMProvider) -> bool:
    """Üretimde sabit test yanıtı gerçek öneri gibi kaydedilmemeli ya da gösterilmemeli."""
    from packages.config.settings import settings
    return isinstance(provider, DeterministicTestLLMProvider) and settings.is_production_like


# Sağlayıcı başına varsayılan model. DEFAULT_LLM_MODEL tek ayar olduğundan başka sağlayıcının modelini
# (ör. openai seçiliyken gemini-*) ya da kapatılmış bir modeli gösteriyorsa yerine bu kullanılır.
DEFAULT_MODELS = {"google": "gemini-3.8-flash", "openai": "gpt-4o", "anthropic": "claude-opus-5-5"}
_MODEL_FAMILIES = {"google": ("gemini-",), "openai": ("gpt-", "o1", "o3", "o4"), "anthropic": ("claude-",)}
RETIRED_MODEL_PREFIXES = ("gemini-1.", "gemini-2.0", "claude-2", "claude-3-", "claude-instant")


def model_for(provider: str) -> str:
    import logging
    from packages.config.settings import settings
    key = "anthropic" if provider == "claude" else provider
    configured = (settings.DEFAULT_LLM_MODEL or "").strip()
    if not configured.startswith(_MODEL_FAMILIES.get(key, ())):
        return DEFAULT_MODELS[key]
    if configured.startswith(RETIRED_MODEL_PREFIXES):
        logging.getLogger(__name__).warning("DEFAULT_LLM_MODEL=%s kapatılmış bir model; %s kullanılıyor", configured, DEFAULT_MODELS[key])
        return DEFAULT_MODELS[key]
    return configured


def get_llm_provider(rate_limiter=None) -> LLMProvider:
    """
    Factory function returning the configured LLM provider.
    Falls back gracefully to DeterministicTestLLMProvider in test/dev if keys are absent,
    while enforcing configuration in production.
    """
    from packages.config.settings import settings
    provider_name = (settings.LLM_PROVIDER or "").lower()

    if provider_name == "google":
        if settings.GOOGLE_API_KEY:
            return GoogleGenAIProvider(
                api_key=settings.GOOGLE_API_KEY,
                model=model_for("google"),
                rate_limiter=rate_limiter
            )
        elif getattr(settings, "ENVIRONMENT", "development") in ("production", "staging"):
            raise ValueError("Google GenAI provider configured but GOOGLE_API_KEY is missing in production environment.")
    elif provider_name == "openai":
        if settings.OPENAI_API_KEY:
            return OpenAIProvider(
                api_key=settings.OPENAI_API_KEY,
                model=model_for("openai"),
                rate_limiter=rate_limiter
            )
        elif getattr(settings, "ENVIRONMENT", "development") in ("production", "staging"):
            raise ValueError("OpenAI provider configured but OPENAI_API_KEY is missing in production environment.")
    elif provider_name in ("anthropic", "claude"):
        if settings.ANTHROPIC_API_KEY:
            return AnthropicProvider(
                api_key=settings.ANTHROPIC_API_KEY,
                model=model_for("anthropic"),
                rate_limiter=rate_limiter
            )
        elif getattr(settings, "ENVIRONMENT", "development") in ("production", "staging"):
            raise ValueError("Anthropic provider configured but ANTHROPIC_API_KEY is missing in production environment.")

    return DeterministicTestLLMProvider()

