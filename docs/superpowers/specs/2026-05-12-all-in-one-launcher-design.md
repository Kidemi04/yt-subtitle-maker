# All-in-One Launcher — Design

**Date:** 2026-05-12
**Branch:** v2.0
**Status:** Approved (pending spec review)

## Context

On the `v2.0` branch the project is split into a Python FastAPI backend (`backend/`)
and an Expo + Tamagui frontend wrapped in a Tauri 2 desktop shell (`apps/desktop/`).
Today, running the app means starting two things by hand: `uvicorn api.main:app`
in one terminal and `pnpm -F desktop tauri:dev` in another. The user wants a single
command for development, and — separately — wants the *shipped* `.app`/`.dmg` to be
self-contained so end users don't run anything manually either.

`tauri dev` already auto-starts the Expo web frontend via `beforeDevCommand: "pnpm web"`
in `tauri.conf.json`, so the only missing piece is the Python backend. The chosen
approach makes the Tauri process the single supervisor for the backend in **both** dev
and production, using the same wiring.

## Approach

The Tauri desktop process owns the backend's lifecycle. On window open, Tauri's Rust
`setup` hook spawns the backend; on window close / app exit / crash, Tauri kills it —
no orphaned `uvicorn`, no second terminal. The frontend keeps talking to
`http://127.0.0.1:8000` exactly as it does now (`apps/desktop/src/state/client.ts`
unchanged). The backend process is resolved per build:

- **Dev build** (`tauri dev`): runs the project venv's
  `uvicorn api.main:app --port 8000 --reload`, `cwd = backend/`. Python hot-reload preserved.
- **Release build** (`tauri build`): runs a self-contained PyInstaller binary bundled
  inside the `.app` as a Tauri sidecar.

Delivered in two stages.

### Stage 1 — one-command dev

Command: `pnpm dev` (root). Currently `pnpm dev` → `pnpm -F desktop dev` (Expo web only);
remap it to `pnpm -F desktop tauri:dev` (native window + backend). Keep `pnpm web` for the
browser-only path.

Changes:

- **`package.json`** (root) — `"dev": "pnpm -F desktop tauri:dev"`.
- **`apps/desktop/src-tauri/Cargo.toml`** — add `tauri-plugin-shell` (Tauri 2's mechanism
  for spawning/managing child processes / sidecars).
- **`apps/desktop/src-tauri/src/main.rs`** — split into `lib.rs` + thin `main.rs` (Tauri 2
  convention). Register `tauri-plugin-shell`. Add a `setup` hook that:
  - resolves the backend command (dev: venv uvicorn; release: bundled sidecar — see Stage 2),
  - spawns it, stashes the child handle in Tauri-managed app state,
  - streams the child's stdout/stderr into the Tauri console so backend + frontend logs
    interleave,
  - on window `Destroyed` event (and via a drop guard) kills the child.
- **`apps/desktop/src-tauri/capabilities/default.json`** — new file; grant the shell plugin
  permission to run exactly the backend command (no broad shell access).
- **`apps/desktop/src-tauri/tauri.conf.json`** — `beforeDevCommand` stays `pnpm web`.
- **`scripts/setup-backend.sh`** — new; creates `backend/.venv` (Python 3.12/3.13 — *not*
  3.14, no PyTorch wheels yet) and runs `pip install -e "backend[dev]"`. One-command backend bootstrap.
- The Rust hook prints a clear, actionable error if `backend/.venv/bin/uvicorn` is missing
  ("run `scripts/setup-backend.sh` first") and lets the app open anyway.

Port: fixed at `8000` (matches the hardcoded client URL). Dynamic free-port selection +
injecting it into the frontend is explicitly **out of scope** for this iteration.

### Stage 2 — self-contained packaged app

- **`backend/pyproject.toml`** — add `pyinstaller` to the `dev` extras.
- **`backend/packaging/backend.spec`** — new PyInstaller spec. Produces a **one-dir** bundle
  (not one-file: PyTorch is ~2 GB; one-file unpacks to temp on every launch). Executable
  named per Tauri's sidecar convention: `yt-subtitle-backend-<target-triple>`
  (e.g. `yt-subtitle-backend-aarch64-apple-darwin`).
- **`apps/desktop/package.json`** — add `"build:backend"` script: runs PyInstaller, drops
  output in `apps/desktop/src-tauri/bin/`. Chain it before `tauri build` (alongside the
  existing `pnpm build` in `beforeBuildCommand`).
- **`apps/desktop/src-tauri/tauri.conf.json`** — `bundle.externalBin: ["bin/yt-subtitle-backend"]`
  so Tauri folds the binary into the `.app`.
- **`apps/desktop/src-tauri/src/lib.rs`** — the `setup` hook branches on
  `cfg!(debug_assertions)`: debug → venv uvicorn; release → the bundled sidecar via
  `tauri_plugin_shell`. Lifecycle handling is identical to Stage 1.

**Not bundled (runtime-acquired, unchanged from today):**

- **Whisper models** — too big (turbo ≈ 1.5 GB). Stays as the runtime download the Init
  screen already performs (`core/dependency_manager.py` → `/api/dependencies/install`),
  into the user cache dir.
- **ffmpeg / mpv** — remain external system tools. The app already probes for them
  (`core/dependency_manager.py`: `check_ffmpeg`, `check_mpv`) and the Init screen surfaces
  their status. Documented prereq: `brew install ffmpeg mpv`. (Bundling ffmpeg is a possible
  later add — out of scope.)

## Error handling

- **Venv missing (dev)** — Rust hook detects no `backend/.venv/bin/uvicorn`, logs
  "run `scripts/setup-backend.sh` first", app still opens; frontend already degrades to a
  "can't connect to backend" state (`apps/desktop/src/state/logs.ts`).
- **Port 8000 busy** — uvicorn exits non-zero; hook surfaces its stderr to the console.
  (Auto-port-picking deferred.)
- **Backend crashes while running** — child exit is logged; frontend degrades to disconnected.
  No auto-restart in this iteration.
- **App exit / crash** — window `Destroyed` handler + drop guard kill the child; no orphan
  `uvicorn`/`python` process survives.

## Verification

1. **Dev:** fresh clone → `scripts/setup-backend.sh` → `pnpm install` → `pnpm dev`. Confirm:
   window opens; `curl http://127.0.0.1:8000/api/version` responds; a small transcription job
   runs end-to-end via the UI; quitting the window leaves no backend process
   (`pgrep -fl 'uvicorn|api.main'` is empty).
2. **Packaged:** `pnpm -F desktop build:backend` → `pnpm -F desktop tauri:build`; launch the
   produced `.app` (on a machine / shell with no dev env on PATH); repeat the version /
   transcription / no-orphan checks.
3. **Unit-ish:** Rust path-resolution logic (dev venv path vs release resource path) gets
   direct tests where practical. The bulk of verification is the manual e2e above since this
   is process/IO glue.

## Out of scope

- Dynamic backend port selection + injecting it into the frontend.
- Auto-restart of a crashed backend.
- Bundling ffmpeg/mpv into the app.
- Windows/Linux packaging specifics (design is macOS-first; the sidecar mechanism is
  cross-platform but target triples and prereq install commands differ).
