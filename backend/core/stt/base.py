"""STT provider abstraction.

All STT engines (whisper, faster-whisper, yt_captions, etc.) implement
the TranscriptionProvider protocol so the pipeline can swap them with
zero coupling to the engine.
"""
from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field  # noqa: F401
from typing import Protocol, runtime_checkable


@dataclass
class TranscriptionSegment:
    """One subtitle entry.

    Time fields are seconds (floats). Never use strings or milliseconds.
    The `translated` field is filled by the translator stage, not STT.
    """
    id: int
    start: float
    end: float
    text: str
    translated: str | None = None


@dataclass
class TranscriptionResult:
    """Whatever an STT provider returns."""
    segments: list[TranscriptionSegment]
    language: str          # detected or pinned language code (e.g. 'en', 'zh')
    source: str            # provider identifier, used for telemetry / UI badges


@runtime_checkable
class TranscriptionProvider(Protocol):
    """Any STT engine. Implementations are stateless w.r.t. concurrent calls."""

    name: str
    needs_audio: bool      # False for yt_captions (which only needs a URL)

    def is_available(self, url: str | None = None) -> bool:
        """Whether this provider can handle the given input right now.

        For yt_captions, this checks if the video has auto-captions.
        For Whisper engines, this typically just returns True after model download.
        """
        ...

    def transcribe(
        self,
        audio_path: str | None,
        url: str | None,
        language: str | None,
        progress: Callable[[float], None] | None = None,
    ) -> TranscriptionResult:
        """Run transcription. `progress(0.0..1.0)` may be called periodically."""
        ...
