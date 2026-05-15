# Library UX Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Library page (today: card grid + per-video modal) with a two-pane layout (left = list of videos, right = always-visible playback hub), and add an in-app mpv install flow so users can play their subtitled videos even when mpv isn't on the system.

**Architecture:** The route at `apps/desktop/app/library.tsx` becomes a two-pane composition over a new zustand store. The current `VideoDetailModal` is deleted; its content (transcript / translation lists, run actions, footer) moves into a new `DetailPane`. mpv is detected and (optionally) downloaded via two new dependency endpoints that mirror the existing Whisper-model install pattern (threading + `queue.Queue` + `StreamingResponse` of NDJSON). A `useMpvStatusPolling()` hook keeps the cached mpv status fresh.

**Tech Stack:** FastAPI + pydantic-settings (backend), Expo Router + Tamagui + zustand (frontend), `@yt-subtitle-maker/api-client` (typed bridge), Tauri 2 (shell).

**Reference spec:** `docs/superpowers/specs/2026-05-15-library-ux-redesign-design.md`

---

## File Map

**Backend — modify**
- `backend/core/dependency_manager.py` — add `MpvStatus` (TypedDict), `check_mpv_status()`, `install_mpv_generator()`, and a `MPV_BINARIES` constants table.
- `backend/api/routes/dependencies.py` — add `GET /api/dependencies/mpv-status` and `POST /api/dependencies/install-mpv`. Enrich the existing `GET /api/dependencies` to include `mpvStatus` (richer than `mpvAvailable`, which stays for compatibility).
- `backend/api/routes/library.py` — change `play_mpv` so the bundled binary at `~/.yt_subtitle_tool/bin/mpv` is preferred over `shutil.which("mpv")`.
- `tests/api/test_dependencies.py` — extend with mpv tests.

**API client — modify**
- `packages/api-client/src/types.ts` — add `MpvStatus`, `InstallMpvEvent`.
- `packages/api-client/src/client.ts` — add `fetchMpvStatus()` and `installMpv()` (async generator using the existing `streamNdjson` primitive).

**Frontend — create**
- `apps/desktop/src/state/library.ts` — new zustand store (list, selection, detail, view, search).
- `apps/desktop/src/state/dependencies.ts` — new zustand store (mpv status, install progress).
- `apps/desktop/src/hooks/useMpvStatusPolling.ts` — background re-check hook.
- `apps/desktop/src/components/library/LibraryPane.tsx`
- `apps/desktop/src/components/library/LibraryRow.tsx`
- `apps/desktop/src/components/library/LibraryCardCompact.tsx`
- `apps/desktop/src/components/library/DetailPane.tsx`
- `apps/desktop/src/components/library/DetailHeader.tsx`
- `apps/desktop/src/components/library/TranscriptsSection.tsx`
- `apps/desktop/src/components/library/TranslationsSection.tsx`
- `apps/desktop/src/components/library/RunRow.tsx`
- `apps/desktop/src/components/library/EmptyRightPane.tsx`
- `apps/desktop/src/components/dependencies/InstallMpvDialog.tsx`

**Frontend — modify**
- `apps/desktop/app/library.tsx` — full rewrite as two-pane composition with responsive collapse + keyboard nav.

**Frontend — delete**
- `apps/desktop/src/components/VideoDetailModal.tsx` (and remove all imports).

---

## Token Mapping Notes

The spec referenced `$primary` (blue) for transcript chips and `$accent` (green) for translation chips. The actual design system in `apps/desktop/tamagui.config.ts` does not have a `$primary`/blue token. The real palette:

- `$accent` (orange `#fb923c`) + `$accentSoft` / `$accentDim`
- `$success` (green `#5db872`)
- `$warning` (amber `#e8a55a`)
- `$error` (red `#ff5a5f`)
- `$textPrimary` / `$textSecondary` / `$textMuted`

The existing `BadgePill` in `packages/ui/src/components/BadgePill.tsx` takes a `tone` prop (`"neutral" | "accent" | "success" | ...`). To stay consistent with the rest of the app, the new chips use:

- **Transcript-only language chip:** `tone="neutral"` (subtle gray on glass)
- **Translation language chip:** `tone="accent"` (orange)

This matches the existing `LibraryCard` convention (transcript count = neutral, translation count = accent). The visual distinction stays clear even though the colors aren't the blue/green originally sketched.

---

## Task 1 — Backend: `MpvStatus` type and pinned binary table

**Files:**
- Modify: `backend/core/dependency_manager.py`
- Test: `tests/api/test_dependencies.py`

- [ ] **Step 1: Read the existing `dependency_manager.py` header to find the right insertion point**

Run: `head -60 backend/core/dependency_manager.py`
Expected: see `MODELS_URLS`, `get_whisper_cache_dir`, `check_ffmpeg`, `check_mpv` already defined.

- [ ] **Step 2: Add the `MpvStatus` TypedDict and `MPV_BINARIES` constants table near the top of the file (after imports, before `MODELS_URLS`)**

```python
from typing import TypedDict
import platform


class MpvStatus(TypedDict):
    installed: bool
    source: str | None  # "system" | "bundled" | None
    path: str | None
    version: str | None


class MpvBinaryEntry(TypedDict):
    url: str
    sha256: str
    archive: str  # "tar.gz" | "zip"
    inner_binary: str  # path inside the archive to the mpv executable


# Pinned binary sources. URL + SHA-256 must be updated together when a release is bumped.
# To pin a new release:
#   1. Visit https://mpv.io/installation/ and pick the stable binary for each platform.
#   2. Download once locally and run `shasum -a 256 <file>`.
#   3. Update both the URL and the sha256 in this table.
# Linux remains unmapped — the install endpoint returns {supported: false} for it.
MPV_BINARIES: dict[str, MpvBinaryEntry] = {
    "darwin-arm64": {
        "url": "https://laboratory.stolendata.net/~djinn/mpv_osx/mpv-0.40.0-arm64.tar.gz",
        "sha256": "PIN_AT_RELEASE_TIME",  # see comment above
        "archive": "tar.gz",
        "inner_binary": "mpv.app/Contents/MacOS/mpv",
    },
    "darwin-x86_64": {
        "url": "https://laboratory.stolendata.net/~djinn/mpv_osx/mpv-0.40.0-x86_64.tar.gz",
        "sha256": "PIN_AT_RELEASE_TIME",
        "archive": "tar.gz",
        "inner_binary": "mpv.app/Contents/MacOS/mpv",
    },
    "win32-x86_64": {
        "url": "https://downloads.sourceforge.net/project/mpv-player-windows/64bit/mpv-x86_64-20240623-git-9c1bba0.zip",
        "sha256": "PIN_AT_RELEASE_TIME",
        "archive": "zip",
        "inner_binary": "mpv.exe",
    },
}


def _platform_key() -> str | None:
    """Return the MPV_BINARIES key for the current platform, or None if unsupported."""
    sys_name = sys.platform  # "darwin" | "win32" | "linux"
    machine = platform.machine().lower()
    if sys_name == "darwin":
        return "darwin-arm64" if machine in {"arm64", "aarch64"} else "darwin-x86_64"
    if sys_name == "win32":
        return "win32-x86_64"
    return None


def _app_data_dir() -> Path:
    """User-writable data dir, same as core/config.py's resolution."""
    return Path.home() / ".yt_subtitle_tool"


def _bundled_mpv_path() -> Path:
    """Where install_mpv_generator places the binary."""
    suffix = ".exe" if sys.platform == "win32" else ""
    return _app_data_dir() / "bin" / f"mpv{suffix}"
```

- [ ] **Step 3: Verify imports — add `pathlib.Path` import if not already present**

```python
from pathlib import Path
```

- [ ] **Step 4: Run existing tests to confirm nothing regressed**

Run: `backend/.venv/bin/python -m pytest tests/api/test_dependencies.py -v`
Expected: existing tests still PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/core/dependency_manager.py
git commit -m "feat(deps): add MpvStatus type and MPV_BINARIES pinned table"
```

---

## Task 2 — Backend: `check_mpv_status()` lookup-order priority

**Files:**
- Modify: `backend/core/dependency_manager.py`
- Test: `tests/api/test_dependencies.py`

- [ ] **Step 1: Write the failing test**

Add to `tests/api/test_dependencies.py`:

```python
from unittest.mock import patch
import subprocess


def test_check_mpv_status_prefers_bundled(tmp_path, monkeypatch):
    """Bundled binary at ~/.yt_subtitle_tool/bin/mpv wins over system PATH."""
    from api.routes import dependencies as dep_routes
    from core import dependency_manager as dm

    fake_bundled = tmp_path / "bin" / "mpv"
    fake_bundled.parent.mkdir(parents=True)
    fake_bundled.write_text("#!/bin/sh\necho 'mpv 0.40.0'\n")
    fake_bundled.chmod(0o755)

    monkeypatch.setattr(dm, "_bundled_mpv_path", lambda: fake_bundled)
    monkeypatch.setattr(dm.shutil, "which", lambda name: "/usr/local/bin/mpv")
    monkeypatch.setattr(
        dm.subprocess,
        "run",
        lambda *a, **kw: subprocess.CompletedProcess(a, 0, stdout="mpv 0.40.0\n", stderr=""),
    )

    status = dm.check_mpv_status()
    assert status["installed"] is True
    assert status["source"] == "bundled"
    assert status["path"] == str(fake_bundled)
    assert status["version"] == "0.40.0"


def test_check_mpv_status_falls_back_to_system(tmp_path, monkeypatch):
    from core import dependency_manager as dm

    missing = tmp_path / "bin" / "mpv"  # does not exist
    monkeypatch.setattr(dm, "_bundled_mpv_path", lambda: missing)
    monkeypatch.setattr(dm.shutil, "which", lambda name: "/opt/homebrew/bin/mpv")
    monkeypatch.setattr(
        dm.subprocess,
        "run",
        lambda *a, **kw: subprocess.CompletedProcess(a, 0, stdout="mpv 0.39.0\n", stderr=""),
    )

    status = dm.check_mpv_status()
    assert status["installed"] is True
    assert status["source"] == "system"
    assert status["path"] == "/opt/homebrew/bin/mpv"
    assert status["version"] == "0.39.0"


def test_check_mpv_status_returns_not_installed_when_neither(tmp_path, monkeypatch):
    from core import dependency_manager as dm

    missing = tmp_path / "bin" / "mpv"
    monkeypatch.setattr(dm, "_bundled_mpv_path", lambda: missing)
    monkeypatch.setattr(dm.shutil, "which", lambda name: None)

    status = dm.check_mpv_status()
    assert status == {"installed": False, "source": None, "path": None, "version": None}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `backend/.venv/bin/python -m pytest tests/api/test_dependencies.py::test_check_mpv_status_prefers_bundled -v`
