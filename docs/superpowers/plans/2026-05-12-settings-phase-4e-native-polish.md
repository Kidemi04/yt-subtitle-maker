# Settings Phase 4e — Native polish (folder pickers, armed paths, Test playback, Advanced ops) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the spec's "Native polish" pieces — `tauri-plugin-dialog` for folder/file pickers, armed folder/path fields with exists/writable/executable validation, an optional "Test playback" button that launches mpv on a tiny bundled clip with the saved subtitle style, and Advanced's "Open config folder" / "Export settings" / "Import settings" — while degrading gracefully in the `pnpm web` flow (where there is no Tauri runtime).

**Architecture:** Tauri-side: pull `tauri-plugin-dialog` into the Rust crate, register it, and grant `dialog:default` permission via a `capabilities/main.json` (this file/dir does not exist yet — we create it). Frontend: a new `apps/desktop/src/lib/native.ts` module owns the single `isTauri()` runtime guard (Tauri v2 exposes `window.__TAURI_INTERNALS__`) and thin wrappers around `@tauri-apps/plugin-dialog`'s `open()` + the new backend ops; settings components call those wrappers and conditionally render "Browse…" / "Test playback" affordances. Backend: a new `POST /api/fs/check` route validates a path (kind: `dir` → exists/isDir/writable; kind: `executable` → exists/executable, with `shutil.which` fallback for bare names), and a new `system_ops` router exposes `POST /api/system/open-config-dir` and `POST /api/system/test-playback`. Test-playback uses a tiny bundled clip at `backend/packaging/test_clip.mp4`; PyInstaller picks it up via `datas` in `backend.spec`. Export/Import is pure frontend (`JSON.stringify(config)` → blob download; `<input type="file">` → parse → `apiClient.updateConfig(parsed)`) so it works identically in Tauri and web.

**Tech Stack:** Rust + Tauri 2 (`tauri-plugin-dialog` v2), `@tauri-apps/plugin-dialog` JS bindings, FastAPI + TestClient (pytest), React 18 + Tamagui, the existing `ArmedField` component (already supports `validate` → "Apply anyway" failure flow), the `useSettingsDraft.update + flush` autosave path from Phase 4b, `apiClient.updateConfig` for Import.

**Spec ref:** `docs/superpowers/specs/2026-05-12-settings-tab-production-ready-design.md`. Phase-4e prose lives in `docs/superpowers/plans/2026-05-12-settings-phase-4-overview.md` §"4e — Native polish". Verbatim spec quotes used by this plan:

> "**Wrong-platform cruft** — `placeholder="C:\\Users\\you\\Downloads"` on a macOS app; folder fields are bare text inputs with no 'Browse…'." (§ Trust & correctness fixes)

> "**`tauri-plugin-dialog`** added (`apps/desktop/src-tauri/Cargo.toml` + `@tauri-apps/plugin-dialog` + a capability entry) for the folder 'Browse…' buttons (open-directory dialog). A small `apps/desktop/src/lib/native.ts` wraps it with an `isTauri()` guard — **in the `pnpm web` dev flow there's no Tauri runtime, so 'Browse…' is hidden/disabled and you fall back to typing the path** (with the resolved-default placeholder). Same guard gates the optional 'Test playback' button." (§ Desktop / Tauri changes)

> "`mpv executable path` is an armed field. Optional 'Test playback' button (launch mpv on a tiny bundled clip with the current style) — flagged as polish-phase." (§ Subtitles)

> "Advanced | Backend URL (armed) · Open config folder · Export / Import settings · **Reset all to defaults**." (§ Tab inventory)

> "**No Tauri runtime (`pnpm web`)** → 'Browse…' and 'Test playback' hidden; folder/path fields are plain text with resolved-default placeholders; everything else works." (§ Desktop / Tauri changes)

> "**Done means:** in `pnpm dev` / the packaged app, 'Browse…' opens a native folder picker and the armed field's Apply rejects a non-existent/non-writable dir with a reason; in `pnpm web` 'Browse…'/'Test playback' are absent and the fields are plain text with the resolved-default placeholder; 'Open config folder' opens the dir; Export downloads a JSON; Import applies one; 'Test playback' launches mpv with the current style (Tauri only); pytest green; typecheck clean; the Rust crate builds." (overview §4e Done means)

