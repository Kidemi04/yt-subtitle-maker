# Plan: Multi-SRT runs per video — re-transcribe + re-translate (Plan C, subdirectory layout)

**Status:** ready to implement (handoff from previous session)
**Branch:** `v2.0` (current; merged work landed through commit `601178b`)
**Decisions locked:**
- Storage = **Plan C** (subdirectory layout per video folder)
- Audio file `<videoId>.wav` is always **reused** across re-transcribe runs (skip download when present)
- Delete granularity = **both**: per-SRT delete in detail modal + per-folder delete in Library

---

## Context for the new session

Read these first to get oriented:

| File | Why |
|---|---|
| `CLAUDE.md` | Repo orientation, stack lock, common commands. |
| `docs/superpowers/specs/2026-05-04-tamagui-rewrite-design.md` § 6 | Frontend↔backend contract reference. |
| `docs/superpowers/design-handoff/README.md` | Locked design tokens + 22-component inventory. |
| `backend/api/routes/library.py` | Existing library endpoints (delete, open-folder, play-mpv). The new endpoints live alongside. |
| `backend/api/routes/history.py` | Reads sidecar — needs to handle the new shape. |
| `backend/core/pipeline.py` | Where transcribes + translations are written today. Needs to know about subdirectories. |
| `packages/api-client/src/{client,types}.ts` | Add new methods + shapes. |
| `apps/desktop/app/library.tsx` | Existing detail modal — refactor target. |
| `apps/desktop/app/history.tsx` | Row click → same detail modal. |
| `apps/desktop/app/index.tsx` | Generate result card already has subtitle picker; can reuse pattern in detail modal. |
| `tests/api/test_library.py`, `tests/api/test_history.py`, `tests/api/test_process_download_only.py` | Existing test patterns to mirror. |

Run `git log --oneline -20` for recent context. Last commit at handoff: `601178b feat(history): wire row actions`.

---

## Storage layout

```
output/
  <Title>_<videoId>/
    <videoId>.wav                              # source audio — written once, reused
    transcripts/
      <transcribeId>.srt                       # e.g. openai-whisper-turbo.srt
      yt_captions.srt
      openai-whisper-large-v3.srt
    translations/
      <translateId>.srt                        # e.g. openai-whisper-turbo_gemini-flash_zh.srt
    _history.json                              # registry — see schema below
```

### ID conventions (stable, deterministic, idempotent)

```python
def transcribe_id(engine: str, model: str | None, language: str) -> str:
    """yt_captions doesn't have a model component."""
    if engine == "yt_captions":
        return f"yt_captions-{language}"
    return f"{engine}-{model}-{language}"

def translate_id(source_transcribe_id: str, translator: str, translator_model: str, target_lang: str) -> str:
    # Hyphenate dotty model names: gemini-2.5-flash-lite -> gemini-2-5-flash-lite
    model_slug = re.sub(r"[^a-zA-Z0-9]+", "-", translator_model).strip("-").lower()
    return f"{source_transcribe_id}__{translator}-{model_slug}__{target_lang}"
```

