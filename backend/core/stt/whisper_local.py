"""openai-whisper provider — wraps the official OpenAI Python whisper package."""
from __future__ import annotations

import os
from collections.abc import Callable

import torch
import whisper

from core.stt.base import TranscriptionResult, TranscriptionSegment

VALID_DEVICES = {"auto", "cpu", "gpu", "cuda"}


class WhisperLocalProvider:
    """openai-whisper engine. Stable, slow, no built-in VAD."""

    name = "openai-whisper"
    needs_audio = True

    def __init__(self, model: str = "turbo", device: str = "auto", cache_dir: str | None = None):
        if device not in VALID_DEVICES:
            raise ValueError(f"device must be one of {VALID_DEVICES}, got {device!r}")
        self.model_name = model
        self._device_request = device
        self.cache_dir = cache_dir
        self._model = None  # lazy-loaded

    def _resolve_device(self) -> str:
        if self._device_request == "auto":
            return "cuda" if torch.cuda.is_available() else "cpu"
        if self._device_request in {"gpu", "cuda"}:
            if not torch.cuda.is_available():
                raise RuntimeError("CUDA/GPU requested but not available")
            return "cuda"
        return "cpu"

    def is_available(self, url: str | None = None) -> bool:
        return True

    def _load_model(self):
        if self._model is None:
            device = self._resolve_device()
            self._model = whisper.load_model(
                self.model_name, device=device, download_root=self.cache_dir
            )
        return self._model

    def transcribe(
        self,
        audio_path: str | None,
        url: str | None,
        language: str | None,
        progress: Callable[[float], None] | None = None,
    ) -> TranscriptionResult:
        # Validate language FIRST (belt-and-suspenders against 'auto' sneaking through),
        # before any disk I/O or model loading.
        if language is not None and language.lower() in {"auto", "auto detect"}:
            raise ValueError(
                "language must be a concrete language code (e.g. 'en', 'zh'); "
                "'auto' should be handled by the caller, not pushed into the engine"
            )
        if not audio_path:
            raise ValueError("WhisperLocalProvider requires audio_path")
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        model = self._load_model()
        # Note: openai-whisper has no real progress callback. We emit one tick before/after.
        if progress:
            progress(0.0)
        result = model.transcribe(audio_path, language=language, verbose=False)
        if progress:
            progress(1.0)

        segments = [
            TranscriptionSegment(
                id=i + 1,
                start=float(seg["start"]),
                end=float(seg["end"]),
                text=seg["text"].strip(),
            )
            for i, seg in enumerate(result["segments"])
        ]
        return TranscriptionResult(
            segments=segments,
            language=result.get("language", language or "unknown"),
            source=self.name,
        )
