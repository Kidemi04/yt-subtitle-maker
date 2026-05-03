from unittest.mock import MagicMock, patch
from core.pipeline import _select_stt_provider
from core.config import AppConfig


@patch("core.pipeline.YtCaptionsProvider")
def test_auto_uses_yt_captions_when_available(mock_yt):
    mock_yt.return_value.is_available.return_value = True
    mock_yt.return_value.name = "yt_captions"
    request = {"sttSource": "auto", "sttEngine": "openai-whisper", "whisperModel": "tiny", "whisperDevice": "cpu"}
    cfg = AppConfig()
    provider = _select_stt_provider(request, cfg, url="https://youtu.be/abc")
    assert provider.name == "yt_captions"


@patch("core.pipeline.YtCaptionsProvider")
@patch("core.pipeline.get_provider")
def test_auto_falls_back_to_whisper_when_no_captions(mock_get, mock_yt):
    mock_yt.return_value.is_available.return_value = False
    mock_get.return_value.name = "openai-whisper"
    request = {"sttSource": "auto", "sttEngine": "openai-whisper", "whisperModel": "tiny", "whisperDevice": "cpu"}
    cfg = AppConfig()
    provider = _select_stt_provider(request, cfg, url="https://youtu.be/abc")
    assert provider.name == "openai-whisper"


@patch("core.pipeline.get_provider")
def test_whisper_only_skips_yt_captions_check(mock_get):
    mock_get.return_value.name = "openai-whisper"
    request = {"sttSource": "whisper", "sttEngine": "openai-whisper", "whisperModel": "tiny", "whisperDevice": "cpu"}
    cfg = AppConfig()
    provider = _select_stt_provider(request, cfg, url="https://youtu.be/abc")
    assert provider.name == "openai-whisper"