**Out of scope** (explicitly):
- Any frontend-only Generate-screen feature (Phase 4 is Settings-tab only).
- The `faster-whisper` engine implementation (that's a separate Phase 4c follow-up).
- Anything else under Phase 4 not labelled "Native polish" — Phases 4a (effective defaults), 4b (hybrid autosave), 4c/4d (engines + translator profiles) are all already shipped or covered by their own plans.
- Tauri auto-updater, deep-links, system-tray, single-instance — none are spec-required.
- Migrating `Open config folder` / `Test playback` to native Tauri commands. We deliberately use **backend** subprocess endpoints (the backend already runs on the user's machine on `127.0.0.1:8000`, so no Rust round-trip is necessary; this also keeps the feature reachable from the `pnpm web` browser flow when a backend is up).

---

## Judgment calls (locked in)

These are the choices the task list assumes — re-decide only if implementation surfaces a hard blocker.

| Decision | Choice | Why |
|---|---|---|
| `isTauri()` runtime check | `typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__ !== undefined` | Tauri v2's official runtime marker; `window.__TAURI__` was v1. Cheap, sync, no top-level import of the plugin (so `pnpm web` doesn't choke). |
| Open-config-folder / Test-playback transport | Backend `POST /api/system/...` endpoints | Backend already on the same machine; `subprocess.run(["open", path])` etc. is one-liner; one place to test (pytest, with mocked `subprocess`); and it works in `pnpm web` too if the backend is up. |
| Test-playback clip location | `backend/packaging/test_clip.mp4` | Lives with `run_backend.py` and `backend.spec`; one-line `datas` add. PyInstaller copies it into `backend-dist/_internal/packaging/`; the route resolves it via `Path(__file__).parent / "test_clip.mp4"` (works in dev and packaged). |
| Path-check transport | Backend `POST /api/fs/check` (new `backend/api/routes/fs.py`) | Same reasoning: stdlib (`os.access`, `shutil.which`); pytest with real `tmp_path` is trivial; usable from Tauri *and* web. |
| Export/Import settings | Pure frontend (JSON blob download + `<input type="file">` → `apiClient.updateConfig(...)`) | Cross-platform without Tauri; one less endpoint; no native file-save dialog needed (browsers do it). |
| `ArmedField` API change | **None.** The caller provides `validate` → it calls `apiClient.checkFs({path, kind})` and returns `{ok, reason}` | `ArmedField` already supports validate-then-commit + "Apply anyway"; no need to bake `kind` into the component. |
| `cargo` verify step | `cargo check --manifest-path …/Cargo.toml` per Rust task; final task does a full `cargo build` | `check` is ~10× faster than `build`; the final full build proves linking still works. Both need `source "$HOME/.cargo/env"` first per CLAUDE.md. |
| Capability granularity | `dialog:default` (the plugin's recommended preset; grants `dialog:allow-open` etc.) | Spec just says "a capability entry"; `dialog:default` is the documented preset. Tightening to individual `dialog:allow-open` if the build complains is a one-line change. |
| Mpv args from `cfg.sub_*` | Build a `--sub-…` list, skipping empty strings / negative defaults | Matches the rules in `core/config.py` (e.g. `sub_font_size: 0  # 0 = mpv default`, `sub_border_size: float = -1  # <0 = mpv default`). |

---

## File structure (created / modified)

| Path | Action | Responsibility |
|---|---|---|
| `apps/desktop/src-tauri/Cargo.toml` | **modify** | Add `tauri-plugin-dialog = "2"` to `[dependencies]`. |
| `apps/desktop/src-tauri/src/lib.rs` | **modify** | Register the plugin: `.plugin(tauri_plugin_dialog::init())` inside `tauri::Builder::default()`. |
| `apps/desktop/src-tauri/capabilities/main.json` | **create** | Tauri 2 capability: grants `core:default` + `dialog:default` to the main window. |
| `apps/desktop/src-tauri/tauri.conf.json` | **modify** | Add `"app.security.capabilities": ["main"]` so the new capability is loaded (only if absent — Tauri 2 may auto-load `capabilities/*.json`; we verify). |
| `apps/desktop/package.json` | **modify** | Add `"@tauri-apps/plugin-dialog": "^2"` to `dependencies`. |
| `apps/desktop/src/lib/native.ts` | **create** | The one and only `isTauri()` + `openDirectoryDialog()` + `openConfigFolder()` + `testPlayback()` wrapper. |
| `backend/api/routes/fs.py` | **create** | `POST /api/fs/check` — exists / isDir / writable for dirs; exists / executable (+ `which`) for executables. |
| `backend/api/routes/system_ops.py` | **create** | `POST /api/system/open-config-dir`, `POST /api/system/test-playback`. |
| `backend/api/main.py` | **modify** | Wire the two new routers. |
| `backend/packaging/test_clip.mp4` | **create** (binary asset) | A 1–2 s silent video bundled for "Test playback". |
| `backend/packaging/backend.spec` | **modify** | Add `(test_clip.mp4, "packaging")` to `datas` so PyInstaller copies it next to the entrypoint module. |
| `tests/api/test_fs_check.py` | **create** | pytest for `/api/fs/check` (uses `tmp_path`). |
| `tests/api/test_system_ops.py` | **create** | pytest for `/api/system/open-config-dir` and `/api/system/test-playback` (mocks `subprocess.run`/`subprocess.Popen` + `shutil.which`). |
| `packages/api-client/src/types.ts` | **modify** | Add `CheckFsRequest`, `CheckFsResult` types. |
| `packages/api-client/src/client.ts` | **modify** | Add `checkFs()` method. |
| `apps/desktop/src/components/settings/GeneralTab.tsx` | **modify** | Wrap `outputDir` / `downloadDir` / `whisperCacheDir` in `ArmedField`s with dir-validation + (Tauri) "Browse…". |
| `apps/desktop/src/components/settings/SubtitlesTab.tsx` | **modify** | Wrap `mpvPath` in `ArmedField` (executable validation) + (Tauri) "Browse…" + (Tauri) "Test playback" button. |
| `apps/desktop/src/components/settings/YouTubeTab.tsx` | **modify** | Wrap `jsRuntimePath` in `ArmedField` (executable validation) + (Tauri) "Browse…". |
| `apps/desktop/src/components/settings/AdvancedTab.tsx` | **modify** | Add "Open config folder", "Export settings", "Import settings" rows. |
| `apps/desktop/src/components/settings/searchIndex.ts` | **modify** | Add entries for `advanced.open-config`, `advanced.export-settings`, `advanced.import-settings`, `subtitles.test-playback`. |

---

## Per-task verify commands (used throughout)

- Backend: `cd /Users/kelvinfong/Documents/Personal\ Project/yt-subtitle-maker && backend/.venv/bin/python -m pytest tests/api/test_<file>.py -v`
- Backend full suite + lint: `backend/.venv/bin/python -m pytest -q && backend/.venv/bin/ruff check backend`
- api-client typecheck: `cd packages/api-client && npx tsc --noEmit`
- Desktop typecheck: `pnpm -F desktop typecheck`
- Cargo fast: `source "$HOME/.cargo/env" && cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`
- Cargo full (final task only): `source "$HOME/.cargo/env" && cd apps/desktop/src-tauri && cargo build`

After **every** task, the engineer must see:
- pytest suite green (202 tests + the new ones)
- ruff clean
- `pnpm -F desktop typecheck` clean
- `cd packages/api-client && npx tsc --noEmit` clean
- Rust tasks additionally: `cargo check` clean

---

## Task 1 — Backend: `POST /api/fs/check` (TDD)

**Files:**
- Create: `backend/api/routes/fs.py`
- Create: `tests/api/test_fs_check.py`
- Modify: `backend/api/main.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/api/test_fs_check.py`:

```python
"""Tests for POST /api/fs/check — path existence / writability / executability."""
from __future__ import annotations

import os
import stat
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


def test_check_dir_exists_and_writable(tmp_path: Path):
    resp = client.post("/api/fs/check", json={"path": str(tmp_path), "kind": "dir"})
    assert resp.status_code == 200
    body = resp.json()
    assert body == {"exists": True, "isDir": True, "writable": True}


def test_check_dir_missing(tmp_path: Path):
    missing = tmp_path / "does-not-exist"
    resp = client.post("/api/fs/check", json={"path": str(missing), "kind": "dir"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["exists"] is False
    assert body["isDir"] is False


def test_check_dir_not_a_directory(tmp_path: Path):
    f = tmp_path / "file.txt"
    f.write_text("hi")
    resp = client.post("/api/fs/check", json={"path": str(f), "kind": "dir"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["exists"] is True
    assert body["isDir"] is False


def test_check_executable_via_full_path(tmp_path: Path):
    exe = tmp_path / "fake"
    exe.write_text("#!/bin/sh\necho hi\n")
    exe.chmod(exe.stat().st_mode | stat.S_IXUSR)
    resp = client.post(
        "/api/fs/check", json={"path": str(exe), "kind": "executable"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["exists"] is True
    assert body["executable"] is True


def test_check_executable_bare_name_uses_which():
    # `ls` is on PATH on every Unix CI box; on Windows the route should still
    # 200 with exists=False/True via shutil.which (which handles .exe).
    resp = client.post(
        "/api/fs/check", json={"path": "ls", "kind": "executable"}
    )
    assert resp.status_code == 200
    body = resp.json()
    # Either it found it on PATH or it didn't; the route doesn't crash either way.
    assert "exists" in body and "executable" in body


def test_check_executable_missing():
    resp = client.post(
        "/api/fs/check",
        json={"path": "/totally/not/here/zzz", "kind": "executable"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["exists"] is False
    assert body["executable"] is False


def test_check_rejects_unknown_kind():
    resp = client.post("/api/fs/check", json={"path": "/tmp", "kind": "bogus"})
    assert resp.status_code in (400, 422)
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `backend/.venv/bin/python -m pytest tests/api/test_fs_check.py -v`
Expected: every test fails with 404 ("Not Found") because the route doesn't exist yet.

- [ ] **Step 3: Implement the route**

Create `backend/api/routes/fs.py`:

```python
"""POST /api/fs/check — validate a filesystem path for a settings field.

Used by the desktop ArmedField'd folder/executable settings to decide whether
to commit a typed value (or show the user the "Apply anyway" affordance).

Body: {"path": str, "kind": "dir" | "executable"}
Returns:
  kind="dir":         {exists: bool, isDir: bool, writable: bool}
  kind="executable":  {exists: bool, executable: bool}

`kind="executable"` accepts either an absolute path or a bare program name; bare
names are resolved through ``shutil.which`` (so "node" works on Windows too —
``which`` knows about PATHEXT).
"""
from __future__ import annotations

import os
import shutil
from pathlib import Path
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api", tags=["fs"])


class CheckFsRequest(BaseModel):
    path: str
    kind: Literal["dir", "executable"]


@router.post("/fs/check")
def check_fs(req: CheckFsRequest) -> dict:
    raw = (req.path or "").strip()
    if req.kind == "dir":
        if not raw:
            return {"exists": False, "isDir": False, "writable": False}
        p = Path(os.path.expanduser(raw))
        exists = p.exists()
        is_dir = exists and p.is_dir()
        # os.access on a missing path returns False, which is what we want.
        writable = is_dir and os.access(str(p), os.W_OK)
        return {"exists": exists, "isDir": is_dir, "writable": writable}

    # kind == "executable"
    if not raw:
        return {"exists": False, "executable": False}
    # Bare name? resolve via PATH.
    if os.sep not in raw and (os.altsep is None or os.altsep not in raw):
        resolved = shutil.which(raw)
        if resolved is None:
            return {"exists": False, "executable": False}
        p = Path(resolved)
    else:
        p = Path(os.path.expanduser(raw))
    exists = p.exists() and p.is_file()
    executable = exists and os.access(str(p), os.X_OK)
    return {"exists": exists, "executable": executable}
```

Modify `backend/api/main.py` — add `from api.routes import fs as fs_route` to the imports and `app.include_router(fs_route.router)` next to the other `include_router` calls.

Use this exact `Edit` pair:

```
old: from api.routes import engines as engines_route
new: from api.routes import engines as engines_route
     from api.routes import fs as fs_route
```

```
old: app.include_router(cookies.router)
new: app.include_router(cookies.router)
     app.include_router(fs_route.router)
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `backend/.venv/bin/python -m pytest tests/api/test_fs_check.py -v`
Expected: 7 passed.

- [ ] **Step 5: Suite + lint**

Run: `backend/.venv/bin/python -m pytest -q && backend/.venv/bin/ruff check backend`
Expected: full suite green (was 202 → now 209), ruff clean.

- [ ] **Step 6: Commit**

```bash
git add backend/api/routes/fs.py backend/api/main.py tests/api/test_fs_check.py
git commit -m "feat(settings/4e): POST /api/fs/check — dir & executable path validation"
```

---

## Task 2 — Backend: `POST /api/system/open-config-dir` + `POST /api/system/test-playback` (TDD)

**Files:**
- Create: `backend/api/routes/system_ops.py`
- Create: `tests/api/test_system_ops.py`
- Modify: `backend/api/main.py`
- Create (binary, blank for now): `backend/packaging/test_clip.mp4` — see Step 3 for how to generate it; if `ffmpeg` is unavailable, commit a placeholder ≥1 KB file (the tests mock the playback subprocess so the bytes never run).

- [ ] **Step 1: Write the failing tests**

Create `tests/api/test_system_ops.py`:

```python
"""Tests for POST /api/system/open-config-dir and /api/system/test-playback."""
from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


def test_open_config_dir_calls_platform_opener(monkeypatch, tmp_path: Path):
    """The route invokes the OS-appropriate file-manager command on `config_dir()`."""
    import core.config as cfgmod

    monkeypatch.setattr(cfgmod, "config_dir", lambda: tmp_path)

    completed = MagicMock(returncode=0)
    with patch("api.routes.system_ops.subprocess.run", return_value=completed) as run:
        resp = client.post("/api/system/open-config-dir")
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}
    # The first arg to subprocess.run is the command list; the last element is the path.
    args, _kwargs = run.call_args
    cmd = args[0]
    assert str(tmp_path) in cmd
    # Platform-appropriate opener
    if sys.platform == "darwin":
        assert cmd[0] == "open"
    elif sys.platform.startswith("win"):
        assert cmd[0].lower() in ("explorer", "explorer.exe")
    else:
        assert cmd[0] == "xdg-open"


def test_open_config_dir_reports_failure(monkeypatch, tmp_path: Path):
    import core.config as cfgmod

    monkeypatch.setattr(cfgmod, "config_dir", lambda: tmp_path)

    with patch(
        "api.routes.system_ops.subprocess.run",
        side_effect=FileNotFoundError("no opener"),
    ):
        resp = client.post("/api/system/open-config-dir")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert "no opener" in body["error"]


def test_test_playback_launches_mpv_with_clip(monkeypatch):
    """Spawns mpv with the bundled clip and --sub-* args derived from config."""
    import core.config as cfgmod
    from core.config import AppConfig

    # A config with a couple of non-default subtitle styles set.
    cfg = AppConfig()
    cfg.sub_font = "Inter"
    cfg.sub_font_size = 48
    cfg.sub_bold = True
    monkeypatch.setattr(cfgmod, "load_config", lambda: cfg)

    proc = MagicMock(pid=12345)
    with patch("api.routes.system_ops.subprocess.Popen", return_value=proc) as popen, \
         patch("api.routes.system_ops.shutil.which", return_value="/usr/local/bin/mpv"):
        resp = client.post("/api/system/test-playback")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["pid"] == 12345
    args, _kwargs = popen.call_args
    argv = args[0]
    # First element is the mpv binary; the clip path is somewhere in the list;
    # at least one --sub-* arg was passed for the non-default fields.
    assert argv[0] == "/usr/local/bin/mpv"
    assert any(a.endswith("test_clip.mp4") for a in argv)
    joined = " ".join(argv)
    assert "--sub-font=Inter" in argv
    assert "--sub-font-size=48" in argv
    assert "--sub-bold=yes" in argv


def test_test_playback_uses_cfg_mpv_path(monkeypatch):
    """If cfg.mpv_path is set, use it instead of `which mpv`."""
    import core.config as cfgmod
    from core.config import AppConfig

    cfg = AppConfig()
    cfg.mpv_path = "/opt/mpv/bin/mpv"
    monkeypatch.setattr(cfgmod, "load_config", lambda: cfg)

    proc = MagicMock(pid=1)
    with patch("api.routes.system_ops.subprocess.Popen", return_value=proc) as popen, \
         patch("api.routes.system_ops.shutil.which", return_value="/should/not/be/used"):
        resp = client.post("/api/system/test-playback")
    assert resp.status_code == 200
    argv = popen.call_args[0][0]
    assert argv[0] == "/opt/mpv/bin/mpv"


def test_test_playback_no_mpv_found(monkeypatch):
    import core.config as cfgmod
    from core.config import AppConfig

    monkeypatch.setattr(cfgmod, "load_config", lambda: AppConfig())
    with patch("api.routes.system_ops.shutil.which", return_value=None):
        resp = client.post("/api/system/test-playback")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert "mpv" in body["error"].lower()


def test_test_playback_missing_clip(monkeypatch, tmp_path):
    import api.routes.system_ops as so
    import core.config as cfgmod
    from core.config import AppConfig

    monkeypatch.setattr(cfgmod, "load_config", lambda: AppConfig())
    # Point the route at a clip path that doesn't exist.
    monkeypatch.setattr(so, "_clip_path", lambda: tmp_path / "missing.mp4")
    with patch("api.routes.system_ops.shutil.which", return_value="/usr/bin/mpv"):
        resp = client.post("/api/system/test-playback")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert "clip" in body["error"].lower()
```

- [ ] **Step 2: Run tests and watch them fail**

Run: `backend/.venv/bin/python -m pytest tests/api/test_system_ops.py -v`
Expected: every test fails with 404 (no route).

- [ ] **Step 3: Add the clip asset**

Generate a 1-second black silent clip locally. If `ffmpeg` is available:

```bash
ffmpeg -y -f lavfi -i color=c=black:s=320x240:d=1 -f lavfi -i anullsrc=r=22050:cl=mono \
       -t 1 -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest \
       backend/packaging/test_clip.mp4
```

If `ffmpeg` is *not* available on the dev box, create a tiny placeholder (≥1 KB so it isn't mistaken for an empty file) — the route's tests mock `subprocess.Popen` so the bytes never have to be a valid mp4. Document this in the commit message so a later contributor can replace it.

- [ ] **Step 4: Implement the route**

Create `backend/api/routes/system_ops.py`:

```python
"""System operation endpoints: open config folder, test mpv playback.

Lives next to `system.py` (which serves the GET /api/system info report).
These are mutating side-effect endpoints — separate file so the info route
stays trivially cacheable.
"""
from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

from fastapi import APIRouter

from core import config as cfgmod

router = APIRouter(prefix="/api/system", tags=["system_ops"])


# ─── Open config folder ──────────────────────────────────────────────────────

def _platform_opener(path: Path) -> list[str]:
    if sys.platform == "darwin":
        return ["open", str(path)]
    if sys.platform.startswith("win"):
        return ["explorer", str(path)]
    return ["xdg-open", str(path)]


@router.post("/open-config-dir")
def open_config_dir() -> dict:
    path = cfgmod.config_dir()
    path.mkdir(parents=True, exist_ok=True)
    try:
        subprocess.run(_platform_opener(path), check=False)
        return {"ok": True}
    except Exception as e:  # FileNotFoundError, PermissionError, …
        return {"ok": False, "error": str(e)}


# ─── Test mpv playback with current subtitle style ───────────────────────────

def _clip_path() -> Path:
    """Resolve the bundled test clip in dev and packaged builds.

    Dev: `<repo>/backend/packaging/test_clip.mp4`.
    Packaged (PyInstaller one-dir): PyInstaller copies our `datas=[(…, "packaging")]`
    entry to `<bundle>/_internal/packaging/test_clip.mp4`; this module ends up at
    `<bundle>/_internal/api/routes/system_ops.py`, so `__file__`/../../../packaging
    resolves to the same dir in both cases.
    """
    return (Path(__file__).resolve().parent.parent.parent / "packaging" / "test_clip.mp4")


def _mpv_args_from_cfg(cfg: Any) -> list[str]:
    """Build --sub-* args, skipping empty/default sentinels per core/config.py."""
    args: list[str] = []
    if getattr(cfg, "sub_font", ""):
        args.append(f"--sub-font={cfg.sub_font}")
    if getattr(cfg, "sub_font_size", 0):
        args.append(f"--sub-font-size={cfg.sub_font_size}")
    if getattr(cfg, "sub_color", ""):
        args.append(f"--sub-color={cfg.sub_color}")
    if getattr(cfg, "sub_border_color", ""):
        args.append(f"--sub-border-color={cfg.sub_border_color}")
    bs = getattr(cfg, "sub_border_size", -1)
    if bs is not None and bs >= 0:
        args.append(f"--sub-border-size={bs}")
    if getattr(cfg, "sub_back_color", ""):
        args.append(f"--sub-back-color={cfg.sub_back_color}")
    if getattr(cfg, "sub_bold", False):
        args.append("--sub-bold=yes")
    if getattr(cfg, "sub_margin_y", 0):
        args.append(f"--sub-margin-y={cfg.sub_margin_y}")
    return args


@router.post("/test-playback")
def test_playback() -> dict:
    cfg = cfgmod.load_config()
    mpv = (getattr(cfg, "mpv_path", "") or "").strip() or shutil.which("mpv")
    if not mpv:
        return {
            "ok": False,
            "error": (
                "mpv not found. Install mpv (e.g. `brew install mpv`) or set "
                "Settings → Subtitles → MPV executable path."
            ),
        }
    clip = _clip_path()
    if not clip.exists():
        return {"ok": False, "error": f"Bundled test clip is missing: {clip}"}
    argv = [mpv, str(clip), *_mpv_args_from_cfg(cfg)]
    try:
        proc = subprocess.Popen(argv)  # fire-and-forget — user closes mpv themselves
        return {"ok": True, "pid": proc.pid}
    except Exception as e:
        return {"ok": False, "error": str(e)}
```

Modify `backend/api/main.py` to wire it:

```
old: from api.routes import fs as fs_route
new: from api.routes import fs as fs_route
     from api.routes import system_ops as system_ops_route
```

```
old: app.include_router(fs_route.router)
new: app.include_router(fs_route.router)
     app.include_router(system_ops_route.router)
```

- [ ] **Step 5: Run tests and watch them pass**

Run: `backend/.venv/bin/python -m pytest tests/api/test_system_ops.py -v`
Expected: 6 passed.

- [ ] **Step 6: Suite + lint**

Run: `backend/.venv/bin/python -m pytest -q && backend/.venv/bin/ruff check backend`
Expected: green; ruff clean.

- [ ] **Step 7: Commit**

```bash
git add backend/api/routes/system_ops.py backend/api/main.py \
        backend/packaging/test_clip.mp4 tests/api/test_system_ops.py
git commit -m "feat(settings/4e): POST /api/system/open-config-dir + /test-playback + bundled clip"
```

(If the clip is a placeholder, mention it in the commit body: "Replace test_clip.mp4 with a real 1s black mp4 once ffmpeg is on the build box; tests mock Popen so a placeholder works for CI.")

---

## Task 3 — PyInstaller: bundle the clip

**Files:**
- Modify: `backend/packaging/backend.spec`

- [ ] **Step 1: Edit the spec**

Use this exact `Edit`:

```
old: datas, binaries, hiddenimports = [], [], []
new: datas, binaries, hiddenimports = [
    (os.path.join(BACKEND_ROOT, "packaging", "test_clip.mp4"), "packaging"),
], [], []
```

This puts the file at `_internal/packaging/test_clip.mp4` inside the one-dir bundle, which is exactly where `_clip_path()` in `system_ops.py` resolves it (see the docstring on that function).

- [ ] **Step 2: Sanity-check the spec is still parseable**

Run: `backend/.venv/bin/python -c "import ast, pathlib; ast.parse(pathlib.Path('backend/packaging/backend.spec').read_text())"`
Expected: no output (parse OK). Do **not** run `pnpm -F desktop build:backend` here — it downloads/extracts the world and isn't a per-task gate.

- [ ] **Step 3: Commit**

```bash
git add backend/packaging/backend.spec
git commit -m "build(settings/4e): bundle test_clip.mp4 in PyInstaller one-dir layout"
```

---

## Task 4 — api-client: `checkFs()` (no TDD; types-driven)

The api-client has no JS test suite — `pnpm -F desktop typecheck` and `cd packages/api-client && npx tsc --noEmit` are the gates.

**Files:**
- Modify: `packages/api-client/src/types.ts`
- Modify: `packages/api-client/src/client.ts`

- [ ] **Step 1: Add the types**

Append to `packages/api-client/src/types.ts`:

```ts
export interface CheckFsRequest {
  path: string;
  kind: "dir" | "executable";
}

export interface CheckFsResult {
  exists: boolean;
  // dir only
  isDir?: boolean;
  writable?: boolean;
  // executable only
  executable?: boolean;
  // present on transport failure
  error?: string;
}
```

- [ ] **Step 2: Add the method**

In `packages/api-client/src/client.ts`, add the import on the existing `import type { … } from "./types";` block:

```
old:   WhisperModel,
new:   WhisperModel,
       CheckFsRequest,
       CheckFsResult,
```

Then add the method just before the `// ─── NDJSON streaming primitive ────` divider:

```ts
  // ─── Filesystem path check ────────────────────────────────────────────
  async checkFs(req: CheckFsRequest): Promise<CheckFsResult> {
    const res = await fetch(`${this.baseUrl}/api/fs/check`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error(`/api/fs/check ${res.status}`);
    return res.json();
  }
```

- [ ] **Step 3: Typecheck**

Run:
```
cd packages/api-client && npx tsc --noEmit
cd ../.. && pnpm -F desktop typecheck
```
Expected: both clean.

- [ ] **Step 4: Commit**

```bash
git add packages/api-client/src/types.ts packages/api-client/src/client.ts
git commit -m "feat(api-client): add checkFs() for path validation in armed settings fields"
```

---

## Task 5 — Tauri plugin: install + register + capability

**Files:**
- Modify: `apps/desktop/src-tauri/Cargo.toml`
- Modify: `apps/desktop/src-tauri/src/lib.rs`
- Create: `apps/desktop/src-tauri/capabilities/main.json`
- Modify: `apps/desktop/src-tauri/tauri.conf.json` (only if Tauri requires capability registration there — see Step 4)
- Modify: `apps/desktop/package.json`

- [ ] **Step 1: Add the Rust dependency**

Use this exact `Edit` on `apps/desktop/src-tauri/Cargo.toml`:

```
old: tauri = { version = "2", features = [] }
     serde = { version = "1", features = ["derive"] }
     serde_json = "1"
new: tauri = { version = "2", features = [] }
     tauri-plugin-dialog = "2"
     serde = { version = "1", features = ["derive"] }
     serde_json = "1"
```

- [ ] **Step 2: Register the plugin**

Use this exact `Edit` on `apps/desktop/src-tauri/src/lib.rs`:

```
old:     tauri::Builder::default()
             .manage(BackendProcess(Mutex::new(None)))
             .setup(|app| {
new:     tauri::Builder::default()
             .plugin(tauri_plugin_dialog::init())
             .manage(BackendProcess(Mutex::new(None)))
             .setup(|app| {
```

- [ ] **Step 3: Create the capability**

Create `apps/desktop/src-tauri/capabilities/main.json`:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "main",
  "description": "Default capabilities for the main window: core APIs + dialog plugin.",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "dialog:default"
  ]
}
```

Note: the `"windows": ["main"]` selector matches the window label. The `tauri.conf.json` defines one window without an explicit label, so Tauri assigns label `"main"` by convention.

- [ ] **Step 4: Verify capability wiring**

Tauri 2 auto-discovers `capabilities/*.json` next to `tauri.conf.json` — no `tauri.conf.json` edit is needed. Confirm by running:

```bash
source "$HOME/.cargo/env" && cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
```

If `cargo check` errors with something like "capability 'main' not found" or "permission 'dialog:default' is not granted", THEN add an explicit reference under `app.security` in `tauri.conf.json`:

```
old:     "security": {
           "csp": null
         }
new:     "security": {
           "csp": null,
           "capabilities": ["main"]
         }
```

…and re-run `cargo check`. Expected: clean build. (Tauri 2 will download `tauri-plugin-dialog` on first run; if you're offline this fails — note it.)

- [ ] **Step 5: Add the JS binding**

Use this exact `Edit` on `apps/desktop/package.json`:

```
old:     "@tamagui/shorthands": "1.115.5",
         "@yt-subtitle-maker/api-client": "workspace:*",
new:     "@tamagui/shorthands": "1.115.5",
         "@tauri-apps/plugin-dialog": "^2",
         "@yt-subtitle-maker/api-client": "workspace:*",
```

Run: `pnpm install`
Expected: lockfile updates, the new dep resolves.

- [ ] **Step 6: Typecheck**

Run: `pnpm -F desktop typecheck`
Expected: clean. (No code uses the plugin yet — the import lands in Task 6.)

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src-tauri/Cargo.toml apps/desktop/src-tauri/Cargo.lock \
        apps/desktop/src-tauri/src/lib.rs \
        apps/desktop/src-tauri/capabilities/main.json \
        apps/desktop/src-tauri/tauri.conf.json \
        apps/desktop/package.json pnpm-lock.yaml
git commit -m "feat(tauri/4e): add tauri-plugin-dialog + main capability for native pickers"
```

(Omit `tauri.conf.json` from the `git add` if Step 4 didn't need to modify it.)

---

## Task 6 — Frontend: `apps/desktop/src/lib/native.ts`

**Files:**
- Create: `apps/desktop/src/lib/native.ts`

- [ ] **Step 1: Write the module**

Create the file with this content verbatim:

```ts
// apps/desktop/src/lib/native.ts
// Single source of truth for "are we inside the Tauri shell?" plus the thin
// wrappers around native-only / backend-mediated affordances. Settings
// components import from here so the isTauri() guard is one line per call
// site, and so the Tauri-only `@tauri-apps/plugin-dialog` import is lazy —
// importing this module on the `pnpm web` flow must not crash.

import { apiClient } from "../state/client";

/** True inside the Tauri 2 webview; false in `pnpm web` and SSR. */
export function isTauri(): boolean {
  // Tauri v2 sets window.__TAURI_INTERNALS__ at injection time.
  // (v1 used window.__TAURI__; we no longer support v1.)
  return (
    typeof window !== "undefined" &&
    typeof (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !==
      "undefined"
  );
}

/** Open a native directory picker. Returns the chosen path, or null on cancel.
 *  Throws if called outside the Tauri runtime — callers must `isTauri()` first.
 */
export async function openDirectoryDialog(opts?: {
  defaultPath?: string;
  title?: string;
}): Promise<string | null> {
  if (!isTauri()) {
    throw new Error("openDirectoryDialog is only available in the Tauri runtime");
  }
  // Lazy import so `pnpm web` (where this module doesn't exist as a real
  // package — the symlinked node_modules still resolves the entry, but the
  // runtime would explode without __TAURI_INTERNALS__) never executes it.
  const { open } = await import("@tauri-apps/plugin-dialog");
  const result = await open({
    directory: true,
    multiple: false,
    defaultPath: opts?.defaultPath,
    title: opts?.title,
  });
  if (result == null) return null;
  // v2 returns string for single-pick; arrays only when multiple:true.
  return typeof result === "string" ? result : result[0] ?? null;
}

/** Open a native file picker (JSON). Returns the chosen path, or null on cancel. */
export async function openJsonFileDialog(): Promise<string | null> {
  if (!isTauri()) {
    throw new Error("openJsonFileDialog is only available in the Tauri runtime");
  }
  const { open } = await import("@tauri-apps/plugin-dialog");
  const result = await open({
    multiple: false,
    filters: [{ name: "Settings JSON", extensions: ["json"] }],
  });
  if (result == null) return null;
  return typeof result === "string" ? result : result[0] ?? null;
}

/** Ask the backend to open ~/.yt_subtitle_tool/ in the OS file manager. */
export async function openConfigFolder(): Promise<{ ok: boolean; error?: string }> {
  const baseUrl = (apiClient as unknown as { baseUrl: string }).baseUrl
    ?? "http://127.0.0.1:8000";
  const res = await fetch(`${baseUrl}/api/system/open-config-dir`, { method: "POST" });
  if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
  return res.json();
}

/** Launch mpv on the bundled clip with the saved subtitle style. */
export async function testPlayback(): Promise<{ ok: boolean; pid?: number; error?: string }> {
  const baseUrl = (apiClient as unknown as { baseUrl: string }).baseUrl
    ?? "http://127.0.0.1:8000";
  const res = await fetch(`${baseUrl}/api/system/test-playback`, { method: "POST" });
  if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
  return res.json();
}
```

Note on the `(apiClient as unknown as { baseUrl: string }).baseUrl` cast: `ApiClient.baseUrl` is `private` (see `packages/api-client/src/client.ts` line 37). Rather than widen the api-client surface for this one-line need, we punch through with a typed cast — the field absolutely exists at runtime.

- [ ] **Step 2: Typecheck**

Run: `pnpm -F desktop typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/lib/native.ts
git commit -m "feat(settings/4e): apps/desktop/src/lib/native.ts (isTauri + native wrappers)"
```

---

## Task 7 — Wire armed folder fields in `GeneralTab` (+ Browse… in Tauri)

**Files:**
- Modify: `apps/desktop/src/components/settings/GeneralTab.tsx`

- [ ] **Step 1: Replace the file**

Replace the entire contents of `apps/desktop/src/components/settings/GeneralTab.tsx` with:

```tsx
import * as React from "react";
import { YStack, XStack } from "tamagui";
import { GlassCard, Dropdown, ButtonGhost, BodySm } from "@yt-subtitle-maker/ui";
import { apiClient } from "../../state/client";
import { useSettings } from "./SettingsContext";
import { Section, SettingRow } from "./shared";
import { VERBOSITY } from "./constants";
import { ArmedField } from "./ArmedField";
import { isTauri, openDirectoryDialog } from "../../lib/native";
import type { AppConfig } from "@yt-subtitle-maker/api-client";

/**
 * Render an armed folder field with optional native "Browse…" secondary.
 * The validator calls `apiClient.checkFs({path, kind:"dir"})` and reports a
 * human reason on failure; `ArmedField`'s built-in "Apply anyway" handles the
 * "I know what I'm doing" escape hatch.
 */
function FolderField({
  field,
  placeholder,
}: {
  field: "outputDir" | "downloadDir" | "whisperCacheDir";
  placeholder?: string;
}) {
  const { draft, update, flush } = useSettings();
  if (!draft) return null;
  const value = (draft as AppConfig)[field] ?? "";

  return (
    <ArmedField
      value={value}
      placeholder={placeholder}
      validate={async (v) => {
        // Empty string is always OK — it means "fall back to default".
        if (!v.trim()) return { ok: true };
        try {
          const r = await apiClient.checkFs({ path: v, kind: "dir" });
          if (r.exists && r.isDir && r.writable) return { ok: true };
          if (!r.exists) return { ok: false, reason: `Path doesn't exist: ${v}` };
          if (!r.isDir) return { ok: false, reason: `Not a directory: ${v}` };
          return { ok: false, reason: `Directory isn't writable: ${v}` };
        } catch (err) {
          return {
            ok: false,
            reason: `Couldn't check the path: ${err instanceof Error ? err.message : String(err)}`,
          };
        }
      }}
      onApply={(v) => {
        update(field, v);
        flush();
      }}
      secondaryAction={
        isTauri()
          ? {
              label: "Browse…",
              onPress: async () => {
                const picked = await openDirectoryDialog({
                  defaultPath: value || placeholder,
                });
                if (picked) {
                  update(field, picked);
                  flush();
                }
              },
            }
          : undefined
      }
    />
  );
}

export function GeneralTab() {
  const { draft, update, defaults } = useSettings();
  if (!draft) return null;
  return (
    <GlassCard variant="mid">
      <YStack gap="$md">
        <Section title="General" />
        <SettingRow
          id="general.output-dir"
          label="Output folder"
          helper="Where finished .srt files are written. Leave blank to use the default location."
        >
          <FolderField field="outputDir" placeholder={defaults?.outputDir || ""} />
        </SettingRow>
        <SettingRow
          id="general.download-dir"
          label="Download folder"
          helper="Where downloaded audio is kept. Leave blank to use the default location."
        >
          <FolderField field="downloadDir" placeholder={defaults?.downloadDir || ""} />
        </SettingRow>
        <SettingRow
          id="general.whisper-cache-dir"
          label="Whisper cache directory"
          helper="Where Whisper model weights are cached. Leave blank for the default."
        >
          <FolderField
            field="whisperCacheDir"
            placeholder={defaults?.whisperCacheDir || ""}
          />
        </SettingRow>
        <SettingRow id="general.logs-verbosity" label="Logs verbosity">
          <Dropdown
            value={draft.logsVerbosity}
            onValueChange={(v) =>
              update("logsVerbosity", v as typeof draft.logsVerbosity)
            }
            options={VERBOSITY}
            width={240}
          />
        </SettingRow>
      </YStack>
    </GlassCard>
  );
}
```

(`ButtonGhost`/`BodySm`/`XStack` are imported but not used directly in this file — TypeScript/ESLint don't flag unused named imports by default in this project, but if `pnpm -F desktop typecheck` complains, drop them.)

- [ ] **Step 2: Typecheck**

Run: `pnpm -F desktop typecheck`
Expected: clean. If a "declared but never used" error fires, prune the unused imports.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/components/settings/GeneralTab.tsx
git commit -m "feat(settings/4e): General tab folder fields are armed + native Browse… in Tauri"
```

---

## Task 8 — Wire armed `mpvPath` + Test playback in `SubtitlesTab`; armed `jsRuntimePath` in `YouTubeTab`

**Files:**
- Modify: `apps/desktop/src/components/settings/SubtitlesTab.tsx`
- Modify: `apps/desktop/src/components/settings/YouTubeTab.tsx`

- [ ] **Step 1: Replace `SubtitlesTab` mpv-path row + add Test playback**

In `apps/desktop/src/components/settings/SubtitlesTab.tsx`, find the existing mpv-path `SettingRow` (around lines 36–46) and replace it with the armed version. First, add new imports near the top of the file:

```
old: import { ApiClient } from "@yt-subtitle-maker/api-client";  // (if present — otherwise skip)
new: // existing imports unchanged
```

…and add (preserving alphabetical order or matching existing convention):

```ts
import { apiClient } from "../../state/client";
import { ArmedField } from "./ArmedField";
import { isTauri, openDirectoryDialog, testPlayback } from "../../lib/native";
import { ButtonSecondary, BodySm } from "@yt-subtitle-maker/ui";
import { XStack } from "tamagui";
```

(Use only the imports not already present; check the file first. Many of these — `BodySm`, `XStack` — are likely already imported.)

Then replace the existing `<SettingRow id="subtitles.mpv-path" …>` block (the one with `<TextInput value={draft.mpvPath} …>` inside) with:

```tsx
        <SettingRow
          id="subtitles.mpv-path"
          label="MPV executable path"
          helper="Path to the mpv binary. Leave blank to use mpv on your PATH."
        >
          <ArmedField
            value={draft.mpvPath}
            placeholder={defaults?.mpvPath || "(uses mpv on PATH)"}
            validate={async (v) => {
              if (!v.trim()) return { ok: true };
              try {
                const r = await apiClient.checkFs({ path: v, kind: "executable" });
                if (r.exists && r.executable) return { ok: true };
                return {
                  ok: false,
                  reason: r.exists
                    ? `Found but not executable: ${v}`
                    : `mpv not found at: ${v}`,
                };
              } catch (err) {
                return {
                  ok: false,
                  reason: `Couldn't check the path: ${err instanceof Error ? err.message : String(err)}`,
                };
              }
            }}
            onApply={(v) => {
              update("mpvPath", v);
              flush();
            }}
            secondaryAction={
              isTauri()
                ? {
                    label: "Browse…",
                    onPress: async () => {
                      const picked = await openDirectoryDialog();
                      // Note: dialog picks a *directory*; mpv is a file. The dialog
                      // plugin's open({directory:false}) returns a file path. We use
                      // file-mode here:
                      if (picked) {
                        update("mpvPath", picked);
                        flush();
                      }
                    },
                  }
                : undefined
            }
          />
        </SettingRow>
        {isTauri() ? (
          <SettingRow
            id="subtitles.test-playback"
            label="Test playback"
            helper="Launch mpv with the saved style on a 1-second clip — sanity-check colors and font before a real run."
          >
            <XStack>
              <ButtonSecondary
                onPress={async () => {
                  const r = await testPlayback();
                  if (!r.ok && typeof window !== "undefined") {
                    window.alert(`Couldn't launch mpv: ${r.error ?? "unknown error"}`);
                  }
                }}
              >
                <BodySm color="$textSecondary">Test playback</BodySm>
              </ButtonSecondary>
            </XStack>
          </SettingRow>
        ) : null}
