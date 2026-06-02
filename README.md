# YouTube Subtitle Maker

A desktop application that downloads YouTube audio, transcribes it locally with OpenAI Whisper, and optionally translates subtitles using Google Gemini or any OpenAI-compatible API. All processing happens on your machine.

**Version**: 2.0.0-alpha  
**License**: TODO — License file not detected in repository.

---

## Features

- Download YouTube audio via yt-dlp (supports age-gated and private videos with browser cookie import)
- Transcribe audio locally using OpenAI Whisper (GPU/CPU, multiple model sizes)
- Fall back to existing YouTube captions instead of running Whisper
- Translate subtitles via Google Gemini, OpenAI, or any OpenAI-compatible endpoint (e.g., LM Studio)
- Manage multiple SRT files per video without re-downloading audio
- Play videos with generated subtitles through MPV integration
- Receive real-time progress updates during download, transcription, and translation
- Modern desktop UI with keyboard navigation and a first-run dependency checker

---

## Prerequisites

- Python 3.11, 3.12, or 3.13 (3.14 is not supported because PyTorch lacks wheels)
- Node.js 20 or later
- pnpm 10 or later
- Rust with rustup (required for Tauri)
- ffmpeg (required by Whisper)
- mpv (required for the "play with subtitles" feature)
- deno or node (yt-dlp needs a JS runtime for YouTube deobfuscation)

> **Note**: On non-interactive shells, `cargo`, `rustc`, and `tauri` may not be on PATH. Run `source "$HOME/.cargo/env"` first.

---

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/Kidemi04/yt-subtitle-maker.git
   cd yt-subtitle-maker
   ```

2. Set up the Python backend (downloads approximately 2 GB of PyTorch, which may take a while):

   ```bash
   PYTHON=python3.12 scripts/setup-backend.sh
   ```

3. Install frontend dependencies:

   ```bash
   pnpm install
   ```

---

## Usage

### Development Mode

The recommended way to start development opens two macOS Terminal windows: one for the backend and one for the web UI.

```bash
pnpm dev
```

This starts:
- Backend: uvicorn with auto-reload at `127.0.0.1:8000`
- Web UI: Expo development server at `http://localhost:8081`

Open `http://localhost:8081` in your browser.

> On first run, macOS may prompt for Automation permission ("Terminal wants to control Terminal"). Click Allow.

### Native Tauri Window

To develop inside the actual desktop application window:

```bash
pnpm -F desktop tauri:dev
```

This spawns the backend, the web UI, and wraps them in a native Tauri window. All logs appear in a single terminal.

### Web UI Only

To run only the frontend in a browser without the backend:

```bash
pnpm web
```

Then open `http://localhost:8081`.

### Backend Only

To run the backend manually:

```bash
cd backend
../backend/.venv/bin/python -m uvicorn api.main:app --host 127.0.0.1 --port 8000 --reload
```

---

## Development

### Technology Stack

**Backend**

| Technology | Purpose |
|---|---|
| Python 3.11–3.13 | Runtime |
| FastAPI | HTTP API framework |
| Uvicorn | ASGI server |
| OpenAI Whisper | Local speech-to-text |
| yt-dlp | YouTube audio extraction |
| Google GenAI / OpenAI | Translation providers |
| PyTorch | Whisper inference backend |
| pytest | Testing |
| ruff | Linting and formatting |
| PyInstaller | Backend bundling for the desktop app |

**Frontend**

| Technology | Purpose |
|---|---|
| React 18.2 | UI framework |
| React Native Web | Cross-platform rendering |
| Expo SDK 51 | Tooling and routing |
| Tamagui 1.115 | UI components and design tokens |
| Tauri 2 | Desktop shell (Rust) |
| Zustand | State management |

**Shared Packages**

- `packages/api-client` — Typed TypeScript client that mirrors the backend API
- `packages/ui` — Tamagui design system components shared across the frontend

### Project Structure

```
yt-subtitle-maker/
├── backend/                    # Python FastAPI backend
│   ├── api/                    # FastAPI routers and schemas
│   ├── core/                   # Business logic (pipeline, STT, translation, etc.)
│   ├── packaging/              # PyInstaller spec and entrypoint
│   └── pyproject.toml          # Python dependencies
├── apps/
│   └── desktop/                # Desktop frontend
│       ├── app/                # Expo Router pages
│       ├── src/
│       │   ├── components/     # UI components
│       │   ├── hooks/          # Custom React hooks
│       │   ├── lib/            # Utilities
│       │   └── state/          # Zustand stores
│       └── src-tauri/          # Tauri Rust shell
├── packages/
│   ├── api-client/             # Typed TS API client
│   └── ui/                     # Tamagui design system
├── scripts/                    # Development and build scripts
├── tests/                      # Backend test suite
└── docs/superpowers/           # Design specs and implementation plans
```

