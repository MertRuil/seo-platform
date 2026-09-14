import pytest
from packages.config.settings import settings
from services.agents.base import (
    get_llm_provider,
    DeterministicTestLLMProvider,
    GoogleGenAIProvider,
    OpenAIProvider,
    RecommendationOutput
)

@pytest.mark.anyio
async def test_llm_provider_factory_default():
    # When no API key is configured, fallback must be deterministic
    provider = get_llm_provider()
    assert isinstance(provider, DeterministicTestLLMProvider)
    output = await provider.generate("Test prompt")
    assert isinstance(output, str)
    assert len(output) > 0

@pytest.mark.anyio
async def test_deterministic_llm_structured_output():
    provider = DeterministicTestLLMProvider()
    res = await provider.generate_structured("Diagnose canonical issue", RecommendationOutput)
    assert isinstance(res, RecommendationOutput)
    assert res.category == "CANONICALIZATION"
    assert res.confidence >= 0.90
    assert len(res.citations) > 0

def test_llm_provider_factory_google_selection(monkeypatch):
    monkeypatch.setattr(settings, "LLM_PROVIDER", "google")
    monkeypatch.setattr(settings, "GOOGLE_API_KEY", "test-fake-key-12345")
    provider = get_llm_provider()
    assert isinstance(provider, GoogleGenAIProvider)
    assert provider.api_key == "test-fake-key-12345"

def test_llm_provider_factory_openai_selection(monkeypatch):
    monkeypatch.setattr(settings, "LLM_PROVIDER", "openai")
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "test-fake-openai-key")
    provider = get_llm_provider()
    assert isinstance(provider, OpenAIProvider)
    assert provider.api_key == "test-fake-openai-key"

def test_llm_provider_factory_anthropic_selection(monkeypatch):
    from services.agents.base import AnthropicProvider
    monkeypatch.setattr(settings, "LLM_PROVIDER", "anthropic")
    monkeypatch.setattr(settings, "ANTHROPIC_API_KEY", "sk-ant-test-fake-key")
    provider = get_llm_provider()
    assert isinstance(provider, AnthropicProvider)
    assert provider.api_key == "sk-ant-test-fake-key"
    assert "claude" in provider.model
