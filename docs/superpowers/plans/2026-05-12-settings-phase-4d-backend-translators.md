# Settings Phase 4d — Backend Translators Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the FastAPI backend and the `@yt-subtitle-maker/api-client` TypeScript package to support named translation-provider profiles (`custom_translators` + `active_translator`) with config-file migration, a real one-line-translation test round-trip with structured error categorisation, and updated camelCase/masking plumbing — so Phase 4d-frontend can build the `ProviderRow` UI on top of a complete contract.

**Architecture:** Three backend layers change in order: (1) `AppConfig` gains two new fields and `load_config()` runs an idempotent migration of legacy `openai_*` keys into `custom_translators` entries; (2) `core/translator/__init__.py` gets a new `get_active_translator(cfg)` dispatcher, and `core/pipeline.py` delegates to it; (3) `api/routes/config.py` and `api/routes/translator.py` expose the new shape over HTTP with correct camelCase/masking. Finally the TypeScript api-client mirrors the new types. Every backend task follows TDD: failing pytest first, then green, then `ruff check backend` clean.

**Tech Stack:** Python 3.12, FastAPI, Pydantic v2, pytest + `fastapi.testclient.TestClient`, `openai` SDK (for `OpenAICompatTranslator`), `google-genai` SDK (for `GeminiTranslator`), TypeScript 5, `npx tsc --noEmit`.

**Spec refs:**
- `docs/superpowers/specs/2026-05-12-settings-tab-production-ready-design.md` §"Translation tab — named provider profiles":
  > "Config shape change … add `custom_translators: list[dict]` where each entry is `{ id, name, base_url, api_key, model }`; add `active_translator: str` = `"gemini" | "local_openai" | "custom:<id>"`. Keep `gemini_*` / `local_openai_*` as the two built-in profiles' storage. **Migration:** on load, a non-empty legacy `openai_*` block becomes a `custom_translators` entry named 'OpenAI'; legacy `translator_provider` maps to `active_translator`. The masked-secret handling extends to per-profile `api_key`s."
  > "**`POST /api/translator/test`** (enhance the existing one): accepts an ad-hoc spec or an existing-profile id (+ `useSavedKey`); performs a **real one-line translation round-trip** … returns `{ ok, sample: {src, dst}, latencyMs, model, error }`. On failure the `error` is the actual cause — 401, model-not-found (404), DNS/connection refused, timeout, non-OpenAI-shaped response, quota exceeded."
- `docs/superpowers/plans/2026-05-12-settings-phase-4-overview.md` §"4d" confirms backend+api-client only; frontend is a separate plan.

**Out of scope:**
- **FRONTEND** — `ProviderRow.tsx`, `TranslationTab.tsx`, the "+ Add provider" preset flow, the per-provider last-test dot/timestamp — all Phase 4d-frontend.
- **Generate-screen per-job translator picker** — own follow-up spec.
- **No Rust changes.**

---

## Judgment calls (documented here so reviewers don't re-debate them)

| Decision | Rationale |
|---|---|
| Per-profile JSON key naming: camelCase on the wire (`{id, name, baseUrl, apiKey, model}`), snake_case in storage | Matches the existing top-level convention; `config.py`'s masking/camel pass also transforms per-profile keys, and snake-cases them back on POST. |
| Migration dedup id: `"openai-legacy"` (stable string) | No UUID needed; we dedupe by checking whether an entry with `id == "openai-legacy"` already exists, making migration fully idempotent. |
| Stale `active_translator` (e.g. `"custom:nope"`): fall back to `"gemini"` | Spec: "Gemini is the fallback." |
| `POST /api/translator/test` returns plain `dict` | Matches `dependencies.py`/`config.py` style; the route already does this. |
| Keep `translator_provider` + `openai_*` in `AppConfig` | Backward-compat and migration source-of-truth. The api-client `AppConfig` type keeps `translatorProvider` for now — Phase 4d-frontend removes it from the UI but not from the type. |
| Real translation round-trip in the test endpoint, not just `is_available()` | Spec requirement; catches auth failures that `is_available()` may miss (Gemini accepts a bad key at `models.list()` sometimes). |

---

## File structure

| File | Action | Responsibility |
|---|---|---|
| `backend/core/config.py` | Modify | Add `custom_translators`/`active_translator` fields; add `_migrate_config(data)` helper; call it in `load_config()` |
| `backend/core/translator/__init__.py` | Modify | Add `get_active_translator(cfg)` dispatcher; keep `get_translator` unchanged |
| `backend/core/pipeline.py` | Modify | Replace ad-hoc `translator_provider` dispatch in `_make_translator` with `get_active_translator(cfg)` when no per-job override |
| `backend/api/schemas.py` | Modify | Update `TranslatorTestRequest` + `ListModelsRequest` with `profileId`/`useSavedKey`/`targetLang` |
| `backend/api/routes/config.py` | Modify | Add `customTranslators`/`activeTranslator` to `_CAMEL_TO_SNAKE`; add `_mask_profile_keys()`; apply per-profile masking in `_config_response`; handle `customTranslators` on POST |
| `backend/api/routes/translator.py` | Modify | Replace `is_available()` test with real round-trip; add `profileId`/`useSavedKey` resolution; add structured error categorisation; update `list-models` to accept `profileId`/`useSavedKey` |
| `tests/core/test_config.py` | Modify | Add migration tests |
| `tests/core/test_translator_dispatch.py` | Create | Tests for `get_active_translator` |
| `tests/api/test_config_profiles.py` | Create | Tests for GET/POST masking of `customTranslators` |
| `tests/api/test_translator.py` | Modify | Update existing tests; add round-trip and structured-error tests |
| `packages/api-client/src/types.ts` | Modify | Add `TranslatorProfile`, `TranslatorTestResult`; extend `AppConfig` |
| `packages/api-client/src/client.ts` | Modify | Update `testTranslator` + `listTranslatorModels` signatures/return types |

---

## Task 1: `AppConfig` — add fields and idempotent migration

**Files:**
- Modify: `backend/core/config.py`
- Modify: `tests/core/test_config.py`

### Why first?

Everything downstream (the route masking, `get_active_translator`, the pipeline) depends on these two fields existing on `AppConfig` and on `load_config()` correctly populating them from an old config. Start with TDD.

- [ ] **Step 1: Write the failing tests**

Add to `tests/core/test_config.py`:

```python
import json
from pathlib import Path
from core.config import AppConfig, load_config, save_config


# ── migration tests ────────────────────────────────────────────────────────────

def test_new_fields_have_defaults():
    cfg = AppConfig()
    assert cfg.custom_translators == []
    assert cfg.active_translator == "gemini"


def test_migration_legacy_openai_becomes_custom_entry(tmp_path, monkeypatch):
    """A config.json with openai_* set + translator_provider='openai'
    should load with a 'openai-legacy' custom_translators entry and
    active_translator='custom:openai-legacy'."""
    fake_home = tmp_path / "h"
    fake_home.mkdir()
    monkeypatch.setenv("HOME", str(fake_home))
    monkeypatch.setenv("USERPROFILE", str(fake_home))

    cfg_dir = fake_home / ".yt_subtitle_tool"
    cfg_dir.mkdir()
    (cfg_dir / "config.json").write_text(json.dumps({
        "openai_api_key": "sk-abc",
        "openai_model": "gpt-4o",
        "openai_base_url": "https://api.openai.com/v1",
        "translator_provider": "openai",
    }), encoding="utf-8")

    loaded = load_config()
    assert len(loaded.custom_translators) == 1
    entry = loaded.custom_translators[0]
    assert entry["id"] == "openai-legacy"
    assert entry["name"] == "OpenAI"
    assert entry["api_key"] == "sk-abc"
    assert entry["model"] == "gpt-4o"
    assert entry["base_url"] == "https://api.openai.com/v1"
    assert loaded.active_translator == "custom:openai-legacy"


def test_migration_legacy_openai_is_idempotent(tmp_path, monkeypatch):
    """Running load_config() twice on the same file does not duplicate
    the 'openai-legacy' entry."""
    fake_home = tmp_path / "h"
    fake_home.mkdir()
    monkeypatch.setenv("HOME", str(fake_home))
    monkeypatch.setenv("USERPROFILE", str(fake_home))

    cfg_dir = fake_home / ".yt_subtitle_tool"
    cfg_dir.mkdir()
    (cfg_dir / "config.json").write_text(json.dumps({
        "openai_api_key": "sk-abc",
        "openai_model": "gpt-4o",
        "translator_provider": "openai",
    }), encoding="utf-8")

    loaded1 = load_config()
    save_config(loaded1)
    loaded2 = load_config()
    assert len(loaded2.custom_translators) == 1


def test_migration_gemini_provider_sets_active_translator(tmp_path, monkeypatch):
    """Legacy config with translator_provider='gemini' and no openai_api_key
    → active_translator='gemini', custom_translators=[]."""
    fake_home = tmp_path / "h"
    fake_home.mkdir()
    monkeypatch.setenv("HOME", str(fake_home))
    monkeypatch.setenv("USERPROFILE", str(fake_home))

    cfg_dir = fake_home / ".yt_subtitle_tool"
    cfg_dir.mkdir()
    (cfg_dir / "config.json").write_text(json.dumps({
        "translator_provider": "gemini",
        "gemini_api_key": "gkey",
    }), encoding="utf-8")

    loaded = load_config()
    assert loaded.active_translator == "gemini"
    assert loaded.custom_translators == []


def test_migration_local_openai_provider_sets_active_translator(tmp_path, monkeypatch):
    fake_home = tmp_path / "h"
    fake_home.mkdir()
    monkeypatch.setenv("HOME", str(fake_home))
    monkeypatch.setenv("USERPROFILE", str(fake_home))

    cfg_dir = fake_home / ".yt_subtitle_tool"
    cfg_dir.mkdir()
    (cfg_dir / "config.json").write_text(json.dumps({
        "translator_provider": "local_openai",
    }), encoding="utf-8")

    loaded = load_config()
    assert loaded.active_translator == "local_openai"


def test_already_migrated_config_roundtrips(tmp_path, monkeypatch):
    """A config.json that already has custom_translators + active_translator
    round-trips without modification."""
    fake_home = tmp_path / "h"
    fake_home.mkdir()
    monkeypatch.setenv("HOME", str(fake_home))
    monkeypatch.setenv("USERPROFILE", str(fake_home))

    cfg_dir = fake_home / ".yt_subtitle_tool"
    cfg_dir.mkdir()
    profile = {
        "id": "openai-legacy",
        "name": "OpenAI",
        "base_url": "https://api.openai.com/v1",
        "api_key": "sk-abc",
        "model": "gpt-4o",
    }
    (cfg_dir / "config.json").write_text(json.dumps({
        "custom_translators": [profile],
        "active_translator": "custom:openai-legacy",
        "openai_api_key": "sk-abc",
        "openai_model": "gpt-4o",
        "translator_provider": "openai",
    }), encoding="utf-8")

    loaded = load_config()
    assert len(loaded.custom_translators) == 1
    assert loaded.active_translator == "custom:openai-legacy"
```

- [ ] **Step 2: Run to see them fail**

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker"
backend/.venv/bin/python -m pytest tests/core/test_config.py -v -k "migration or new_fields" 2>&1 | tail -30
```

Expected: `FAILED` — `AppConfig` has no `custom_translators` attribute.

- [ ] **Step 3: Implement the fields and migration**

Replace the contents of `backend/core/config.py` with:

```python
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
    custom_translators: list = field(default_factory=list)
    # "gemini" | "local_openai" | "custom:<id>"
    active_translator: str = "gemini"

    # Gemini
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash-lite"

    # Local OpenAI (LM Studio / Ollama)
    local_openai_base_url: str = "http://127.0.0.1:1234/v1"
    local_openai_model: str = ""
    local_openai_api_key: str = ""

    # OpenAI-compatible (legacy; new configs use custom_translators instead)
    openai_base_url: str = "https://api.openai.com/v1"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"

    # Misc
    mpv_path: str = ""
    whisper_cache_dir: str = ""
    logs_verbosity: Literal["error", "warning", "info", "debug"] = "info"
    js_runtime_path: str = ""

    # mpv subtitle style
    sub_font: str = ""
    sub_font_size: int = 0
    sub_color: str = ""
    sub_border_color: str = ""
    sub_border_size: float = -1
    sub_back_color: str = ""
    sub_bold: bool = False
    sub_margin_y: int = 0


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
```

- [ ] **Step 4: Run the migration tests**

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker"
backend/.venv/bin/python -m pytest tests/core/test_config.py -v 2>&1 | tail -30
```

Expected: all pass.

- [ ] **Step 5: Run the full suite to check no regressions**

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker"
backend/.venv/bin/python -m pytest -q 2>&1 | tail -20
```

Expected: all pass (the new `list` annotation on `custom_translators` may emit a ruff warning — fix in next step).

- [ ] **Step 6: Ruff clean**

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker"
backend/.venv/bin/ruff check backend/core/config.py
```

If ruff reports `UP006` (use `list` not `List`) for the `field(default_factory=list)` annotation — that's actually fine since we typed it as bare `list`. If it complains about `list` in the dataclass field type annotation hint, the fix is to leave the annotation as-is (Python 3.12 accepts `list` natively). Expected: clean.

- [ ] **Step 7: Commit**

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker"
git add backend/core/config.py tests/core/test_config.py
git commit -m "feat(config): add custom_translators + active_translator with idempotent openai_* migration"
```

---

## Task 2: `config.py` route — camelCase map + per-profile masking

**Files:**
- Modify: `backend/api/routes/config.py`
- Create: `tests/api/test_config_profiles.py`

### Why second?

The masking + camelCase plumbing must be correct before the translator route or the api-client can be verified. Once this is green, `GET /api/config` correctly exposes `customTranslators` with masked `apiKey`s and `POST /api/config` correctly handles them.

- [ ] **Step 1: Write the failing tests**

Create `tests/api/test_config_profiles.py`:

```python
"""Tests for the custom_translators camelCase + masking plumbing in /api/config."""
import json
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