### Architecture Overview

The backend (`backend/`) uses thin FastAPI routes over a modular core. `backend/api/main.py` wires together routers for metadata, processing, translation, configuration, dependencies, library, history, cookies, engines, system, and file system operations. All business logic lives in `backend/core/`:

- `core/pipeline.py` — Orchestrates the full workflow: fetch metadata, select STT, download audio, transcribe, optionally translate, and write SRT
- `core/downloader/` — Wraps yt-dlp, supports browser cookies, and probes for JS runtimes
- `core/stt/` — Pluggable speech-to-text engines (Whisper, YouTube captions)
- `core/translator/` — Pluggable translation providers (Gemini, OpenAI, local OpenAI)
- `core/library_runs.py` — Manages multiple SRT runs per video with concurrent-safe file operations
- `core/dependency_manager.py` — Downloads Whisper models and checks for ffmpeg/mpv
- `core/config.py` — Pydantic-settings configuration persisted to `~/.yt_subtitle_tool/config.json`

The frontend (`apps/desktop/`) uses Expo Router file-based routing:

- `index.tsx` — Generate (main workflow)
- `library.tsx` — Library and video history
- `history.tsx` — Global run history
- `settings.tsx` — App settings
- `init.tsx` — First-run dependency checker
- `about.tsx` — About page
- `_layout.tsx` — Shell (sidebar, topbar, logs drawer)

State lives in Zustand stores under `apps/desktop/src/state/`.

The Tauri shell (`apps/desktop/src-tauri/`) manages the backend subprocess. In debug mode it spawns the local Python virtualenv's uvicorn. In release mode it launches the PyInstaller-bundled binary. Both modes check whether `127.0.0.1:8000` is already listening and attach if so.

---

## Testing

### Backend Tests

Run all backend tests with pytest:

```bash
backend/.venv/bin/python -m pytest
```

Run a specific test:

```bash
backend/.venv/bin/python -m pytest tests/api/test_process.py::test_name -v
```

### Backend Lint

Check Python code with ruff:

```bash
backend/.venv/bin/ruff check backend
```

### Frontend Typecheck

Check TypeScript types:

```bash
pnpm -F desktop typecheck
```

---

## Building

### Packaged Desktop Application

Build the complete desktop application (includes backend bundling):

```bash
pnpm -F desktop tauri:build
```

Outputs:
- macOS application: `apps/desktop/src-tauri/target/release/bundle/macos/`
- DMG installer: `apps/desktop/src-tauri/target/release/bundle/dmg/`

### Backend Bundle Only

Rebuild just the PyInstaller backend bundle:

```bash
pnpm -F desktop build:backend
```

This generates `apps/desktop/src-tauri/backend-dist/` for use by Tauri.

---

## API Documentation

The backend exposes the following endpoints under `/api`:

- `GET /api/metadata` — Fetch YouTube video metadata
- `POST /api/process` — Run the full pipeline (returns streaming NDJSON events)
- `POST /api/translator/translate` — Translate SRT content
- `GET /api/version` — App version information
- `GET /api/config` / `POST /api/config` — App configuration
- `GET /api/dependencies` — Check and download runtime dependencies
- `GET /api/engines` — List available STT and translation engines
- `GET /api/library` / `POST /api/library/*` — Video library management
- `GET /api/history` — Processing history
- `POST /api/cookies` — Browser cookie import
- `POST /api/system/*` — System operations

---

## Configuration

Application settings persist to:

```
~/.yt_subtitle_tool/config.json
```

Output folders (`output/`, `downloads/`) resolve relative to the backend's working directory:
- **Development**: `backend/`
- **Packaged application**: `~/.yt_subtitle_tool/`

---

## Roadmap

| Branch | Status | Description |
|---|---|---|
| `main` | Active | Current v2.0+ architecture (Tauri + Tamagui) |
| `v1.5` | Legacy | In-progress work captured before the v2.0 rewrite |
| `v2.0` | Legacy | Settings tab production-ready version |
| `v2.1` | Merged into main | Library UX redesign |
| `v2.2`, `v2.3` | Experimental | DeepSeek and other experimental features |

---

## Contributing

TODO — Contributing guidelines have not been established for this project.

---

## Acknowledgments

- [OpenAI Whisper](https://github.com/openai/whisper) — Local speech-to-text
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) — YouTube extraction
- [FastAPI](https://fastapi.tiangolo.com/) — Python web framework
- [Expo](https://expo.dev/) — React Native tooling
- [Tamagui](https://tamagui.dev/) — Universal UI kit
- [Tauri](https://tauri.app/) — Rust desktop framework

---

<p align="center">
  Built for making subtitles accessible to everyone.
</p>
