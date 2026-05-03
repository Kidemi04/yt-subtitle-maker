import pytest
from core.stt.whisper_local import WhisperLocalProvider
from core.stt.base import TranscriptionProvider


def test_provider_satisfies_protocol():
    provider = WhisperLocalProvider(model="tiny", device="cpu")
    assert isinstance(provider, TranscriptionProvider)
    assert provider.name == "openai-whisper"
    assert provider.needs_audio is True


def test_is_available_returns_true_after_init():
    provider = WhisperLocalProvider(model="tiny", device="cpu")
    assert provider.is_available() is True


def test_constructor_validates_device():
    with pytest.raises(ValueError, match="device must be"):
        WhisperLocalProvider(model="tiny", device="weird-device")


def test_constructor_rejects_auto_language_at_protocol_level():
    """Belt-and-suspenders: even if a caller sneaks 'auto' through, we error."""
    provider = WhisperLocalProvider(model="tiny", device="cpu")
    with pytest.raises(ValueError, match="must be a concrete language code"):
        provider.transcribe(audio_path="/does/not/matter.wav", url=None, language="auto")
