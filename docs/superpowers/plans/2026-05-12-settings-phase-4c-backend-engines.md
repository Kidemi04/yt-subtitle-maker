# Settings Phase 4c-Backend — Engine-Driven Transcription Tab: Backend Endpoints + api-client Types

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `GET /api/system` (OS/arch/GPU report), `GET /api/engines` (engine descriptor list with model catalog + "planned" stubs for unreleased engines), and engine-keyed variants of `/api/dependencies` GET + POST/install — all tested with pytest — plus the matching TypeScript types and `ApiClient` methods in `packages/api-client`.

**Architecture:** Three new thin route files (`system.py`, `engines.py`) wired into `api/main.py`, plus extensions to the existing `dependencies.py` route. The system-info logic lives in a new `core/system_info.py` module (never crashes — GPU errors return `vendor: "none"`). The engine-descriptor builder lives in a new `core/engines.py` module, which imports `MODELS_URLS` + `MODEL_SIZES_MB` from `dependency_manager.py` and `check_whisper_model` for download-state. All new endpoints return plain dicts (matching the style of `config.py` and `dependencies.py`). `/api/version`'s `cudaAvailable` field is **left as-is** for backward compatibility; `GET /api/system` supersedes it for Settings/4c-frontend consumers. The api-client gains four new types and three new methods (plus optional `engine?` args on the existing install methods) without touching anything else.

**Tech Stack:** Python 3.12, FastAPI, pydantic (for request models only), pytest + `unittest.mock`, `platform`, `torch` (already a dep); TypeScript 5, `packages/api-client` fetch client, `npx tsc --noEmit`.

**Spec refs:**

From `docs/superpowers/specs/2026-05-12-settings-tab-production-ready-design.md` — "Transcription tab — engine-driven":

> "The tab is driven by an **engine descriptor list** the backend provides, not a hardcoded UI list. Each descriptor: `{ id, label, available: bool, packageSizeMb: number|null, requirements: {...}, models: [{ name, sizeMb, downloaded }], tunables: [{ key, label, type, choices?, default, help }] }`."

> "Backend exposes a system report via a new dedicated `GET /api/system`: `{ os: "macos"|"windows"|"linux", arch: "arm64"|"x86_64", gpu: { vendor: "apple"|"nvidia"|"amd"|"intel"|"none", name, cudaAvailable, mpsAvailable } }` — superseding the `cudaAvailable` hint currently tacked onto `/api/version`."

> "/api/dependencies model-download endpoints gain an optional `engine` param (absent ⇒ today's Whisper behaviour — backward compatible)."

From "Backend changes (summary)" items 3, 4, 4b:

> "3. `GET /api/system` → OS / arch / GPU report (see Transcription). 4. `GET /api/engines` → the engine descriptor list … For now it reflects `openai-whisper` (available) + static "planned" stubs … 4b. `/api/dependencies` model-download endpoints gain an optional `engine` param (absent ⇒ today's Whisper behaviour — backward compatible)."

From `docs/superpowers/plans/2026-05-12-settings-phase-4-overview.md` — "4c — Backend (4c-backend)":

> "`GET /api/system` → `{ os, arch, gpu: { vendor, name, cudaAvailable, mpsAvailable } }` … `GET /api/engines` → `[{ id, label, available, packageSizeMb, requirements, models: [{ name, sizeMb, downloaded }], tunables }]`. For now: `openai-whisper` (available; its models from `MODELS_URLS` with sizes & downloaded-state) + static 'planned' stubs for `faster-whisper` / `whisperx` / `insanely-fast-whisper` … `/api/dependencies` model-download endpoints gain an optional `engine` param."

**Out of scope for this plan (do not pull in):**
- **4c-frontend** (`EnginePicker.tsx`, machine-compat verdict UI, Source-mode `SegmentedControl`, `TranscriptionTab.tsx` rewrite, search-index updates) — separate plan.
- **Implementing `faster-whisper`, `whisperx`, or `insanely-fast-whisper`** — 4c-backend ships the *contract* + the `openai-whisper` descriptor + static "planned" stubs for the others. No real `FasterWhisperProvider` class.
- **Engine plugin-download system** — letting the packaged `.app` download engine packages at runtime. Out of scope per spec.
- **Config model changes** — no `AppConfig` fields change here; the engine descriptor is derived, not persisted.
- **Rust/Tauri** — none.
- **Phase 4b autosave / per-field `↺`** — independent.

---

## Judgment calls (document here, not in code)

