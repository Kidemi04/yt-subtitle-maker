import pytest
from unittest.mock import MagicMock, patch
from core.translator.openai_compat import OpenAICompatTranslator
from core.translator.base import TranslationProvider
from core.stt.base import TranscriptionSegment


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