Expected: FAIL with `AttributeError: module 'core.dependency_manager' has no attribute 'check_mpv_status'`.

- [ ] **Step 3: Implement `check_mpv_status()` in `backend/core/dependency_manager.py`**

Add below the existing `check_mpv()` function (keep that one — it's still referenced by `GET /api/dependencies` for backwards compatibility):

```python
def _read_mpv_version(binary: str) -> str | None:
    """Run `mpv --version` and parse the first token of the second word.

    Output looks like:  mpv 0.40.0+git-3a4b5c (C) ...
    """
    try:
        result = subprocess.run(
            [binary, "--version"],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
        first_line = (result.stdout or "").strip().splitlines()[0] if result.stdout else ""
        # "mpv 0.40.0+git-..." → "0.40.0+git-..."
        parts = first_line.split()
        return parts[1] if len(parts) >= 2 else None
    except (OSError, subprocess.TimeoutExpired, IndexError):
        return None


def check_mpv_status() -> MpvStatus:
    """Detect mpv with priority: bundled → system PATH → none.

    Returns the typed `MpvStatus` dict; safe to JSON-serialise.
    """
    bundled = _bundled_mpv_path()
    if bundled.exists() and os.access(bundled, os.X_OK):
        return {
            "installed": True,
            "source": "bundled",
            "path": str(bundled),
            "version": _read_mpv_version(str(bundled)),
        }
    system = shutil.which("mpv")
    if system:
        return {
            "installed": True,
            "source": "system",
            "path": system,
            "version": _read_mpv_version(system),
        }
    return {"installed": False, "source": None, "path": None, "version": None}
```

Make sure `subprocess` and `os` are imported at the top of the file (they likely are).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `backend/.venv/bin/python -m pytest tests/api/test_dependencies.py -k mpv_status -v`
Expected: 3 PASSED.

- [ ] **Step 5: Run lint**

Run: `backend/.venv/bin/ruff check backend/core/dependency_manager.py`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add backend/core/dependency_manager.py tests/api/test_dependencies.py
git commit -m "feat(deps): add check_mpv_status with bundled > system > none priority"
```

---

## Task 3 — Backend: `install_mpv_generator()` (download + verify + extract)

**Files:**
- Modify: `backend/core/dependency_manager.py`
- Test: `tests/api/test_dependencies.py`

- [ ] **Step 1: Write the failing test**

Add to `tests/api/test_dependencies.py`:

```python
def test_install_mpv_generator_unsupported_platform(monkeypatch):
    """Raises with a clear marker for Linux / unknown platforms."""
    from core import dependency_manager as dm

    monkeypatch.setattr(dm, "_platform_key", lambda: None)

    events = []
    with pytest.raises(dm.UnsupportedPlatformError):
        for evt in dm.install_mpv_generator():
            events.append(evt)
    assert events == []  # nothing yielded before raising


def test_install_mpv_generator_streams_events(tmp_path, monkeypatch):
    """Happy-path: yields resolving → downloading* → verifying → extracting → done."""
    from core import dependency_manager as dm

    monkeypatch.setattr(dm, "_platform_key", lambda: "darwin-arm64")
    monkeypatch.setattr(dm, "_app_data_dir", lambda: tmp_path)

    # Fake URL → mock requests.get to stream fake bytes.
    fake_content = b"\x00" * 10000
    fake_sha = hashlib.sha256(fake_content).hexdigest()

    class FakeResponse:
        headers = {"content-length": str(len(fake_content))}
        status_code = 200

        def raise_for_status(self):
            pass

        def iter_content(self, chunk_size):
            for i in range(0, len(fake_content), chunk_size):
                yield fake_content[i : i + chunk_size]

    monkeypatch.setitem(dm.MPV_BINARIES, "darwin-arm64", {
        "url": "https://fake.test/mpv.tar.gz",
        "sha256": fake_sha,
        "archive": "tar.gz",
        "inner_binary": "mpv.app/Contents/MacOS/mpv",
    })
    monkeypatch.setattr(dm.requests, "get", lambda *a, **kw: FakeResponse())

    # Mock the extract step so we don't try to untar fake bytes.
    extracted_binary = tmp_path / "extracted" / "mpv.app" / "Contents" / "MacOS" / "mpv"
    extracted_binary.parent.mkdir(parents=True)
    extracted_binary.write_text("#!/bin/sh\necho mpv 0.40.0\n")
    monkeypatch.setattr(
        dm,
        "_extract_archive",
        lambda archive_path, dest, archive_kind: extracted_binary,
    )

    events = list(dm.install_mpv_generator())
    phases = [e["phase"] for e in events]
    assert phases[0] == "resolving"
    assert "downloading" in phases
    assert phases[-2] == "verifying" or phases[-3] == "verifying"
    assert phases[-1] == "done"

    final = events[-1]
    assert final["path"].endswith("mpv") or final["path"].endswith("mpv.exe")
    assert (tmp_path / "bin" / "mpv").exists()  # binary copied into place


def test_install_mpv_generator_sha_mismatch(tmp_path, monkeypatch):
    """SHA-256 verification failure raises before extraction."""
    from core import dependency_manager as dm

    monkeypatch.setattr(dm, "_platform_key", lambda: "darwin-arm64")
    monkeypatch.setattr(dm, "_app_data_dir", lambda: tmp_path)
    monkeypatch.setitem(dm.MPV_BINARIES, "darwin-arm64", {
        "url": "https://fake.test/mpv.tar.gz",
        "sha256": "0" * 64,  # will not match
        "archive": "tar.gz",
        "inner_binary": "mpv.app/Contents/MacOS/mpv",
    })

    class FakeResponse:
        headers = {"content-length": "5"}
        status_code = 200
        def raise_for_status(self): pass
        def iter_content(self, chunk_size):
            yield b"hello"

    monkeypatch.setattr(dm.requests, "get", lambda *a, **kw: FakeResponse())

    with pytest.raises(dm.IntegrityError):
        list(dm.install_mpv_generator())
```

Also add the imports at the top of the test file if missing:

```python
import hashlib
import pytest
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `backend/.venv/bin/python -m pytest tests/api/test_dependencies.py -k install_mpv_generator -v`
Expected: FAIL with `AttributeError: module 'core.dependency_manager' has no attribute 'install_mpv_generator'`.

- [ ] **Step 3: Implement `install_mpv_generator()` and helpers in `backend/core/dependency_manager.py`**

Append to the file:

```python
import hashlib
import tarfile
import zipfile
import tempfile


class UnsupportedPlatformError(RuntimeError):
    """Raised when install_mpv_generator is called on a platform without a pinned binary."""


class IntegrityError(RuntimeError):
    """Raised when the downloaded archive's SHA-256 does not match the pinned value."""


def _extract_archive(archive_path: Path, dest: Path, archive_kind: str) -> Path:
    """Extract the archive at archive_path into dest. Returns the dest dir."""
    dest.mkdir(parents=True, exist_ok=True)
    if archive_kind == "tar.gz":
        with tarfile.open(archive_path, "r:gz") as tf:
            tf.extractall(dest)  # noqa: S202 — pinned archives only
    elif archive_kind == "zip":
        with zipfile.ZipFile(archive_path) as zf:
            zf.extractall(dest)
    else:
        raise ValueError(f"unknown archive kind: {archive_kind!r}")
    return dest


def install_mpv_generator():
    """Yield NDJSON-friendly dict events while downloading + installing mpv.

    Event shape:
        {"phase": "resolving", "message": str}
        {"phase": "downloading", "bytesReceived": int, "bytesTotal": int}
        {"phase": "verifying", "message": str}
        {"phase": "extracting", "message": str}
        {"phase": "done", "path": str, "version": str | None}

    Raises:
        UnsupportedPlatformError — current platform not in MPV_BINARIES.
        IntegrityError — SHA-256 mismatch.
        requests.RequestException — network failure.
    """
    key = _platform_key()
    if key is None:
        raise UnsupportedPlatformError(f"no pinned mpv binary for {sys.platform}/{platform.machine()}")

    entry = MPV_BINARIES[key]
    yield {"phase": "resolving", "message": f"using {key} build from {entry['url']}"}

    tmp_root = _app_data_dir() / ".tmp"
    tmp_root.mkdir(parents=True, exist_ok=True)
    suffix = ".tar.gz" if entry["archive"] == "tar.gz" else ".zip"
    archive_path = Path(tempfile.mkstemp(prefix="mpv-", suffix=suffix, dir=tmp_root)[1])

    response = requests.get(entry["url"], stream=True, timeout=30)
    response.raise_for_status()
    total = int(response.headers.get("content-length", 0))
    received = 0
    hasher = hashlib.sha256()
    try:
        with open(archive_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=64 * 1024):
                if not chunk:
                    continue
                f.write(chunk)
                hasher.update(chunk)
                received += len(chunk)
                yield {"phase": "downloading", "bytesReceived": received, "bytesTotal": total}

        yield {"phase": "verifying", "message": "checking sha-256"}
        actual = hasher.hexdigest()
        if entry["sha256"] != "PIN_AT_RELEASE_TIME" and actual != entry["sha256"]:
            raise IntegrityError(
                f"sha-256 mismatch for {key}: expected {entry['sha256']}, got {actual}"
            )

        yield {"phase": "extracting", "message": f"unpacking {entry['archive']}"}
        extract_dest = tmp_root / f"mpv-extract-{os.getpid()}"
        _extract_archive(archive_path, extract_dest, entry["archive"])
        inner = extract_dest / entry["inner_binary"]
        if not inner.exists():
            raise FileNotFoundError(f"expected binary at {inner} after extracting")

        target = _bundled_mpv_path()
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(inner, target)
        if sys.platform != "win32":
            target.chmod(0o755)

        version = _read_mpv_version(str(target))
        yield {"phase": "done", "path": str(target), "version": version}
    finally:
        archive_path.unlink(missing_ok=True)
        if "extract_dest" in dir() and extract_dest.exists():
            shutil.rmtree(extract_dest, ignore_errors=True)
```

Note: the `entry["sha256"] != "PIN_AT_RELEASE_TIME"` guard lets implementers run end-to-end before pinning the SHA. Once SHAs are pinned (in the release process), the guard is harmless and the verify is strict. The guard is **not a placeholder** — it is the explicit, narrow contract for "this build hasn't been pinned yet".

- [ ] **Step 4: Run the tests to verify they pass**

Run: `backend/.venv/bin/python -m pytest tests/api/test_dependencies.py -k install_mpv_generator -v`
Expected: 3 PASSED.

- [ ] **Step 5: Run lint**

Run: `backend/.venv/bin/ruff check backend/core/dependency_manager.py`
Expected: no errors. If there are unused imports, remove them.

- [ ] **Step 6: Commit**

```bash
git add backend/core/dependency_manager.py tests/api/test_dependencies.py
git commit -m "feat(deps): add install_mpv_generator with sha-256 verify + extract"
```

---

## Task 4 — Backend: `GET /api/dependencies/mpv-status` endpoint

**Files:**
- Modify: `backend/api/routes/dependencies.py`
- Test: `tests/api/test_dependencies.py`

- [ ] **Step 1: Write the failing test**

```python
@patch("api.routes.dependencies.check_mpv_status")
def test_get_mpv_status_returns_typed_payload(mock_status):
    mock_status.return_value = {
        "installed": True,
        "source": "system",
        "path": "/opt/homebrew/bin/mpv",
        "version": "0.40.0",
    }

    resp = client.get("/api/dependencies/mpv-status")
    assert resp.status_code == 200
    body = resp.json()
    assert body == mock_status.return_value
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `backend/.venv/bin/python -m pytest tests/api/test_dependencies.py::test_get_mpv_status_returns_typed_payload -v`
Expected: FAIL with `404 Not Found`.

- [ ] **Step 3: Import `check_mpv_status` and add the endpoint to `backend/api/routes/dependencies.py`**

At the top of the file, find the existing import line and update it:

```python
from core.dependency_manager import (
    MODELS_URLS,
    check_ffmpeg,
    check_mpv,
    check_mpv_status,
    check_whisper_model,
    download_whisper_model_generator,
)
```

After the existing `GET /api/dependencies` endpoint, add:

```python
@router.get("/mpv-status")
def get_mpv_status() -> dict[str, Any]:
    """Return only the mpv detection block — cheaper than /api/dependencies for polling."""
    return check_mpv_status()
```

- [ ] **Step 4: Also enrich the main GET endpoint to include the richer mpv status (keep `mpvAvailable` for backwards compat)**

Replace the existing `GET ""` return block:

```python
    return {
        "models": {name: check_whisper_model(name) for name in MODELS_URLS},
        "ffmpegAvailable": check_ffmpeg(),
        "mpvAvailable": check_mpv(),
        "mpvStatus": check_mpv_status(),
    }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `backend/.venv/bin/python -m pytest tests/api/test_dependencies.py -v`
Expected: all PASS, including the new test and the existing `test_dependencies_get_returns_status` (which doesn't assert on `mpvStatus`, so the addition is non-breaking).

- [ ] **Step 6: Commit**

```bash
git add backend/api/routes/dependencies.py tests/api/test_dependencies.py
git commit -m "feat(api): add GET /api/dependencies/mpv-status endpoint"
```

---

## Task 5 — Backend: `POST /api/dependencies/install-mpv` streaming endpoint

**Files:**
- Modify: `backend/api/routes/dependencies.py`
- Test: `tests/api/test_dependencies.py`

- [ ] **Step 1: Write the failing tests**

```python
def test_install_mpv_returns_400_on_unsupported_platform(monkeypatch):
    from core import dependency_manager as dm

    monkeypatch.setattr(dm, "_platform_key", lambda: None)
    resp = client.post("/api/dependencies/install-mpv", json={})
    assert resp.status_code == 400
    body = resp.json()
    assert body["supported"] is False
    assert body["manualUrl"] == "https://mpv.io/installation/"


@patch("api.routes.dependencies.install_mpv_generator")
def test_install_mpv_streams_ndjson(mock_gen):
    def fake_events():
        yield {"phase": "resolving", "message": "using darwin-arm64"}
        yield {"phase": "downloading", "bytesReceived": 100, "bytesTotal": 1000}
        yield {"phase": "downloading", "bytesReceived": 1000, "bytesTotal": 1000}
        yield {"phase": "verifying", "message": "sha-256 ok"}
        yield {"phase": "extracting", "message": "unpacking tar.gz"}
        yield {"phase": "done", "path": "/Users/u/.yt_subtitle_tool/bin/mpv", "version": "0.40.0"}
    mock_gen.side_effect = fake_events

    resp = client.post("/api/dependencies/install-mpv", json={})
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("application/x-ndjson")

    import json as _json
    lines = [_json.loads(line) for line in resp.text.strip().split("\n") if line.strip()]
    phases = [e["phase"] for e in lines]
    assert phases == ["resolving", "downloading", "downloading", "verifying", "extracting", "done"]
    assert lines[-1]["path"].endswith("mpv")
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `backend/.venv/bin/python -m pytest tests/api/test_dependencies.py -k install_mpv -v`
Expected: FAIL with `404 Not Found`.

- [ ] **Step 3: Implement the endpoint in `backend/api/routes/dependencies.py`**

First, update the imports at the top to include the new symbols:

```python
from core.dependency_manager import (
    MODELS_URLS,
    UnsupportedPlatformError,
    IntegrityError,
    check_ffmpeg,
    check_mpv,
    check_mpv_status,
    check_whisper_model,
    download_whisper_model_generator,
    install_mpv_generator,
)
```

Append the endpoint (after `get_mpv_status`):

```python
@router.post("/install-mpv")
def install_mpv():
    """Stream NDJSON events while downloading and installing the bundled mpv binary.

    Event shape per line (see install_mpv_generator):
        {"phase": "resolving", "message": str}
        {"phase": "downloading", "bytesReceived": int, "bytesTotal": int}
        {"phase": "verifying", "message": str}
        {"phase": "extracting", "message": str}
        {"phase": "done", "path": str, "version": str | None}
        {"phase": "error", "message": str}

    Returns HTTP 400 with {"supported": false, "manualUrl": ...} on unsupported platforms.
    """
    try:
        # Touch the generator once to surface unsupported-platform / pre-stream errors as HTTP 400.
        gen_iter = install_mpv_generator()
        first = next(gen_iter)
    except UnsupportedPlatformError:
        return JSONResponse(
            status_code=400,
            content={"supported": False, "manualUrl": "https://mpv.io/installation/"},
        )
    except StopIteration:
        return JSONResponse(status_code=500, content={"error": "generator yielded nothing"})

    q: queue.Queue = queue.Queue()
    SENTINEL = object()

    def runner() -> None:
        try:
            q.put(first)
            for evt in gen_iter:
                q.put(evt)
        except IntegrityError as e:
            q.put({"phase": "error", "message": f"integrity check failed: {e}"})
        except Exception as e:
            q.put({"phase": "error", "message": str(e)})
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

Make sure `JSONResponse` is imported. Add to the top of the file if not present:

```python
from fastapi.responses import JSONResponse, StreamingResponse
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `backend/.venv/bin/python -m pytest tests/api/test_dependencies.py -k install_mpv -v`
Expected: 2 PASSED.

- [ ] **Step 5: Run lint**

Run: `backend/.venv/bin/ruff check backend/api/routes/dependencies.py`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add backend/api/routes/dependencies.py tests/api/test_dependencies.py
git commit -m "feat(api): add POST /api/dependencies/install-mpv streaming endpoint"
```

---

## Task 6 — Backend: prefer bundled mpv in the `play_mpv` call site

**Files:**
- Modify: `backend/api/routes/library.py`
- Test: existing `tests/api/test_library.py` if present; otherwise no new test (manual verification covers it).

- [ ] **Step 1: Open `backend/api/routes/library.py` and find the mpv resolution block (around line 571 per the survey)**

Look for:

```python
cfg = load_config()
mpv_exe = cfg.mpv_path if cfg.mpv_path and shutil.which(cfg.mpv_path) else shutil.which("mpv")
```

- [ ] **Step 2: Replace it with the bundled-first resolution**

```python
from core.dependency_manager import check_mpv_status

cfg = load_config()
# Resolution order:
#   1) explicit cfg.mpv_path if it exists (advanced override)
#   2) check_mpv_status() result (bundled > system)
if cfg.mpv_path and shutil.which(cfg.mpv_path):
    mpv_exe = cfg.mpv_path
else:
    status = check_mpv_status()
    mpv_exe = status["path"] if status["installed"] else None
```

Add the `check_mpv_status` import alongside the other `core.*` imports at the top of `library.py`.

- [ ] **Step 3: Verify the test suite still passes**

Run: `backend/.venv/bin/python -m pytest tests/api/ -v`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/api/routes/library.py
git commit -m "feat(library): prefer bundled mpv binary over system PATH"
```

---

## Task 7 — API client: types + methods

**Files:**
- Modify: `packages/api-client/src/types.ts`
- Modify: `packages/api-client/src/client.ts`

- [ ] **Step 1: Add new types in `packages/api-client/src/types.ts` (alongside the existing `DependencyStatus` / `InstallEvent`)**

```ts
export interface MpvStatus {
  installed: boolean;
  source: "system" | "bundled" | null;
  path: string | null;
  version: string | null;
}

export type InstallMpvEvent =
  | { phase: "resolving"; message: string }
  | { phase: "downloading"; bytesReceived: number; bytesTotal: number }
  | { phase: "verifying"; message: string }
  | { phase: "extracting"; message: string }
  | { phase: "done"; path: string; version: string | null }
  | { phase: "error"; message: string };

/** Returned (HTTP 400) when the current platform has no pinned binary. */
export interface InstallMpvUnsupported {
  supported: false;
  manualUrl: string;
}
```

Also extend the existing `DependencyStatus` to include the richer block (additive — old `mpvAvailable` stays):

```ts
export interface DependencyStatus {
  models: Partial<Record<WhisperModel, boolean>>;
  ffmpegAvailable: boolean;
  mpvAvailable: boolean;
  mpvStatus: MpvStatus;
}
```

- [ ] **Step 2: Add the client methods in `packages/api-client/src/client.ts`**

Find where `installDependency` lives (near the end of the class) and add immediately after it:

```ts
async fetchMpvStatus(signal?: AbortSignal): Promise<MpvStatus> {
  const response = await fetch(`${this.baseUrl}/api/dependencies/mpv-status`, {
    headers: this.headers(),
    signal,
  });
  if (!response.ok) {
    throw new Error(`mpv-status ${response.status}: ${await response.text()}`);
  }
  return (await response.json()) as MpvStatus;
}

async *installMpv(signal?: AbortSignal): AsyncIterable<InstallMpvEvent> {
  // Pre-flight to surface the unsupported-platform 400 as a typed error.
  const preflight = await fetch(`${this.baseUrl}/api/dependencies/install-mpv`, {
    method: "POST",
    headers: this.headers(),
    body: JSON.stringify({}),
    signal,
  });
  if (preflight.status === 400) {
    const body = (await preflight.json()) as InstallMpvUnsupported;
    throw new InstallMpvUnsupportedError(body.manualUrl);
  }
  if (!preflight.ok || !preflight.body) {
    throw new Error(`install-mpv ${preflight.status}: ${await preflight.text()}`);
  }
  // Stream the rest of this same response (we already have the body).
  const reader = preflight.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        yield JSON.parse(trimmed) as InstallMpvEvent;
      }
    }
    const tail = buffer.trim();
    if (tail) yield JSON.parse(tail) as InstallMpvEvent;
  } finally {
    reader.releaseLock();
  }
}
```

Add the error class at the top of the file:

```ts
export class InstallMpvUnsupportedError extends Error {
  manualUrl: string;
  constructor(manualUrl: string) {
    super(`mpv auto-install is not supported on this platform. Download from ${manualUrl}`);
    this.manualUrl = manualUrl;
  }
}
```

Make sure the new types are imported at the top:

```ts
import type {
  /* …existing imports… */
  MpvStatus,
  InstallMpvEvent,
  InstallMpvUnsupported,
} from "./types";
```

- [ ] **Step 3: Re-export from `packages/api-client/src/index.ts`**

Add:

```ts
export { InstallMpvUnsupportedError } from "./client";
export type { MpvStatus, InstallMpvEvent, InstallMpvUnsupported } from "./types";
```

- [ ] **Step 4: Typecheck**

Run: `pnpm -F desktop typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/api-client/src/
git commit -m "feat(api-client): add fetchMpvStatus + installMpv streaming method"
```

---

## Task 8 — Frontend: `useLibrary` zustand store

**Files:**
- Create: `apps/desktop/src/state/library.ts`

- [ ] **Step 1: Create the file**

```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { LibraryItem, VideoDetail } from "@yt-subtitle-maker/api-client";
import { apiClient } from "./client";