```

Now fix the "Browse… picks a directory" mistake — we need a *file* picker for mpv. Update `apps/desktop/src/lib/native.ts` to add an `openExecutableDialog`:

```ts
/** Open a native file picker for an executable. Returns path or null. */
export async function openExecutableDialog(): Promise<string | null> {
  if (!isTauri()) {
    throw new Error("openExecutableDialog is only available in the Tauri runtime");
  }
  const { open } = await import("@tauri-apps/plugin-dialog");
  const result = await open({ multiple: false });
  if (result == null) return null;
  return typeof result === "string" ? result : result[0] ?? null;
}
```

…and swap the import + usage in `SubtitlesTab.tsx`:

```
old: import { isTauri, openDirectoryDialog, testPlayback } from "../../lib/native";
new: import { isTauri, openExecutableDialog, testPlayback } from "../../lib/native";
```

```
old:                       const picked = await openDirectoryDialog();
new:                       const picked = await openExecutableDialog();
```

- [ ] **Step 2: Replace `YouTubeTab` js-runtime-path row**

In `apps/desktop/src/components/settings/YouTubeTab.tsx`, find the `<SettingRow id="youtube.js-runtime-path" …>` block (around lines 126–140) and replace its child `<TextInput …>` with `<ArmedField …>`:

```tsx
        <SettingRow
          id="youtube.js-runtime-path"
          label="JS runtime for yt-dlp"
          helper={
            jsRuntime
              ? `Detected: ${jsRuntime}`
              : "⚠ No runtime detected — install Node or Deno, or set the path here. Without one, YouTube extraction degrades."
          }
        >
          <ArmedField
            value={draft.jsRuntimePath}
            placeholder="(auto-detect node/deno on PATH)"
            validate={async (v) => {
              if (!v.trim()) return { ok: true };
              try {
                const r = await apiClient.checkFs({ path: v, kind: "executable" });
                if (r.exists && r.executable) return { ok: true };
                return {
                  ok: false,
                  reason: r.exists
                    ? `Found but not executable: ${v}`
                    : `Runtime not found: ${v}`,
                };
              } catch (err) {
                return {
                  ok: false,
                  reason: `Couldn't check the path: ${err instanceof Error ? err.message : String(err)}`,
                };
              }
            }}
            onApply={(v) => {
              update("jsRuntimePath", v);
              flush();
            }}
            secondaryAction={
              isTauri()
                ? {
                    label: "Browse…",
                    onPress: async () => {
                      const picked = await openExecutableDialog();
                      if (picked) {
                        update("jsRuntimePath", picked);
                        flush();
                      }
                    },
                  }
                : undefined
            }
          />
        </SettingRow>
