"""User configuration. Persisted to ~/.yt_subtitle_tool/config.json."""
from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Literal

CONFIG_FILENAME = "config.json"
CONFIG_DIR_NAME = ".yt_subtitle_tool"


def config_dir() -> Path:
    home = os.environ.get("USERPROFILE") or os.environ.get("HOME") or os.path.expanduser("~")
    return Path(home) / CONFIG_DIR_NAME


def config_path() -> Path:
    return config_dir() / CONFIG_FILENAME


@dataclass
class AppConfig:
    # General
    backend_url: str = "http://127.0.0.1:8000"
    download_dir: str = ""
    output_dir: str = ""

    # Cookies
    cookie_browser: str = ""
    cookie_profile: str = ""
    cookies_txt_path: str = ""

    # STT defaults (overridable per-job)
    default_stt_engine: str = "openai-whisper"
    default_whisper_model: str = "turbo"
    default_whisper_device: str = "auto"
    default_source_lang: str = "en"      # NOT 'auto' — see spec §14 #6
    yt_captions_first: bool = True
    vad_enabled: bool = True
    ffmpeg_resample_16k: bool = True

    # Translation
    enable_translation: bool = False
    auto_translate_title: bool = True
    default_target_lang: str = "zh-CN"
    translator_provider: Literal["gemini", "local_openai", "openai"] = "gemini"

    # Named provider profiles (Phase 4d).
    # Each entry: { id, name, base_url, api_key, model }.
    # Built-in profiles ("gemini", "local_openai") are stored separately below;
    # custom entries (including migrated legacy openai_*) live here.
    custom_translators: list[dict] = field(default_factory=list)
    # "gemini" | "local_openai" | "custom:<id>"
    active_translator: str = "gemini"

    # Gemini
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash-lite"

    # Local OpenAI (LM Studio / Ollama)
    local_openai_base_url: str = "http://127.0.0.1:1234/v1"
    local_openai_model: str = ""
    local_openai_api_key: str = ""

    # OpenAI-compatible
    openai_base_url: str = "https://api.openai.com/v1"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"

    # Misc
    mpv_path: str = ""
    whisper_cache_dir: str = ""
    logs_verbosity: Literal["error", "warning", "info", "debug"] = "info"
    # JS runtime override for yt-dlp's YouTube player extraction. Recent
    # yt-dlp requires Deno or Node to deobfuscate format URLs. Empty string
    # = auto-detect (PATH lookup). Otherwise: "node" / "deno" / a bare or
    # "name:path" spec.
    js_runtime_path: str = ""

    # mpv subtitle style — only applied when non-default. Empty string / 0
    # means "let mpv use its built-in default for that flag", so changing
    # nothing here keeps behaviour identical to a fresh mpv install.
    # Reference: mpv --sub-* options.
    sub_font: str = ""           # e.g. "Noto Sans CJK SC", "Inter", "Arial"
    sub_font_size: int = 0       # 0 = mpv default (55)
    sub_color: str = ""          # "#RRGGBB" — text fill
    sub_border_color: str = ""   # "#RRGGBB" — outline
    sub_border_size: float = -1  # <0 = mpv default (3); 0 = no outline
    sub_back_color: str = ""     # "#RRGGBBAA" — opaque box behind text; "" = none
    sub_bold: bool = False
    sub_margin_y: int = 0        # 0 = mpv default; bottom margin in pixels


_DEFAULT_OPENAI_URL = "https://api.openai.com/v1"


def _migrate_config(data: dict) -> dict:
    """Idempotent migration of legacy config keys to the Phase-4d shape.

    Runs on the raw dict before AppConfig is constructed.  Safe to call
    on already-migrated configs — produces the identical output.

    Migrations performed:
    1. If `openai_api_key` or `openai_model` are non-default AND there is no
       existing custom_translators entry with id='openai-legacy', append one.
    2. If `translator_provider == 'openai'` and `active_translator` is not
       already set in the raw dict, set it to 'custom:openai-legacy'.
    3. If `translator_provider` is 'gemini' or 'local_openai' and
       `active_translator` is not already in the raw dict, copy it across.
    """
    data = dict(data)  # shallow copy — don't mutate the caller's dict

    existing_ids = {e.get("id") for e in data.get("custom_translators", [])}

    # Migration 1: promote legacy openai_* block
    openai_key = data.get("openai_api_key", "")
    openai_model = data.get("openai_model", "")
    openai_url = data.get("openai_base_url", _DEFAULT_OPENAI_URL)
    # "gpt-4o-mini" is AppConfig.openai_model's default — keep in sync if that changes.
    is_non_default = bool(openai_key) or (openai_model and openai_model != "gpt-4o-mini")

    if is_non_default and "openai-legacy" not in existing_ids:
        legacy_entry = {
            "id": "openai-legacy",
            "name": "OpenAI",
            "base_url": openai_url or _DEFAULT_OPENAI_URL,
            "api_key": openai_key,
            "model": openai_model or "gpt-4o-mini",
        }
        data.setdefault("custom_translators", [])
        data["custom_translators"] = list(data["custom_translators"]) + [legacy_entry]

    # Migration 2 & 3: map translator_provider → active_translator
    if "active_translator" not in data:
        provider = data.get("translator_provider", "gemini")
        if provider == "openai":
            data["active_translator"] = "custom:openai-legacy"
        elif provider in ("gemini", "local_openai"):
            data["active_translator"] = provider
        else:
            data["active_translator"] = "gemini"

    return data


def load_config() -> AppConfig:
    p = config_path()
    if not p.exists():
        return AppConfig()
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
        data = _migrate_config(data)
        # Filter out unknown keys to tolerate older configs
        valid = {k: v for k, v in data.items() if k in AppConfig.__dataclass_fields__}
        return AppConfig(**valid)
    except Exception:
        return AppConfig()


def save_config(cfg: AppConfig) -> None:
    config_dir().mkdir(parents=True, exist_ok=True)
    config_path().write_text(json.dumps(asdict(cfg), indent=2), encoding="utf-8")
