import pytest

from packages.config.settings import settings
from services.agents.base import DEFAULT_MODELS, model_for


@pytest.mark.parametrize(
    "configured, provider, expected",
    [
        ("gemini-3.8-flash", "google", "gemini-3.8-flash"),
        # Paylaşılan ayar başka sağlayıcının modelini gösteriyorsa o sağlayıcıya gönderilmez.
        ("gemini-3.8-flash", "openai", DEFAULT_MODELS["openai"]),
        ("gpt-4o", "anthropic", DEFAULT_MODELS["anthropic"]),
        ("claude-opus-5-5", "claude", "claude-opus-5-5"),
        # Kapatılmış modeller varsayılana düşer.
        ("gemini-1.5-pro", "google", DEFAULT_MODELS["google"]),
        ("claude-3-5-sonnet-20241022", "anthropic", DEFAULT_MODELS["anthropic"]),
        ("", "google", DEFAULT_MODELS["google"]),
    ],
)
def test_model_for(monkeypatch, configured, provider, expected):
    monkeypatch.setattr(settings, "DEFAULT_LLM_MODEL", configured)
    assert model_for(provider) == expected
