import types

import pytest

from core.stt.base import TranscriptionSegment


class FakeFWModel:
    captured = {}

    def __init__(self, model, device, compute_type, download_root):
        self.captured.update(
            model=model,
            device=device,
            compute_type=compute_type,
            download_root=download_root,
        )

    def transcribe(self, audio_path, language=None, beam_size=5, vad_filter=False):
        segments = [
            types.SimpleNamespace(id=7, start=1.25, end=2.5, text=" hello "),
            types.SimpleNamespace(id=8, start=2.5, end=4.0, text="world"),
        ]
        info = types.SimpleNamespace(language=language or "en")
        return iter(segments), info


def test_faster_whisper_transcribes_segments(monkeypatch):
    import core.stt.faster_whisper as mod

    monkeypatch.setattr(mod, "WhisperModel", FakeFWModel)
    monkeypatch.setattr(mod.os.path, "exists", lambda path: True)
    provider = mod.FasterWhisperProvider(model="small", device="cpu", cache_dir="/tmp/fw")

    result = provider.transcribe("/tmp/audio.wav", None, "en")

    assert result.source == "faster-whisper"
    assert result.language == "en"
    assert result.segments == [
        TranscriptionSegment(id=1, start=1.25, end=2.5, text="hello"),
        TranscriptionSegment(id=2, start=2.5, end=4.0, text="world"),
    ]
    assert FakeFWModel.captured["device"] == "cpu"
    assert FakeFWModel.captured["compute_type"] == "int8"


def test_faster_whisper_rejects_auto_language(monkeypatch):
    import core.stt.faster_whisper as mod

    monkeypatch.setattr(mod, "WhisperModel", FakeFWModel)
    monkeypatch.setattr(mod.os.path, "exists", lambda path: True)
    provider = mod.FasterWhisperProvider(model="small", device="cpu")

    with pytest.raises(ValueError, match="language must be a concrete"):
        provider.transcribe("/tmp/audio.wav", None, "auto")