1. **Leave `cudaAvailable` on `/api/version` alone.** It's used by the existing test in `test_version.py` and likely consumed by older frontend paths. The 4c-frontend plan migrates Transcription-tab consumers to `GET /api/system`; until then both co-exist.
2. **Plain dicts, not pydantic `response_model=`.** `config.py` and `dependencies.py` both return plain dicts; the new routes match that style. `BackendCapabilities` in `version.py` is the exception (it uses `response_model=BackendCapabilities`) — don't unify now.
3. **`packageSizeMb: null` for `openai-whisper`.** torch is already a hard runtime dep — there is no incremental install package for `openai-whisper`. The frontend should render this as "included" or "—".
4. **`tunables: []` for `openai-whisper`.** Device / source-language / VAD / ffmpeg-resample are general config fields the frontend handles separately in `TranscriptionTab`; they are not engine-specific tunables. If `faster-whisper` lands, its `compute_type` / `beam_size` / `vad_filter` *would* go in `tunables`.
5. **Minimal `requirements` shape.** Use `{ "platform": ["macos", "windows", "linux"], "accelerators": ["cpu"] }` for `openai-whisper` (runs everywhere, CPU always works, GPU is a bonus). For the stubs: `faster-whisper` `{"platform": [...all...], "accelerators": ["cpu", "nvidia_cuda"]}`, `whisperx` `{"platform": ["macos", "linux"], "accelerators": ["cpu", "nvidia_cuda"]}`, `insanely-fast-whisper` `{"platform": ["macos"], "accelerators": ["apple_mps"]}`.
6. **`MODEL_SIZES_MB` literal values.** Published openai-whisper checkpoint sizes (from the [openai/whisper README](https://github.com/openai/whisper#available-models-and-languages)): `tiny≈75`, `base≈145`, `small≈484`, `medium≈1536`, `large-v3≈3093`, `turbo≈1624` MB.
7. **Best-effort GPU detection, never crash.** `torch.cuda.get_device_name(0)` is only safe when CUDA is available. `torch.backends.mps.is_available()` is Apple-only but returns False elsewhere without crashing. On macOS arm64 without CUDA, report `vendor: "apple"` (we know from arch+platform). GPU name on non-CUDA macOS: attempt `subprocess.run(["system_profiler", "SPDisplaysDataType", "-json"])` and parse the first GPU name; if it fails/times-out, leave `name: null`. On Linux without CUDA: leave `vendor: "none", name: null`. On Windows without CUDA: leave `vendor: "none", name: null`.
8. **`engine` param is optional on both GET and POST/install.** Absent or `"openai-whisper"` → today's behaviour. A *planned* but-not-yet-available engine → `{"ok": false, "error": "engine 'faster-whisper' is not yet available on this installation"}` — matches the existing `{"ok": False, "error": ...}` style.

---

## File structure

| File | Action | Responsibility |
|---|---|---|
| `backend/core/system_info.py` | **Create** | `get_system_report() → dict` — OS/arch/GPU; never raises |
| `backend/core/engines.py` | **Create** | `build_engine_descriptors() → list[dict]` — assembles the descriptor list from `MODELS_URLS`, `MODEL_SIZES_MB`, `check_whisper_model`, plus static stubs |
| `backend/core/dependency_manager.py` | **Modify** | Add `MODEL_SIZES_MB: dict[str, int]` constant |
| `backend/api/routes/system.py` | **Create** | `GET /api/system` — calls `get_system_report()` |
| `backend/api/routes/engines.py` | **Create** | `GET /api/engines` — calls `build_engine_descriptors()` |
| `backend/api/routes/dependencies.py` | **Modify** | `GET /api/dependencies` gains optional `?engine=` query param; `POST /api/dependencies/install` body gains optional `engine` field; both remain backward-compatible |
| `backend/api/main.py` | **Modify** | Wire `system` and `engines` routers |
| `tests/api/test_system_route.py` | **Create** | Pytest for `GET /api/system` |
| `tests/api/test_engines_route.py` | **Create** | Pytest for `GET /api/engines` |
| `tests/api/test_dependencies.py` | **Modify** | Append tests for the `engine` param behaviour |
| `packages/api-client/src/types.ts` | **Modify** | Add `SystemReport`, `GpuInfo`, `EngineDescriptor`, `EngineModel`, `EngineTunable` types |
| `packages/api-client/src/client.ts` | **Modify** | Add `getSystem()`, `getEngines()`; add optional `engine?` to `fetchDependencies` and `installDependency` |

---

## Task 1 — `core/system_info.py`: `get_system_report()`

**Files:**
- Create: `backend/core/system_info.py`
- Create: `tests/api/test_system_route.py` (stub test first)

### Background

`get_system_report()` is the helper that `GET /api/system` delegates to. It uses:
- `platform.system()` → `"Darwin"` / `"Windows"` / `"Linux"` → mapped to `"macos"` / `"windows"` / `"linux"`
- `platform.machine()` → `"arm64"` / `"AMD64"` / `"x86_64"` → normalised to `"arm64"` or `"x86_64"`
- `torch.cuda.is_available()` → bool
- `torch.cuda.get_device_name(0)` — only safe when CUDA available
- `torch.backends.mps.is_available()` → bool (Apple Silicon GPU)
- For GPU name on macOS non-CUDA: `subprocess.run(["system_profiler", "SPDisplaysDataType", "-json"], ...)` → parse first GPU name

- [ ] **Step 1: Write the failing test (just `test_system_route.py` stub — the route doesn't exist yet)**

Create `tests/api/test_system_route.py`:

```python
"""Tests for GET /api/system — OS / arch / GPU report."""
from __future__ import annotations

from unittest.mock import patch

from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


def test_system_route_exists_and_returns_shape():
    """GET /api/system responds 200 with the expected top-level keys."""
    resp = client.get("/api/system")
    assert resp.status_code == 200
    body = resp.json()
    assert "os" in body
    assert "arch" in body
    assert "gpu" in body
    assert body["os"] in {"macos", "windows", "linux"}
    assert body["arch"] in {"arm64", "x86_64"}
    gpu = body["gpu"]
    assert "vendor" in gpu
    assert "name" in gpu       # str or null
    assert "cudaAvailable" in gpu
    assert "mpsAvailable" in gpu
    assert gpu["vendor"] in {"apple", "nvidia", "amd", "intel", "none"}
    assert isinstance(gpu["cudaAvailable"], bool)
    assert isinstance(gpu["mpsAvailable"], bool)


def test_system_route_never_crashes_on_bad_gpu(monkeypatch):
    """Even if torch or subprocess explodes, the route must return 200."""
    import core.system_info as si

    def boom():
        raise RuntimeError("simulated GPU explosion")

    monkeypatch.setattr(si, "_gpu_info", boom)
    resp = client.get("/api/system")
    assert resp.status_code == 200
    body = resp.json()
    # Fallback: vendor is "none"
    assert body["gpu"]["vendor"] == "none"
```

- [ ] **Step 2: Run test — confirm it fails**

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker"
backend/.venv/bin/python -m pytest tests/api/test_system_route.py -q
```

Expected: `ERROR` or `FAILED` — `404` on `GET /api/system` (route doesn't exist yet).

- [ ] **Step 3: Create `backend/core/system_info.py`**

```python
"""System info helper — OS / arch / GPU report.

get_system_report() is the single public API. It never raises; on any
error the gpu block falls back to vendor="none".
"""
from __future__ import annotations

import json
import platform
import subprocess


def _gpu_name_macos() -> str | None:
    """Best-effort GPU name on macOS via system_profiler (JSON output)."""
    try:
        result = subprocess.run(
            ["system_profiler", "SPDisplaysDataType", "-json"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        data = json.loads(result.stdout)
        displays = data.get("SPDisplaysDataType", [])
        if displays:
            return displays[0].get("sppci_model") or displays[0].get("_name")
    except Exception:
        pass
    return None


def _gpu_info() -> dict:
    """Return gpu sub-dict. Never raises — returns vendor='none' on failure."""
    try:
        import torch  # noqa: PLC0415 — deferred so tests without torch still pass

        cuda_ok = torch.cuda.is_available()
        mps_ok = torch.backends.mps.is_available()

        if cuda_ok:
            try:
                name: str | None = torch.cuda.get_device_name(0)
            except Exception:
                name = None
            # Detect vendor from device name string
            vendor = "none"
            if name:
                n = name.lower()
                if "nvidia" in n or "geforce" in n or "quadro" in n or "tesla" in n:
                    vendor = "nvidia"
                elif "amd" in n or "radeon" in n:
                    vendor = "amd"
                elif "intel" in n:
                    vendor = "intel"
            return {
                "vendor": vendor,
                "name": name,
                "cudaAvailable": True,
                "mpsAvailable": False,
            }

        if mps_ok:
            name = _gpu_name_macos()
            return {
                "vendor": "apple",
                "name": name,
                "cudaAvailable": False,
                "mpsAvailable": True,
            }

        # macOS arm64 without MPS available (unusual) — still likely Apple GPU
        sys = platform.system()
        mach = platform.machine().lower()
        if sys == "Darwin" and mach == "arm64":
            name = _gpu_name_macos()
            return {
                "vendor": "apple",
                "name": name,
                "cudaAvailable": False,
                "mpsAvailable": False,
            }

        return {"vendor": "none", "name": None, "cudaAvailable": False, "mpsAvailable": False}
    except Exception:
        return {"vendor": "none", "name": None, "cudaAvailable": False, "mpsAvailable": False}


def get_system_report() -> dict:
    """Return OS / arch / GPU information. Never raises."""
    sys = platform.system()
    os_name = {"Darwin": "macos", "Windows": "windows", "Linux": "linux"}.get(sys, "linux")

    raw_arch = platform.machine()
    arch = "arm64" if raw_arch.lower() in {"arm64", "aarch64"} else "x86_64"

    try:
        gpu = _gpu_info()
    except Exception:
        gpu = {"vendor": "none", "name": None, "cudaAvailable": False, "mpsAvailable": False}

    return {"os": os_name, "arch": arch, "gpu": gpu}
```

- [ ] **Step 4: Create `backend/api/routes/system.py`**

```python
"""GET /api/system — OS / arch / GPU report for machine-compat verdicts."""
from __future__ import annotations

from fastapi import APIRouter

from core.system_info import get_system_report

router = APIRouter(prefix="/api", tags=["system"])


@router.get("/system")
def get_system() -> dict:
    """Return OS, architecture, and GPU information.

    Supersedes the ``cudaAvailable`` field on ``/api/version`` for new consumers.
    ``/api/version``'s ``cudaAvailable`` is left unchanged for backward compatibility.
    """
    return get_system_report()
```

- [ ] **Step 5: Wire the router into `backend/api/main.py`**

```python
from api.routes import system as system_route
```

Add the `include_router` call after the existing ones:

```python
app.include_router(system_route.router)
```

The full import block at the top of `main.py` becomes:

```python
from api.routes import config as config_route
from api.routes import (
    cookies,
    dependencies,
    history,
    library,
    metadata,
    process,
    system as system_route,
    translator,
    version,
)
```

And add one line in the router-wiring block:

```python
app.include_router(system_route.router)
```

(Place it after `app.include_router(version.router)`.)

- [ ] **Step 6: Run the test — confirm it passes; full suite green**

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker"
backend/.venv/bin/python -m pytest tests/api/test_system_route.py -q
```

Expected: `2 passed`.

```bash
backend/.venv/bin/python -m pytest -q
```

Expected: all previously-passing tests still pass (was 161; now 163).

- [ ] **Step 7: Lint**

```bash
backend/.venv/bin/ruff check backend
```

Expected: no errors. Fix any if found (most likely `E501` for lines > 100 chars — trim those lines).

- [ ] **Step 8: Commit**

```bash
git add backend/core/system_info.py backend/api/routes/system.py backend/api/main.py tests/api/test_system_route.py
git commit -m "feat(api): GET /api/system — OS/arch/GPU report (core/system_info.py)"
```

---

## Task 2 — `MODEL_SIZES_MB` in `dependency_manager.py`

**Files:**
- Modify: `backend/core/dependency_manager.py`

This task is a prerequisite for Task 3 (`engines.py` imports `MODEL_SIZES_MB`). It has no new test of its own — the sizes are validated indirectly by Task 3's test (which asserts `sizeMb` is a positive integer).

- [ ] **Step 1: Add `MODEL_SIZES_MB` to `backend/core/dependency_manager.py`**

After the `MODELS_URLS` dict (line 16), insert:

```python
# Published checkpoint sizes in MB (openai-whisper README, 2024).
# Used by GET /api/engines to populate the model catalog's sizeMb field.
MODEL_SIZES_MB: dict[str, int] = {
    "tiny": 75,
    "base": 145,
    "small": 484,
    "medium": 1536,
    "large-v3": 3093,
    "turbo": 1624,
}
```

- [ ] **Step 2: Quick sanity — import is clean**

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker"
backend/.venv/bin/python -c "from core.dependency_manager import MODEL_SIZES_MB; print(MODEL_SIZES_MB)"
```

Expected output: `{'tiny': 75, 'base': 145, 'small': 484, 'medium': 1536, 'large-v3': 3093, 'turbo': 1624}`.

- [ ] **Step 3: Lint**

```bash
backend/.venv/bin/ruff check backend
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add backend/core/dependency_manager.py
git commit -m "feat(core): MODEL_SIZES_MB map for openai-whisper checkpoints"
```

---

## Task 3 — `core/engines.py` + `GET /api/engines`

**Files:**
- Create: `backend/core/engines.py`
- Create: `backend/api/routes/engines.py`
- Modify: `backend/api/main.py`
- Create: `tests/api/test_engines_route.py`

### Descriptor JSON contract (literal — implementer must not deviate)

The `GET /api/engines` response is a JSON array. Each element:

```json
{
  "id": "openai-whisper",
  "label": "OpenAI Whisper",
  "available": true,
  "packageSizeMb": null,
  "requirements": {
    "platform": ["macos", "windows", "linux"],
    "accelerators": ["cpu"]
  },
  "models": [
    { "name": "tiny",     "sizeMb": 75,   "downloaded": false },
    { "name": "base",     "sizeMb": 145,  "downloaded": false },
    { "name": "small",    "sizeMb": 484,  "downloaded": false },
    { "name": "medium",   "sizeMb": 1536, "downloaded": false },
    { "name": "large-v3", "sizeMb": 3093, "downloaded": false },
    { "name": "turbo",    "sizeMb": 1624, "downloaded": false }
  ],
  "tunables": [],
  "note": null
}
```

Planned stubs (static, `available: false`, `models: []`):

```json
{
  "id": "faster-whisper",
  "label": "Faster Whisper",
  "available": false,
  "packageSizeMb": 50,
  "requirements": {
    "platform": ["macos", "windows", "linux"],
    "accelerators": ["cpu", "nvidia_cuda"]
  },
  "models": [],
  "tunables": [],
  "note": "Add-on — planned. Will support compute_type, beam_size, and VAD filter."
}
```

```json
{
  "id": "whisperx",
  "label": "WhisperX",
  "available": false,
  "packageSizeMb": 200,
  "requirements": {
    "platform": ["macos", "linux"],
    "accelerators": ["cpu", "nvidia_cuda"]
  },
  "models": [],
  "tunables": [],
  "note": "Add-on — planned. Word-level timestamps + speaker diarisation."
}
```

```json
{
  "id": "insanely-fast-whisper",
  "label": "Insanely Fast Whisper",
  "available": false,
  "packageSizeMb": 300,
  "requirements": {
    "platform": ["macos"],
    "accelerators": ["apple_mps"]
  },
  "models": [],
  "tunables": [],
  "note": "Add-on — planned. Apple Silicon only (MPS)."
}
```

- [ ] **Step 1: Write the failing test**

Create `tests/api/test_engines_route.py`:

```python
"""Tests for GET /api/engines — engine descriptor list."""
from __future__ import annotations

from unittest.mock import patch

from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


def test_engines_returns_list():
    resp = client.get("/api/engines")
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body, list)
    assert len(body) >= 4  # openai-whisper + 3 planned stubs


def test_openai_whisper_descriptor_shape():
    with patch("core.engines.check_whisper_model") as mock_check:
        # Simulate tiny + turbo downloaded, rest not.
        mock_check.side_effect = lambda name: name in {"tiny", "turbo"}
        resp = client.get("/api/engines")
    assert resp.status_code == 200
    descs = resp.json()
    ow = next(d for d in descs if d["id"] == "openai-whisper")

    assert ow["available"] is True
    assert ow["packageSizeMb"] is None
    assert isinstance(ow["requirements"], dict)
    assert "platform" in ow["requirements"]
    assert "accelerators" in ow["requirements"]

    # models list: 6 entries, each with name/sizeMb/downloaded
    assert len(ow["models"]) == 6
    model_names = {m["name"] for m in ow["models"]}
    assert model_names == {"tiny", "base", "small", "medium", "large-v3", "turbo"}

    for m in ow["models"]:
        assert isinstance(m["sizeMb"], int)
        assert m["sizeMb"] > 0
        assert isinstance(m["downloaded"], bool)

    # tiny and turbo are downloaded per our mock
    tiny = next(m for m in ow["models"] if m["name"] == "tiny")
    turbo = next(m for m in ow["models"] if m["name"] == "turbo")
    base = next(m for m in ow["models"] if m["name"] == "base")
    assert tiny["downloaded"] is True
    assert turbo["downloaded"] is True
    assert base["downloaded"] is False

    # tunables is empty list (no engine-specific tunables for openai-whisper)
    assert ow["tunables"] == []


def test_planned_stubs_present_and_unavailable():
    resp = client.get("/api/engines")
    descs = resp.json()
    planned_ids = {"faster-whisper", "whisperx", "insanely-fast-whisper"}
    found = {d["id"] for d in descs if d["id"] in planned_ids}
    assert found == planned_ids

    for d in descs:
        if d["id"] in planned_ids:
            assert d["available"] is False
            assert d["models"] == []
            assert isinstance(d["packageSizeMb"], int)
            assert d["packageSizeMb"] > 0
            assert isinstance(d.get("note"), str)


def test_model_sizes_match_known_values():
    """Verify the sizeMb values for the openai-whisper models match spec."""
    resp = client.get("/api/engines")
    ow = next(d for d in resp.json() if d["id"] == "openai-whisper")
    sizes = {m["name"]: m["sizeMb"] for m in ow["models"]}
    assert sizes["tiny"] == 75
    assert sizes["base"] == 145
    assert sizes["small"] == 484
    assert sizes["medium"] == 1536
    assert sizes["large-v3"] == 3093
    assert sizes["turbo"] == 1624
```

- [ ] **Step 2: Run test — confirm it fails**

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker"
backend/.venv/bin/python -m pytest tests/api/test_engines_route.py -q
```

Expected: 4 failures — `404` on `GET /api/engines`.

- [ ] **Step 3: Create `backend/core/engines.py`**

```python
"""Engine descriptor builder for GET /api/engines.

Returns the descriptor list the frontend's TranscriptionTab renders.
openai-whisper is the only *available* engine; faster-whisper, whisperx,
and insanely-fast-whisper are static "planned" stubs with available=False.

The descriptor contract (camelCase JSON keys) is defined in:
  docs/superpowers/specs/2026-05-12-settings-tab-production-ready-design.md
  §"Transcription tab — engine-driven"
"""
from __future__ import annotations

from core.dependency_manager import MODEL_SIZES_MB, MODELS_URLS, check_whisper_model

# Static planned stubs — not available yet.
# When a real implementation lands (e.g. faster-whisper), move it to a
# real descriptor built dynamically like openai-whisper's.
_PLANNED_STUBS: list[dict] = [
    {
        "id": "faster-whisper",
        "label": "Faster Whisper",
        "available": False,
        "packageSizeMb": 50,
        "requirements": {
            "platform": ["macos", "windows", "linux"],
            "accelerators": ["cpu", "nvidia_cuda"],
        },
        "models": [],
        "tunables": [],
        "note": "Add-on — planned. Will support compute_type, beam_size, and VAD filter.",
    },
    {
        "id": "whisperx",
        "label": "WhisperX",
        "available": False,
        "packageSizeMb": 200,
        "requirements": {
            "platform": ["macos", "linux"],
            "accelerators": ["cpu", "nvidia_cuda"],
        },
        "models": [],
        "tunables": [],
        "note": "Add-on — planned. Word-level timestamps + speaker diarisation.",
    },
    {
        "id": "insanely-fast-whisper",
        "label": "Insanely Fast Whisper",
        "available": False,
        "packageSizeMb": 300,
        "requirements": {
            "platform": ["macos"],
            "accelerators": ["apple_mps"],
        },
        "models": [],
        "tunables": [],
        "note": "Add-on — planned. Apple Silicon only (MPS).",
    },
]


def _openai_whisper_descriptor() -> dict:
    """Build the openai-whisper descriptor with live download-state per model."""
    models = [
        {
            "name": name,
            "sizeMb": MODEL_SIZES_MB[name],
            "downloaded": check_whisper_model(name),
        }
        for name in MODELS_URLS  # preserves insertion order: tiny → turbo
    ]
    return {
        "id": "openai-whisper",
        "label": "OpenAI Whisper",
        "available": True,
        "packageSizeMb": None,  # torch is a hard dep — no incremental install
        "requirements": {
            "platform": ["macos", "windows", "linux"],
            "accelerators": ["cpu"],  # gpu is a bonus, not required
        },
        "models": models,
        "tunables": [],  # device/lang/VAD/ffmpeg-resample are general config
        "note": None,
    }


def build_engine_descriptors() -> list[dict]:
    """Return the full engine descriptor list (available first, then planned)."""
    return [_openai_whisper_descriptor(), *_PLANNED_STUBS]
```

- [ ] **Step 4: Create `backend/api/routes/engines.py`**

```python
"""GET /api/engines — engine descriptor list for the TranscriptionTab."""
from __future__ import annotations

from fastapi import APIRouter

from core.engines import build_engine_descriptors

router = APIRouter(prefix="/api", tags=["engines"])


@router.get("/engines")
def get_engines() -> list:
    """Return the engine descriptor list.

    Shape per element:
      { id, label, available, packageSizeMb, requirements, models, tunables, note }

    openai-whisper is available; faster-whisper/whisperx/insanely-fast-whisper
    are static planned stubs (available=false, models=[]).
    """
    return build_engine_descriptors()
```

- [ ] **Step 5: Wire the router into `backend/api/main.py`**

Update the import block in `backend/api/main.py` (add `engines as engines_route`):

```python
from api.routes import config as config_route
from api.routes import (
    cookies,
    dependencies,
    engines as engines_route,
    history,
    library,
    metadata,
    process,
    system as system_route,
    translator,
    version,
)
```

Add the include after `system_route`:

```python
app.include_router(engines_route.router)
```

- [ ] **Step 6: Run tests — confirm they pass; full suite green**

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker"
backend/.venv/bin/python -m pytest tests/api/test_engines_route.py -q
```

Expected: `4 passed`.

```bash
backend/.venv/bin/python -m pytest -q
```

Expected: all tests pass.

- [ ] **Step 7: Lint**

```bash
backend/.venv/bin/ruff check backend
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add backend/core/engines.py backend/api/routes/engines.py backend/api/main.py tests/api/test_engines_route.py
git commit -m "feat(api): GET /api/engines — engine descriptor list (openai-whisper + planned stubs)"
```

---

## Task 4 — `engine` param on `/api/dependencies` GET + POST/install

**Files:**
- Modify: `backend/api/routes/dependencies.py`
- Modify: `tests/api/test_dependencies.py`

The `engine` query param on GET and the `engine` field in the POST body are optional. Absent or `"openai-whisper"` → today's behaviour. Any other value → `{"ok": false, "error": "engine '...' is not yet available on this installation"}`.

The POST body `InstallRequest` already uses pydantic — extend it with an optional `engine` field. The GET uses no request model — add a FastAPI query param.

- [ ] **Step 1: Write the failing tests**

Append to `tests/api/test_dependencies.py`:

```python
def test_dependencies_get_no_engine_param_still_works():
    """Omitting ?engine= is backward compatible."""
    resp = client.get("/api/dependencies")
    assert resp.status_code == 200
    assert "models" in resp.json()


def test_dependencies_get_openai_whisper_engine_same_as_no_param():
    """?engine=openai-whisper returns the same shape as no param."""
    resp = client.get("/api/dependencies?engine=openai-whisper")
    assert resp.status_code == 200
    body = resp.json()
    assert "models" in body
    assert "ffmpegAvailable" in body


def test_dependencies_get_planned_engine_returns_error():
    """?engine=faster-whisper returns {"ok": false, ...} — not 4xx."""
    resp = client.get("/api/dependencies?engine=faster-whisper")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert "faster-whisper" in body["error"]


def test_dependencies_install_no_engine_still_works():
    """POST /install with no engine field is backward compatible."""
    # Reject with a known-bad model — we just care it returns 200 (not 5xx)
    # with an error message, same as before.
    resp = client.post("/api/dependencies/install", json={"model": "nonexistent"})
    assert resp.status_code < 500


def test_dependencies_install_openai_whisper_engine_accepted():
    """POST /install with engine=openai-whisper routes to the existing handler."""
    resp = client.post(
        "/api/dependencies/install",
        json={"model": "nonexistent", "engine": "openai-whisper"},
    )
    assert resp.status_code < 500


def test_dependencies_install_planned_engine_returns_error():
    """POST /install with engine=faster-whisper returns {"ok": false, ...}."""
    resp = client.post(
        "/api/dependencies/install",
        json={"model": "tiny", "engine": "faster-whisper"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert "faster-whisper" in body["error"]
```

- [ ] **Step 2: Run new tests — confirm they fail**

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker"
backend/.venv/bin/python -m pytest tests/api/test_dependencies.py -q -k "engine"
```

Expected: several failures (the engine-param tests hit the endpoint without the new param handling).

- [ ] **Step 3: Modify `backend/api/routes/dependencies.py`**

Replace the file with the updated version. Key changes:
1. `InstallRequest` gains an optional `engine: str | None = None` field.
2. `get_dependencies()` gains an `engine: str | None = Query(default=None)` parameter.
3. Both handlers: absent or `"openai-whisper"` → existing logic; anything else → `{"ok": False, "error": "..."}`.

```python
"""Dependency check + install endpoints (Whisper model download, ffmpeg/mpv probe)."""
from __future__ import annotations

import json
import queue
import threading
from typing import Any

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from core.dependency_manager import (
    MODELS_URLS,
    check_ffmpeg,
    check_mpv,
    check_whisper_model,
    download_whisper_model_generator,
)

router = APIRouter(prefix="/api/dependencies", tags=["dependencies"])

# Engines that are not yet available. Any engine id outside this set and
# outside {"openai-whisper", None} triggers the "not yet available" error.
_PLANNED_ENGINES = {"faster-whisper", "whisperx", "insanely-fast-whisper"}


class InstallRequest(BaseModel):
    model: str
    engine: str | None = None


@router.get("")
def get_dependencies(engine: str | None = Query(default=None)) -> dict[str, Any]:
    """Return install state of every known Whisper model + ffmpeg/mpv presence.

    Optional ``?engine=`` query param. Absent or ``"openai-whisper"`` → today's
    behaviour. Any planned-but-not-yet-available engine → ``{"ok": False, ...}``.
    """
    if engine is not None and engine != "openai-whisper":
        return {
            "ok": False,
            "error": (
                f"engine {engine!r} is not yet available on this installation. "
                "Only 'openai-whisper' models can be checked or downloaded right now."
            ),
        }
    return {
        "models": {name: check_whisper_model(name) for name in MODELS_URLS},
        "ffmpegAvailable": check_ffmpeg(),
        "mpvAvailable": check_mpv(),
    }


@router.post("/install")
def install_model(req: InstallRequest):
    """Stream NDJSON progress events while downloading a Whisper model.

    Optional ``engine`` field in body. Absent or ``"openai-whisper"`` → today's
    behaviour. Any planned-but-not-yet-available engine → ``{"ok": False, ...}``.

    Event shape per line:
      {"status": "downloading", "downloaded": int, "total": int, "speed": float, "percent": float}
      {"status": "done", "model": str, "path": str}
      {"status": "error", "error": str, "recoverable": false}
    """
    if req.engine is not None and req.engine != "openai-whisper":
        return {
            "ok": False,
            "error": (
                f"engine {req.engine!r} is not yet available on this installation. "
                "Only 'openai-whisper' models can be downloaded right now."
            ),
        }

    if req.model not in MODELS_URLS:
        return {
            "ok": False,
            "error": f"Unknown model: {req.model!r}. Known: {list(MODELS_URLS.keys())}",
        }

    q: queue.Queue = queue.Queue()
    SENTINEL = object()

    def runner() -> None:
        try:
            for downloaded, total, speed in download_whisper_model_generator(req.model):
                percent = (downloaded / total * 100.0) if total > 0 else 0.0
                q.put({
                    "status": "downloading",
                    "downloaded": downloaded,
                    "total": total,
                    "speed": speed,
                    "percent": percent,
                })
            q.put({"status": "done", "model": req.model})
        except Exception as e:
            q.put({"status": "error", "error": str(e), "recoverable": False})
        finally:
            q.put(SENTINEL)

    threading.Thread(target=runner, daemon=True).start()

    def gen():
        while True:
            evt = q.get()
            if evt is SENTINEL:
                break
            yield json.dumps(evt) + "\n"

    return StreamingResponse(gen(), media_type="application/x-ndjson")
```

- [ ] **Step 4: Run all dependency tests — confirm all pass; full suite green**

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker"
backend/.venv/bin/python -m pytest tests/api/test_dependencies.py -q
```

Expected: all tests pass (the 3 original + the 6 new ones = 9 total).

```bash
backend/.venv/bin/python -m pytest -q
```

Expected: all tests pass.

- [ ] **Step 5: Lint**

```bash
backend/.venv/bin/ruff check backend
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add backend/api/routes/dependencies.py tests/api/test_dependencies.py
git commit -m "feat(api): /api/dependencies GET+POST gain optional engine param (backward-compatible)"
```

---

## Task 5 — api-client types + `getSystem` / `getEngines` / `engine?` args

**Files:**
- Modify: `packages/api-client/src/types.ts`
- Modify: `packages/api-client/src/client.ts`

This is pure TypeScript — no backend changes, no pytest. The verify command is `npx tsc --noEmit`.

- [ ] **Step 1: Add new types to `packages/api-client/src/types.ts`**

Append after the `InstallEvent` type (end of file):

```typescript
// ─── System report (GET /api/system) ──────────────────────────────────────

export interface GpuInfo {
  /** "apple" | "nvidia" | "amd" | "intel" | "none" */
  vendor: "apple" | "nvidia" | "amd" | "intel" | "none";
  /** GPU display name, or null if undetectable. */
  name: string | null;
  cudaAvailable: boolean;
  mpsAvailable: boolean;
}

export interface SystemReport {
  os: "macos" | "windows" | "linux";
  arch: "arm64" | "x86_64";
  gpu: GpuInfo;
}

// ─── Engine descriptors (GET /api/engines) ────────────────────────────────

export interface EngineTunable {
  key: string;
  label: string;
  /** "select" | "int" | "float" | "bool" */
  type: "select" | "int" | "float" | "bool";
  /** Present when type is "select". */
  choices?: string[];
  default: string | number | boolean | null;
  help: string;
}

export interface EngineModel {
  name: string;
  /** Size in MB (from openai-whisper's published checkpoint sizes). */
  sizeMb: number;
  /** True if the model file is present in the local cache. */
  downloaded: boolean;
}

export interface EngineDescriptor {
  id: string;
  label: string;
  available: boolean;
  /** Package download size in MB; null if the engine is bundled (openai-whisper). */
  packageSizeMb: number | null;
  requirements: {
    platform: string[];
    accelerators: string[];
  };
  models: EngineModel[];
  tunables: EngineTunable[];
  note: string | null;
}
```

- [ ] **Step 2: Add new methods + update existing ones in `packages/api-client/src/client.ts`**

First, add the new type imports at the top of `client.ts`. The existing import line is:

```typescript
import type {
  AppConfig,
  BackendCapabilities,
  DependencyStatus,
  HistoryItem,
  InstallEvent,
  LibraryItem,
  LibraryRunEvent,
  LibraryTranscribeRequest,
  LibraryTranslateRequest,
  ProcessEvent,
  ProcessRequest,
  TranslatorProvider,
  VideoDetail,
  VideoMetadata,
  WhisperModel,
} from "./types";
```

Replace it with:

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
  TranslatorProvider,
  VideoDetail,
  VideoMetadata,
  WhisperModel,
} from "./types";
```

Then add two new methods in the "Version + capabilities" section (after `fetchVersion()`):

```typescript
  // ─── System report ────────────────────────────────────────────────────
  async getSystem(): Promise<SystemReport> {
    const res = await fetch(`${this.baseUrl}/api/system`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`/api/system ${res.status}`);
    return res.json();
  }

  // ─── Engine descriptors ───────────────────────────────────────────────
  async getEngines(): Promise<EngineDescriptor[]> {
    const res = await fetch(`${this.baseUrl}/api/engines`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`/api/engines ${res.status}`);
    return res.json();
  }
```

Then update `fetchDependencies` to accept an optional `engine` query param:

```typescript
  async fetchDependencies(engine?: string): Promise<DependencyStatus> {
    const url = engine
      ? `${this.baseUrl}/api/dependencies?engine=${encodeURIComponent(engine)}`
      : `${this.baseUrl}/api/dependencies`;
    const res = await fetch(url, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`/api/dependencies ${res.status}`);
    return res.json();
  }
```

Then update `installDependency` to accept an optional `engine` arg:

```typescript
  async *installDependency(
    model: WhisperModel,
    signal?: AbortSignal,
    engine?: string,
  ): AsyncIterable<InstallEvent> {
    yield* this.streamNdjson<InstallEvent>(
      "/api/dependencies/install",
      engine ? { model, engine } : { model },
      signal,
    );
  }
```

- [ ] **Step 3: Typecheck**

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker/packages/api-client"
npx tsc --noEmit
```

Expected: no errors.

Also verify the desktop app compiles (it imports from `@yt-subtitle-maker/api-client`):

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker"
pnpm -F desktop typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/api-client/src/types.ts packages/api-client/src/client.ts
git commit -m "feat(api-client): SystemReport/EngineDescriptor types + getSystem/getEngines methods + engine? args"
```

---

## Task 6 — Cleanup pass

**Files:** potentially `backend/api/routes/dependencies.py`, `backend/core/engines.py`, `backend/core/system_info.py`, `backend/api/main.py`

This optional but recommended task does a final look for any rough edges before 4c-frontend consumes the new endpoints.

- [ ] **Step 1: Confirm the `_PLANNED_ENGINES` set in `dependencies.py` is unused beyond the comment**

The `_PLANNED_ENGINES` set was defined but not referenced in the final implementation (the guard checks `engine is not None and engine != "openai-whisper"` — it catches all planned engines without needing the set). Remove it to keep the file clean:

In `backend/api/routes/dependencies.py`, delete:

```python
# Engines that are not yet available. Any engine id outside this set and
# outside {"openai-whisper", None} triggers the "not yet available" error.
_PLANNED_ENGINES = {"faster-whisper", "whisperx", "insanely-fast-whisper"}
```

- [ ] **Step 2: Confirm the full test suite is green and lint is clean**

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker"
backend/.venv/bin/python -m pytest -q
backend/.venv/bin/ruff check backend
```

Expected: all tests pass, no lint errors.

- [ ] **Step 3: Confirm `npx tsc --noEmit` and desktop typecheck are clean**

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker/packages/api-client"
npx tsc --noEmit
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker"
pnpm -F desktop typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add backend/api/routes/dependencies.py
git commit -m "chore(api): remove unused _PLANNED_ENGINES set from dependencies.py"
```

---

## Self-review

### 1. Spec coverage

| Spec requirement | Covered by |
|---|---|
| `GET /api/system` → `{os, arch, gpu: {vendor, name, cudaAvailable, mpsAvailable}}` | Task 1 (`core/system_info.py` + `api/routes/system.py`) |
| GPU detection: `torch.cuda`, `torch.backends.mps`, never crash, best-effort name | Task 1 (`_gpu_info()` with full fallback, `_gpu_name_macos()`) |
| `/api/version`'s `cudaAvailable` left alone for backward-compat | Judgment call #1 — explicitly documented; `version.py` not touched |
| `GET /api/engines` → descriptor list | Task 3 (`core/engines.py` + `api/routes/engines.py`) |
| `openai-whisper` available with `models[]` populated from `MODELS_URLS`+`MODEL_SIZES_MB`+`check_whisper_model` | Task 3 (`_openai_whisper_descriptor()`) |
| `tunables: []` for `openai-whisper` | Task 3 + judgment call #4 |
| `packageSizeMb: null` for `openai-whisper` | Task 3 + judgment call #3 |
| Static "planned" stubs for `faster-whisper`, `whisperx`, `insanely-fast-whisper` | Task 3 (`_PLANNED_STUBS`) |
| `MODEL_SIZES_MB` map (tiny=75, base=145, small=484, medium=1536, large-v3=3093, turbo=1624) | Task 2 |
| `/api/dependencies` GET + POST gain optional `engine` param; absent/`"openai-whisper"` = today's behaviour | Task 4 |
| Planned engine param → `{"ok": false, "error": ...}` style | Task 4 |
| api-client: `SystemReport`, `GpuInfo`, `EngineDescriptor`, `EngineModel`, `EngineTunable` types | Task 5 (`types.ts`) |
| api-client: `getSystem()`, `getEngines()` methods | Task 5 (`client.ts`) |
| api-client: `fetchDependencies(engine?)` + `installDependency(model, signal?, engine?)` | Task 5 (`client.ts`) |
| Pytest for `GET /api/system` | Task 1 (`test_system_route.py`) |
| Pytest for `GET /api/engines` (openai-whisper available + sizes + downloaded; planned stubs present + unavailable) | Task 3 (`test_engines_route.py`) |
| Pytest for `engine` param on `GET /api/dependencies` + `POST /api/dependencies/install` | Task 4 (`test_dependencies.py` additions) |
| `npx tsc --noEmit` clean | Task 5 step 3 |
| `ruff check backend` clean after every backend task | Tasks 1, 2, 3, 4, 6 each include a lint step |

### 2. Placeholder scan

- No "TBD", "TODO", or "implement later" in any task — all code is literal.
- No "similar to Task N" shortcuts.
- Every backend task shows complete file content (or the exact diff) and the exact pytest command.
- `_PLANNED_ENGINES` in the Task 4 implementation was defined but unused in the final logic — Task 6 removes it (this is a deliberate clean-up step, not deferred work).

### 3. Type/name consistency

- `MODEL_SIZES_MB` defined in `dependency_manager.py` (Task 2), imported in `engines.py` (Task 3) — names match exactly.
- `MODELS_URLS` imported in `engines.py` under the same name it has in `dependency_manager.py`.
- `check_whisper_model` imported in `engines.py` and used in tests — names match.
- `build_engine_descriptors()` defined in `core/engines.py`, imported and called in `api/routes/engines.py` — names match.
- `get_system_report()` defined in `core/system_info.py`, imported and called in `api/routes/system.py`, monkeypatched as `si.get_system_report` (via `_gpu_info`) in test — names match.
- `SystemReport`, `GpuInfo`, `EngineDescriptor`, `EngineModel`, `EngineTunable` defined in `types.ts` (Task 5 step 1), imported in `client.ts` (Task 5 step 2) — names match.
- `getSystem()` returns `Promise<SystemReport>` — matches `SystemReport` shape exactly.
- `getEngines()` returns `Promise<EngineDescriptor[]>` — matches `EngineDescriptor` shape exactly.
- The `engine?` parameter on `installDependency` is the third positional arg to preserve the existing `(model, signal?)` call sites without breakage — callers that pass `undefined` for `signal` but want `engine` can use `installDependency(model, undefined, "openai-whisper")`.
