"""User configuration. Persisted to ~/.yt_subtitle_tool/config.json."""
from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass
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


def load_config() -> AppConfig:
    p = config_path()
    if not p.exists():
        return AppConfig()
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
        # Filter out unknown keys to tolerate older configs
        valid = {k: v for k, v in data.items() if k in AppConfig.__dataclass_fields__}
        return AppConfig(**valid)
    except Exception:
        return AppConfig()


def save_config(cfg: AppConfig) -> None:
    config_dir().mkdir(parents=True, exist_ok=True)
    config_path().write_text(json.dumps(asdict(cfg), indent=2), encoding="utf-8")