Repeated transcribes with the **same** parameters reuse the same id (and overwrite the SRT — running tiny → tiny replaces tiny's output, but tiny → turbo keeps both). Same for translations.

### Sidecar shape (`_history.json`)

```json
{
  "videoId": "Y5FzIUNvvJ0",
  "url": "https://www.youtube.com/watch?v=Y5FzIUNvvJ0",
  "titleOriginal": "Family Guy - Chris Castrated",
  "titleTranslated": null,
  "thumbnailUrl": "https://img.youtube.com/vi/Y5FzIUNvvJ0/hqdefault.jpg",
  "channel": "Family Guy",
  "durationSeconds": 360,
  "createdAt": "2026-05-05T01:44:19+00:00",
  "updatedAt": "2026-05-05T02:10:33+00:00",
  "transcribes": [
    {
      "id": "openai-whisper-turbo-en",
      "engine": "openai-whisper",
      "model": "turbo",
      "device": "auto",
      "vadEnabled": true,
      "language": "en",
      "filename": "openai-whisper-turbo-en.srt",
      "createdAt": "2026-05-05T01:44:19+00:00",
      "durationMs": 339875,
      "segmentCount": 47
    }
  ],
  "translations": [
    {
      "id": "openai-whisper-turbo-en__gemini-gemini-2-5-flash-lite__zh",
      "sourceTranscribeId": "openai-whisper-turbo-en",
      "translator": "gemini",
      "translatorModel": "gemini-2.5-flash-lite",
      "targetLang": "zh",
      "filename": "openai-whisper-turbo-en__gemini-gemini-2-5-flash-lite__zh.srt",
      "createdAt": "2026-05-05T02:10:33+00:00",
      "durationMs": 11240,
      "segmentCount": 47
    }
  ]
}
```

### Backwards compat (read-only)

Old folders have flat `<videoId>_original.srt` + `<videoId>_<lang>.srt` + old sidecar (single transcribe/translate). On read, **synthesize** the new shape on the fly without touching disk:
- `<videoId>_original.srt` → `transcribes[0]` with `id: "legacy"`, `filename: "<videoId>_original.srt"` (root, not transcripts/)
- `<videoId>_<lang>.srt` → `translations[0]` with `id: "legacy-<lang>"`, `sourceTranscribeId: "legacy"`, `filename: "<videoId>_<lang>.srt"`

When a NEW transcribe or translate fires on a legacy folder, perform a **lazy migration**: move legacy files into `transcripts/`/`translations/`, rewrite sidecar to new shape, then continue.

---

## Backend changes

### New endpoints

```
GET  /api/library/{videoId}                      → full sidecar JSON (new shape)
POST /api/library/{videoId}/transcribe           → NDJSON stream, body { sttEngine, whisperModel, whisperDevice, vadEnabled, sourceLang }
                                                    Reuses <videoId>.wav, writes transcripts/<id>.srt, appends to sidecar.transcribes
POST /api/library/{videoId}/translate            → NDJSON stream, body { sourceTranscribeId, targetLang, translatorProvider }
                                                    Reads transcripts/<sourceTranscribeId>.srt, writes translations/<id>.srt, appends to sidecar.translations
POST /api/library/{videoId}/delete-srt           → body { id, kind: "transcribe" | "translate" }
                                                    Deletes the SRT file + removes the entry from sidecar arrays.
                                                    For transcripts: also cascade-delete child translations.
```

### Modified endpoints

| Endpoint | Change |
|---|---|
| `GET /api/library` | Return new shape per item: `{videoId, url, titleOriginal, titleTranslated, thumbnailUrl, createdAt, transcribesCount, translationsCount, audio: url\|null, hasVideo: bool}`. Drop the `files` 4-slot object — clients now go to detail endpoint for the full picture. **THIS IS A BREAKING CHANGE** — `apps/desktop/app/library.tsx` consumers must update. |
| `GET /api/history` | Map sidecar's `transcribes[]` + `translations[]` into HistoryItem rows. Each VIDEO becomes one row (the existing UX), but `sttEngineUsed` becomes the latest transcribe's engine, and `processingDurationMs` becomes the SUM of all runs' durations. Add `transcribesCount`/`translationsCount` so frontend can show a badge. |
| `POST /api/library/play-mpv` | Accept optional `transcribeId` and `translateId` (mutually exclusive with `subtitlePreference`). When given, load that exact SRT from `transcripts/`/`translations/`. |
| `core/pipeline.run_pipeline` | New behavior: writes to `transcripts/<id>.srt` and `translations/<id>.srt` instead of root. Sidecar APPENDS (does not overwrite). Honors lazy migration if folder is legacy. |

### Backend module structure

Create `backend/core/library_runs.py` with:

```python
def transcribe_id(engine, model, language) -> str: ...
def translate_id(source, translator, translator_model, target_lang) -> str: ...
def folder_layout(folder: Path) -> dict: ...           # detect legacy vs new
def migrate_legacy_folder(folder: Path) -> None: ...   # move files, rewrite sidecar
def read_sidecar(folder: Path) -> dict: ...            # tolerant read, returns new shape
def write_sidecar(folder: Path, sidecar: dict) -> None: ...
def append_transcribe(folder: Path, entry: dict) -> None: ...
def append_translation(folder: Path, entry: dict) -> None: ...
def remove_entry(folder: Path, kind: str, id: str) -> list[Path]: ...  # returns deleted file paths
```

This module is the single source of truth for sidecar manipulation. Library/history/process routes all go through it.

---

## Frontend changes

### Types (`packages/api-client/src/types.ts`)

```typescript
export interface TranscribeRun {
  id: string;
  engine: string;       // SttEngine | "yt_captions"
  model: string | null; // null for yt_captions
  device: WhisperDevice | null;
  vadEnabled: boolean | null;
  language: string;
  filename: string;
  createdAt: string;
  durationMs: number;
  segmentCount: number;
}

export interface TranslateRun {
  id: string;
  sourceTranscribeId: string;
  translator: TranslatorProvider;
  translatorModel: string;
  targetLang: string;
  filename: string;
  createdAt: string;
  durationMs: number;
  segmentCount: number;
}

export interface VideoDetail {
  videoId: string;
  url: string;
  titleOriginal: string;
  titleTranslated: string | null;
  thumbnailUrl: string | null;
  channel: string | null;
  durationSeconds: number | null;
  createdAt: string;
  updatedAt: string;
  transcribes: TranscribeRun[];
  translations: TranslateRun[];
}

// LibraryItem becomes summary-only:
export interface LibraryItem {
  videoId: string;
  url: string;
  titleOriginal: string;
  titleTranslated: string | null;
  thumbnailUrl: string | null;
  createdAt: string;
  transcribesCount: number;
  translationsCount: number;
  audio: string | null;
  hasVideo: boolean;
}
```

### Client methods (`packages/api-client/src/client.ts`)

```typescript
fetchVideoDetail(videoId): Promise<VideoDetail>
streamTranscribe(videoId, opts): AsyncIterable<ProcessEvent>      // NDJSON
streamTranslate(videoId, opts): AsyncIterable<ProcessEvent>       // NDJSON
deleteSrt(videoId, kind: "transcribe"|"translate", id): Promise<void>
playMpv(videoId, opts): existing — extend with { transcribeId?, translateId? }
```

### UI

#### `apps/desktop/app/library.tsx`
- LibraryCard now shows `transcribesCount` + `translationsCount` badges instead of file kinds.
- Click → opens new VideoDetailModal (replaces existing inline modal content).

#### New: `apps/desktop/app/components/VideoDetailModal.tsx` (or inline in library.tsx)
- Header: thumbnail (192×108), `<TitleLg>` title, URL, close X
- Caption row: video duration, library createdAt
- **Transcripts section** (`<DisplaySm>` "Transcripts (N)")
  - For each TranscribeRun, render a card:
    ```
    [▶] [🌐 Translate]                openai-whisper · turbo · en
                                       45s · 47 segments · 12 hours ago
                                                              [⋯ Delete]
    ```
  - Bottom: `[+ New transcript]` ButtonGhost
- **Translations section** (`<DisplaySm>` "Translations (M)")
  - Grouped by `sourceTranscribeId`. Group header is the source transcribe's id.
  - For each TranslateRun:
    ```
    [▶ Play]                          gemini · flash-lite · zh
                                       3s · 47 segments · 5 hours ago
                                                              [⋯ Delete]
    ```
  - Bottom: `[+ New translation]` ButtonGhost
- Footer: `[Open folder]` `[Reload in Generate]` `[Delete entire video]` (red)

#### New: `apps/desktop/app/components/NewTranscribeModal.tsx`
Small modal with:
- `<Caption>` Source: read-only, `<videoId>.wav`
- STT Source RadioCard (auto/yt_captions/whisper)
- STT Engine Dropdown (filtered by installedSttEngines)
- Whisper model Dropdown (filtered by /api/dependencies installed models)
- Whisper device Dropdown
- VAD Toggle
- Source language Dropdown
- `[Cancel]` `[Run transcribe]`

On submit: streams `streamTranscribe()`, shows ProgressBar + StepPill in same modal. On done: closes, refreshes detail.

#### New: `apps/desktop/app/components/NewTranslationModal.tsx`
- "Source transcript" Dropdown — populated from `detail.transcribes` by id
- "Translator" SegmentedControl (Gemini/Local AI/OpenAI)
- "Translator model" — hard-coded summary like "uses Settings", or expose another Dropdown
- "Target language" Dropdown
- `[Cancel]` `[Run translation]`

On submit: streams `streamTranslate()`, shows ProgressBar. On done: closes, refreshes detail.

#### `apps/desktop/app/history.tsx`
- Row click (or new "details" icon button) → opens same VideoDetailModal
- Reload button stays as-is (URL prefill into Generate)
- Update display: row's "engine" badge becomes `transcribesCount`-aware ("3 transcripts · 2 translations")

#### `apps/desktop/app/index.tsx`
- Result card's "Re-transcribe with..." button (currently disabled with "coming soon") wires to NewTranscribeModal.
- Subtitle picker becomes dynamic: lists all transcripts + translations for the current video, not just hard-coded translated/original.

---

## Implementation phases

Each phase ships independently — tests + commits at each boundary.

### Phase 1 — Backend foundation (sidecar + library_runs module)
- `core/library_runs.py`: id helpers, sidecar read/write (with backwards-compat synthesis), append helpers, lazy migration.
- Tests: `tests/core/test_library_runs.py` covering id determinism, legacy folder synthesis, lazy migration, sidecar append idempotency.
- **No route changes yet.** Library/history endpoints still use old code.
- Commit: `feat(library-runs): sidecar registry + id conventions for multi-SRT folders`

### Phase 2 — Pipeline writes new layout
- `pipeline.run_pipeline` uses `library_runs.append_transcribe` / `append_translation`. SRTs go to `transcripts/` / `translations/`.
- Existing `/api/process` endpoint stays. Old test `test_process_download_only.py` needs updating to assert new path.
- Commit: `feat(pipeline): write SRTs to transcripts/ and translations/ subdirs`

### Phase 3 — New library detail endpoint + delete-srt
- `GET /api/library/{videoId}` returns `VideoDetail` shape.
- `POST /api/library/{videoId}/delete-srt` removes a single run.
- Tests: legacy folder read, new folder read, delete cascade.
- Commit: `feat(api/library): GET /{videoId} detail + POST /delete-srt`

### Phase 4 — Re-transcribe endpoint
- `POST /api/library/{videoId}/transcribe` — streams NDJSON like `/api/process`. Uses existing audio.wav. Writes to `transcripts/<id>.srt`. Appends sidecar.
- Cooperative cancel via shared `_active_cancel` slot (refactor process.py's pattern out into a small module so transcribe + translate + process share it).
- Tests: streams a fake STT, verifies sidecar entry created, file written.
- Commit: `feat(api/library): POST /{videoId}/transcribe — re-run STT on existing audio`

### Phase 5 — Re-translate endpoint
- `POST /api/library/{videoId}/translate` — streams NDJSON. Reads `transcripts/<sourceTranscribeId>.srt`, calls translator, writes `translations/<id>.srt`.
- Tests.
- Commit: `feat(api/library): POST /{videoId}/translate — re-translate from existing transcript`

### Phase 6 — Refactor library list + history endpoints to new shape
- `GET /api/library` returns summary shape.
- `GET /api/history` aggregates new sidecar arrays.
- Tests updated.
- Commit: `refactor(api): library + history surface multi-SRT counts`

### Phase 7 — play-mpv accepts run id
- Optional `transcribeId` / `translateId` body fields. Backwards compat via `subtitlePreference` for fresh single-run jobs.
- Tests.
- Commit: `feat(api/library/play-mpv): pick exact SRT by run id`

### Phase 8 — Frontend api-client + types
- New types, new client methods. NO UI yet — just typecheck-clean.
- Commit: `feat(api-client): types + methods for multi-SRT runs`

### Phase 9 — VideoDetailModal + Library refactor
- New component. Replaces existing Library inline modal content.
- LibraryCard updates to show counts.
- Generate result card's subtitle picker still works (uses single most-recent transcript/translation).
- Commit: `feat(library): VideoDetailModal with per-run cards`

### Phase 10 — NewTranscribeModal + NewTranslationModal
- Wire up + stream. Re-transcribe button on Generate result card lights up.
- Commit: `feat(library): re-transcribe + re-translate modals`

### Phase 11 — History page integration
- Row → opens VideoDetailModal. `transcribesCount`/`translationsCount` badges.
- Commit: `feat(history): row opens VideoDetailModal`

### Phase 12 — Verify end-to-end
- Manual: run a fresh job → re-transcribe with different model → re-translate with different translator → play each via mpv → delete one → confirm sidecar reflects state.
- Update screenshots in design-handoff if useful.
- Commit only if there are doc tweaks.

Each phase ends with: `pytest -q` + `pnpm -F desktop typecheck` + `ruff check backend/` all green.

---

## Constraints & gotchas

- **Don't break legacy folders.** Read tolerantly. Lazy-migrate only when adding a new run.
- **`audio.wav` is the contract.** Re-transcribe REQUIRES the wav file. If missing, return `{ok: false, error: "no audio file in folder; download a fresh job first"}`.
- **Cooperative cancel** must work across all 3 streaming endpoints. Refactor `_active_cancel` slot into a shared module (`api/jobs.py`?) so process / transcribe / translate share one cancel slot.
- **Sidecar concurrency** — multiple POSTs against the same video (transcribe + translate at once) need to not corrupt sidecar. Use file lock or read-modify-write under a folder-level threading.Lock.
- **typecheck** Tamagui icon `color` prop accepts `$tokens` directly — keep using those, NOT raw hex.
- **Typography primitives** are in `@yt-subtitle-maker/ui`. Use `<TitleSm>`, `<Caption>`, etc. — no inline `<Text fontFamily=$body fontSize=11 ...>` blocks (that pattern was already cleaned up in commit `13af001`).
- **Inter weight** quirk: when overriding `fontWeight` ≠ 400, use the explicit Inter family name (`Inter_600SemiBold`, etc.) — see `packages/ui/src/components/Typography.tsx` for the rationale. New components must follow.
- **No git worktree** — work directly on `v2.0` branch.
- **Push regularly** — commit per phase, push after each, so partial progress survives.

---

## Open V2 polish (not in this plan, can come later)

- Side-by-side diff view of two transcripts
- Bulk export (zip of all SRTs)
- Tag a "favourite" transcript per video so it's the default for play-mpv
- Search across all SRT content (full-text)
- Re-transcribe should auto-trigger a translate of any existing target lang the user previously translated to (saves a click)