@pytest.fixture()
def config_with_profiles(tmp_path, monkeypatch):
    """Point config I/O at a tmp dir with a pre-populated config.json."""
    fake_home = tmp_path / "h"
    fake_home.mkdir()
    monkeypatch.setenv("HOME", str(fake_home))
    monkeypatch.setenv("USERPROFILE", str(fake_home))

    cfg_dir = fake_home / ".yt_subtitle_tool"
    cfg_dir.mkdir()
    data = {
        "custom_translators": [
            {
                "id": "openai-legacy",
                "name": "OpenAI",
                "base_url": "https://api.openai.com/v1",
                "api_key": "sk-secret",
                "model": "gpt-4o",
            }
        ],
        "active_translator": "custom:openai-legacy",
    }
    (cfg_dir / "config.json").write_text(json.dumps(data), encoding="utf-8")
    return cfg_dir


def test_get_config_masks_profile_api_key(config_with_profiles):
    resp = client.get("/api/config")
    assert resp.status_code == 200
    body = resp.json()
    profiles = body.get("customTranslators", [])
    assert len(profiles) == 1
    assert profiles[0]["apiKey"] == "***"
    assert profiles[0]["id"] == "openai-legacy"
    assert profiles[0]["name"] == "OpenAI"
    assert profiles[0]["baseUrl"] == "https://api.openai.com/v1"
    assert profiles[0]["model"] == "gpt-4o"


def test_get_config_blank_api_key_not_masked(tmp_path, monkeypatch):
    """A profile with empty api_key should come back as '' not '***'."""
    fake_home = tmp_path / "h"
    fake_home.mkdir()
    monkeypatch.setenv("HOME", str(fake_home))
    monkeypatch.setenv("USERPROFILE", str(fake_home))
    cfg_dir = fake_home / ".yt_subtitle_tool"
    cfg_dir.mkdir()
    (cfg_dir / "config.json").write_text(json.dumps({
        "custom_translators": [{
            "id": "deepseek-1",
            "name": "DeepSeek",
            "base_url": "https://api.deepseek.com/v1",
            "api_key": "",
            "model": "deepseek-chat",
        }],
        "active_translator": "custom:deepseek-1",
    }), encoding="utf-8")

    resp = client.get("/api/config")
    assert resp.status_code == 200
    profile = resp.json()["customTranslators"][0]
    assert profile["apiKey"] == ""


def test_get_config_active_translator_present(config_with_profiles):
    resp = client.get("/api/config")
    assert resp.status_code == 200
    assert resp.json()["activeTranslator"] == "custom:openai-legacy"


def test_post_config_with_masked_api_key_keeps_saved_key(config_with_profiles):
    """POST with apiKey='***' on an existing profile preserves the saved key."""
    resp = client.post("/api/config", json={
        "customTranslators": [{
            "id": "openai-legacy",
            "name": "OpenAI updated",
            "baseUrl": "https://api.openai.com/v1",
            "apiKey": "***",
            "model": "gpt-4o-mini",
        }]
    })
    assert resp.status_code == 200
    # The returned profile should still have the masked key (not the literal ***)
    profile = resp.json()["customTranslators"][0]
    assert profile["apiKey"] == "***"
    assert profile["name"] == "OpenAI updated"
    assert profile["model"] == "gpt-4o-mini"

    # Confirm the raw saved value is still 'sk-secret'
    from core.config import load_config
    cfg = load_config()
    assert cfg.custom_translators[0]["api_key"] == "sk-secret"


def test_post_config_with_real_api_key_updates_it(config_with_profiles):
    """POST with a new real key updates the stored value."""
    resp = client.post("/api/config", json={
        "customTranslators": [{
            "id": "openai-legacy",
            "name": "OpenAI",
            "baseUrl": "https://api.openai.com/v1",
            "apiKey": "sk-newkey",
            "model": "gpt-4o",
        }]
    })
    assert resp.status_code == 200

    from core.config import load_config
    cfg = load_config()
    assert cfg.custom_translators[0]["api_key"] == "sk-newkey"


def test_post_config_add_new_profile(config_with_profiles):
    """Sending a list with an extra profile adds it."""
    resp = client.post("/api/config", json={
        "customTranslators": [
            {
                "id": "openai-legacy",
                "name": "OpenAI",
                "baseUrl": "https://api.openai.com/v1",
                "apiKey": "***",
                "model": "gpt-4o",
            },
            {
                "id": "deepseek-1",
                "name": "DeepSeek",
                "baseUrl": "https://api.deepseek.com/v1",
                "apiKey": "ds-key",
                "model": "deepseek-chat",
            },
        ]
    })
    assert resp.status_code == 200

    from core.config import load_config
    cfg = load_config()
    assert len(cfg.custom_translators) == 2
    ids = {e["id"] for e in cfg.custom_translators}
    assert "deepseek-1" in ids


def test_post_config_remove_profile_by_omission(config_with_profiles):
    """Sending an empty list removes all custom profiles."""
    resp = client.post("/api/config", json={"customTranslators": []})
    assert resp.status_code == 200

    from core.config import load_config
    cfg = load_config()
    assert cfg.custom_translators == []


def test_post_config_active_translator_roundtrips(config_with_profiles):
    resp = client.post("/api/config", json={"activeTranslator": "gemini"})
    assert resp.status_code == 200
    assert resp.json()["activeTranslator"] == "gemini"
```

- [ ] **Step 2: Run to see them fail**

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker"
backend/.venv/bin/python -m pytest tests/api/test_config_profiles.py -v 2>&1 | tail -30
```

Expected: `FAILED` — `customTranslators` key absent in GET response.

- [ ] **Step 3: Implement the masking + camelCase changes**

Edit `backend/api/routes/config.py`. The full updated content:

```python
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
    "subFontSize": "sub_font_size",
    "subColor": "sub_color",
    "subBorderColor": "sub_border_color",
    "subBorderSize": "sub_border_size",
    "subBackColor": "sub_back_color",
    "subBold": "sub_bold",
    "subMarginY": "sub_margin_y",
}
_SNAKE_TO_CAMEL = {v: k for k, v in _CAMEL_TO_SNAKE.items()}

# API keys masked on GET so they aren't leaked over the wire.
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


# Path config fields that are blank-by-default and resolved at runtime.
def _effective_defaults() -> dict:
    d = asdict(AppConfig())
    cwd = Path.cwd()
    d["output_dir"] = str(cwd / "output")
    d["download_dir"] = str(cwd / "downloads")
    if not d["whisper_cache_dir"]:
        d["whisper_cache_dir"] = get_whisper_cache_dir()
    d["mpv_path"] = shutil.which("mpv") or ""
    return d


def _config_response(cfg: AppConfig) -> dict:
    d = asdict(cfg)
    # Separate custom_translators before the generic camel conversion
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
            # value is a list of camelCase profile dicts
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
```

- [ ] **Step 4: Run the profile tests**

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker"
backend/.venv/bin/python -m pytest tests/api/test_config_profiles.py -v 2>&1 | tail -40
```

Expected: all pass.

- [ ] **Step 5: Run the full suite**

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker"
backend/.venv/bin/python -m pytest -q 2>&1 | tail -20
```

Expected: all pass.

