import pytest
from core.translator import get_translator, list_translators


def test_lists_three_providers():
    names = list_translators()
    assert set(names) == {"gemini", "local_openai", "openai"}


def test_gemini_factory():
    t = get_translator("gemini", api_key="x", model="gemini-2.5-flash-lite")
    assert t.name == "gemini"


def test_local_openai_factory_uses_lm_studio_default_url():
    t = get_translator("local_openai", model="gemma-3-27b-it")
    assert t.base_url == "http://127.0.0.1:1234/v1"
    assert t.api_key == "lm-studio"


def test_openai_factory_uses_openai_default_url():
    t = get_translator("openai", api_key="sk-x", model="gpt-4o-mini")
    assert t.base_url == "https://api.openai.com/v1"


def test_unknown_provider_raises():
    with pytest.raises(KeyError, match="unknown translator"):
        get_translator("nope")