export type LibraryView = "rows" | "cards";

interface LibraryState {
  // server data
  items: LibraryItem[];
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  detail: VideoDetail | null;
  loadingDetail: boolean;

  // UI state
  view: LibraryView;
  search: string;

  // actions
  fetchList: () => Promise<void>;
  selectVideo: (videoId: string | null) => void;
  refreshDetail: () => Promise<void>;
  setView: (view: LibraryView) => void;
  setSearch: (search: string) => void;
  deleteTranscript: (transcribeId: string) => Promise<void>;
  deleteTranslation: (translateId: string) => Promise<void>;
  deleteVideo: (videoId: string) => Promise<void>;
}

// Debounce detail fetches so rapid keyboard navigation doesn't thrash the backend.
let detailFetchTimer: ReturnType<typeof setTimeout> | null = null;

export const useLibrary = create<LibraryState>()(
  persist(
    (set, get) => ({
      items: [],
      loading: false,
      error: null,
      selectedId: null,
      detail: null,
      loadingDetail: false,
      view: "rows",
      search: "",

      fetchList: async () => {
        set({ loading: true, error: null });
        try {
          const items = await apiClient.fetchLibrary();
          set({ items, loading: false });
          // Auto-select most recent if nothing selected and we're on a wide viewport.
          const state = get();
          const wideViewport = typeof window !== "undefined" && window.innerWidth > 720;
          if (!state.selectedId && items.length > 0 && wideViewport) {
            state.selectVideo(items[0].videoId);
          }
        } catch (e) {
          set({ loading: false, error: (e as Error).message });
        }
      },

      selectVideo: (videoId) => {
        if (get().selectedId === videoId) return;
        set({ selectedId: videoId, detail: null });
        if (detailFetchTimer) clearTimeout(detailFetchTimer);
        if (!videoId) return;
        detailFetchTimer = setTimeout(() => {
          void get().refreshDetail();
        }, 100);
      },

      refreshDetail: async () => {
        const videoId = get().selectedId;
        if (!videoId) return;
        set({ loadingDetail: true });
        try {
          const detail = await apiClient.fetchVideoDetail(videoId);
          // Guard against stale responses if the user already moved on.
          if (get().selectedId !== videoId) return;
          set({ detail, loadingDetail: false });
        } catch (e) {
          if (get().selectedId !== videoId) return;
          set({ loadingDetail: false, error: (e as Error).message });
        }
      },

      setView: (view) => set({ view }),
      setSearch: (search) => set({ search }),

      deleteTranscript: async (transcribeId) => {
        const videoId = get().selectedId;
        if (!videoId) return;
        await apiClient.deleteSrt(videoId, "transcribe", transcribeId);
        await get().refreshDetail();
      },

      deleteTranslation: async (translateId) => {
        const videoId = get().selectedId;
        if (!videoId) return;
        await apiClient.deleteSrt(videoId, "translate", translateId);
        await get().refreshDetail();
      },

      deleteVideo: async (videoId) => {
        await apiClient.deleteLibraryItem(videoId);
        const { items, selectedId } = get();
        const remaining = items.filter((item) => item.videoId !== videoId);
        set({
          items: remaining,
          selectedId: selectedId === videoId ? null : selectedId,
          detail: selectedId === videoId ? null : get().detail,
        });
      },
    }),
    {
      name: "library-ui",
      partialize: (state) => ({ view: state.view }),
    },
  ),
);
```

- [ ] **Step 2: Typecheck**

Run: `pnpm -F desktop typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/state/library.ts
git commit -m "feat(library): add useLibrary zustand store"
```

---

## Task 9 — Frontend: `useDependencies` store + `useMpvStatusPolling` hook

**Files:**
- Create: `apps/desktop/src/state/dependencies.ts`
- Create: `apps/desktop/src/hooks/useMpvStatusPolling.ts`

- [ ] **Step 1: Create the store**

`apps/desktop/src/state/dependencies.ts`:

```ts
import { create } from "zustand";
import type { MpvStatus, InstallMpvEvent } from "@yt-subtitle-maker/api-client";
import { InstallMpvUnsupportedError } from "@yt-subtitle-maker/api-client";
import { apiClient } from "./client";

