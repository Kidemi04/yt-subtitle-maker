import pytest
from core.stt import get_provider, list_providers


def test_registry_lists_known_providers():
    names = list_providers()
    assert "openai-whisper" in names
    assert "yt_captions" in names


def test_get_provider_returns_instance_by_name():
    p = get_provider("openai-whisper", model="tiny", device="cpu")
    assert p.name == "openai-whisper"


def test_get_provider_with_unknown_name_raises():
    with pytest.raises(KeyError, match="unknown stt provider"):
        get_provider("nonexistent")