```

Add the new imports near the top of `YouTubeTab.tsx`:

```ts
import { apiClient } from "../../state/client";
import { ArmedField } from "./ArmedField";
import { isTauri, openExecutableDialog } from "../../lib/native";
```

You'll also need to expose `flush` from `useSettings()` if the file doesn't already destructure it — check the existing `const { … } = useSettings();` line and add `flush` to it (the hook already provides it; see `useSettingsDraft.ts` line 54).

- [ ] **Step 3: Typecheck**

Run: `pnpm -F desktop typecheck`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/lib/native.ts \
        apps/desktop/src/components/settings/SubtitlesTab.tsx \
        apps/desktop/src/components/settings/YouTubeTab.tsx
git commit -m "feat(settings/4e): mpvPath + jsRuntimePath armed with Browse… + Test playback"
```

---

## Task 9 — `AdvancedTab`: Open config folder + Export + Import

**Files:**
- Modify: `apps/desktop/src/components/settings/AdvancedTab.tsx`

- [ ] **Step 1: Extend the file**

Replace the entire contents of `apps/desktop/src/components/settings/AdvancedTab.tsx` with:

```tsx
import * as React from "react";
import { XStack, YStack } from "tamagui";
import { GlassCard, ButtonGhost, ButtonSecondary, BodySm, Caption } from "@yt-subtitle-maker/ui";
import { ApiClient, type AppConfig } from "@yt-subtitle-maker/api-client";
import { apiClient } from "../../state/client";
import { useSettings } from "./SettingsContext";
import { Section, SettingRow } from "./shared";
import { ArmedField } from "./ArmedField";
import { openConfigFolder } from "../../lib/native";

export function AdvancedTab() {
  const { draft, config, update, flush, setConfig, setDraft, setError } = useSettings();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [importStatus, setImportStatus] = React.useState<string | null>(null);
  if (!draft) return null;

  const onExport = () => {
    const payload = JSON.stringify(config ?? draft, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "yt-subtitle-tool-settings.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const onImportPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<AppConfig>;
      // Strip non-config keys like `_defaults` that GET /api/config injects.
      const clean: Record<string, unknown> = { ...parsed };
      delete clean._defaults;
      const next = await apiClient.updateConfig(clean as Partial<AppConfig>);
      setConfig(next);
      setDraft(next);
      apiClient.setBaseUrl(next.backendUrl);
      setImportStatus(`Imported ${Object.keys(clean).length} fields.`);
    } catch (err) {
      setImportStatus(
        `Import failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  return (
    <GlassCard variant="mid">
      <YStack gap="$md">
        <Section title="Advanced" />
        <SettingRow
          id="advanced.backend-url"
          label="Backend URL"
          helper="The address the app talks to. Edit → it pings GET /api/version before applying. Default is 127.0.0.1:8000."
        >
          <ArmedField
            value={draft.backendUrl}
            placeholder="127.0.0.1:8000"
            validate={async (v) => {
              try {
                await new ApiClient(v).fetchVersion();
                return { ok: true };
              } catch (err) {
                return {
                  ok: false,
                  reason: `Couldn't reach a backend at "${v}": ${err instanceof Error ? err.message : String(err)}`,
                };
              }
            }}
            onApply={(v) => {
              update("backendUrl", v);
              apiClient.setBaseUrl(v);
              flush();
            }}
            secondaryAction={{
              label: "Reset to 127.0.0.1:8000",
              onPress: () => {
                update("backendUrl", "127.0.0.1:8000");
                apiClient.setBaseUrl("127.0.0.1:8000");
                flush();
              },
            }}
          />
        </SettingRow>

        <SettingRow
          id="advanced.open-config"
          label="Open config folder"
          helper="Reveal ~/.yt_subtitle_tool/ in your file manager."
        >
          <XStack>
            <ButtonSecondary
              onPress={async () => {
                const r = await openConfigFolder();
                if (!r.ok && typeof window !== "undefined") {
                  window.alert(`Couldn't open the folder: ${r.error ?? "unknown error"}`);
                }
              }}
            >
              <BodySm color="$textSecondary">Open config folder</BodySm>
            </ButtonSecondary>
          </XStack>
        </SettingRow>

        <SettingRow
          id="advanced.export-settings"
          label="Export settings"
          helper="Download all current settings as a JSON file."
        >
          <XStack>
            <ButtonSecondary onPress={onExport}>
              <BodySm color="$textSecondary">Export to JSON…</BodySm>
            </ButtonSecondary>
          </XStack>
        </SettingRow>

        <SettingRow
          id="advanced.import-settings"
          label="Import settings"
          helper="Load a JSON file previously exported. Replaces the corresponding fields."
        >
          <YStack gap="$xs">
            <XStack>
              <ButtonSecondary onPress={() => fileInputRef.current?.click()}>
                <BodySm color="$textSecondary">Import from JSON…</BodySm>
              </ButtonSecondary>
            </XStack>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={onImportPick}
              style={{ display: "none" }}
            />
            {importStatus ? <Caption color="$textSecondary">{importStatus}</Caption> : null}
          </YStack>
        </SettingRow>

        <SettingRow
          id="advanced.reset-all"
          label="Reset all to defaults"
          helper="Danger zone — overwrites your saved config with the shipped defaults."
        >
          <XStack>
            <ButtonGhost
              onPress={async () => {
                if (
                  typeof window !== "undefined" &&
                  !window.confirm(
                    "Reset every setting to its default? This overwrites your saved config and can't be undone.",
                  )
                )
                  return;
                try {
                  const next = await apiClient.resetConfig();
                  setConfig(next);
                  setDraft(next);
                  apiClient.setBaseUrl(next.backendUrl);
                } catch (err) {
                  setError(err instanceof Error ? err.message : String(err));
                }
              }}
            >
              <BodySm fontWeight="500" color="$error">
                Reset all to defaults
              </BodySm>
            </ButtonGhost>
          </XStack>
        </SettingRow>
      </YStack>
    </GlassCard>
  );
}
```

Note on the `<input type="file">`: react-native-web passes a real HTML `<input>` through when you use it directly inside JSX (Tamagui doesn't intercept the `input` host element). The styled-display=none + ref-driven click is the standard cross-platform pattern. On Tauri it works identically — the WKWebView handles file inputs natively.

- [ ] **Step 2: Typecheck**

Run: `pnpm -F desktop typecheck`
Expected: clean. If `<input>` complains about being unknown JSX, replace it with `React.createElement("input", {...})`.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/components/settings/AdvancedTab.tsx
git commit -m "feat(settings/4e): Advanced — Open config folder + Export/Import settings"
```

