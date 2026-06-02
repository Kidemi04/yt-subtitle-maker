from __future__ import annotations

import os
from collections.abc import Callable
from pathlib import Path
from typing import Any

import torch

from core.stt.base import TranscriptionResult, TranscriptionSegment
from core.stt.model_catalog import engine_model_dir

VALID_DEVICES = {"auto", "cpu", "gpu", "cuda"}
WhisperModel: Any = None


class FasterWhisperProvider:
    name = "faster-whisper"
    needs_audio = True

    def __init__(self, model: str = "turbo", device: str = "auto", cache_dir: str | None = None):
        if device not in VALID_DEVICES:
            raise ValueError(f"device must be one of {VALID_DEVICES}, got {device!r}")
        self.model_name = model
        self._device_request = device
        self.cache_dir = cache_dir
        self._model = None

    def _resolve_device(self) -> str:
        if self._device_request == "auto":
            return "cuda" if torch.cuda.is_available() else "cpu"
        if self._device_request in {"gpu", "cuda"}:
            if not torch.cuda.is_available():
                raise RuntimeError("CUDA/GPU requested but not available")
            return "cuda"
        return "cpu"

    def _compute_type(self, device: str) -> str:
        return "float16" if device == "cuda" else "int8"

    def _model_ref(self) -> str:
        if self.cache_dir:
            candidate = Path(self.cache_dir) / self.model_name
            return str(candidate) if candidate.is_dir() else self.model_name
        candidate = engine_model_dir(self.name, self.model_name)
        return str(candidate) if candidate.is_dir() else self.model_name

    def _download_root(self) -> str | None:
        if self.cache_dir:
            return self.cache_dir
        return str(engine_model_dir(self.name, self.model_name).parent)

    def _load_model(self):
        global WhisperModel
        if self._model is None:
            if WhisperModel is None:
                from faster_whisper import WhisperModel as FasterWhisperModel

                WhisperModel = FasterWhisperModel
            device = self._resolve_device()
            self._model = WhisperModel(
                self._model_ref(),
                device=device,
                compute_type=self._compute_type(device),
                download_root=self._download_root(),
            )
        return self._model

    def is_available(self, url: str | None = None) -> bool:
        try:
            import faster_whisper  # noqa: F401

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
        if language is not None and language.lower() in {"auto", "auto detect"}:
            raise ValueError(
                "language must be a concrete language code (e.g. 'en', 'zh'); "
                "'auto' should be handled by the caller, not pushed into the engine"
            )
        if not audio_path:
            raise ValueError("FasterWhisperProvider requires audio_path")
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        model = self._load_model()
        if progress:
            progress(0.0)
        segments_iter, info = model.transcribe(
            audio_path,
            language=language,
            beam_size=5,
            vad_filter=False,
        )
        raw_segments = list(segments_iter)
        total = len(raw_segments) or 1
        segments: list[TranscriptionSegment] = []
        for i, seg in enumerate(raw_segments, start=1):
            segments.append(
                TranscriptionSegment(
                    id=i,
                    start=float(seg.start),
                    end=float(seg.end),
                    text=str(seg.text).strip(),
                )
            )
            if progress:
                progress(i / total)
        return TranscriptionResult(
            segments=segments,
            language=getattr(info, "language", language or "unknown"),
            source=self.name,
        )