- [ ] **Step 6: Ruff clean**

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker"
backend/.venv/bin/ruff check backend/api/routes/config.py
```

Expected: clean.

- [ ] **Step 7: Commit**

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker"
git add backend/api/routes/config.py tests/api/test_config_profiles.py
git commit -m "feat(config): camelCase map + per-profile masking for custom_translators"
```

---

## Task 3: `get_active_translator` + pipeline wiring

**Files:**
- Modify: `backend/core/translator/__init__.py`
- Modify: `backend/core/pipeline.py`
- Create: `tests/core/test_translator_dispatch.py`

### Why third?

The route changes in Task 4 call `get_active_translator`; the pipeline change is two lines but needs a test to guard it. Do both here.

- [ ] **Step 1: Write the failing tests**

Create `tests/core/test_translator_dispatch.py`:

```python
"""Tests for get_active_translator — the AppConfig-aware dispatcher."""
from unittest.mock import MagicMock, patch

import pytest

from core.config import AppConfig
from core.translator import get_active_translator
from core.translator.gemini import GeminiTranslator
from core.translator.openai_compat import OpenAICompatTranslator


def _cfg(**kwargs) -> AppConfig:
    cfg = AppConfig()
    for k, v in kwargs.items():
        setattr(cfg, k, v)
    return cfg


def test_active_gemini():
    cfg = _cfg(active_translator="gemini", gemini_api_key="gkey", gemini_model="gemini-2.5-flash-lite")
    provider = get_active_translator(cfg)
    assert isinstance(provider, GeminiTranslator)
    assert provider.api_key == "gkey"


def test_active_local_openai():
    cfg = _cfg(
        active_translator="local_openai",
        local_openai_base_url="http://127.0.0.1:1234/v1",
        local_openai_model="gemma-3-27b",
        local_openai_api_key="",
    )
    provider = get_active_translator(cfg)
    assert isinstance(provider, OpenAICompatTranslator)
    assert provider.name == "local_openai"
    assert provider.api_key == "lm-studio"  # default sentinel


def test_active_custom_profile():
    cfg = _cfg(
        active_translator="custom:deepseek-1",
        custom_translators=[{
            "id": "deepseek-1",
            "name": "DeepSeek",
            "base_url": "https://api.deepseek.com/v1",
            "api_key": "ds-key",
            "model": "deepseek-chat",
        }],
    )
    provider = get_active_translator(cfg)
    assert isinstance(provider, OpenAICompatTranslator)
    assert provider.base_url == "https://api.deepseek.com/v1"
    assert provider.api_key == "ds-key"
    assert provider.model == "deepseek-chat"
    assert provider.name == "DeepSeek"


def test_stale_custom_id_falls_back_to_gemini():
    """If active_translator points to a non-existent custom id, fall back to Gemini."""
    cfg = _cfg(
        active_translator="custom:nope",
        custom_translators=[],
        gemini_api_key="gkey",
    )
    provider = get_active_translator(cfg)
    assert isinstance(provider, GeminiTranslator)


def test_pipeline_uses_get_active_translator_when_no_override():
    """pipeline._make_translator should call get_active_translator when the
    request dict has no translatorProvider override."""
    from core.pipeline import _make_translator

    cfg = AppConfig()
    cfg.active_translator = "gemini"
    cfg.gemini_api_key = "gkey"

    with patch("core.pipeline.get_active_translator") as mock_gat:
        mock_gat.return_value = MagicMock()
        _make_translator({}, cfg)
        mock_gat.assert_called_once_with(cfg)


def test_pipeline_per_job_override_still_wins():
    """A non-None translatorProvider in the request skips get_active_translator."""
    from core.pipeline import _make_translator

    cfg = AppConfig()
    with patch("core.pipeline.get_active_translator") as mock_gat:
        with patch("core.pipeline.get_translator") as mock_gt:
            mock_gt.return_value = MagicMock()
            _make_translator(
                {
                    "translatorProvider": "gemini",
                    "translatorBaseUrl": None,
                    "translatorModel": "gemini-2.5-flash-lite",
                    "translatorApiKey": None,
                },
                cfg,
            )
            mock_gat.assert_not_called()
            mock_gt.assert_called_once()
```

- [ ] **Step 2: Run to see them fail**

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker"
backend/.venv/bin/python -m pytest tests/core/test_translator_dispatch.py -v 2>&1 | tail -30
```

Expected: `ImportError` or `AttributeError` — `get_active_translator` not defined yet.

- [ ] **Step 3: Add `get_active_translator` to `core/translator/__init__.py`**

Edit `backend/core/translator/__init__.py` — add the function and update `__all__`:

```python
"""Translator provider registry."""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from core.translator.base import TranslationProvider
from core.translator.gemini import GeminiTranslator
from core.translator.openai_compat import OpenAICompatTranslator

if TYPE_CHECKING:
    from core.config import AppConfig

log = logging.getLogger(__name__)

DEFAULT_LM_STUDIO_URL = "http://127.0.0.1:1234/v1"
DEFAULT_OPENAI_URL = "https://api.openai.com/v1"


def list_translators() -> list[str]:
    return ["gemini", "local_openai", "openai"]


def get_translator(name: str, **kwargs: Any) -> TranslationProvider:
    if name == "gemini":
        return GeminiTranslator(
            api_key=kwargs.get("api_key", ""),
            model=kwargs.get("model", "gemini-2.5-flash-lite"),
        )
    if name == "local_openai":
        return OpenAICompatTranslator(
            base_url=kwargs.get("base_url") or DEFAULT_LM_STUDIO_URL,
            model=kwargs["model"],
            api_key=kwargs.get("api_key") or "lm-studio",
            name="local_openai",
        )
    if name == "openai":
        return OpenAICompatTranslator(
            base_url=kwargs.get("base_url") or DEFAULT_OPENAI_URL,
            model=kwargs["model"],
            api_key=kwargs.get("api_key", ""),
            name="openai",
        )
    raise KeyError(f"unknown translator: {name!r}")


def get_active_translator(cfg: "AppConfig") -> TranslationProvider:
    """Resolve cfg.active_translator to a TranslationProvider.

    Dispatch rules:
    - "gemini"       → GeminiTranslator with the built-in gemini_* credentials.
    - "local_openai" → OpenAICompatTranslator with local_openai_* credentials.
    - "custom:<id>"  → look up cfg.custom_translators by id;
                       if not found, log a warning and fall back to Gemini.
    Any other value also falls back to Gemini.
    """
    active = cfg.active_translator

    if active == "gemini":
        return GeminiTranslator(
            api_key=cfg.gemini_api_key,
            model=cfg.gemini_model,
        )

    if active == "local_openai":
        return OpenAICompatTranslator(
            base_url=cfg.local_openai_base_url or DEFAULT_LM_STUDIO_URL,
            model=cfg.local_openai_model or "placeholder",
            api_key=cfg.local_openai_api_key or "lm-studio",
            name="local_openai",
        )

    if active.startswith("custom:"):
        profile_id = active[len("custom:"):]
        entry = next(
            (e for e in cfg.custom_translators if e.get("id") == profile_id),
            None,
        )
        if entry:
            return OpenAICompatTranslator(
                base_url=entry.get("base_url", DEFAULT_OPENAI_URL),
                model=entry.get("model", "placeholder"),
                api_key=entry.get("api_key") or "placeholder",
                name=entry.get("name", profile_id),
            )
        log.warning(
            "active_translator=%r points to unknown custom profile %r; "
            "falling back to Gemini",
            active,
            profile_id,
        )

    # Unknown or stale — fall back to Gemini
    return GeminiTranslator(
        api_key=cfg.gemini_api_key,
        model=cfg.gemini_model,
    )