---

## Task 10 — Update `searchIndex.ts`

**Files:**
- Modify: `apps/desktop/src/components/settings/searchIndex.ts`

- [ ] **Step 1: Add entries**

Use this exact `Edit`:

```
old:   { id: "subtitles.bold", tab: "subtitles", label: "Bold", keywords: ["bold", "weight"] },
       // Advanced
       { id: "advanced.backend-url", tab: "advanced", label: "Backend URL", keywords: ["backend", "url", "server", "ngrok", "host", "port"] },
       { id: "advanced.reset-all", tab: "advanced", label: "Reset all to defaults", keywords: ["reset", "defaults", "factory", "wipe"] },
new:   { id: "subtitles.bold", tab: "subtitles", label: "Bold", keywords: ["bold", "weight"] },
       { id: "subtitles.test-playback", tab: "subtitles", label: "Test playback", keywords: ["test", "playback", "mpv", "preview", "launch"] },
       // Advanced
       { id: "advanced.backend-url", tab: "advanced", label: "Backend URL", keywords: ["backend", "url", "server", "ngrok", "host", "port"] },
       { id: "advanced.open-config", tab: "advanced", label: "Open config folder", keywords: ["open", "config", "folder", "reveal", "finder", "explorer"] },
       { id: "advanced.export-settings", tab: "advanced", label: "Export settings", keywords: ["export", "backup", "download", "json"] },
       { id: "advanced.import-settings", tab: "advanced", label: "Import settings", keywords: ["import", "restore", "upload", "json"] },
       { id: "advanced.reset-all", tab: "advanced", label: "Reset all to defaults", keywords: ["reset", "defaults", "factory", "wipe"] },
```

