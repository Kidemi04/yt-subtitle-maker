# All-in-One Launcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One command (`pnpm dev`) starts the Tauri desktop window *and* the Python backend together for development; and `pnpm -F desktop tauri:build` produces a self-contained `.app` that launches its own backend.

**Architecture:** The Tauri desktop process becomes the backend's supervisor. Its Rust `setup` hook spawns the backend on window open and kills it on app exit. In a dev build it runs the project venv's `uvicorn … --reload`; in a release build it runs a PyInstaller one-dir binary bundled inside the `.app`. The Expo frontend is still auto-started by Tauri's existing `beforeDevCommand`. The frontend keeps talking to `http://127.0.0.1:8000` unchanged.

**Tech Stack:** Tauri 2.11 (Rust), Expo/React Native Web + Tamagui, FastAPI + uvicorn, PyInstaller, pnpm workspace.

**Spec:** `docs/superpowers/specs/2026-05-12-all-in-one-launcher-design.md`

**Deviation from spec (intentional simplification):** the spec mentioned `tauri-plugin-shell` + `bundle.externalBin`. This plan instead uses the Rust std library's `std::process::Command` + `bundle.resources`. Same behaviour (Tauri supervises the backend, dev = venv uvicorn, release = PyInstaller binary, killed on exit) with fewer moving parts — no plugin, no capability files, no target-triple-named binaries.

---

## Prerequisites (one-time, on the implementing machine)

- **Rust toolchain** — required to build/run anything Tauri. `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh` then restart the shell. Verify: `rustc --version`.
- **Python 3.11, 3.12, or 3.13** (NOT 3.14 — PyTorch has no 3.14 wheels yet). Verify one is available, e.g. `python3.12 --version`.
- **Node ≥ 20 and pnpm ≥ 10** — already present.
- **System tools** (runtime deps the app probes for, not built by this plan): `brew install ffmpeg mpv`.

## File map

Stage 1 (one-command dev):
- Create `scripts/setup-backend.sh` — creates `backend/.venv` and installs `backend[dev]`.
- Modify `package.json` (root) — remap `dev` script.
- Rename/split `apps/desktop/src-tauri/src/main.rs` → thin `main.rs` + new `apps/desktop/src-tauri/src/lib.rs` (Tauri-2 convention; holds the backend-spawn logic).
- Modify `apps/desktop/src-tauri/Cargo.toml` — add `[lib]` section.
- Modify `.gitignore` — ignore the PyInstaller output dirs.

Stage 2 (self-contained packaged app):
- Create `backend/packaging/run_backend.py` — PyInstaller entrypoint (`uvicorn.run(app, …)`).
- Create `backend/packaging/backend.spec` — PyInstaller spec (one-dir).
- Modify `backend/pyproject.toml` — add `pyinstaller` to `dev` extras; pin `requires-python = ">=3.11,<3.14"`.
- Modify `apps/desktop/package.json` — add `build:backend` script; make `tauri:build` run it first.
- Modify `apps/desktop/src-tauri/tauri.conf.json` — add `bundle.resources`.
- Modify `apps/desktop/src-tauri/src/lib.rs` — add the release-build branch.
- Create `apps/desktop/src-tauri/backend-dist/.gitkeep` — keeps the resources dir present so `tauri dev` doesn't complain about a missing resource path.

## Note on testing

This work is process/IO/build glue — there is no meaningful unit surface. Each task ends with a concrete verification command and its expected output; that is the test. Run `pytest` once at the end to confirm the backend package still imports cleanly after the `pyproject.toml` edit.

---

# Stage 1 — one-command dev

### Task 1: Backend venv bootstrap script

**Files:**
- Create: `scripts/setup-backend.sh`

- [ ] **Step 1: Write the script**