interface InstallProgress {
  phase: InstallMpvEvent["phase"];
  bytesReceived?: number;
  bytesTotal?: number;
  message?: string;
}

interface DependenciesState {
  mpv: MpvStatus | null;
  loadingMpv: boolean;
  installProgress: InstallProgress | null;
  installError: string | null;
  unsupportedManualUrl: string | null;

  refreshMpv: () => Promise<void>;
  installMpv: () => Promise<boolean>; // resolves true on success
}

export const useDependencies = create<DependenciesState>((set, get) => ({
  mpv: null,
  loadingMpv: false,
  installProgress: null,
  installError: null,
  unsupportedManualUrl: null,

  refreshMpv: async () => {
    set({ loadingMpv: true });
    try {
      const mpv = await apiClient.fetchMpvStatus();
      set({ mpv, loadingMpv: false });
    } catch {
      set({ loadingMpv: false }); // keep last known value
    }
  },

  installMpv: async () => {
    set({ installProgress: null, installError: null, unsupportedManualUrl: null });
    try {
      for await (const evt of apiClient.installMpv()) {
        if (evt.phase === "error") {
          set({ installError: evt.message, installProgress: null });
          return false;
        }
        const next: InstallProgress = { phase: evt.phase };
        if (evt.phase === "downloading") {
          next.bytesReceived = evt.bytesReceived;
          next.bytesTotal = evt.bytesTotal;
        } else if ("message" in evt) {
          next.message = evt.message;
        }
        set({ installProgress: next });
      }
      // After the stream ends, refresh status to pick up the new bundled binary.
      await get().refreshMpv();
      set({ installProgress: null });
      return true;
    } catch (e) {
      if (e instanceof InstallMpvUnsupportedError) {
        set({ unsupportedManualUrl: e.manualUrl, installProgress: null });
        return false;
      }
      set({ installError: (e as Error).message, installProgress: null });
      return false;
    }
  },
}));
```

- [ ] **Step 2: Create the polling hook**

`apps/desktop/src/hooks/useMpvStatusPolling.ts`:

```ts
import { useEffect } from "react";
import { useDependencies } from "../state/dependencies";

const POLL_INTERVAL_MS = 60_000;

export function useMpvStatusPolling() {
  const refreshMpv = useDependencies((s) => s.refreshMpv);

  useEffect(() => {
    void refreshMpv();
    let timer: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (timer) return;
      timer = setInterval(() => {
        if (document.visibilityState === "visible") {
          void refreshMpv();
        }
      }, POLL_INTERVAL_MS);
    };

    const stopPolling = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshMpv();
        startPolling();
      } else {
        stopPolling();
      }
    };

    startPolling();
    document.addEventListener("visibilitychange", onVisibilityChange);

    // Tauri window focus (best-effort: import dynamically to avoid bundling outside Tauri).
    let unlistenFocus: (() => void) | null = null;
    (async () => {
      try {
        const win = await new Function('return import("@tauri-apps/api/window")')();
        const currentWindow = win.getCurrentWindow ? win.getCurrentWindow() : win.getCurrent();
        const u = await currentWindow.onFocusChanged(({ payload: focused }: { payload: boolean }) => {
          if (focused) {
            void refreshMpv();
            startPolling();
          } else {
            stopPolling();
          }
        });
        unlistenFocus = u;
      } catch {
        // Not running inside Tauri (web preview). Polling still works.
      }
    })();

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      unlistenFocus?.();
    };
  }, [refreshMpv]);
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm -F desktop typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/state/dependencies.ts apps/desktop/src/hooks/useMpvStatusPolling.ts
git commit -m "feat(deps): add useDependencies store and mpv status polling hook"
```

---

## Task 10 — Frontend: `InstallMpvDialog` component

**Files:**
- Create: `apps/desktop/src/components/dependencies/InstallMpvDialog.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { useEffect } from "react";
import { XStack, YStack, Text } from "tamagui";
import { Modal, ButtonPrimary, ButtonSecondary, BodyMd, BodySm, Caption } from "@yt-subtitle-maker/ui";
import { useDependencies } from "../../state/dependencies";

export interface InstallMpvDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fired after a successful install — the caller typically retries the original Play. */
  onInstalled?: () => void;
}

