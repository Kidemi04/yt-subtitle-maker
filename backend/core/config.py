"""User configuration. Persisted to ~/.yt_subtitle_tool/config.json.

Persistence contract (matters because this file holds the user's API keys):

* **Writes are atomic.** `save_config` writes a sibling temp file, fsyncs it,
  then `os.replace`s it over the real one. A crash or quit mid-write can no
  longer leave a truncated `config.json`.
* **Corruption is never silent.** An unreadable/unparseable config is moved
  aside to `config.json.corrupt-<n>` and recorded in `last_load_error()`
  instead of being discarded. Previously a truncated file made every setting
  — API keys included — revert to defaults with no warning, and the next
  autosave overwrote the original for good.
* **Values are validated.** `AppConfig` is a plain dataclass, so nothing
  type-checks the JSON on the way in. `_coerce` does that explicitly:
  garbage like `sub_font_size="not-a-number"` used to flow straight through
  into an mpv command line.
* **The file is 0600.** It contains plaintext provider keys.
"""
from __future__ import annotations

import contextlib
import json
import os
import tempfile
from dataclasses import asdict, dataclass, field, fields
from pathlib import Path
from typing import Literal, get_args, get_origin, get_type_hints

CONFIG_FILENAME = "config.json"
CONFIG_DIR_NAME = ".yt_subtitle_tool"
CONFIG_MODE = 0o600


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
    # "auto" lets each Whisper engine run its own language detection. The old
    # default was a hard-coded "en", which silently mis-transcribed every
    # non-English video: Whisper doesn't error on a wrong forced language, it
    # confidently emits garbage. Users who want a pinned language still set one.
    default_source_lang: str = "auto"
    yt_captions_first: bool = False
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
    # Per-language font overrides: { "zh": "PingFang SC", "ja": "Hiragino Sans" }.
    # Keys are matched against the active sub's BCP-47 language code by prefix
    # (so "zh" covers zh, zh-CN, zh-Hans, zh-TW, ...) — see `_resolve_sub_font`
    # in backend/api/routes/library.py. Missing language → fall back to
    # `sub_font` → platform-default CJK font.
    sub_fonts_by_lang: dict[str, str] = field(default_factory=dict)
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


# ─── Validation ──────────────────────────────────────────────────────────────
# AppConfig is a dataclass, so neither the annotations nor the `Literal`s are
# enforced at construction. These tables are the enforcement.

# field -> (min, max). Upper bounds are "clearly a mistake" guards, not taste:
# a 10^9-pixel margin is not a preference, it's a corrupt file.
_NUM_BOUNDS: dict[str, tuple[float, float]] = {
    "sub_font_size": (0, 400),
    "sub_margin_y": (0, 2000),
    "sub_border_size": (-1, 50),
}

# Allowed values for plain-`str` fields that are really enums. Fields already
# annotated `Literal[...]` don't belong here — `_coerce` checks those against
# the annotation itself.
_ENUMS: dict[str, set[str]] = {
    "default_whisper_device": {"auto", "cpu", "gpu", "cuda"},
}

_last_load_error: str | None = None


def last_load_error() -> str | None:
    """Why the most recent `load_config()` fell back to defaults, if it did.

    `None` on a clean load. Surfaced through GET /api/config so a corrupt
    config is visible in the UI instead of looking like a settings reset.
    """
    return _last_load_error


def _defaults() -> dict:
    return asdict(AppConfig())