__all__ = [
    "TranslationProvider",
    "get_active_translator",
    "get_translator",
    "list_translators",
    "DEFAULT_LM_STUDIO_URL",
    "DEFAULT_OPENAI_URL",
]
```

- [ ] **Step 4: Update `core/pipeline.py` — replace the old dispatch**

First, read where `_make_translator` is in the file:

```bash
grep -n "_make_translator\|translator_provider\|translatorProvider" \
  "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker/backend/core/pipeline.py" | head -30
```

The function currently looks up `request.get("translatorProvider") or cfg.translator_provider` and dispatches via `get_translator`. Change it to call `get_active_translator(cfg)` when there is no per-job override. The per-job override path stays as-is.

Find the `_make_translator` function body and update it. The expected current form (verify with grep output) is roughly:

```python
def _make_translator(request: dict, cfg: AppConfig) -> TranslationProvider:
    provider = request.get("translatorProvider") or cfg.translator_provider
    base_url = request.get("translatorBaseUrl")
    model = request.get("translatorModel") or ...
    api_key = request.get("translatorApiKey") or ...
    return get_translator(provider, base_url=base_url, model=model, api_key=api_key)
```

Replace it with:

```python
def _make_translator(request: dict, cfg: AppConfig) -> TranslationProvider:
    # Per-job override: the Generate screen can pass a specific provider/credentials.
    override_provider = request.get("translatorProvider")
    if override_provider:
        base_url = request.get("translatorBaseUrl")
        model = request.get("translatorModel") or cfg.gemini_model
        api_key = request.get("translatorApiKey")
        return get_translator(override_provider, base_url=base_url, model=model, api_key=api_key)
    # No override → use the active translator from config (respects custom profiles).
    return get_active_translator(cfg)
```

Also add the import at the top of `pipeline.py`:

```python
from core.translator import get_active_translator, get_translator
```

(Replace or extend the existing `from core.translator import get_translator` line.)

- [ ] **Step 5: Run the dispatch tests**

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker"
backend/.venv/bin/python -m pytest tests/core/test_translator_dispatch.py -v 2>&1 | tail -30
```

Expected: all pass.

- [ ] **Step 6: Run the full suite**

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker"
backend/.venv/bin/python -m pytest -q 2>&1 | tail -20
```

Expected: all pass.

- [ ] **Step 7: Ruff clean**

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker"
backend/.venv/bin/ruff check backend/core/translator/__init__.py backend/core/pipeline.py
```

Expected: clean.

- [ ] **Step 8: Commit**

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker"
git add backend/core/translator/__init__.py backend/core/pipeline.py \
        tests/core/test_translator_dispatch.py
git commit -m "feat(translator): get_active_translator dispatcher + pipeline wiring"
```

---

## Task 4: Enhanced `POST /api/translator/test` — real round-trip + structured errors

**Files:**
- Modify: `backend/api/schemas.py`
- Modify: `backend/api/routes/translator.py`
- Modify: `tests/api/test_translator.py`

### Context

The current endpoint calls `provider.is_available()` and returns `{ok: bool}`. The spec requires:
1. A real one-line translation call (≈ `"Hello, world."` → `{src, dst}` pair).
2. Structured error categorisation: 401/403 auth, 404/model-not-found, DNS/connect, timeout, non-OpenAI-shape, quota.
3. Accepts either an ad-hoc `{provider, baseUrl, model, apiKey}` form OR `{profileId, useSavedKey}` to resolve from saved config.
4. Returns `{ok, sample?: {src, dst}, latencyMs, model?, error?}`.

For the real round-trip we call `provider.translate_title("Hello, world.", target_lang)` — `GeminiTranslator.translate_title` and `OpenAICompatTranslator.translate_title` both exist and both take `(title, target_lang)`. This is the least-invasive hook: one call, one response, tests the auth + model + network path end-to-end.

- [ ] **Step 1: Update schemas — add `profileId`, `useSavedKey`, `targetLang`**

Edit `backend/api/schemas.py`. Update the two relevant classes:

```python
class TranslatorTestRequest(BaseModel):
    # Ad-hoc spec form — specify the provider + credentials directly.
    provider: TranslatorProvider | None = None
    baseUrl: str | None = None
    model: str | None = None
    apiKey: str | None = None

    # Saved-profile form — resolve credentials server-side.
    # profileId: "gemini" | "local_openai" | "custom:<id>"
    profileId: str | None = None
    useSavedKey: bool = False

    # Language to translate the test phrase into (default: Chinese).
    targetLang: str = "zh-CN"


class ListModelsRequest(BaseModel):
    provider: TranslatorProvider | None = None
    baseUrl: str | None = None
    apiKey: str | None = None
    # Saved-profile form
    profileId: str | None = None
    useSavedKey: bool = False
```

- [ ] **Step 2: Write the failing translator tests**

Replace the content of `tests/api/test_translator.py` with:

```python
"""Tests for /api/translator/test and /api/translator/list-models."""
import json
import time
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


# ── helpers ────────────────────────────────────────────────────────────────────

def _openai_error(status: int, message: str):
    """Build an openai.APIStatusError-like exception."""
    from openai import AuthenticationError, NotFoundError, RateLimitError
    import httpx

    req = httpx.Request("POST", "https://api.openai.com/v1/chat/completions")
    resp = httpx.Response(status, json={"error": {"message": message, "type": "error"}})
    if status in (401, 403):
        return AuthenticationError(message, response=resp, body={"error": {"message": message}})
    if status == 404:
        return NotFoundError(message, response=resp, body={"error": {"message": message}})
    if status == 429:
        return RateLimitError(message, response=resp, body={"error": {"message": message}})
    return Exception(message)


# ── success path ────────────────────────────────────────────────────────────────

