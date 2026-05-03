import pytest
from core.translator.gemini import GeminiTranslator
from core.translator.base import TranslationProvider
from core.stt.base import TranscriptionSegment


def test_satisfies_protocol():
    t = GeminiTranslator(api_key="fake-key", model="gemini-2.5-flash-lite")
    assert isinstance(t, TranslationProvider)
    assert t.name == "gemini"


def test_list_models_returns_known_models():
    t = GeminiTranslator(api_key="fake-key", model="gemini-2.5-flash-lite")
    models = t.list_models()
    assert "gemini-2.5-flash-lite" in models
    assert "gemini-2.5-flash" in models


def test_translate_segments_requires_api_key():
    t = GeminiTranslator(api_key="", model="gemini-2.5-flash-lite")
    segs = [TranscriptionSegment(id=1, start=0, end=1, text="hi")]
    with pytest.raises(ValueError, match="api_key required"):
        t.translate_segments(segs, "zh-CN")
