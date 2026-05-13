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


def test_translate_segments_recovers_from_count_mismatch_via_bisection():
    """Gemini sometimes returns N-1 translations for N inputs in long
    batches (the model merges short adjacent lines). Recover by bisecting
    the batch instead of failing the whole pipeline. Mirrors the test for
    OpenAICompatTranslator."""
    import json as _json
    from unittest.mock import MagicMock, patch

    with patch("core.translator.gemini.genai") as mock_genai:
        mock_client = MagicMock()
        mock_genai.Client.return_value = mock_client

        # First call (4 segments) → 3 translations (merge). Subsequent
        # calls (2/2 halves) succeed with correct count.
        def _resp(arr):
            r = MagicMock()
            r.text = _json.dumps(arr)
            return r

        mock_client.models.generate_content.side_effect = [
            _resp(["你好", "世界", "merged"]),  # 3 != 4
            _resp(["你好", "世界"]),  # 2/2
            _resp(["再见", "完了"]),  # 2/2
        ]

        t = GeminiTranslator(api_key="fake-key", model="gemini-2.5-flash-lite")
        segs = [
            TranscriptionSegment(id=i, start=float(i), end=float(i + 1), text=f"line {i}")
            for i in range(4)
        ]
        t.translate_segments(segs, "zh-CN")

        assert all(s.translated for s in segs)
        assert mock_client.models.generate_content.call_count == 3
