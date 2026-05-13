from unittest.mock import MagicMock, patch
from core.translator.openai_compat import OpenAICompatTranslator
from core.translator.base import TranslationProvider


def test_satisfies_protocol():
    t = OpenAICompatTranslator(
        base_url="http://127.0.0.1:1234/v1", model="gemma-3-27b-it"
    )
    assert isinstance(t, TranslationProvider)
    assert t.name == "openai_compat"


def test_default_api_key_for_lm_studio():
    """LM Studio accepts any non-empty string as api_key; we default to 'lm-studio'."""
    t = OpenAICompatTranslator(base_url="http://127.0.0.1:1234/v1", model="m")
    assert t.api_key == "lm-studio"


def test_explicit_api_key_overrides_default():
    t = OpenAICompatTranslator(base_url="x", model="m", api_key="sk-real")
    assert t.api_key == "sk-real"


@patch("core.translator.openai_compat.OpenAI")
def test_list_models_calls_models_list(mock_openai_cls):
    mock_client = MagicMock()
    mock_client.models.list.return_value.data = [
        MagicMock(id="gemma-3-27b-it"),
        MagicMock(id="qwen2.5-7b-instruct"),
    ]
    mock_openai_cls.return_value = mock_client

    t = OpenAICompatTranslator(base_url="x", model="m")
    models = t.list_models()
    assert models == ["gemma-3-27b-it", "qwen2.5-7b-instruct"]


@patch("core.translator.openai_compat.OpenAI")
def test_is_available_returns_false_on_connection_error(mock_openai_cls):
    mock_client = MagicMock()
    mock_client.models.list.side_effect = ConnectionError("refused")
    mock_openai_cls.return_value = mock_client

    t = OpenAICompatTranslator(base_url="x", model="m")
    assert t.is_available() is False


@patch("core.translator.openai_compat.OpenAI")
def test_translate_title_passes_through(mock_openai_cls):
    mock_client = MagicMock()
    mock_resp = MagicMock()
    mock_resp.choices = [MagicMock(message=MagicMock(content="你好"))]
    mock_client.chat.completions.create.return_value = mock_resp
    mock_openai_cls.return_value = mock_client

    t = OpenAICompatTranslator(base_url="x", model="m")
    out = t.translate_title("Hello", "zh-CN")
    assert out == "你好"


# ─── translate_segments: count-mismatch bisection recovery ────────────────────
# LLMs (esp. fast/non-reasoning ones like DeepSeek-V4-Flash) routinely merge
# two short adjacent subtitle lines into one translation despite the
# "do not merge" instruction in the prompt. The original code raised
# "Translator returned N-1 for N segments" and failed the whole pipeline.
# Recovery: bisect the batch and retry. Test both happy path + recovery.


def _make_segments(n):
    """Build n minimal TranscriptionSegment-ish stubs with .text and a
    settable .translated attribute. Avoids importing the real dataclass to
    keep the test fast/independent."""
    from core.stt.base import TranscriptionSegment
    return [
        TranscriptionSegment(id=i, start=float(i), end=float(i + 1), text=f"line {i}")
        for i in range(n)
    ]


def _mock_chat_response(content):
    """A MagicMock shaped like an OpenAI chat.completions response."""
    r = MagicMock()
    r.choices = [MagicMock(message=MagicMock(content=content))]
    return r


@patch("core.translator.openai_compat.OpenAI")
def test_translate_segments_happy_path(mock_openai_cls):
    """3 segments in, 3 translations out, single API call — no recursion."""
    import json as _json

    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = _mock_chat_response(
        _json.dumps(["你好", "世界", "再见"])
    )
    mock_openai_cls.return_value = mock_client

    t = OpenAICompatTranslator(base_url="x", model="m")
    segments = _make_segments(3)
    t.translate_segments(segments, "zh-CN")

    assert [s.translated for s in segments] == ["你好", "世界", "再见"]
    assert mock_client.chat.completions.create.call_count == 1


@patch("core.translator.openai_compat.OpenAI")
def test_translate_segments_recovers_from_count_mismatch_via_bisection(
    mock_openai_cls,
):
    """The exact regression the user hit ('Translator returned 29 for 30
    segments'). The LLM returns N-1 translations for a batch of N; the
    code must bisect (N/2 + N/2) and recover instead of raising. Asserts
    final state is fully translated with no exception."""
    import json as _json

    mock_client = MagicMock()
    # First call (full batch of 4) returns only 3 translations — simulates
    # the LLM merging two lines. Subsequent calls (size 2 each) return
    # the correct count.
    mock_client.chat.completions.create.side_effect = [
        _mock_chat_response(_json.dumps(["你好", "世界", "merged"])),  # 3 != 4
        _mock_chat_response(_json.dumps(["你好", "世界"])),  # halves: 2/2 ✓
        _mock_chat_response(_json.dumps(["再见", "完了"])),  # 2/2 ✓
    ]
    mock_openai_cls.return_value = mock_client

    t = OpenAICompatTranslator(base_url="x", model="m")
    segments = _make_segments(4)
    t.translate_segments(segments, "zh-CN")

    # All 4 segments have a non-empty translation after recovery
    assert all(s.translated for s in segments)
    # 3 calls total: the failed full batch + 2 successful halves
    assert mock_client.chat.completions.create.call_count == 3


@patch("core.translator.openai_compat.OpenAI")
def test_translate_segments_raises_when_size1_batch_fails(mock_openai_cls):
    """Bisection has a base case: size-1 batches can't be halved further.
    If the LLM returns 0 translations for a single line (genuine provider
    error), surface a clear RuntimeError instead of looping forever."""
    import json as _json
    import pytest

    mock_client = MagicMock()
    # All calls return wrong counts — bisection drives down to size 1,
    # which still returns 0 instead of 1.
    mock_client.chat.completions.create.return_value = _mock_chat_response(
        _json.dumps([])
    )
    mock_openai_cls.return_value = mock_client

    t = OpenAICompatTranslator(base_url="x", model="m")
    segments = _make_segments(2)
    with pytest.raises(RuntimeError, match="0 for 1"):
        t.translate_segments(segments, "zh-CN")
