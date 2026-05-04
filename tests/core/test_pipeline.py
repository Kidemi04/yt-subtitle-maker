from unittest.mock import patch
from core.pipeline import _percent_from_yt_dlp, _select_stt_provider
from core.config import AppConfig


def test_percent_from_yt_dlp_prefers_byte_counters():
    assert _percent_from_yt_dlp({"downloaded_bytes": 50, "total_bytes": 200}) == 25.0


def test_percent_from_yt_dlp_uses_total_estimate_when_no_total():
    pct = _percent_from_yt_dlp({"downloaded_bytes": 30, "total_bytes_estimate": 60})
    assert pct == 50.0


def test_percent_from_yt_dlp_handles_ansi_escaped_percent_string():
    """yt-dlp colorized output produces strings like '\\x1b[0;94m  0.0%\\x1b[0m'."""
    d = {"_percent_str": "\x1b[0;94m  42.5%\x1b[0m"}
    assert _percent_from_yt_dlp(d) == 42.5


def test_percent_from_yt_dlp_handles_plain_percent_string():
    assert _percent_from_yt_dlp({"_percent_str": " 75.0%"}) == 75.0


def test_percent_from_yt_dlp_returns_none_when_unparseable():
    assert _percent_from_yt_dlp({}) is None
    assert _percent_from_yt_dlp({"_percent_str": "N/A"}) is None
    # Zero-byte total must not raise ZeroDivisionError.
    assert _percent_from_yt_dlp({"downloaded_bytes": 0, "total_bytes": 0}) is None


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