```bash
#!/usr/bin/env bash
# Create the backend virtualenv and install its dependencies.
# Requires Python 3.11, 3.12, or 3.13 (NOT 3.14 — PyTorch has no 3.14 wheels yet).
# Override the interpreter with PYTHON=, e.g.  PYTHON=python3.12 scripts/setup-backend.sh
set -euo pipefail

cd "$(dirname "$0")/.."            # repo root
PYTHON="${PYTHON:-python3}"

ver="$("$PYTHON" -c 'import sys; print("%d.%d" % sys.version_info[:2])')"
case "$ver" in
  3.11|3.12|3.13) ;;
  *)
    echo "Error: Python $ver detected. Need 3.11, 3.12, or 3.13 (PyTorch lacks 3.14 wheels)." >&2
    echo "Install one and re-run, e.g.:  PYTHON=python3.12 scripts/setup-backend.sh" >&2
    exit 1
    ;;
esac

echo "Creating backend/.venv with Python $ver…"
"$PYTHON" -m venv backend/.venv
backend/.venv/bin/python -m pip install --upgrade pip
backend/.venv/bin/python -m pip install -e "backend[dev]"
echo
echo "✓ Backend venv ready at backend/.venv"
echo "  Start everything with:  pnpm dev"
```

- [ ] **Step 2: Make it executable**

Run: `chmod +x scripts/setup-backend.sh`

- [ ] **Step 3: Run it**

Run: `PYTHON=python3.12 scripts/setup-backend.sh` (use whichever 3.11–3.13 you have)
Expected: ends with `✓ Backend venv ready at backend/.venv`. (First run downloads PyTorch — large; may take a few minutes.)

- [ ] **Step 4: Verify the venv works**

Run: `backend/.venv/bin/python -m uvicorn --version`
Expected: prints a uvicorn version line, no error.

Run: `cd backend && ../backend/.venv/bin/python -c "import api.main; print(api.main.app.title)" && cd ..`
Expected: `yt-subtitle-maker API`

- [ ] **Step 5: Commit**

```bash
git add scripts/setup-backend.sh
git commit -m "feat(scripts): setup-backend.sh — one-command backend venv bootstrap"
```

---

### Task 2: Remap root `pnpm dev` to the Tauri dev command

**Files:**
- Modify: `package.json` (repo root)

- [ ] **Step 1: Edit the `scripts` block**

Change the `dev` line. Final `scripts` block:

```json
  "scripts": {
    "dev": "pnpm -F desktop tauri:dev",
    "web": "pnpm -F desktop web",
    "build": "pnpm -F desktop build"
  },
```

(Only `dev` changes: was `pnpm -F desktop dev`.)

- [ ] **Step 2: Verify**

Run: `node -e "console.log(require('./package.json').scripts.dev)"`
Expected: `pnpm -F desktop tauri:dev`

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: pnpm dev now launches the Tauri window (was Expo web only)"
```

---

### Task 3: Split `main.rs` into `main.rs` + `lib.rs` (no behaviour change yet)

This is a pure refactor to the standard Tauri-2 layout, so the next task can put the spawn logic in `lib.rs`. After this task the app must still build and run exactly as before.

**Files:**
- Modify: `apps/desktop/src-tauri/Cargo.toml`
- Modify: `apps/desktop/src-tauri/src/main.rs`
- Create: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Add a `[lib]` section to `Cargo.toml`**

Insert after the `[package]` block (before `[build-dependencies]`):

```toml
[lib]
name = "yt_subtitle_desktop_lib"
crate-type = ["staticlib", "cdylib", "rlib"]
```

- [ ] **Step 2: Create `src/lib.rs`**

```rust
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 3: Replace `src/main.rs` with a thin shim**

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    yt_subtitle_desktop_lib::run();
}
```

- [ ] **Step 4: Build the Rust crate**

Run: `cd apps/desktop/src-tauri && cargo build && cd -`
Expected: `Finished` with no errors. (First build pulls Tauri crates — slow.)

- [ ] **Step 5: Smoke-run the app**

Run (from repo root, after `pnpm install` if not done yet): `pnpm dev`
Expected: Expo bundles, the Tauri window opens showing the app UI (frontend will report it can't reach the backend — that's fine; we add it next). Quit the window.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src-tauri/Cargo.toml apps/desktop/src-tauri/src/main.rs apps/desktop/src-tauri/src/lib.rs
git commit -m "refactor(tauri): split main.rs into main + lib (no behaviour change)"
```

