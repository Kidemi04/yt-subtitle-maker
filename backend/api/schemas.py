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

    # Per-job translator override. Accepts the legacy 3-slot identifiers
    # ('gemini' / 'local_openai' / 'openai') AND the Phase 4d named-profile
    # form 'custom:<id>' for user-saved profiles in `customTranslators`.
    # Pipeline `_make_translator` dispatches both shapes. Default is None so
    # the pipeline falls through to `cfg.active_translator` /
    # `cfg.translator_provider` — hard-coding a value here would override the
    # user's Settings choice because pipeline.py uses
    # `request.get(...) or cfg.<field>`.
    translatorProvider: str | None = None
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
    # Ad-hoc spec form — specify the provider + credentials directly. All
    # credential fields default to None so the backend resolves missing values
    # from the saved config (so the Generate page can test with just
    # `{provider}` instead of forcing the user to repeat baseUrl/model/apiKey
    # already saved in Settings).
    provider: TranslatorProvider | None = None
    baseUrl: str | None = None
    model: str | None = None
    apiKey: str | None = None

    # Saved-profile form — resolve credentials server-side via
    # `get_active_translator`. profileId: "gemini" | "local_openai" |
    # "custom:<id>". `useSavedKey=True` is required for this form so the
    # backend doesn't silently fall back to the ad-hoc path if `provider` is
    # omitted by accident.
    profileId: str | None = None
    useSavedKey: bool = False

    # Language to translate the test phrase ("Hello, world.") into. Frontend
    # passes the current cfg.default_target_lang; we default to the same on
    # the server so this is safe to omit.
    targetLang: str = "zh-CN"


class ListModelsRequest(BaseModel):
    # Ad-hoc form (existing behaviour)
    provider: TranslatorProvider | None = None
    baseUrl: str | None = None
    apiKey: str | None = None
    # Saved-profile form (Phase 4d)
    profileId: str | None = None
    useSavedKey: bool = False


class BackendCapabilities(BaseModel):
    mpvAvailable: bool
    cudaAvailable: bool
    installedSttEngines: list[str]
    whisperModelsAvailable: list[str]
    version: str
    # Detected JS runtime spec yt-dlp uses to deobfuscate YouTube format URLs
    # ("deno:/path", "node:/path"), or null if neither is on PATH and no
    # override is configured. When null, format extraction is degraded.
    jsRuntime: str | None = None