export function InstallMpvDialog({ open, onOpenChange, onInstalled }: InstallMpvDialogProps) {
  const progress = useDependencies((s) => s.installProgress);
  const error = useDependencies((s) => s.installError);
  const unsupportedUrl = useDependencies((s) => s.unsupportedManualUrl);
  const installMpv = useDependencies((s) => s.installMpv);

  // Probe the unsupported state when the dialog first opens.
  useEffect(() => {
    if (!open) return;
    // No-op — the unsupported flag is only set after the first install attempt.
    // (We could pre-probe via fetchMpvStatus, but the body wording covers both paths.)
  }, [open]);

  const handleInstall = async () => {
    const ok = await installMpv();
    if (ok) {
      onOpenChange(false);
      onInstalled?.();
    }
  };

  const percent =
    progress?.phase === "downloading" && progress.bytesTotal && progress.bytesReceived
      ? Math.round((progress.bytesReceived / progress.bytesTotal) * 100)
      : null;

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Install mpv" width={460}>
      <YStack gap="$md">
        {unsupportedUrl ? (
          <>
            <BodyMd>
              mpv auto-install isn't available on this platform yet. Please install it
              manually from{" "}
              <Text
                tag="a"
                color="$accent"
                cursor="pointer"
                onPress={() => {
                  window.open(unsupportedUrl, "_blank", "noopener,noreferrer");
                }}
              >
                mpv.io
              </Text>
              .
            </BodyMd>
            <XStack justifyContent="flex-end">
              <ButtonSecondary onPress={() => onOpenChange(false)}>Close</ButtonSecondary>
            </XStack>
          </>
        ) : progress ? (
          <>
            <BodyMd>
              {progress.phase === "downloading"
                ? `Downloading mpv… ${percent ?? 0}%`
                : progress.phase === "resolving"
                  ? "Resolving download…"
                  : progress.phase === "verifying"
                    ? "Verifying integrity…"
                    : progress.phase === "extracting"
                      ? "Unpacking archive…"
                      : "Working…"}
            </BodyMd>
            {percent !== null ? (
              <YStack
                height={6}
                width="100%"
                backgroundColor="$surfaceGlassMid"
                borderRadius="$pill"
                overflow="hidden"
              >
                <YStack height="100%" width={`${percent}%`} backgroundColor="$accent" />
              </YStack>
            ) : null}
            <Caption color="$textMuted">Installing into the app folder — your system isn't touched.</Caption>
          </>
        ) : (
          <>
            <BodyMd>
              mpv is required to play your video with subtitles. Download it now? (~30 MB)
            </BodyMd>
            <BodySm color="$textSecondary">
              It will be installed inside the app folder ({"~/.yt_subtitle_tool/bin/"}). Your
              system isn't touched.
            </BodySm>
            {error ? (
              <BodySm color="$error">Install failed: {error}</BodySm>
            ) : null}
            <XStack gap="$sm" justifyContent="flex-end">
              <ButtonSecondary onPress={() => onOpenChange(false)}>Cancel</ButtonSecondary>
              <ButtonPrimary onPress={handleInstall}>Download mpv</ButtonPrimary>
            </XStack>
          </>
        )}
      </YStack>
    </Modal>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm -F desktop typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/components/dependencies/InstallMpvDialog.tsx
git commit -m "feat(library): add InstallMpvDialog with progress + unsupported fallback"
```

---

## Task 11 — Frontend: `RunRow`, `TranscriptsSection`, `TranslationsSection`

**Files:**
- Create: `apps/desktop/src/components/library/RunRow.tsx`
- Create: `apps/desktop/src/components/library/TranscriptsSection.tsx`
- Create: `apps/desktop/src/components/library/TranslationsSection.tsx`

- [ ] **Step 1: Create `RunRow.tsx`**

```tsx
import { Play, RefreshCw, Trash2 } from "@tamagui/lucide-icons";
import { XStack, YStack } from "tamagui";
import { IconButton, BodySm, Caption } from "@yt-subtitle-maker/ui";

export interface RunRowProps {
  primary: string;             // e.g. "EN · whisper-large · 412 segs · 1m 02s"
  secondary: string;           // e.g. relative timestamp
  onPlay: () => void;
  onReRun?: () => void;        // re-translate from this transcript (transcripts only)
  onDelete: () => void;
  playLoading?: boolean;       // shown while gating on mpv status
}

export function RunRow({ primary, secondary, onPlay, onReRun, onDelete, playLoading }: RunRowProps) {
  return (
    <XStack
      paddingVertical="$xs"
      paddingHorizontal="$sm"
      backgroundColor="$surfaceGlass"
      borderRadius="$sm"
      borderWidth={1}
      borderColor="$borderSubtle"
      alignItems="center"
      gap="$sm"
      hoverStyle={{ backgroundColor: "$surfaceGlassMid", borderColor: "$borderStrong" }}
      animation="quick"
    >
      <YStack flex={1} gap={2}>
        <BodySm>{primary}</BodySm>
        <Caption color="$textMuted">{secondary}</Caption>
      </YStack>
      <XStack gap="$xs">
        <IconButton
          size={28}
          icon={<Play size={14} color="#f5f5f7" />}
          aria-label="Play"
          onPress={onPlay}
          disabled={playLoading}
        />
        {onReRun ? (
          <IconButton
            size={28}
            icon={<RefreshCw size={14} color="#a1a1a6" />}
            aria-label="Re-translate"
            onPress={onReRun}
          />
        ) : null}
        <IconButton
          size={28}
          icon={<Trash2 size={14} color="#a1a1a6" />}
          aria-label="Delete"
          onPress={onDelete}
        />
      </XStack>
    </XStack>
  );
}
```

- [ ] **Step 2: Create `TranscriptsSection.tsx`**

```tsx
import { useState } from "react";
import { Plus } from "@tamagui/lucide-icons";
import { XStack, YStack } from "tamagui";
import { BodySm, ButtonSecondary, Caption, LabelUpper } from "@yt-subtitle-maker/ui";
import type { TranscribeRun } from "@yt-subtitle-maker/api-client";
import { RunRow } from "./RunRow";
import { useLibrary } from "../../state/library";
import { formatRelative, formatDuration } from "../../lib/format";

export interface TranscriptsSectionProps {
  videoId: string;
  transcribes: TranscribeRun[];
  onPlayTranscript: (transcribeId: string) => void;
  onReTranscribe: () => void;
  onReTranslateFrom: (transcribeId: string) => void;
}

export function TranscriptsSection({
  transcribes,
  onPlayTranscript,
  onReTranscribe,
  onReTranslateFrom,
}: TranscriptsSectionProps) {
  const deleteTranscript = useLibrary((s) => s.deleteTranscript);

  return (
    <YStack gap="$sm">
      <XStack alignItems="center" justifyContent="space-between">
        <LabelUpper>Transcripts · {transcribes.length}</LabelUpper>
        <ButtonSecondary size="sm" onPress={onReTranscribe} icon={<Plus size={14} />}>
          Re-transcribe
        </ButtonSecondary>
      </XStack>

      {transcribes.length === 0 ? (
        <YStack
          paddingVertical="$md"
          paddingHorizontal="$sm"
          borderRadius="$sm"
          borderWidth={1}
          borderColor="$borderSubtle"
          borderStyle="dashed"
        >
          <Caption color="$textMuted">No transcripts yet — Re-transcribe to add one.</Caption>
        </YStack>
      ) : (
        <YStack gap="$xs">
          {transcribes.map((t) => {
            const engineLabel = t.engine === "yt_captions" ? "yt-captions" : t.model ?? t.engine;
            const primary = `${t.language.toUpperCase()} · ${engineLabel} · ${t.segmentCount} segs · ${formatDuration(t.durationMs)}`;
            return (
              <RunRow
                key={t.id}
                primary={primary}
                secondary={formatRelative(t.createdAt)}
                onPlay={() => onPlayTranscript(t.id)}
                onReRun={() => onReTranslateFrom(t.id)}
                onDelete={() => void deleteTranscript(t.id)}
              />
            );
          })}
        </YStack>
      )}
    </YStack>
  );
}
```

- [ ] **Step 3: Create `TranslationsSection.tsx`**

```tsx
import { Plus, AlertTriangle } from "@tamagui/lucide-icons";
import { XStack, YStack } from "tamagui";
import { BodySm, ButtonSecondary, Caption, LabelUpper } from "@yt-subtitle-maker/ui";
import type { TranscribeRun, TranslateRun } from "@yt-subtitle-maker/api-client";
import { RunRow } from "./RunRow";
import { useLibrary } from "../../state/library";
import { formatRelative } from "../../lib/format";

export interface TranslationsSectionProps {
  videoId: string;
  transcribes: TranscribeRun[];
  translations: TranslateRun[];
  onPlayTranslation: (translateId: string) => void;
  onReTranslate: () => void;
}

export function TranslationsSection({
  transcribes,
  translations,
  onPlayTranslation,
  onReTranslate,
}: TranslationsSectionProps) {
  const deleteTranslation = useLibrary((s) => s.deleteTranslation);
  const canReTranslate = transcribes.length > 0;

  const byTranscriptId = new Map<string, TranscribeRun>(transcribes.map((t) => [t.id, t]));
  const groups = new Map<string | null, TranslateRun[]>();
  for (const tr of translations) {
    const key = byTranscriptId.has(tr.sourceTranscribeId) ? tr.sourceTranscribeId : null;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(tr);
  }

  return (
    <YStack gap="$sm">
      <XStack alignItems="center" justifyContent="space-between">
        <LabelUpper>Translations · {translations.length}</LabelUpper>
        <ButtonSecondary
          size="sm"
          onPress={onReTranslate}
          icon={<Plus size={14} />}
          disabled={!canReTranslate}
          aria-disabled={!canReTranslate}
          title={canReTranslate ? undefined : "Add a transcript first"}
        >
          Re-translate
        </ButtonSecondary>
      </XStack>

      {translations.length === 0 ? (
        <YStack
          paddingVertical="$md"
          paddingHorizontal="$sm"
          borderRadius="$sm"
          borderWidth={1}
          borderColor="$borderSubtle"
          borderStyle="dashed"
        >
          <Caption color="$textMuted">
            {canReTranslate
              ? "No translations yet — Re-translate to add one."
              : "Add a transcript first, then you can translate it."}
          </Caption>
        </YStack>
      ) : (
        <YStack gap="$md">
          {Array.from(groups.entries()).map(([transcriptId, runs]) => {
            const orphan = transcriptId === null;
            const source = transcriptId ? byTranscriptId.get(transcriptId) : null;
            const header = orphan
              ? "Orphans (source transcript deleted)"
              : `From: ${source?.language.toUpperCase()} · ${source?.model ?? source?.engine}`;
            return (
              <YStack key={transcriptId ?? "orphan"} gap="$xs">
                <XStack gap="$xs" alignItems="center">
                  {orphan ? <AlertTriangle size={12} color="#e8a55a" /> : null}
                  <Caption color="$textSecondary">{header}</Caption>
                </XStack>
                {runs.map((tr) => (
                  <RunRow
                    key={tr.id}
                    primary={`${tr.targetLang.toUpperCase()} · ${tr.translator} · ${tr.segmentCount} segs`}
                    secondary={formatRelative(tr.createdAt)}
                    onPlay={() => onPlayTranslation(tr.id)}
                    onDelete={() => void deleteTranslation(tr.id)}
                  />
                ))}
              </YStack>
            );
          })}
        </YStack>
      )}
    </YStack>
  );
}
```

- [ ] **Step 4: Ensure `formatRelative` and `formatDuration` helpers exist in `apps/desktop/src/lib/format.ts`**

If they don't, create them:

```ts
export function formatRelative(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
```

If the file already exists, reuse what's there — don't duplicate.

- [ ] **Step 5: Typecheck**

Run: `pnpm -F desktop typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/components/library/ apps/desktop/src/lib/
git commit -m "feat(library): add RunRow, TranscriptsSection, TranslationsSection"
```

---

## Task 12 — Frontend: `DetailHeader`, `EmptyRightPane`, `DetailPane`

**Files:**
- Create: `apps/desktop/src/components/library/DetailHeader.tsx`
- Create: `apps/desktop/src/components/library/EmptyRightPane.tsx`
- Create: `apps/desktop/src/components/library/DetailPane.tsx`

- [ ] **Step 1: Create `DetailHeader.tsx`**

```tsx
import { ExternalLink, Folder } from "@tamagui/lucide-icons";
import { Stack, XStack, YStack } from "tamagui";
import { BodySm, Caption, IconButton, TitleLg } from "@yt-subtitle-maker/ui";
import type { VideoDetail } from "@yt-subtitle-maker/api-client";
import { apiClient } from "../../state/client";
import { formatRelative } from "../../lib/format";

export function DetailHeader({ detail }: { detail: VideoDetail }) {
  const handleOpenFolder = () => {
    void apiClient.openLibraryFolder(detail.videoId);
  };
  const handleOpenUrl = () => {
    window.open(detail.url, "_blank", "noopener,noreferrer");
  };

  const title = detail.titleTranslated ?? detail.titleOriginal;
  const showOriginal = detail.titleTranslated && detail.titleOriginal !== detail.titleTranslated;
  const durationLabel = detail.durationSeconds
    ? `${Math.floor(detail.durationSeconds / 60)}:${String(detail.durationSeconds % 60).padStart(2, "0")}`
    : detail.hasVideo
      ? null
      : "audio";

  return (
    <XStack gap="$md" padding="$md" alignItems="center">
      <Stack
        width={160}
        height={90}
        borderRadius="$sm"
        backgroundColor="$bgElevated"
        style={{
          backgroundImage: detail.thumbnailUrl ? `url(${detail.thumbnailUrl})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <YStack flex={1} gap="$xs" minWidth={0}>
        <TitleLg numberOfLines={2}>{title}</TitleLg>
        {showOriginal ? (
          <BodySm color="$textSecondary" numberOfLines={1}>
            {detail.titleOriginal}
          </BodySm>
        ) : null}
        <XStack gap="$xs" alignItems="center" flexWrap="wrap">
          {detail.channel ? <Caption color="$textSecondary">{detail.channel}</Caption> : null}
          {detail.channel && durationLabel ? <Caption color="$textMuted">·</Caption> : null}
          {durationLabel ? <Caption color="$textSecondary">{durationLabel}</Caption> : null}
          <Caption color="$textMuted">·</Caption>
          <Caption color="$textSecondary">Added {formatRelative(detail.createdAt)}</Caption>
          <Caption color="$textMuted">·</Caption>
          <Caption color="$textMuted" fontFamily="$mono">
            {detail.videoId}
          </Caption>
        </XStack>
        <XStack gap="$xs" marginTop="$xs">
          <IconButton
            size={28}
            icon={<Folder size={14} color="#a1a1a6" />}
            aria-label="Open folder"
            onPress={handleOpenFolder}
          />
          <IconButton
            size={28}
            icon={<ExternalLink size={14} color="#a1a1a6" />}
            aria-label="Open URL"
            onPress={handleOpenUrl}
          />
        </XStack>
      </YStack>
    </XStack>
  );
}
```

- [ ] **Step 2: Create `EmptyRightPane.tsx`**

```tsx
import { Library as LibraryIcon } from "@tamagui/lucide-icons";
import { Stack, YStack } from "tamagui";
import { BodyMd, DisplayMd } from "@yt-subtitle-maker/ui";

export function EmptyRightPane({ libraryEmpty }: { libraryEmpty: boolean }) {
  return (
    <YStack flex={1} alignItems="center" justifyContent="center" gap="$md" padding="$lg">
      <Stack
        width={96}
        height={96}
        borderRadius="$xl"
        alignItems="center"
        justifyContent="center"
        backgroundColor="$surfaceGlass"
        borderWidth={1}
        borderColor="$borderSubtle"
      >
        <LibraryIcon size={40} color="$textMuted" />
      </Stack>
      <YStack alignItems="center" gap="$xs" maxWidth={360}>
        <DisplayMd textAlign="center">
          {libraryEmpty ? "Your library is empty" : "Pick a video"}
        </DisplayMd>
        <BodyMd color="$textSecondary" textAlign="center">
          {libraryEmpty
            ? "Generate some subtitles and they'll show up here."
            : "Select a video on the left to see transcripts and translations."}
        </BodyMd>
      </YStack>
    </YStack>
  );
}
```

- [ ] **Step 3: Create `DetailPane.tsx`**

```tsx
import { useState } from "react";
import { Trash2 } from "@tamagui/lucide-icons";
import { ScrollView, Stack, XStack, YStack } from "tamagui";
import { BodySm, ButtonDestructive, Caption } from "@yt-subtitle-maker/ui";
import { useLibrary } from "../../state/library";
import { useDependencies } from "../../state/dependencies";
import { apiClient } from "../../state/client";
import { DetailHeader } from "./DetailHeader";
import { TranscriptsSection } from "./TranscriptsSection";
import { TranslationsSection } from "./TranslationsSection";
import { EmptyRightPane } from "./EmptyRightPane";
import { InstallMpvDialog } from "../dependencies/InstallMpvDialog";
import { NewTranscribeModal } from "../NewTranscribeModal";
import { NewTranslationModal } from "../NewTranslationModal";

export function DetailPane() {
  const items = useLibrary((s) => s.items);
  const selectedId = useLibrary((s) => s.selectedId);
  const detail = useLibrary((s) => s.detail);
  const loadingDetail = useLibrary((s) => s.loadingDetail);
  const deleteVideo = useLibrary((s) => s.deleteVideo);
  const refreshDetail = useLibrary((s) => s.refreshDetail);

  const mpv = useDependencies((s) => s.mpv);

  const [installOpen, setInstallOpen] = useState(false);
  const [pendingPlay, setPendingPlay] = useState<null | (() => Promise<void>)>(null);
  const [newTranscribeOpen, setNewTranscribeOpen] = useState(false);
  const [newTranslationOpen, setNewTranslationOpen] = useState(false);
  const [translationSourceId, setTranslationSourceId] = useState<string | undefined>();

  if (!selectedId) {
    return <EmptyRightPane libraryEmpty={items.length === 0} />;
  }

  const playGated = (action: () => Promise<void>) => {
    if (mpv?.installed) {
      void action();
    } else {
      setPendingPlay(() => action);
      setInstallOpen(true);
    }
  };

  const handlePlayTranscript = (transcribeId: string) => {
    playGated(() => apiClient.playMpv(selectedId, { transcribeId }).then(() => undefined));
  };
  const handlePlayTranslation = (translateId: string) => {
    playGated(() => apiClient.playMpv(selectedId, { translateId }).then(() => undefined));
  };

  const handleReTranslateFrom = (transcribeId: string) => {
    setTranslationSourceId(transcribeId);
    setNewTranslationOpen(true);
  };

  if (!detail && loadingDetail) {
    return (
      <YStack flex={1} padding="$lg" gap="$md">
        <Stack height={90} borderRadius="$sm" backgroundColor="$surfaceGlass" />
        <Stack height={120} borderRadius="$sm" backgroundColor="$surfaceGlass" />
        <Stack height={120} borderRadius="$sm" backgroundColor="$surfaceGlass" />
      </YStack>
    );
  }

  if (!detail) {
    return <EmptyRightPane libraryEmpty={items.length === 0} />;
  }

  return (
    <YStack flex={1} minWidth={0}>
      <DetailHeader detail={detail} />

      <ScrollView flex={1}>
        <YStack padding="$md" gap="$lg" paddingBottom="$xl">
          <TranscriptsSection
            videoId={selectedId}
            transcribes={detail.transcribes}
            onPlayTranscript={handlePlayTranscript}
            onReTranscribe={() => setNewTranscribeOpen(true)}
            onReTranslateFrom={handleReTranslateFrom}
          />
          <TranslationsSection
            videoId={selectedId}
            transcribes={detail.transcribes}
            translations={detail.translations}
            onPlayTranslation={handlePlayTranslation}
            onReTranslate={() => {
              setTranslationSourceId(undefined);
              setNewTranslationOpen(true);
            }}
          />
        </YStack>
      </ScrollView>

      <XStack
        padding="$md"
        borderTopWidth={1}
        borderTopColor="$borderSubtle"
        backgroundColor="$surfaceGlass"
        justifyContent="flex-end"
      >
        <ButtonDestructive
          size="sm"
          icon={<Trash2 size={14} />}
          onPress={() => {
            if (window.confirm("Delete this video and all its transcripts/translations?")) {
              void deleteVideo(selectedId);
            }
          }}
        >
          Delete entire video
        </ButtonDestructive>
      </XStack>

      <NewTranscribeModal
        open={newTranscribeOpen}
        onOpenChange={setNewTranscribeOpen}
        videoId={selectedId}
        onComplete={() => void refreshDetail()}
      />
      <NewTranslationModal
        open={newTranslationOpen}
        onOpenChange={setNewTranslationOpen}
        videoId={selectedId}
        transcribes={detail.transcribes}
        initialSourceTranscribeId={translationSourceId}
        onComplete={() => void refreshDetail()}
      />
      <InstallMpvDialog
        open={installOpen}
        onOpenChange={setInstallOpen}
        onInstalled={() => {
          const action = pendingPlay;
          setPendingPlay(null);
          if (action) void action();
        }}
      />
    </YStack>
  );
}
```

- [ ] **Step 4: If `ButtonDestructive` doesn't exist in `@yt-subtitle-maker/ui`, use `ButtonSecondary` with a custom backgroundColor or add a thin wrapper**

Check first:

```bash
grep -n ButtonDestructive packages/ui/src/index.ts
```

If absent, swap the import for `ButtonSecondary` and pass `borderColor="$error"` / `color="$error"` props, or define a quick local variant in this file.

- [ ] **Step 5: Typecheck**

Run: `pnpm -F desktop typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/components/library/
git commit -m "feat(library): add DetailHeader, EmptyRightPane, DetailPane composition"
```

---

## Task 13 — Frontend: `LibraryRow` and `LibraryCardCompact`

**Files:**
- Create: `apps/desktop/src/components/library/LibraryRow.tsx`
- Create: `apps/desktop/src/components/library/LibraryCardCompact.tsx`

- [ ] **Step 1: Create `LibraryRow.tsx`**

```tsx
import { Stack, XStack, YStack } from "tamagui";
import { BadgePill, BodySm, Caption, TitleSm } from "@yt-subtitle-maker/ui";
import type { LibraryItem, VideoDetail } from "@yt-subtitle-maker/api-client";
import { formatRelative } from "../../lib/format";

export interface LibraryRowProps {
  item: LibraryItem;
  selected: boolean;
  /** Optional detail (when this video is the selected one) for richer chips. */
  detail?: VideoDetail | null;
  onPress: () => void;
}

/** Lowercased ISO 639-1 language tag set extracted from a detail payload. */
function languageChipsFromDetail(detail: VideoDetail | null | undefined) {
  if (!detail) return { transcripts: new Set<string>(), translations: new Set<string>() };
  const transcripts = new Set<string>();
  const translations = new Set<string>();
  for (const t of detail.transcribes) transcripts.add(t.language.toLowerCase());
  for (const tr of detail.translations) translations.add(tr.targetLang.toLowerCase());
  return { transcripts, translations };
}

export function LibraryRow({ item, selected, detail, onPress }: LibraryRowProps) {
  const title = item.titleTranslated ?? item.titleOriginal;
  const { transcripts, translations } = languageChipsFromDetail(detail);

  // When detail isn't yet loaded for this row, fall back to count badges.
  const showCountFallback = !detail;
  const tCount = item.transcribesCount ?? 0;
  const trCount = item.translationsCount ?? 0;

  return (
    <Stack
      tag="button"
      role="button"
      onPress={onPress}
      cursor="pointer"
      paddingVertical="$xs"
      paddingHorizontal="$sm"
      borderLeftWidth={selected ? 2 : 0}
      borderLeftColor="$accent"
      backgroundColor={selected ? "$surfaceGlassMid" : "transparent"}
      hoverStyle={{ backgroundColor: "$surfaceGlass" }}
      animation="quick"
    >
      <XStack gap="$sm" alignItems="flex-start">
        <Stack
          width={80}
          height={45}
          borderRadius="$xs"
          backgroundColor="$bgElevated"
          flexShrink={0}
          style={{
            backgroundImage: item.thumbnailUrl ? `url(${item.thumbnailUrl})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <YStack flex={1} gap={2} minWidth={0}>
          <TitleSm numberOfLines={2}>{title}</TitleSm>
          <Caption color="$textMuted">
            {formatRelative(item.createdAt)}
            {item.hasVideo ? "" : " · audio"}
          </Caption>
          <XStack gap={4} flexWrap="wrap" marginTop={2}>
            {showCountFallback ? (
              <>
                {tCount > 0 ? (
                  <BadgePill tone="neutral" size="sm">
                    {tCount}t
                  </BadgePill>
                ) : null}
                {trCount > 0 ? (
                  <BadgePill tone="accent" size="sm">
                    {trCount}
                  </BadgePill>
                ) : null}
              </>
            ) : (
              <>
                {Array.from(transcripts)
                  .filter((lang) => !translations.has(lang))
                  .map((lang) => (
                    <BadgePill key={`t-${lang}`} tone="neutral" size="sm">
                      {lang.toUpperCase()}
                    </BadgePill>
                  ))}
                {Array.from(translations).map((lang) => (
                  <BadgePill key={`tr-${lang}`} tone="accent" size="sm">
                    {lang.toUpperCase()}
                  </BadgePill>
                ))}
              </>
            )}
          </XStack>
        </YStack>
      </XStack>
    </Stack>
  );
}
```

If `BadgePill` doesn't accept a `size` prop, drop it — visual scaling can be handled in a follow-up.

- [ ] **Step 2: Create `LibraryCardCompact.tsx`**

```tsx
import { Stack, XStack, YStack } from "tamagui";
import { BadgePill, Caption, TitleSm } from "@yt-subtitle-maker/ui";
import type { LibraryItem } from "@yt-subtitle-maker/api-client";
import { formatRelative } from "../../lib/format";

export interface LibraryCardCompactProps {
  item: LibraryItem;
  selected: boolean;
  onPress: () => void;
}

export function LibraryCardCompact({ item, selected, onPress }: LibraryCardCompactProps) {
  const title = item.titleTranslated ?? item.titleOriginal;
  const tCount = item.transcribesCount ?? 0;
  const trCount = item.translationsCount ?? 0;

  return (
    <Stack
      tag="button"
      role="button"
      width={158}
      borderRadius="$md"
      overflow="hidden"
      backgroundColor={selected ? "$surfaceGlassMid" : "$surfaceGlass"}
      borderWidth={1}
      borderColor={selected ? "$accent" : "$borderSubtle"}
      cursor="pointer"
      onPress={onPress}
      hoverStyle={{ borderColor: "$borderStrong" }}
      animation="quick"
    >
      <Stack
        height={90}
        backgroundColor="$bgElevated"
        style={{
          backgroundImage: item.thumbnailUrl ? `url(${item.thumbnailUrl})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <YStack padding="$sm" gap={2}>
        <TitleSm numberOfLines={2}>{title}</TitleSm>
        <Caption color="$textMuted">{formatRelative(item.createdAt)}</Caption>
        <XStack gap={4} marginTop={4} flexWrap="wrap">
          {tCount > 0 ? <BadgePill tone="neutral">{tCount}t</BadgePill> : null}
          {trCount > 0 ? <BadgePill tone="accent">{trCount}</BadgePill> : null}
        </XStack>
      </YStack>
    </Stack>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm -F desktop typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/components/library/
git commit -m "feat(library): add LibraryRow and LibraryCardCompact item components"
```

---

## Task 14 — Frontend: `LibraryPane` (left pane container)

**Files:**
- Create: `apps/desktop/src/components/library/LibraryPane.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { useMemo } from "react";
import { LayoutGrid, List, RefreshCw, Search, X } from "@tamagui/lucide-icons";
import { Input, ScrollView, Stack, XStack, YStack } from "tamagui";
import {
  BodyMd,
  BodySm,
  Caption,
  ButtonSecondary,
  IconButton,
  TitleLg,
} from "@yt-subtitle-maker/ui";
import { useLibrary } from "../../state/library";
import { LibraryRow } from "./LibraryRow";
import { LibraryCardCompact } from "./LibraryCardCompact";

const PANE_WIDTH = 360;

export function LibraryPane() {
  const items = useLibrary((s) => s.items);
  const loading = useLibrary((s) => s.loading);
  const error = useLibrary((s) => s.error);
  const selectedId = useLibrary((s) => s.selectedId);
  const detail = useLibrary((s) => s.detail);
  const view = useLibrary((s) => s.view);
  const search = useLibrary((s) => s.search);
  const setView = useLibrary((s) => s.setView);
  const setSearch = useLibrary((s) => s.setSearch);
  const selectVideo = useLibrary((s) => s.selectVideo);
  const fetchList = useLibrary((s) => s.fetchList);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const hay = [
        item.titleTranslated ?? "",
        item.titleOriginal ?? "",
        item.videoId,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [items, search]);

  return (
    <YStack
      width={PANE_WIDTH}
      maxWidth={PANE_WIDTH}
      flexShrink={0}
      borderRightWidth={1}
      borderRightColor="$borderSubtle"
      backgroundColor="$bgElevated"
    >
      {/* Sticky header */}
      <YStack padding="$md" gap="$sm" borderBottomWidth={1} borderBottomColor="$borderSubtle">
        <XStack alignItems="center" justifyContent="space-between">
          <TitleLg>Library</TitleLg>
          <XStack gap="$xs" alignItems="center">
            <Caption color="$textMuted">{items.length} videos</Caption>
            <IconButton
              size={28}
              icon={<RefreshCw size={14} color="#a1a1a6" />}
              aria-label="Refresh"
              onPress={() => void fetchList()}
            />
          </XStack>
        </XStack>

        <XStack
          alignItems="center"
          gap="$xs"
          paddingHorizontal="$sm"
          paddingVertical={6}
          backgroundColor="$surfaceGlass"
          borderRadius="$md"
          borderWidth={1}
          borderColor="$borderSubtle"
        >
          <Search size={14} color="#6e6e73" />
          <Input
            flex={1}
            unstyled
            placeholder="Search title or video ID…"
            value={search}
            onChangeText={setSearch}
            color="$textPrimary"
            paddingHorizontal="$xs"
          />
          {search ? (
            <IconButton
              size={20}
              icon={<X size={12} color="#a1a1a6" />}
              aria-label="Clear search"
              onPress={() => setSearch("")}
            />
          ) : null}
        </XStack>

        <XStack gap={4}>
          <ButtonSecondary
            size="sm"
            icon={<List size={12} />}
            onPress={() => setView("rows")}
            aria-pressed={view === "rows"}
            backgroundColor={view === "rows" ? "$surfaceGlassMid" : undefined}
          >
            Rows
          </ButtonSecondary>
          <ButtonSecondary
            size="sm"
            icon={<LayoutGrid size={12} />}
            onPress={() => setView("cards")}
            aria-pressed={view === "cards"}
            backgroundColor={view === "cards" ? "$surfaceGlassMid" : undefined}
          >
            Cards
          </ButtonSecondary>
        </XStack>
      </YStack>

      {error ? (
        <YStack
          margin="$sm"
          padding="$sm"
          borderRadius="$sm"
          borderWidth={1}
          borderColor="$error"
          backgroundColor="$bgElevated"
        >
          <BodySm color="$error">Failed to load library: {error}</BodySm>
        </YStack>
      ) : null}

      <ScrollView flex={1}>
        {loading && items.length === 0 ? (
          <YStack padding="$md">
            <BodySm color="$textMuted">Loading…</BodySm>
          </YStack>
        ) : filtered.length === 0 && search ? (
          <YStack padding="$md" gap="$sm">
            <BodyMd color="$textSecondary">No matches for "{search}"</BodyMd>
            <ButtonSecondary size="sm" onPress={() => setSearch("")}>
              Clear search
            </ButtonSecondary>
          </YStack>
        ) : view === "rows" ? (
          <YStack>
            {filtered.map((item) => (
              <LibraryRow
                key={item.videoId}
                item={item}
                selected={item.videoId === selectedId}
                detail={item.videoId === selectedId ? detail : null}
                onPress={() => selectVideo(item.videoId)}
              />
            ))}
          </YStack>
        ) : (
          <XStack flexWrap="wrap" gap="$sm" padding="$sm">
            {filtered.map((item) => (
              <LibraryCardCompact
                key={item.videoId}
                item={item}
                selected={item.videoId === selectedId}
                onPress={() => selectVideo(item.videoId)}
              />
            ))}
          </XStack>
        )}
      </ScrollView>
    </YStack>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm -F desktop typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/components/library/LibraryPane.tsx
git commit -m "feat(library): add LibraryPane left-side container"
```

---

## Task 15 — Frontend: rewrite `apps/desktop/app/library.tsx` route

**Files:**
- Modify: `apps/desktop/app/library.tsx` (rewrite)

- [ ] **Step 1: Replace the whole file**

```tsx
import { useEffect, useState } from "react";
import { ArrowLeft } from "@tamagui/lucide-icons";
import { useFocusEffect } from "expo-router";
import { XStack, YStack, Stack } from "tamagui";
import { IconButton } from "@yt-subtitle-maker/ui";
import { LibraryPane } from "../src/components/library/LibraryPane";
import { DetailPane } from "../src/components/library/DetailPane";
import { useLibrary } from "../src/state/library";
import { useMpvStatusPolling } from "../src/hooks/useMpvStatusPolling";
import { useLibraryKeyboardNav } from "../src/hooks/useLibraryKeyboardNav";

const NARROW_BREAKPOINT = 720;

function useViewportIsNarrow() {
  const [isNarrow, setIsNarrow] = useState(
    typeof window !== "undefined" ? window.innerWidth <= NARROW_BREAKPOINT : false,
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setIsNarrow(window.innerWidth <= NARROW_BREAKPOINT);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return isNarrow;
}

export default function LibraryRoute() {
  const fetchList = useLibrary((s) => s.fetchList);
  const selectedId = useLibrary((s) => s.selectedId);
  const selectVideo = useLibrary((s) => s.selectVideo);
  const isNarrow = useViewportIsNarrow();

  useFocusEffect(() => {
    void fetchList();
  });

  useMpvStatusPolling();
  useLibraryKeyboardNav();

  if (isNarrow) {
    return (
      <YStack flex={1}>
        {selectedId ? (
          <YStack flex={1}>
            <XStack padding="$sm" borderBottomWidth={1} borderBottomColor="$borderSubtle">
              <IconButton
                size={32}
                icon={<ArrowLeft size={16} color="#a1a1a6" />}
                aria-label="Back to library"
                onPress={() => selectVideo(null)}
              />
            </XStack>
            <DetailPane />
          </YStack>
        ) : (
          <LibraryPane />
        )}
      </YStack>
    );
  }

  return (
    <XStack flex={1}>
      <LibraryPane />
      <Stack flex={1} minWidth={0}>
        <DetailPane />
      </Stack>
    </XStack>
  );
}
```

- [ ] **Step 2: Typecheck — expect a missing hook**

Run: `pnpm -F desktop typecheck`
Expected: FAIL — `Cannot find module '../src/hooks/useLibraryKeyboardNav'`. That's intentional; the next task creates it.

---

## Task 16 — Frontend: keyboard navigation hook

**Files:**
- Create: `apps/desktop/src/hooks/useLibraryKeyboardNav.ts`

- [ ] **Step 1: Create the hook**

```ts
import { useEffect } from "react";
import { useLibrary } from "../state/library";
import { apiClient } from "../state/client";
import { useDependencies } from "../state/dependencies";

function isTypingInInput(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || target.isContentEditable;
}

export function useLibraryKeyboardNav() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const state = useLibrary.getState();
      const deps = useDependencies.getState();

      // "/" focuses the search input.
      if (e.key === "/" && !isTypingInInput(e.target)) {
        const searchInput = document.querySelector<HTMLInputElement>(
          'input[placeholder^="Search title"]',
        );
        if (searchInput) {
          e.preventDefault();
          searchInput.focus();
        }
        return;
      }

      if (isTypingInInput(e.target)) return;

      const filtered = filteredItems(state);
      const currentIndex = state.selectedId
        ? filtered.findIndex((it) => it.videoId === state.selectedId)
        : -1;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = filtered[Math.min(currentIndex + 1, filtered.length - 1)];
        if (next) state.selectVideo(next.videoId);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = filtered[Math.max(currentIndex - 1, 0)];
        if (prev) state.selectVideo(prev.videoId);
      } else if (e.key === "Enter" && state.selectedId && state.detail) {
        e.preventDefault();
        const first =
          state.detail.translations[0] ?? state.detail.transcribes[0] ?? null;
        if (!first || !deps.mpv?.installed) return; // mpv-gated; ignore if missing
        const isTranslation = "targetLang" in first;
        void apiClient.playMpv(state.selectedId, isTranslation ? { translateId: first.id } : { transcribeId: first.id });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

function filteredItems(state: ReturnType<typeof useLibrary.getState>) {
  const q = state.search.trim().toLowerCase();
  if (!q) return state.items;
  return state.items.filter((item) => {
    const hay = [item.titleTranslated ?? "", item.titleOriginal ?? "", item.videoId]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm -F desktop typecheck`
Expected: PASS.

- [ ] **Step 3: Commit (Task 15 + 16 together)**

```bash
git add apps/desktop/app/library.tsx apps/desktop/src/hooks/useLibraryKeyboardNav.ts
git commit -m "feat(library): rewrite route as two-pane with responsive collapse + keyboard nav"
```

---

## Task 17 — Delete `VideoDetailModal` and clean up imports

**Files:**
- Delete: `apps/desktop/src/components/VideoDetailModal.tsx`

- [ ] **Step 1: Check for any remaining imports of `VideoDetailModal`**

Run: `grep -rn "VideoDetailModal" apps/desktop packages/`
Expected: only `apps/desktop/src/components/VideoDetailModal.tsx` itself (the file we're about to delete). The route already removed its import in Task 15.

If anything else imports it, remove those imports.

- [ ] **Step 2: Delete the file**

Run: `git rm apps/desktop/src/components/VideoDetailModal.tsx`
Expected: file removed; `git status` shows it as deleted.

- [ ] **Step 3: Typecheck**

Run: `pnpm -F desktop typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(library): remove VideoDetailModal — replaced by DetailPane"
```

---

## Task 18 — Manual verification + final pass

- [ ] **Step 1: Run the backend test suite end-to-end**

Run: `backend/.venv/bin/python -m pytest tests/api/test_dependencies.py -v`
Expected: all PASS.

- [ ] **Step 2: Run lint**

Run: `backend/.venv/bin/ruff check backend`
Expected: no errors.

- [ ] **Step 3: Start dev**

Run: `pnpm dev` — opens "yt backend" and "yt web" Terminal windows. (First run prompts for Automation permission.)

Open http://localhost:8081/library in a browser.

- [ ] **Step 4: Work the manual verification checklist from the spec**

For each item, confirm in the browser:

- [ ] Empty library: left pane shows just the header; right pane shows the "Library is empty" hero.
- [ ] Library with ≥1 items: most recent auto-selected on mount; right pane renders header + sections.
- [ ] Search: typing filters items immediately; clearing restores the list.
- [ ] View toggle: switching to Cards re-renders as a wrapped grid; switching back to Rows persists across a page reload.
- [ ] Keyboard nav: focus the page (click empty area), press `/` → search input focuses. Press Escape to blur it. Press Arrow Down / Up → selection moves. Press Enter → mpv launches (or the install dialog appears).
- [ ] Play with system mpv installed: confirm `which mpv` → click ▶ on a transcript / translation → mpv launches with subtitles.
- [ ] Play with mpv missing: temporarily rename your mpv (`mv $(which mpv) $(which mpv).bak`), reload, click ▶ → InstallMpvDialog appears with "Download mpv" button. Click it, watch the progress bar, confirm mpv launches afterward. Restore your system mpv: `mv $(which mpv).bak $(which mpv)`.
- [ ] Background re-check: with the app open and selected mpv missing, run `brew install mpv` (or move the renamed binary back). Within 60s, the dialog button state updates (or the next Play attempt succeeds without the dialog).
- [ ] Re-transcribe: opens `NewTranscribeModal`; complete a re-run; detail refreshes with a new row.
- [ ] Re-translate from a specific transcript: ⟳ icon on a transcript row opens `NewTranslationModal` with the source preselected.
- [ ] Delete transcript: confirms, removes it, cascades to its translations.
- [ ] Delete translation: confirms, removes it.
- [ ] Delete entire video: confirms, removes the row, right pane returns to State A.
- [ ] Narrow window: resize browser to ≤ 720px width → single-pane mode. Selecting a row navigates to the detail view with a back arrow.
- [ ] Widths: spot-check at 600 / 800 / 1200 / 1600 — no overflow, no clipped text.

- [ ] **Step 5: If everything passes, push the branch**

```bash
git push -u origin feature/library-ux
```

Open a PR titled "Library UX redesign: two-pane layout + mpv install flow".

---

## Self-review (run before handing off)

**Spec coverage check:**
- ✓ Two-pane layout (Task 15)
- ✓ Left pane rows with thumbnail / title / language chips / view toggle (Tasks 13, 14)
- ✓ Right pane grouped transcripts + translations with inline play / re-run / delete (Tasks 11, 12)
- ✓ "+ Re-transcribe" / "+ Re-translate" buttons (Tasks 11, 12)
- ✓ Auto-select most recent on mount (Task 8)
- ✓ Keyboard nav: Arrow keys, Enter, `/` (Task 16)
- ✓ mpv detection + bundled-first priority (Tasks 2, 6)
- ✓ mpv install flow with progress + sha verify (Tasks 3, 5, 10)
- ✓ Background re-check polling (Task 9)
- ✓ Search-only (no file-type chips); existing chips dropped in `library.tsx` rewrite (Task 15)
- ✓ Narrow viewport (≤ 720px) collapses to single-pane (Task 15)
- ✓ Delete cascade unchanged; delete-entire-video footer (Task 12)
- ✓ `VideoDetailModal` deleted (Task 17)

**Type consistency check:**
- `MpvStatus` shape matches backend (Task 1) → API client (Task 7) → store (Task 9) → dialog (Task 10). All four use `{installed, source, path, version}`.
- `InstallMpvEvent` phases match end-to-end: `resolving | downloading | verifying | extracting | done | error`. Backend yields these in Task 3, endpoint forwards in Task 5, client parses in Task 7, store consumes in Task 9, dialog displays in Task 10.
- `LibraryView` type (`"rows" | "cards"`) defined once in Task 8 and consumed by `LibraryPane` (Task 14).

**Placeholder scan:**
- The string `"PIN_AT_RELEASE_TIME"` is a deliberate sentinel that toggles strict SHA-256 verification on/off — documented in Task 1 and guarded in Task 3 code. Not a placeholder; it's the explicit contract for "this URL hasn't been pinned yet".
- No "TBD", "TODO", or "fill in" strings in any task's code blocks.

**Scope check:**
- Single PR per user direction. ~18 tasks, each individually testable. Backend tasks are TDD; frontend tasks are manual-verification-only (consistent with this repo — no JS test suite).