---

### Task 4: Spawn (and reap) the backend from the Tauri setup hook

**Files:**
- Modify: `apps/desktop/src-tauri/src/lib.rs`
- Modify: `.gitignore`

- [ ] **Step 1: Replace `src/lib.rs` with the full version**

```rust
use std::process::{Child, Command};
use std::sync::Mutex;

use tauri::{Manager, RunEvent};

/// Holds the spawned Python backend so it can be killed when the app exits.
struct BackendProcess(Mutex<Option<Child>>);

/// Spawn the FastAPI backend on 127.0.0.1:8000.
///
/// Debug build  → `<repo>/backend/.venv/bin/python -m uvicorn api.main:app --reload`, cwd `<repo>/backend`.
/// Release build → the bundled PyInstaller binary under `Resources/backend-dist/` (wired in a later task).
#[allow(unused_variables)]
fn spawn_backend(app: &tauri::AppHandle) -> std::io::Result<Child> {
    #[cfg(debug_assertions)]
    {
        // CARGO_MANIFEST_DIR is `<repo>/apps/desktop/src-tauri`, baked in at compile time.
        let repo_root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("..")
            .join("..");
        let backend_dir = repo_root.join("backend");
        let python = backend_dir.join(".venv").join("bin").join("python");
        if !python.exists() {
            eprintln!(
                "[backend] {} not found — run `scripts/setup-backend.sh` first. \
                 Starting the app without a backend.",
                python.display()
            );
            return Err(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                "backend venv missing",
            ));
        }
        eprintln!("[backend] starting (dev): {} -m uvicorn …", python.display());
        Command::new(python)
            .args([
                "-m", "uvicorn", "api.main:app",
                "--host", "127.0.0.1", "--port", "8000", "--reload",
            ])
            .current_dir(&backend_dir)
            .spawn()
    }

    #[cfg(not(debug_assertions))]
    {
        let resource_dir = app.path().resource_dir().map_err(|e| {
            std::io::Error::new(std::io::ErrorKind::NotFound, e.to_string())
        })?;
        let bin_dir = resource_dir.join("backend-dist");
        let exe = bin_dir.join("yt-subtitle-backend");
        eprintln!("[backend] starting (release): {}", exe.display());
        Command::new(exe).current_dir(&bin_dir).spawn()
    }
}

pub fn run() {
    tauri::Builder::default()
        .manage(BackendProcess(Mutex::new(None)))
        .setup(|app| {
            match spawn_backend(app.handle()) {
                Ok(child) => {
                    *app.state::<BackendProcess>().0.lock().unwrap() = Some(child);
                }
                Err(e) => eprintln!("[backend] failed to start: {e}"),
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let RunEvent::Exit = event {
                if let Some(mut child) =
                    app_handle.state::<BackendProcess>().0.lock().unwrap().take()
                {
                    let _ = child.kill();
                    let _ = child.wait();
                }
            }
        });
}
```

- [ ] **Step 2: Add the PyInstaller output dirs to `.gitignore`**

Append at the end of `.gitignore`:

```gitignore
# All-in-one launcher (PyInstaller output bundled into the Tauri app)
apps/desktop/src-tauri/backend-dist/*
!apps/desktop/src-tauri/backend-dist/.gitkeep
apps/desktop/src-tauri/.pyinstaller-work/
```

- [ ] **Step 3: Build**

Run: `cd apps/desktop/src-tauri && cargo build && cd -`
Expected: `Finished`, no errors (warnings about the unused `app` param in debug are fine — suppressed by `#[allow(unused_variables)]`).

- [ ] **Step 4: Run the full stack**

Run: `pnpm dev`
Expected: console shows `[backend] starting (dev): …`, then uvicorn's `Application startup complete.` (torch import makes this take ~5–15 s), then the Tauri window shows the app connected to the backend.

In another terminal while it's running:
Run: `curl -s http://127.0.0.1:8000/api/version`
Expected: a JSON object (e.g. `{"version":"2.0.0a1", ...}` — exact shape per `backend/api/routes/version.py`).

