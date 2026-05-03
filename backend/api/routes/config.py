"""Config GET/POST. POST accepts partial updates."""
from __future__ import annotations

from dataclasses import asdict
from typing import Any

from fastapi import APIRouter, Body

from core.config import load_config, save_config

router = APIRouter(prefix="/api", tags=["config"])


# Map TS camelCase keys to Python snake_case fields
_CAMEL_TO_SNAKE = {
    "backendUrl": "backend_url",
    "downloadDir": "download_dir",
    "outputDir": "output_dir",
    "cookieBrowser": "cookie_browser",
    "cookieProfile": "cookie_profile",
    "cookiesTxtPath": "cookies_txt_path",
    "defaultSttEngine": "default_stt_engine",
    "defaultWhisperModel": "default_whisper_model",
    "defaultWhisperDevice": "default_whisper_device",
    "defaultSourceLang": "default_source_lang",
    "defaultTargetLang": "default_target_lang",
    "ytCaptionsFirst": "yt_captions_first",
    "vadEnabled": "vad_enabled",
    "ffmpegResample16k": "ffmpeg_resample_16k",
    "enableTranslation": "enable_translation",
    "autoTranslateTitle": "auto_translate_title",
    "translatorProvider": "translator_provider",
    "geminiApiKey": "gemini_api_key",
    "geminiModel": "gemini_model",
    "localOpenaiBaseUrl": "local_openai_base_url",
    "localOpenaiModel": "local_openai_model",
    "localOpenaiApiKey": "local_openai_api_key",
    "openaiBaseUrl": "openai_base_url",
    "openaiApiKey": "openai_api_key",
    "openaiModel": "openai_model",
    "mpvPath": "mpv_path",
    "whisperCacheDir": "whisper_cache_dir",
    "logsVerbosity": "logs_verbosity",
}
_SNAKE_TO_CAMEL = {v: k for k, v in _CAMEL_TO_SNAKE.items()}

# API keys are masked on GET so they aren't leaked over the wire (V2 ngrok).
# POST ignores the mask sentinel so the frontend can GET → render → POST
# without re-entering the key.
SECRET_KEYS = {"geminiApiKey", "localOpenaiApiKey", "openaiApiKey"}
MASK = "***"


def _to_camel(d: dict) -> dict:
    return {_SNAKE_TO_CAMEL.get(k, k): v for k, v in d.items()}


def _mask_secrets(d: dict) -> dict:
    return {k: (MASK if k in SECRET_KEYS and v else v) for k, v in d.items()}


@router.get("/config")
def get_config() -> dict:
    return _mask_secrets(_to_camel(asdict(load_config())))


@router.post("/config")
def update_config(payload: dict[str, Any] = Body(...)) -> dict:  # noqa: B008
    cfg = load_config()
    for camel_key, value in payload.items():
        # Don't overwrite real keys with the GET-side mask
        if camel_key in SECRET_KEYS and value == MASK:
            continue
        snake_key = _CAMEL_TO_SNAKE.get(camel_key)
        if snake_key and hasattr(cfg, snake_key):
            setattr(cfg, snake_key, value)
    save_config(cfg)
    return {"ok": True}
