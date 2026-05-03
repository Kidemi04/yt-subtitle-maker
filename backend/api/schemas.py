"""Pydantic schemas mirroring the TypeScript types in design spec §6.1."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, field_validator

# ─── STT ──────────────────────────────────────────────────────────────────────

SttSource = Literal["auto", "yt_captions", "whisper"]
SttEngine = Literal[
    "openai-whisper", "faster-whisper", "whisperx", "insanely-fast-whisper"
]
WhisperModel = Literal["tiny", "base", "small", "medium", "turbo", "large-v3"]
WhisperDevice = Literal["auto", "cpu", "gpu"]
TranslatorProvider = Literal["gemini", "local_openai", "openai"]


class VideoMetadata(BaseModel):
    ok: bool
    videoId: str | None = None
    titleOriginal: str | None = None
    titleTranslated: str | None = None
    thumbnailUrl: str | None = None
    durationSeconds: float | None = None
    channel: str | None = None
    error: str | None = None


class ProcessRequest(BaseModel):
    url: str
    sttSource: SttSource
    sttEngine: SttEngine | None = None
    whisperModel: WhisperModel
    whisperDevice: WhisperDevice
    vadEnabled: bool
    sourceLang: str
    enableTranslation: bool
    targetLang: str | None = None

    translatorProvider: TranslatorProvider = "gemini"
    translatorBaseUrl: str | None = None
    translatorModel: str | None = None
    translatorApiKey: str | None = None

    downloadOnly: bool = False

    @field_validator("sourceLang")
    @classmethod
    def reject_auto(cls, v: str) -> str:
        if v.lower() in {"auto", "auto detect", ""}:
            raise ValueError(
                "sourceLang must be a concrete language code; "
                "frontend should resolve 'auto' to a real code (default 'en')"
            )
        return v


class TranslatorTestRequest(BaseModel):
    provider: TranslatorProvider
    baseUrl: str | None = None
    model: str
    apiKey: str | None = None


class ListModelsRequest(BaseModel):
    provider: TranslatorProvider
    baseUrl: str | None = None
    apiKey: str | None = None


class BackendCapabilities(BaseModel):
    mpvAvailable: bool
    cudaAvailable: bool
    installedSttEngines: list[str]
    whisperModelsAvailable: list[str]
    version: str