- [ ] **Step 5: Verify no orphan after quit**

Quit the Tauri window, then run: `pgrep -fl 'uvicorn|api.main' || echo "clean"`
Expected: `clean` (no surviving backend process).

- [ ] **Step 6: Verify the missing-venv path**

Run: `mv backend/.venv backend/.venv.bak && pnpm dev`
Expected: console prints `[backend] … run \`scripts/setup-backend.sh\` first …`, the window still opens, frontend shows a "can't connect" state. Quit, then: `mv backend/.venv.bak backend/.venv`.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src-tauri/src/lib.rs .gitignore
git commit -m "feat(tauri): supervise the Python backend — spawn on launch, kill on exit"
```

---

**Stage 1 is complete and independently shippable here:** `scripts/setup-backend.sh` once, then `pnpm dev` runs everything. Stage 2 makes the *packaged* app self-contained.

---

# Stage 2 — self-contained packaged app

### Task 5: Backend dependency + metadata updates for packaging

**Files:**
- Modify: `backend/pyproject.toml`

- [ ] **Step 1: Edit `backend/pyproject.toml`**

Change `requires-python` and add `pyinstaller` to the `dev` extras. Resulting relevant sections:

```toml
[project]
name = "yt-subtitle-maker-backend"
version = "2.0.0a1"
description = "Backend for yt-subtitle-maker (FastAPI + modular core)"
requires-python = ">=3.11,<3.14"
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.30",
    "pydantic>=2.7",
    "pydantic-settings>=2.5",
    "openai-whisper>=20231117",
    "yt-dlp>=2024.10",
    "openai>=1.50",
    "google-genai>=0.3",
    "torch>=2.1",
    "numpy",
    "requests>=2.32",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "pytest-asyncio>=0.24",
    "httpx>=0.27",
    "ruff>=0.6",
    "pyinstaller>=6.6",
]
```

- [ ] **Step 2: Install the new dev dep into the existing venv**

Run: `backend/.venv/bin/python -m pip install -e "backend[dev]"`
Expected: installs `pyinstaller` (and confirms the rest are up to date).

- [ ] **Step 3: Verify**

Run: `backend/.venv/bin/pyinstaller --version`
Expected: prints a version `>= 6.6`.

- [ ] **Step 4: Commit**

```bash
git add backend/pyproject.toml
git commit -m "build(backend): add pyinstaller dev dep; cap python <3.14"
```

---

### Task 6: PyInstaller entrypoint script

**Files:**
- Create: `backend/packaging/run_backend.py`

- [ ] **Step 1: Write the entrypoint**

```python
"""PyInstaller entrypoint for the bundled backend.

Built into the `yt-subtitle-backend` executable by `packaging/backend.spec`.
Equivalent to `uvicorn api.main:app --host 127.0.0.1 --port 8000` but as a
frozen binary with no reloader.
"""
from __future__ import annotations

import uvicorn

from api.main import app

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
```

- [ ] **Step 2: Verify it runs against the dev venv**

Run: `cd backend && ../backend/.venv/bin/python packaging/run_backend.py &` then (after ~10 s) `curl -s http://127.0.0.1:8000/api/version`
Expected: JSON version object. Then: `kill %1 ; cd ..`

- [ ] **Step 3: Commit**

```bash
git add backend/packaging/run_backend.py
git commit -m "feat(backend): packaging/run_backend.py — frozen-binary entrypoint"
```

---

### Task 7: PyInstaller spec + `build:backend` script

**Files:**
- Create: `backend/packaging/backend.spec`
- Create: `apps/desktop/src-tauri/backend-dist/.gitkeep`
- Modify: `apps/desktop/package.json`

- [ ] **Step 1: Write `backend/packaging/backend.spec`**