def _coerce(data: dict) -> tuple[dict, list[str]]:
    """Drop/repair values that don't match their declared field type.

    Returns the cleaned dict plus a human-readable note per rejected value.
    Anything unrecognised is dropped (not guessed at) so a bad edit degrades
    to the default for that one field instead of failing the whole load.
    """
    hints = get_type_hints(AppConfig)
    defaults = _defaults()
    known = {f.name for f in fields(AppConfig)}
    out: dict = {}
    notes: list[str] = []

    def reject(key: str, default: object, why: str) -> None:
        # Takes key/default as arguments rather than closing over the loop
        # variables — a closure here would report whichever field the loop
        # happened to be on when it ran.
        notes.append(f"{key}: {why}; using default {default!r}")

    for key, value in data.items():
        if key not in known:
            continue  # tolerate configs from older/newer versions
        want = hints[key]
        default = defaults[key]

        # Literal[...] — the annotation the dataclass never checked.
        if get_origin(want) is Literal:
            if value in get_args(want):
                out[key] = value
            else:
                reject(key, default, f"{value!r} is not one of {list(get_args(want))}")
            continue

        if want is bool:
            if isinstance(value, bool):
                out[key] = value
            else:
                reject(key, default, f"{value!r} is not a boolean")
            continue

        if want in (int, float):
            # bool is an int subclass; a boolean here is a type error.
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                reject(key, default, f"{value!r} is not a number")
                continue
            lo, hi = _NUM_BOUNDS.get(key, (float("-inf"), float("inf")))
            if not (lo <= value <= hi):
                reject(key, default, f"{value!r} is outside {lo}..{hi}")
                continue
            out[key] = int(value) if want is int else float(value)
            continue

        if want is str:
            if not isinstance(value, str):
                reject(key, default, f"{value!r} is not a string")
                continue
            allowed = _ENUMS.get(key)
            if allowed is not None and value not in allowed:
                reject(key, default, f"{value!r} is not one of {sorted(allowed)}")
                continue
            out[key] = value
            continue

        if get_origin(want) is list:
            if isinstance(value, list):
                out[key] = value
            else:
                reject(key, default, f"{value!r} is not a list")
            continue

        if get_origin(want) is dict:
            if isinstance(value, dict) and all(
                isinstance(k, str) and isinstance(v, str) for k, v in value.items()
            ):
                out[key] = value
            else:
                reject(key, default, f"{value!r} is not a string->string mapping")
            continue

        out[key] = value  # no rule for this shape — pass through unchanged

    return out, notes


def _quarantine(p: Path, reason: str) -> str:
    """Move an unusable config aside so its contents (API keys!) survive.

    Returns the path we moved it to, or "" if even that failed — in which
    case we still refuse to overwrite it silently.
    """
    for n in range(1, 100):
        target = p.with_suffix(p.suffix + f".corrupt-{n}")
        if not target.exists():
            try:
                p.replace(target)
                return str(target)
            except OSError:
                return ""
    return ""


def load_config() -> AppConfig:
    global _last_load_error
    _last_load_error = None

    p = config_path()
    if not p.exists():
        return AppConfig()

    # Tighten permissions on a config written by an older build, so the fix
    # applies to existing installs instead of only to the next save.
    with contextlib.suppress(OSError):
        if p.stat().st_mode & 0o077:
            os.chmod(p, CONFIG_MODE)

    try:
        raw = p.read_text(encoding="utf-8")
    except OSError as e:
        _last_load_error = f"Could not read {p}: {e}. Using defaults."
        return AppConfig()

    try:
        data = json.loads(raw)
        if not isinstance(data, dict):
            raise ValueError("top-level JSON value is not an object")
    except Exception as e:
        moved = _quarantine(p, str(e))
        _last_load_error = (
            f"{p.name} is not valid JSON ({e}). "
            + (
                f"Your previous settings were kept at {moved} — the app started "
                "with defaults so nothing overwrites them."
                if moved
                else "Could not move the damaged file aside; settings were NOT "
                "overwritten, but the app started with defaults."
            )
        )
        return AppConfig()

    data = _migrate_config(data)
    cleaned, notes = _coerce(data)
    if notes:
        _last_load_error = "Some settings were invalid and reset: " + "; ".join(notes)

    try:
        return AppConfig(**cleaned)
    except Exception as e:
        # Shouldn't happen after _coerce, but never take the user's file down
        # with us if it does.
        _last_load_error = f"Could not apply {p.name} ({e}). Using defaults."
        return AppConfig()


def save_config(cfg: AppConfig) -> None:
    """Persist atomically at 0600.

    temp file in the same directory -> fsync -> os.replace. The rename is
    atomic on POSIX and Windows (same volume), so a reader either sees the
    whole old file or the whole new one, never a half-written one.
    """
    d = config_dir()
    d.mkdir(parents=True, exist_ok=True)
    target = config_path()
    payload = json.dumps(asdict(cfg), indent=2)

    fd, tmp_name = tempfile.mkstemp(
        dir=str(d), prefix=CONFIG_FILENAME + ".", suffix=".tmp"
    )
    tmp = Path(tmp_name)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(payload)
            fh.flush()
            os.fsync(fh.fileno())
        os.chmod(tmp, CONFIG_MODE)  # before it becomes visible under the real name
        os.replace(tmp, target)
    except BaseException:
        tmp.unlink(missing_ok=True)
        raise
