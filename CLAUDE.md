# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A desktop app that downloads YouTube audio, transcribes it locally with OpenAI Whisper, and (optionally) translates the subtitles with Google Gemini (or any OpenAI-compatible API), producing `.srt` files. It's a **pnpm monorepo**:

- `backend/` — Python FastAPI service + the actual pipeline (download → STT → translate → write SRT). Always serves on `127.0.0.1:8000`.
- `apps/desktop/` — Expo SDK 51 + Expo Router + Tamagui + react-native-web frontend, rendered inside a Tauri 2 desktop window (`apps/desktop/src-tauri/`).
- `packages/api-client` — typed TS client + types mirroring the backend (`@yt-subtitle-maker/api-client`).
- `packages/ui` — Tamagui design-system components + tokens (`@yt-subtitle-maker/ui`).

The active branch is `v2.1`. (`main` is the abandoned v1 PySide/Flutter app; `v1.5`/`v2.0` are older.) **`README.md` is stale** — it describes the old Flutter architecture; don't trust it. The `flutter_gui/` directory in the working tree is leftover v1 cruft, not part of this app.

## Setup

Python **must be 3.11–3.13** — PyTorch has no 3.14 wheels yet (`requires-python = ">=3.11,<3.14"`). On this machine `python3` is 3.14, so pass `python3.12` explicitly.

```bash
PYTHON=python3.12 scripts/setup-backend.sh   # creates backend/.venv, installs backend[dev] (downloads ~2 GB of PyTorch — slow)
pnpm install                                  # frontend / monorepo deps
```

Other prerequisites (already installed here): Node ≥20, pnpm ≥10, Rust (`rustup` — needed for anything Tauri), `ffmpeg` + `mpv` (`brew`; Whisper needs ffmpeg, mpv is for the "play with subtitles" feature), a JS runtime (`deno` or `node` — yt-dlp needs it to deobfuscate YouTube; auto-detected).

## Commands

| Task | Command |
|---|---|
| **Dev (default)** — opens two macOS Terminal windows: "yt backend" (uvicorn `--reload`, :8000) + "yt web" (Expo web, :8081); open http://localhost:8081 in a browser. No native window. | `pnpm dev` |
| Dev with the native Tauri app window (Tauri spawns + supervises the backend, all logs in one terminal) | `pnpm -F desktop tauri:dev` |
| Just the web UI in a browser (no backend) | `pnpm web` → http://localhost:8081 |
| Backend only (manual) | `cd backend && ../backend/.venv/bin/python -m uvicorn api.main:app --host 127.0.0.1 --port 8000 --reload` |
| Build the packaged app (`.app` + `.dmg`) | `pnpm -F desktop tauri:build` → `apps/desktop/src-tauri/target/release/bundle/{macos,dmg}/` |
| Rebuild just the PyInstaller backend bundle | `pnpm -F desktop build:backend` → `apps/desktop/src-tauri/backend-dist/` |
| Backend tests (all) | `backend/.venv/bin/python -m pytest` |
| Backend tests (one) | `backend/.venv/bin/python -m pytest tests/api/test_process.py::test_name -v` |
| Backend lint | `backend/.venv/bin/ruff check backend` (config in `backend/pyproject.toml`: line-length 100, rules E/F/I/B/UP/SIM) |
| Frontend typecheck | `pnpm -F desktop typecheck` |
| Build the Rust crate directly | `source "$HOME/.cargo/env" && cd apps/desktop/src-tauri && cargo build` |

Notes:
- `cargo`/`rustc`/`tauri` are **not on PATH in non-interactive shells** — `source "$HOME/.cargo/env"` first (it's in the user's `~/.zshrc`/`~/.zprofile`/`~/.zshenv` for interactive shells).
- `pnpm dev` runs `scripts/dev.sh`, which uses `osascript` to open Terminal.app windows — macOS-only, and the **first run prompts for Automation permission** ("Terminal wants to control Terminal" → Allow). It writes `/tmp/yt-subtitle-dev-{backend,web}.command` files with your `PATH` baked in, and skips opening the backend window if `:8000` is already taken.
- pytest config (`pytest.ini`): `testpaths = tests`, `pythonpath = backend` (so `import api` / `import core` work). There's no JS test suite.
- Tauri-side rebuilds: don't run `pnpm -F desktop build:backend` and `cargo build`/`tauri build` concurrently — `tauri build` enumerates every file under `backend-dist/` and races with the PyInstaller rewrite. `tauri:build` runs them in sequence (`build:backend && tauri build`).

## Architecture — the big picture

### Backend (`backend/`) — thin routes over a `core/` library
`backend/api/main.py` is the FastAPI app; it just wires the routers in `backend/api/routes/` (`metadata`, `process`, `translator`, `version`, `config`, `dependencies`, `library`, `history`, `cookies`). Routes are intentionally thin — all real work is in `backend/core/`:

- **`core/pipeline.py`** — the single orchestrator (`run_pipeline()`): `fetch_metadata → select STT → [download audio] → transcribe → [translate] → write SRT`. Emits NDJSON-friendly dict events via an `on_event` callback for the streaming `/api/process` endpoint.
- **`core/downloader/`** — `youtube.py` (yt-dlp wrapper), `cookies.py` (browser cookies for age-gated/private videos), `js_runtime.py` (probes for deno/node, builds yt-dlp's `js_runtimes` opts).
- **`core/stt/`** — speech-to-text providers behind `base.py` (`TranscriptionProvider`), **registered in `core/stt/__init__.py`** (`_REGISTRY`): `whisper_local.py` (`"openai-whisper"`), `yt_captions.py` (`"yt_captions"` — reuse YouTube's own captions). Adding an engine = one line in that registry.
- **`core/translator/`** — translation providers behind `base.py` (`TranslationProvider`), **dispatched in `core/translator/__init__.py`** (`get_translator`): `gemini.py` (`"gemini"`), `openai_compat.py` (`"openai"` and `"local_openai"` / LM Studio).
- **`core/dependency_manager.py`** — Whisper model download (streamed progress) + `check_ffmpeg()` / `check_mpv()`. Powers the `/api/dependencies` endpoint and the frontend's first-run "Init" screen.
- **`core/library_runs.py` + `core/subtitles.py`** — "multi-SRT runs per video": each output folder is `output/<Title>_<videoId>/` containing `<videoId>.wav`, `transcripts/<id>.srt`, `translations/<id>.srt`, and `_history.json`. You can re-transcribe / re-translate an existing video to add more SRTs without re-downloading; all sidecar mutations go through `library_runs` (shared locks for concurrent runs). `subtitles.py` is SRT read/write/segment helpers.
- **`core/config.py`** — `AppConfig` (pydantic-settings), persisted to `~/.yt_subtitle_tool/config.json`. `output/` and `downloads/` are resolved **relative to the backend's CWD** — in dev that's `backend/`, and the packaged app runs the backend with CWD `~/.yt_subtitle_tool/` (so it doesn't write into the read-only `.app`).

### Frontend (`apps/desktop/`)
Expo Router file-based routing in `apps/desktop/app/`: `index.tsx` (Generate), `library.tsx`, `history.tsx`, `settings.tsx`, `about.tsx`, `init.tsx` (first-run), `_layout.tsx` (the shell — sidebar, topbar, logs drawer; loads fonts and gates render on them). State lives in `apps/desktop/src/state/` — zustand stores plus the **singleton `apiClient`** (`@yt-subtitle-maker/api-client` pointed at `http://127.0.0.1:8000`). Tamagui config: `apps/desktop/tamagui.config.ts`.

- **`apps/desktop/index.js` is the app entry** (`import "expo-router/entry"`), and `package.json`'s `main` points at it — **this indirection is required, do not "simplify" it away.** The `.npmrc` sets `node-linker=hoisted`, so `expo-router` lives at `<repo-root>/node_modules`; if `main` pointed straight at `expo-router/entry`, Expo's web HTML would emit `<script src="/../../node_modules/expo-router/entry.bundle">`, browsers/WKWebView normalize the `../../` away, the URL 404s → blank white window.
- `apps/desktop/metro.config.js` — monorepo tweaks: watch the workspace root (so `packages/ui` edits hot-reload), `disableHierarchicalLookup` + explicit `nodeModulesPaths`, and a blocklist on `src-tauri/` so Cargo's mid-build artifacts don't crash Metro's file watcher.
- `apps/desktop/node_modules/` contains only the workspace symlinks (`@yt-subtitle-maker/*`); everything else is hoisted to the repo-root `node_modules/`. **Don't change `.npmrc`** — React Native / Metro depend on the hoisted layout.

### Tauri shell (`apps/desktop/src-tauri/`)
`src/main.rs` is a thin shim; **`src/lib.rs` is the real entry**. Its `setup` hook runs `spawn_backend()`:
- **debug build** → `<repo>/backend/.venv/bin/python -m uvicorn api.main:app --reload`, CWD `<repo>/backend` (path resolved via `env!("CARGO_MANIFEST_DIR")`).
- **release build** → the PyInstaller binary bundled at `<Resources>/backend-dist/yt-subtitle-backend`, CWD `~/.yt_subtitle_tool/`.
- Either way, it first checks whether something is already listening on `127.0.0.1:8000`; if so it logs `already listening … not spawning another` and attaches (this is how `pnpm dev`'s split-window mode works — the `tauri dev` window cooperates with the separate backend window).
- The spawned child is killed on `RunEvent::Exit` and via a `Drop` guard. A backend it *didn't* spawn is left alone.

`tauri.conf.json`: `beforeDevCommand: "pnpm web"`, `devUrl: "http://localhost:8081"`, and `bundle.resources` copies `backend-dist/` into the `.app` at `Contents/Resources/backend-dist/`.

### Packaging the backend
`backend/packaging/run_backend.py` is the PyInstaller entrypoint (`uvicorn.run(app, host="127.0.0.1", port=8000)`). `backend/packaging/backend.spec` is the spec — a **one-dir** bundle (PyTorch is too big for one-file), `collect_all` over `whisper`, `torch`, `yt_dlp`, `uvicorn`, `openai`, `google`, `google.genai`. `pnpm -F desktop build:backend` runs PyInstaller into `apps/desktop/src-tauri/backend-dist/`. `.gitignore` tracks `backend-dist/.gitkeep` but ignores the (~600 MB) contents. Whisper models and ffmpeg/mpv are **not** bundled — they're acquired at runtime (the Init screen / `/api/dependencies`) or expected on the system.

### Where design notes live
`docs/superpowers/specs/` and `docs/superpowers/plans/` hold the spec + implementation-plan docs for the recent work (backend modularization, the Tamagui rewrite, the all-in-one launcher, etc.).