- [ ] **Step 2: Typecheck**

Run: `pnpm -F desktop typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/components/settings/searchIndex.ts
git commit -m "feat(settings/4e): search-index entries for new advanced + subtitles rows"
```

---

## Task 11 — Full-build verification + sanity sweep

This is the only task that runs the slow gates.

- [ ] **Step 1: Backend full suite + lint**

Run: `backend/.venv/bin/python -m pytest -q && backend/.venv/bin/ruff check backend`
Expected: full suite green; ruff clean.

- [ ] **Step 2: Frontend typechecks**

Run:
```
cd packages/api-client && npx tsc --noEmit
cd /Users/kelvinfong/Documents/Personal\ Project/yt-subtitle-maker && pnpm -F desktop typecheck
```
Expected: both clean.

- [ ] **Step 3: Full Rust build**

Run: `source "$HOME/.cargo/env" && cd apps/desktop/src-tauri && cargo build`
Expected: builds clean. (This will be slow on a cold cache — minutes — because `tauri-plugin-dialog` and its tree are downloading. If you're offline you'll get a network error; document and re-run when online.)

- [ ] **Step 4: Manual smoke (informational — not a gate)**

These can't be automated headlessly; record results in the PR description rather than blocking the task:

In `pnpm dev` (split-window) or `pnpm -F desktop tauri:dev`:
- Settings → General → Output folder → "Edit" → type a non-existent path → "Apply" → see "Path doesn't exist" inline → click "Apply anyway" → field accepts and saves (autosave pill flashes).
- Same field → "Edit" → "Browse…" → native folder picker opens → pick a real folder → field commits + flush.
- Settings → Subtitles → MPV executable path → "Edit" → "Browse…" → pick `/opt/homebrew/bin/mpv` → applies cleanly → "Test playback" button is visible → click → mpv window opens for ~1s with subtitle style applied.
- Settings → Advanced → "Open config folder" → Finder/Explorer opens `~/.yt_subtitle_tool/`.
- Settings → Advanced → "Export to JSON…" → browser saves `yt-subtitle-tool-settings.json` containing the live config.
- Modify the JSON externally (e.g. change `logsVerbosity`), then "Import from JSON…" → status pill says "Imported N fields", live settings reflect the change.