```python
# PyInstaller spec for the yt-subtitle-maker backend (one-dir bundle).
# Build (run from the `backend/` directory, with the venv active or via .venv/bin/pyinstaller):
#   pyinstaller packaging/backend.spec --noconfirm
# Produces dist/backend-dist/  (executable: dist/backend-dist/yt-subtitle-backend).
from PyInstaller.utils.hooks import collect_all, collect_submodules

datas, binaries, hiddenimports = [], [], []
for pkg in ("whisper", "torch", "yt_dlp", "google", "uvicorn"):
    d, b, h = collect_all(pkg)
    datas += d
    binaries += b
    hiddenimports += h

hiddenimports += collect_submodules("uvicorn")
hiddenimports += [
    "api.main",
    "uvicorn.lifespan.on",
    "uvicorn.lifespan.off",
    "uvicorn.loops.auto",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.logging",
]

a = Analysis(
    ["packaging/run_backend.py"],
    pathex=["."],            # so `import api` / `import core` resolve (run from backend/)
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    excludes=["tkinter"],
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="yt-subtitle-backend",
    console=True,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    name="backend-dist",
)
```

- [ ] **Step 2: Create the placeholder so the resources dir always exists**

Run: `mkdir -p apps/desktop/src-tauri/backend-dist && touch apps/desktop/src-tauri/backend-dist/.gitkeep`

- [ ] **Step 3: Add the `build:backend` script to `apps/desktop/package.json`**

Add to the `scripts` block (keep the rest as-is). The script runs from `apps/desktop/` (pnpm sets cwd to the package dir):

```json
  "scripts": {
    "dev": "expo start --web --port 8081",
    "web": "expo start --web --port 8081",
    "build": "expo export --platform web --output-dir dist",
    "build:backend": "rm -rf src-tauri/backend-dist && ../../backend/.venv/bin/pyinstaller --noconfirm --distpath src-tauri --workpath src-tauri/.pyinstaller-work ../../backend/packaging/backend.spec",
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "pnpm build:backend && tauri build",
    "typecheck": "tsc --noEmit"
  },
```

Notes for the implementer:
- `pyinstaller` is invoked with the spec path `../../backend/packaging/backend.spec`; because `pathex=["."]` in the spec is resolved relative to PyInstaller's cwd, the build must effectively treat `backend/` as the source root — pass the spec path but keep `pathex` pointing at `backend/`. If `import api` fails during the build, change the spec's `pathex` to an absolute path: `pathex=[os.path.abspath(os.path.join(os.path.dirname(SPEC), ".."))]` (and `import os` at the top of the spec).
- `--distpath src-tauri` makes PyInstaller write the COLLECT output to `src-tauri/backend-dist/` (the `COLLECT(name="backend-dist")`), which is exactly where `tauri.conf.json` will pick it up in the next task.

- [ ] **Step 4: Build the backend bundle**

Run (from repo root): `pnpm -F desktop build:backend`
Expected: PyInstaller finishes; `apps/desktop/src-tauri/backend-dist/yt-subtitle-backend` exists and is executable. (This is large — torch alone is ~2 GB. Takes several minutes.)

Run: `test -x apps/desktop/src-tauri/backend-dist/yt-subtitle-backend && echo OK`
Expected: `OK`

- [ ] **Step 5: Smoke-test the frozen backend standalone**

Run: `(cd apps/desktop/src-tauri/backend-dist && ./yt-subtitle-backend &) ; sleep 12 ; curl -s http://127.0.0.1:8000/api/version ; pkill -f yt-subtitle-backend`
Expected: a JSON version object printed before the `pkill`. If you instead see a `ModuleNotFoundError`, add the named module to `hiddenimports` in `backend.spec` and rebuild.

- [ ] **Step 6: Commit**

```bash
git add backend/packaging/backend.spec apps/desktop/src-tauri/backend-dist/.gitkeep apps/desktop/package.json
git commit -m "feat(packaging): PyInstaller spec + build:backend script"
```

---

### Task 8: Bundle the backend into the Tauri app + release-build branch

The Rust release branch already exists (added in Task 4). This task makes `tauri build` copy `backend-dist/` into the `.app` and verifies the resolved path matches what `spawn_backend` expects in release.

**Files:**
- Modify: `apps/desktop/src-tauri/tauri.conf.json`

- [ ] **Step 1: Add `resources` to the `bundle` block of `tauri.conf.json`**

