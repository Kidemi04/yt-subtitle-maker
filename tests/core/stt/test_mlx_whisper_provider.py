import pytest

from core.stt.base import TranscriptionSegment


def test_mlx_whisper_transcribes_segments(monkeypatch):
    import core.stt.mlx_whisper as mod

    def fake_transcribe(audio_path, path_or_hf_repo, language=None, word_timestamps=False):
        return {
            "language": language or "en",
            "segments": [
                {"start": 0.0, "end": 1.0, "text": " hi "},
                {"start": 1.0, "end": 2.0, "text": "there"},
            ],
        }

    monkeypatch.setattr(mod.platform, "system", lambda: "Darwin")
    monkeypatch.setattr(mod.platform, "machine", lambda: "arm64")
    monkeypatch.setattr(mod, "_mlx_transcribe", fake_transcribe)
    monkeypatch.setattr(mod.os.path, "exists", lambda path: True)

    provider = mod.MlxWhisperProvider(model="small", cache_dir="/tmp/mlx")
    result = provider.transcribe("/tmp/audio.wav", None, "en")

    assert result.source == "mlx-whisper"
    assert result.language == "en"
    assert result.segments == [
        TranscriptionSegment(id=1, start=0.0, end=1.0, text="hi"),
        TranscriptionSegment(id=2, start=1.0, end=2.0, text="there"),
    ]


def test_mlx_whisper_rejects_non_macos_arm64(monkeypatch):
    import core.stt.mlx_whisper as mod

    monkeypatch.setattr(mod.platform, "system", lambda: "Linux")
    monkeypatch.setattr(mod.platform, "machine", lambda: "x86_64")
    provider = mod.MlxWhisperProvider(model="small")

    with pytest.raises(RuntimeError, match="macOS Apple Silicon"):
        provider.transcribe("/tmp/audio.wav", None, "en")