In `pnpm web` (browser, no Tauri):
- Same Settings → General field → no "Browse…" button visible → typing + Apply works against `/api/fs/check`.
- Subtitles tab → no "Test playback" row.
- Advanced → "Open config folder" / "Export" / "Import" all visible and functional (they're backend-mediated or pure browser).

- [ ] **Step 5: Final commit (only if anything changed during verification)**

If Steps 1–3 surfaced lint nits or typing tweaks, fix them and commit. Otherwise no-op.

```bash
git status   # should be clean
```

---

## Self-review

Walked the plan against the spec and overview-§4e:

**Spec coverage:**
- "All three folder fields get a 'Browse…' button" — Task 7 (`GeneralTab` folder fields are armed + native Browse… in Tauri). ✓
- "`mpv executable path` is an armed field. Optional 'Test playback' button" — Task 8. ✓
- "`tauri-plugin-dialog` added (Cargo.toml + plugin-dialog + capability)" — Task 5. ✓
- "A small `apps/desktop/src/lib/native.ts` wraps it with an `isTauri()` guard" — Task 6. ✓
- "In `pnpm web` there's no Tauri runtime, so 'Browse…' is hidden" — Tasks 7, 8, 9 all gate behind `isTauri()`. ✓
- "Open config folder · Export / Import settings" in Advanced — Task 9. ✓
- "small 'stat dir / check executable' endpoint" — Task 1 (`/api/fs/check`). ✓
- "Test playback" launches mpv on a tiny bundled clip — Task 2 (route) + Task 3 (PyInstaller bundling). ✓
- New ids picked up in search-index — Task 10. ✓
- "the Rust crate builds (`source "$HOME/.cargo/env" && … && cargo build`)" — Task 11 Step 3. ✓

**Placeholder scan:** no "TBD", "implement later", "appropriate error handling" — every step has literal code or a literal `Edit` block. The Step "If `ffmpeg` is not available, commit a placeholder" in Task 2 Step 3 is a real instruction with a real fallback (the tests mock `Popen`), not a deferral.

**Type / name consistency:**
- `CheckFsRequest`/`CheckFsResult` defined in Task 4 → used in `native.ts` (indirectly via apiClient.checkFs) and in Tasks 7/8.
- `apiClient.checkFs` signature `(req: CheckFsRequest) => Promise<CheckFsResult>` — matches every caller.
- Backend `/api/fs/check` returns `{exists, isDir, writable}` for `dir` and `{exists, executable}` for `executable` — the frontend validators in Tasks 7, 8 read exactly those keys.
- `openDirectoryDialog` (folders) vs `openExecutableDialog` (files) — Task 8 catches the conceptual error from the first draft (mpv is a file, not a directory) and adds the file-picker wrapper in `native.ts`; the SubtitlesTab + YouTubeTab updates use `openExecutableDialog`.
- `useSettings()` provides `flush` (verified against `useSettingsDraft.ts` line 54) — all `update + flush` call sites in Tasks 7–9 are valid.
- `subprocess.run` in `system_ops.py` is `module-name.subprocess.run` for `patch()` targets — tests patch `api.routes.system_ops.subprocess.run`/`.Popen`/`.shutil.which`, matching the import paths in the implementation.

**Coverage gaps:** none found.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-12-settings-phase-4e-native-polish.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