```json
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": ["icons/icon.png"],
    "resources": {
      "backend-dist/": "backend-dist/"
    }
  }
```

(The key `backend-dist/` is resolved relative to `tauri.conf.json`, i.e. `apps/desktop/src-tauri/backend-dist/`; it lands in the bundle at `Contents/Resources/backend-dist/`, which is `app.path().resource_dir().join("backend-dist")` at runtime — matching `spawn_backend`'s release branch.)

- [ ] **Step 2: Sanity-check the dev path is still resolvable after this change**

Run: `pnpm dev`
Expected: dev still works exactly as in Task 4 (dev build ignores `bundle.resources`). `curl -s http://127.0.0.1:8000/api/version` returns JSON. Quit.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src-tauri/tauri.conf.json
git commit -m "feat(tauri): bundle the PyInstaller backend as an app resource"
```

---

### Task 9: Full release build + end-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Build the app**

Run (from repo root): `pnpm -F desktop tauri:build`
Expected: runs `build:backend` (PyInstaller), then `expo export`, then Tauri bundling; finishes with paths to the produced artifacts under `apps/desktop/src-tauri/target/release/bundle/` (a `.app` under `macos/` and a `.dmg` under `dmg/`).

- [ ] **Step 2: Confirm the backend is inside the bundle**

Run: `ls "apps/desktop/src-tauri/target/release/bundle/macos/yt-subtitle-maker.app/Contents/Resources/backend-dist/yt-subtitle-backend"`
Expected: the path exists.

- [ ] **Step 3: Launch the packaged app from a clean shell**

Run: `open "apps/desktop/src-tauri/target/release/bundle/macos/yt-subtitle-maker.app"`
Expected: the window opens; within ~10–15 s the frontend shows it's connected.

Run: `curl -s http://127.0.0.1:8000/api/version`
Expected: JSON version object.

- [ ] **Step 4: End-to-end job + no-orphan check**

In the running app: paste a short YouTube URL, run a transcription (use the smallest Whisper model; download it via the Init screen if prompted), confirm an `.srt` is produced.
Then quit the app and run: `pgrep -fl 'yt-subtitle-backend|uvicorn' || echo "clean"`
Expected: `clean`.

- [ ] **Step 5: Backend package still imports cleanly (regression)**

Run: `backend/.venv/bin/python -m pytest`
Expected: the existing suite passes (no collection errors from the `pyproject.toml` change).

- [ ] **Step 6: Commit (docs/changelog only, if any)**

If you updated `README.md` or a changelog as part of this task, commit it:

```bash
git add README.md
git commit -m "docs: document pnpm dev / tauri build all-in-one workflow"
```

(If no doc changes, skip — there's nothing to commit for a verification-only task.)

---

## Self-review checklist (done by plan author)

- **Spec coverage:** Stage 1 = Tasks 1–4 (setup script, `pnpm dev` remap, lib split, supervise backend). Stage 2 = Tasks 5–9 (pyinstaller dep, entrypoint, spec+build script, bundle into app, e2e). Error-handling cases from the spec: missing venv (Task 4 Step 6), port busy (uvicorn stderr surfaces via inherited stdio), backend crash (no auto-restart — documented in spec "out of scope"), orphan-free exit (Task 4 Step 5, Task 9 Step 4). "Not bundled" items (Whisper models, ffmpeg/mpv) are unchanged by this plan — covered in Prerequisites. ✓
- **Placeholders:** none — every code/config step shows full content; the one "if it fails, adjust" notes (hiddenimports, pathex) are real PyInstaller iteration guidance, not deferred work. ✓
- **Type/name consistency:** `BackendProcess`, `spawn_backend`, `backend-dist` dir name, `yt-subtitle-backend` exe name, port `8000`, crate lib name `yt_subtitle_desktop_lib` — used consistently across Tasks 3, 4, 7, 8. The `COLLECT(name="backend-dist")` + `--distpath src-tauri` + `tauri.conf.json` `resources` key + Rust `resource_dir.join("backend-dist")` all line up. ✓
