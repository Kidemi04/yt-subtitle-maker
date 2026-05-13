"""Config GET/POST. POST accepts partial updates."""
from __future__ import annotations

import shutil
from dataclasses import asdict
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Body

from core.config import AppConfig, load_config, save_config
from core.dependency_manager import get_whisper_cache_dir

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
    "customTranslators": "custom_translators",
    "activeTranslator": "active_translator",
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
    "jsRuntimePath": "js_runtime_path",
    "subFont": "sub_font",
    "subFontsByLang": "sub_fonts_by_lang",
    "subFontSize": "sub_font_size",
    "subColor": "sub_color",
    "subBorderColor": "sub_border_color",
    "subBorderSize": "sub_border_size",
    "subBackColor": "sub_back_color",
    "subBold": "sub_bold",
    "subMarginY": "sub_margin_y",
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


def _profile_to_camel(p: dict) -> dict:
    """Convert a single custom_translators entry (snake_case) to camelCase wire format."""
    return {
        "id": p.get("id", ""),
        "name": p.get("name", ""),
        "baseUrl": p.get("base_url", ""),
        "apiKey": MASK if p.get("api_key") else "",
        "model": p.get("model", ""),
    }


def _mask_profile_keys(profiles: list) -> list:
    """Return a list of camelCase per-profile dicts with api_key masked."""
    return [_profile_to_camel(p) for p in profiles]


def _profile_from_camel(entry: dict, existing_by_id: dict) -> dict:
    """Convert an incoming camelCase profile entry to snake_case for storage.

    If apiKey == MASK and we have a saved entry with the same id,
    keep the saved api_key (don't overwrite with the sentinel).
    """
    profile_id = entry.get("id", "")
    raw_key = entry.get("apiKey", "")
    if raw_key == MASK:
        saved = existing_by_id.get(profile_id, {})
        api_key = saved.get("api_key", "")
    else:
        api_key = raw_key
    return {
        "id": profile_id,
        "name": entry.get("name", ""),
        "base_url": entry.get("baseUrl", ""),
        "api_key": api_key,
        "model": entry.get("model", ""),
    }


# Path config fields that are blank-by-default and resolved at runtime relative
# to the backend's CWD (output/downloads) or to a system location. The frontend
# shows these resolved values as placeholders / uses them for ↺-to-default.
def _effective_defaults() -> dict:
    d = asdict(AppConfig())
    cwd = Path.cwd()
    d["output_dir"] = str(cwd / "output")
    d["download_dir"] = str(cwd / "downloads")
    if not d["whisper_cache_dir"]:
        # The app's own model-storage directory: <project_root>/models in dev,
        # <Resources>/models in the packaged app. This is where the Init screen
        # (POST /api/dependencies/install) downloads Whisper weights via
        # core.dependency_manager.download_whisper_model().
        d["whisper_cache_dir"] = get_whisper_cache_dir()
    d["mpv_path"] = shutil.which("mpv") or ""
    # js_runtime_path stays "" — /api/version already reports the auto-detected runtime.
    return d


def _config_response(cfg: AppConfig) -> dict:
    d = asdict(cfg)
    # Separate custom_translators before the generic camel conversion: the
    # per-profile dicts need their own snake→camel pass AND per-profile masking
    # of api_key, which the flat _to_camel/_mask_secrets helpers don't cover.
    profiles_snake = d.pop("custom_translators", [])
    out = _mask_secrets(_to_camel(d))
    out["customTranslators"] = _mask_profile_keys(profiles_snake)

    defaults_d = _effective_defaults()
    defaults_profiles = defaults_d.pop("custom_translators", [])
    defaults_out = _mask_secrets(_to_camel(defaults_d))
    defaults_out["customTranslators"] = _mask_profile_keys(defaults_profiles)
    out["_defaults"] = defaults_out
    return out


@router.get("/config")
def get_config() -> dict:
    return _config_response(load_config())


@router.post("/config")
def update_config(payload: dict[str, Any] = Body(...)) -> dict:  # noqa: B008
    cfg = load_config()
    existing_by_id = {e["id"]: e for e in cfg.custom_translators}

    for camel_key, value in payload.items():
        if camel_key == "customTranslators":
            # value is a list of camelCase profile dicts. Snake-case each entry
            # and apply the "***"-keeps-saved-key rule before assigning.
            cfg.custom_translators = [
                _profile_from_camel(entry, existing_by_id)
                for entry in (value or [])
            ]
            continue
        # Don't overwrite real keys with the GET-side mask
        if camel_key in SECRET_KEYS and value == MASK:
            continue
        snake_key = _CAMEL_TO_SNAKE.get(camel_key)
        if snake_key and hasattr(cfg, snake_key):
            setattr(cfg, snake_key, value)
    save_config(cfg)
    return _config_response(load_config())


@router.post("/config/reset")
def reset_config() -> dict:
    """Reset every setting to AppConfig() defaults, persist, return masked config."""
    save_config(AppConfig())
    return _config_response(load_config())
