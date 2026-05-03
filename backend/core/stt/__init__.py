"""STT provider registry.

The registry is the only place outside `pipeline.py` that knows the concrete
provider classes. Adding faster-whisper / WhisperX / insanely-fast in V1.1
means appending one line here.
"""
from __future__ import annotations

from typing import Any

from core.stt.base import (
    TranscriptionProvider,
    TranscriptionResult,
    TranscriptionSegment,
)
from core.stt.whisper_local import WhisperLocalProvider
from core.stt.yt_captions import YtCaptionsProvider

_REGISTRY: dict[str, type] = {
    "openai-whisper": WhisperLocalProvider,
    "yt_captions": YtCaptionsProvider,
    # V1.1+:
    # "faster-whisper": FasterWhisperProvider,
    # "whisperx": WhisperXProvider,
    # "insanely-fast-whisper": InsanelyFastWhisperProvider,
}


def list_providers() -> list[str]:
    return list(_REGISTRY.keys())


def get_provider(name: str, **kwargs: Any) -> TranscriptionProvider:
    cls = _REGISTRY.get(name)
    if cls is None:
        raise KeyError(f"unknown stt provider: {name!r} (known: {list_providers()})")
    return cls(**kwargs)


__all__ = [
    "TranscriptionProvider",
    "TranscriptionResult",
    "TranscriptionSegment",
    "get_provider",
    "list_providers",
]