@patch("api.routes.translator.get_translator")
def test_test_endpoint_success_adhoc(mock_get):
    mock_provider = MagicMock()
    mock_provider.translate_title.return_value = "你好，世界。"
    mock_provider.model = "gemma-3-27b-it"
    mock_get.return_value = mock_provider

    resp = client.post("/api/translator/test", json={
        "provider": "local_openai",
        "baseUrl": "http://127.0.0.1:1234/v1",
        "model": "gemma-3-27b-it",
        "targetLang": "zh-CN",
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["sample"] == {"src": "Hello, world.", "dst": "你好，世界。"}
    assert "latencyMs" in body
    assert body["model"] == "gemma-3-27b-it"


@patch("api.routes.translator.get_active_translator")
def test_test_endpoint_success_saved_profile(mock_gat, tmp_path, monkeypatch):
    """profileId='gemini' + useSavedKey=True resolves from saved config."""
    fake_home = tmp_path / "h"
    fake_home.mkdir()
    monkeypatch.setenv("HOME", str(fake_home))
    monkeypatch.setenv("USERPROFILE", str(fake_home))
    cfg_dir = fake_home / ".yt_subtitle_tool"
    cfg_dir.mkdir()
    (cfg_dir / "config.json").write_text(json.dumps({
        "gemini_api_key": "gkey",
        "gemini_model": "gemini-2.5-flash-lite",
        "active_translator": "gemini",
    }), encoding="utf-8")

    mock_provider = MagicMock()
    mock_provider.translate_title.return_value = "你好，世界。"
    mock_provider.model = "gemini-2.5-flash-lite"
    mock_gat.return_value = mock_provider

    resp = client.post("/api/translator/test", json={
        "profileId": "gemini",
        "useSavedKey": True,
        "targetLang": "zh-CN",
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["sample"]["src"] == "Hello, world."
    mock_gat.assert_called_once()


# ── error paths ────────────────────────────────────────────────────────────────

@patch("api.routes.translator.get_translator")
def test_test_endpoint_auth_error(mock_get):
    mock_provider = MagicMock()
    from openai import AuthenticationError
    import httpx
    req = httpx.Request("POST", "https://api.openai.com/v1/chat/completions")
    resp = httpx.Response(401, json={"error": {"message": "invalid key", "type": "invalid_request_error"}})
    mock_provider.translate_title.side_effect = AuthenticationError(
        "invalid key", response=resp, body={"error": {"message": "invalid key"}}
    )
    mock_provider.model = "gpt-4o"
    mock_get.return_value = mock_provider

    resp = client.post("/api/translator/test", json={
        "provider": "openai",
        "model": "gpt-4o",
        "apiKey": "bad-key",
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert "Authentication failed" in body["error"]


@patch("api.routes.translator.get_translator")
def test_test_endpoint_model_not_found(mock_get):
    mock_provider = MagicMock()
    from openai import NotFoundError
    import httpx
    req = httpx.Request("POST", "https://api.openai.com/v1/chat/completions")
    r = httpx.Response(404, json={"error": {"message": "model not found", "type": "invalid_request_error"}})
    mock_provider.translate_title.side_effect = NotFoundError(
        "model not found", response=r, body={"error": {"message": "model not found"}}
    )
    mock_provider.model = "gpt-99"
    mock_get.return_value = mock_provider

    resp = client.post("/api/translator/test", json={
        "provider": "openai",
        "model": "gpt-99",
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert "not found" in body["error"].lower()


@patch("api.routes.translator.get_translator")
def test_test_endpoint_connection_error(mock_get):
    mock_provider = MagicMock()
    import httpx
    mock_provider.translate_title.side_effect = httpx.ConnectError("Connection refused")
    mock_provider.model = "gemma"
    mock_get.return_value = mock_provider

    resp = client.post("/api/translator/test", json={
        "provider": "local_openai",
        "model": "gemma",
        "baseUrl": "http://127.0.0.1:9999/v1",
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert "reach" in body["error"].lower() or "connect" in body["error"].lower()


@patch("api.routes.translator.get_translator")
def test_test_endpoint_timeout(mock_get):
    mock_provider = MagicMock()
    import httpx
    mock_provider.translate_title.side_effect = httpx.TimeoutException("timeout")
    mock_provider.model = "gemma"
    mock_get.return_value = mock_provider

    resp = client.post("/api/translator/test", json={
        "provider": "local_openai",
        "model": "gemma",
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert "timed out" in body["error"].lower()


@patch("api.routes.translator.get_translator")
def test_test_endpoint_quota_error(mock_get):
    mock_provider = MagicMock()
    from openai import RateLimitError
    import httpx
    r = httpx.Response(429, json={"error": {"message": "quota exceeded", "type": "insufficient_quota"}})
    mock_provider.translate_title.side_effect = RateLimitError(
        "quota exceeded", response=r, body={"error": {"message": "quota exceeded"}}
    )
    mock_provider.model = "gpt-4o"
    mock_get.return_value = mock_provider

    resp = client.post("/api/translator/test", json={
        "provider": "openai",
        "model": "gpt-4o",
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert "quota" in body["error"].lower()


# ── list-models ────────────────────────────────────────────────────────────────

@patch("api.routes.translator.get_translator")
def test_list_models_adhoc(mock_get):
    mock_provider = MagicMock()
    mock_provider.list_models.return_value = ["gemma-3-27b-it", "qwen2.5-7b"]
    mock_get.return_value = mock_provider

    resp = client.post("/api/translator/list-models", json={
        "provider": "local_openai",
        "baseUrl": "http://127.0.0.1:1234/v1",
    })
    assert resp.status_code == 200
    assert resp.json() == {"ok": True, "models": ["gemma-3-27b-it", "qwen2.5-7b"]}


@patch("api.routes.translator.get_active_translator")
def test_list_models_saved_profile(mock_gat, tmp_path, monkeypatch):
    fake_home = tmp_path / "h"
    fake_home.mkdir()
    monkeypatch.setenv("HOME", str(fake_home))
    monkeypatch.setenv("USERPROFILE", str(fake_home))
    cfg_dir = fake_home / ".yt_subtitle_tool"
    cfg_dir.mkdir()
    (cfg_dir / "config.json").write_text(json.dumps({
        "custom_translators": [{
            "id": "deepseek-1",
            "name": "DeepSeek",
            "base_url": "https://api.deepseek.com/v1",
            "api_key": "ds-key",
            "model": "deepseek-chat",
        }],
        "active_translator": "custom:deepseek-1",
    }), encoding="utf-8")

    mock_provider = MagicMock()
    mock_provider.list_models.return_value = ["deepseek-chat", "deepseek-coder"]
    mock_gat.return_value = mock_provider

    resp = client.post("/api/translator/list-models", json={
        "profileId": "custom:deepseek-1",
        "useSavedKey": True,
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert "deepseek-chat" in body["models"]
```

- [ ] **Step 3: Run to see them fail**

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker"
backend/.venv/bin/python -m pytest tests/api/test_translator.py -v 2>&1 | tail -40
```

Expected: failures on the new tests (the existing three tests may still pass since the old schema still has `provider` — check; if they fail too that's fine, they get replaced).

- [ ] **Step 4: Rewrite `api/routes/translator.py`**

```python
"""Translator-related endpoints: test reachability + real round-trip, list available models.

These endpoints fall back to the saved config when the client omits a field
or sends the GET-side mask sentinel `"***"`. That lets the Settings page
test a connection without making the user re-type their API key after
opening the page (GET masks secrets so they aren't leaked over the wire).

Phase 4d: enhanced POST /api/translator/test — real one-line translation
round-trip with structured error categorisation; accepts either an ad-hoc
spec OR a saved profileId + useSavedKey.
"""
from __future__ import annotations

import time

import httpx
from fastapi import APIRouter

from api.routes.config import MASK
from api.schemas import ListModelsRequest, TranslatorTestRequest
from core.config import AppConfig, load_config
from core.translator import get_active_translator, get_translator

router = APIRouter(prefix="/api/translator", tags=["translator"])

_TEST_SRC = "Hello, world."


def _saved_credentials(cfg: AppConfig, provider: str) -> tuple[str | None, str, str]:
    """Return (base_url, model, api_key) from saved config for a built-in provider."""
    if provider == "gemini":
        return None, cfg.gemini_model, cfg.gemini_api_key
    if provider == "local_openai":
        return (
            cfg.local_openai_base_url,
            cfg.local_openai_model or "placeholder",
            cfg.local_openai_api_key or "lm-studio",
        )
    if provider == "openai":
        return cfg.openai_base_url, cfg.openai_model, cfg.openai_api_key
    raise ValueError(f"unknown built-in translator provider: {provider!r}")


def _resolve_field(client_value: str | None, saved_value: str | None) -> str | None:
    """Pick the client value unless it's blank or the GET-side mask sentinel."""
    if not client_value or client_value == MASK:
        return saved_value
    return client_value


def _resolve_provider_from_request(req: TranslatorTestRequest, cfg: AppConfig):
    """Return a TranslationProvider from either the profileId or ad-hoc spec."""
    # Saved-profile form: profileId + useSavedKey
    if req.profileId and req.useSavedKey:
        # Temporarily set active_translator to the requested profile and dispatch.
        import copy
        tmp_cfg = copy.copy(cfg)
        tmp_cfg.active_translator = req.profileId
        return get_active_translator(tmp_cfg)

    # Ad-hoc spec form: provider + optional credentials
    if req.provider:
        saved_base, saved_model, saved_key = _saved_credentials(cfg, req.provider)
        base_url = _resolve_field(req.baseUrl, saved_base)
        model = _resolve_field(req.model, saved_model) or "placeholder"
        api_key = _resolve_field(req.apiKey, saved_key)
        return get_translator(req.provider, base_url=base_url, model=model, api_key=api_key)

    raise ValueError("TranslatorTestRequest must include either 'provider' or 'profileId'")


def _resolve_provider_for_models(req: ListModelsRequest, cfg: AppConfig):
    """Return a TranslationProvider for list-models."""
    if req.profileId and req.useSavedKey:
        import copy
        tmp_cfg = copy.copy(cfg)
        tmp_cfg.active_translator = req.profileId
        return get_active_translator(tmp_cfg)

    if req.provider:
        saved_base, _, saved_key = _saved_credentials(cfg, req.provider)
        base_url = _resolve_field(req.baseUrl, saved_base)
        api_key = _resolve_field(req.apiKey, saved_key)
        return get_translator(req.provider, base_url=base_url, model="placeholder", api_key=api_key)

    raise ValueError("ListModelsRequest must include either 'provider' or 'profileId'")


def _categorise_error(exc: Exception, model: str | None) -> str:
    """Return a human-readable error string based on exception type."""
    try:
        from openai import AuthenticationError, NotFoundError, RateLimitError
        if isinstance(exc, AuthenticationError):
            return "Authentication failed (check the API key)"
        if isinstance(exc, NotFoundError):
            return f"Model '{model}' not found"
        if isinstance(exc, RateLimitError):
            return "Quota exceeded"
    except ImportError:
        pass

    try:
        from google.genai import errors as genai_errors
        if hasattr(genai_errors, "ClientError") and isinstance(exc, genai_errors.ClientError):
            msg = str(exc).lower()
            if "401" in msg or "403" in msg or "api_key" in msg or "permission" in msg:
                return "Authentication failed (check the API key)"
            if "404" in msg or "not found" in msg:
                return f"Model '{model}' not found"
            if "429" in msg or "quota" in msg:
                return "Quota exceeded"
    except ImportError:
        pass

    if isinstance(exc, httpx.ConnectError):
        return f"Couldn't reach the endpoint — connection refused or DNS failure"
    if isinstance(exc, httpx.TimeoutException):
        return "Request timed out"
    if isinstance(exc, (ValueError, KeyError, AttributeError)):
        return f"Unexpected response shape (is this an OpenAI-compatible endpoint?)"

    return str(exc)


@router.post("/test")
def test_translator(req: TranslatorTestRequest):
    cfg = load_config()
    t0 = time.monotonic()
    model_name: str | None = None
    try:
        provider = _resolve_provider_from_request(req, cfg)
        # Grab the model name for error messages (both providers expose .model)
        model_name = getattr(provider, "model", None)
        dst = provider.translate_title(_TEST_SRC, req.targetLang)
        latency_ms = int((time.monotonic() - t0) * 1000)
        return {
            "ok": True,
            "sample": {"src": _TEST_SRC, "dst": dst},
            "latencyMs": latency_ms,
            "model": model_name,
        }
    except Exception as exc:
        latency_ms = int((time.monotonic() - t0) * 1000)
        return {
            "ok": False,
            "error": _categorise_error(exc, model_name),
            "latencyMs": latency_ms,
            "model": model_name,
        }


@router.post("/list-models")
def list_translator_models(req: ListModelsRequest):
    cfg = load_config()
    try:
        provider = _resolve_provider_for_models(req, cfg)
        return {"ok": True, "models": provider.list_models()}
    except Exception as e:
        return {"ok": False, "error": str(e), "models": []}
```

- [ ] **Step 5: Run the translator tests**

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker"
backend/.venv/bin/python -m pytest tests/api/test_translator.py -v 2>&1 | tail -40
```

Expected: all pass.

- [ ] **Step 6: Run the full suite**

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker"
backend/.venv/bin/python -m pytest -q 2>&1 | tail -20
```

Expected: all pass.

- [ ] **Step 7: Ruff clean**

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker"
backend/.venv/bin/ruff check backend/api/schemas.py backend/api/routes/translator.py
```

Expected: clean.

- [ ] **Step 8: Commit**

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker"
git add backend/api/schemas.py backend/api/routes/translator.py \
        tests/api/test_translator.py
git commit -m "feat(translator): real round-trip test endpoint with structured error categorisation + profileId form"
```

---

## Task 5: api-client — new types + updated method signatures

**Files:**
- Modify: `packages/api-client/src/types.ts`
- Modify: `packages/api-client/src/client.ts`

### Why last?

The api-client mirrors the backend contract; all backend tasks must be stable before we lock in the TypeScript types.

- [ ] **Step 1: Add types to `packages/api-client/src/types.ts`**

Add the following block after the existing `TranslatorProvider` type (after line 8) and before `VideoMetadata`:

```typescript
/** A named translation-provider profile stored in custom_translators. */
export interface TranslatorProfile {
  id: string;
  name: string;
  baseUrl: string;
  /** Masked to "***" on GET when non-empty; send "***" back to keep the saved key. */
  apiKey: string;
  model: string;
}

/** Structured result from POST /api/translator/test (Phase 4d). */
export interface TranslatorTestResult {
  ok: boolean;
  sample?: { src: string; dst: string };
  latencyMs?: number;
  model?: string | null;
  error?: string;
}
```

In the `AppConfig` interface, add two new optional fields after `openaiModel`:

```typescript
  /** Named custom translation-provider profiles (Phase 4d). */
  customTranslators?: TranslatorProfile[];
  /** Active translator: "gemini" | "local_openai" | "custom:<id>" (Phase 4d). */
  activeTranslator?: string;
```

- [ ] **Step 2: Verify the types compile**

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker/packages/api-client"
npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 3: Update `testTranslator` and `listTranslatorModels` in `client.ts`**

Replace the existing `testTranslator` method with:

```typescript
  // ─── Translation helpers ───────────────────────────────────────────────
  /**
   * Test a translator. Two call forms:
   *
   * **Ad-hoc spec** (test before saving):
   *   `{ provider, baseUrl?, apiKey?, model?, targetLang? }`
   *
   * **Saved-profile** (uses persisted credentials server-side):
   *   `{ profileId, useSavedKey: true, targetLang? }`
   *
   * Both return a `TranslatorTestResult` with a real one-line translation
   * round-trip or a structured error.
   */
  async testTranslator(
    input:
      | {
          provider: TranslatorProvider;
          baseUrl?: string;
          apiKey?: string;
          model?: string;
          targetLang?: string;
        }
      | {
          profileId: string;
          useSavedKey: true;
          targetLang?: string;
        },
  ): Promise<TranslatorTestResult> {
    const res = await fetch(`${this.baseUrl}/api/translator/test`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`/api/translator/test ${res.status}`);
    return res.json();
  }
```

Replace the existing `listTranslatorModels` method with:

```typescript
  async listTranslatorModels(
    input:
      | { provider: TranslatorProvider; baseUrl?: string; apiKey?: string }
      | { profileId: string; useSavedKey: true },
  ): Promise<{ ok: boolean; models: string[]; error?: string }> {
    const res = await fetch(`${this.baseUrl}/api/translator/list-models`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`/api/translator/list-models ${res.status}`);
    return res.json();
  }
```

Also add `TranslatorProfile` and `TranslatorTestResult` to the import in `client.ts`:

```typescript
import type {
  AppConfig,
  BackendCapabilities,
  DependencyStatus,
  EngineDescriptor,
  HistoryItem,
  InstallEvent,
  LibraryItem,
  LibraryRunEvent,
  LibraryTranscribeRequest,
  LibraryTranslateRequest,
  ProcessEvent,
  ProcessRequest,
  SystemReport,
  TranslatorProfile,
  TranslatorProvider,
  TranslatorTestResult,
  VideoDetail,
  VideoMetadata,
  WhisperModel,
} from "./types";
```

- [ ] **Step 4: Typecheck the api-client**

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker/packages/api-client"
npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 5: Typecheck the desktop app**

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker"
pnpm -F desktop typecheck 2>&1 | tail -20
```

Expected: no new errors (the old `testTranslator` call sites pass an object with `provider` — still valid under the union type since `provider: TranslatorProvider` matches the first union branch).

- [ ] **Step 6: Commit**

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker"
git add packages/api-client/src/types.ts packages/api-client/src/client.ts
git commit -m "feat(api-client): TranslatorProfile, TranslatorTestResult types + updated testTranslator/listTranslatorModels"
```

---

## Task 6: Final lint + suite health check

**Files:** none new — verification only.

- [ ] **Step 1: Run the full backend suite**

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker"
backend/.venv/bin/python -m pytest -q 2>&1 | tail -10
```

Expected: all pass, no failures.

- [ ] **Step 2: Ruff clean across all touched files**

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker"
backend/.venv/bin/ruff check \
  backend/core/config.py \
  backend/core/translator/__init__.py \
  backend/core/pipeline.py \
  backend/api/schemas.py \
  backend/api/routes/config.py \
  backend/api/routes/translator.py
```

Expected: no output (clean).

- [ ] **Step 3: Full desktop typecheck**

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker"
pnpm -F desktop typecheck 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 4: Commit (if any ruff/lint fixes were needed)**

If Step 2 required fixes, commit them:

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker"
git add -p  # stage only lint fixes
git commit -m "chore: ruff lint fixes across phase-4d backend files"
```

If everything was already clean, no commit needed.

---

## Self-review

### Spec coverage check

| Spec requirement | Task |
|---|---|
| `custom_translators: list[dict]` + `active_translator: str` added to `AppConfig` | Task 1 |
| Migration: legacy `openai_*` → `custom_translators` entry `"openai-legacy"` | Task 1 |
| Migration: `translator_provider` → `active_translator` | Task 1 |
| Migration is idempotent | Task 1 (test: `test_migration_legacy_openai_is_idempotent`) |
| Per-profile `api_key` masked on GET; `"***"` sentinel preserved on POST | Task 2 |
| `customTranslators`/`activeTranslator` in camelCase map | Task 2 |
| POST with masked key keeps saved key; POST with real key updates it | Task 2 |
| POST adding / removing a profile works | Task 2 |
| `get_active_translator(cfg)` dispatches gemini / local_openai / custom:<id> | Task 3 |
| Stale `active_translator` falls back to Gemini | Task 3 |
| `pipeline._make_translator` uses `get_active_translator` when no override | Task 3 |
| Per-job `translatorProvider` override still wins | Task 3 |
| `POST /api/translator/test` — real one-line translation round-trip | Task 4 |
| Accepts ad-hoc `{provider, …}` form | Task 4 |
| Accepts `{profileId, useSavedKey}` form resolving from config | Task 4 |
| Returns `{ok, sample: {src, dst}, latencyMs, model}` on success | Task 4 |
| Structured errors: auth 401/403 | Task 4 |
| Structured errors: model not found 404 | Task 4 |
| Structured errors: DNS / connect refused | Task 4 |
| Structured errors: timeout | Task 4 |
| Structured errors: quota 429 | Task 4 |
| `POST /api/translator/list-models` accepts `profileId + useSavedKey` | Task 4 |
| api-client `TranslatorProfile` type | Task 5 |
| api-client `TranslatorTestResult` type | Task 5 |
| api-client `AppConfig.customTranslators` + `activeTranslator` | Task 5 |
| api-client `testTranslator` updated signature (both call forms) | Task 5 |
| api-client `listTranslatorModels` updated signature | Task 5 |
| Existing call sites still typecheck (backward-compatible union) | Task 5 |

### Placeholder scan

No "TBD", "TODO", or "implement later" markers present. All steps contain literal code.

### Type consistency

- `TranslatorProfile` defined in Task 5 Step 1 and imported in Step 3 of the same task. ✓
- `TranslatorTestResult` defined in Task 5 Step 1 and used as return type in Step 3. ✓
- `get_active_translator` defined in Task 3 Step 3 and imported/used in Task 4 Step 4 (`from core.translator import get_active_translator, get_translator`). ✓
- `_profile_to_camel` / `_profile_from_camel` defined and used only in Task 2. ✓
- `translate_title(title, target_lang)` — both `GeminiTranslator` and `OpenAICompatTranslator` already have this method (confirmed by reading the source). ✓
- `_TEST_SRC = "Hello, world."` used in the route and the test assertions. ✓
- `mock_provider.model` attribute — `OpenAICompatTranslator.__init__` sets `self.model = model`; `GeminiTranslator.__init__` sets `self.model = model`. Both confirmed. ✓
