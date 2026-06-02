from core.config import AppConfig
from core.pipeline import _select_stt_provider


def test_select_stt_provider_uses_faster_whisper(monkeypatch):
    monkeypatch.setattr("core.pipeline.get_provider", lambda name, **kw: (name, kw))

    provider_name, kwargs = _select_stt_provider(
        {
            "sttSource": "whisper",
            "sttEngine": "faster-whisper",
            "whisperModel": "small",
            "whisperDevice": "cpu",
        },
        AppConfig(),
        "https://youtu.be/x",
    )

    assert provider_name == "faster-whisper"
    assert kwargs["model"] == "small"
    assert kwargs["device"] == "cpu"


def test_default_config_prefers_openai_whisper_not_youtube_auto():
    cfg = AppConfig()
    assert cfg.default_stt_engine == "openai-whisper"
    assert cfg.yt_captions_first is False
