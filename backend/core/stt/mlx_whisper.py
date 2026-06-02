from __future__ import annotations

import os
import platform
from collections.abc import Callable
from pathlib import Path

from core.stt.base import TranscriptionResult, TranscriptionSegment
from core.stt.model_catalog import engine_model_dir


def _is_macos_arm64() -> bool:
    return platform.system() == "Darwin" and platform.machine().lower() in {"arm64", "aarch64"}


def _mlx_transcribe(
    audio_path: str,
    path_or_hf_repo: str,
    language: str | None,
    word_timestamps: bool,
):
    import mlx_whisper

    kwargs = {
        "path_or_hf_repo": path_or_hf_repo,
        "word_timestamps": word_timestamps,
    }
    if language:
        kwargs["language"] = language
    return mlx_whisper.transcribe(audio_path, **kwargs)


class MlxWhisperProvider:
    name = "mlx-whisper"
    needs_audio = True

    def __init__(self, model: str = "turbo", device: str = "auto", cache_dir: str | None = None):
        self.model_name = model
        self._device_request = device
        self.cache_dir = cache_dir

    def _model_ref(self) -> str:
        if self.cache_dir:
            candidate = Path(self.cache_dir) / self.model_name
            return str(candidate) if candidate.is_dir() else f"mlx-community/whisper-{self.model_name}"
        candidate = engine_model_dir(self.name, self.model_name)
        if candidate.is_dir():
            return str(candidate)
        return f"mlx-community/whisper-{self.model_name}"

    def is_available(self, url: str | None = None) -> bool:
        if not _is_macos_arm64():
            return False
        try:
            import mlx_whisper  # noqa: F401

            return True
        except Exception:
            return False

    def transcribe(
        self,
        audio_path: str | None,
        url: str | None,
        language: str | None,
        progress: Callable[[float], None] | None = None,
    ) -> TranscriptionResult:
        if not _is_macos_arm64():
            raise RuntimeError("MLX Whisper requires macOS Apple Silicon")
        if language is not None and language.lower() in {"auto", "auto detect"}:
            raise ValueError(
                "language must be a concrete language code (e.g. 'en', 'zh'); "
                "'auto' should be handled by the caller, not pushed into the engine"
            )
        if not audio_path:
            raise ValueError("MlxWhisperProvider requires audio_path")
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        if progress:
            progress(0.0)
        result = _mlx_transcribe(
            audio_path,
            path_or_hf_repo=self._model_ref(),
            language=language,
            word_timestamps=False,
        )
        raw_segments = result.get("segments") or []
        total = len(raw_segments) or 1
        segments: list[TranscriptionSegment] = []
        for i, seg in enumerate(raw_segments, start=1):
            segments.append(
                TranscriptionSegment(
                    id=i,
                    start=float(seg["start"]),
                    end=float(seg["end"]),
                    text=str(seg["text"]).strip(),
                )
            )
            if progress:
                progress(i / total)
        return TranscriptionResult(
            segments=segments,
            language=result.get("language", language or "unknown"),
            source=self.name,
        )
