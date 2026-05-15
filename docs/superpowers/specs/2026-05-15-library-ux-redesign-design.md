# Library UX Redesign — Design Spec

**Date:** 2026-05-15
**Branch:** `feature/library-ux`
**Status:** approved (pending user review of this file)

## Goal

Make the Library page a true playback hub. Today the Library is a card grid that opens a modal for per-video detail; finding and playing a specific transcript or translation is two clicks deep and feels like an admin screen. The user wants flexibility around playback — replay any video they've previously processed, pick which transcript or translation to play with mpv, and easily kick off new transcribe / translate runs to play with new versions.

Secondary goal: handle the case where mpv is not installed by offering an in-app download.

## Non-goals

- In-app HTML5 player. Playback continues to go through mpv.
- Bulk actions (multi-select, batch delete, batch translate).
- Drag-and-drop, tagging, folders.
- Sort options beyond the backend default (newest first).
- Resizable splitter between panes (fixed 360px left pane in v1).
- Exposing custom mpv-download URL in Settings UI.
- Auto-download of mpv on Linux (manual link only).

## High-level layout

`apps/desktop/app/library.tsx` is replaced with a two-pane layout that lives inside the existing app shell (sidebar + topbar untouched).

```
┌─ Topbar ──────────────────────────────────────────────────────┐
├─ Sidebar ┬─ Left pane (~360px) ─┬─ Right pane (flex) ────────┤
│          │ Search…                │  Video header              │
│          │ [☰ Rows] [⊞ Cards]    │  Transcripts section       │
│          │ ──────────────         │  Translations section      │
│          │ ▣ Row (selected)       │  Footer: Open folder /     │
│          │ ▢ Row                  │  Delete entire video       │
│          │ ▢ Row …                │                            │
└──────────┴────────────────────────┴────────────────────────────┘
```

- `VideoDetailModal` is deleted. Its content moves into the right pane.
- The current `LibraryCard` is replaced. A new `LibraryRow` is the default; a smaller `LibraryCard` is kept for the optional Cards view.
- The two existing nested modals (`NewTranscribeModal`, `NewTranslationModal`) stay as-is and are still opened by "+ Re-transcribe" / "+ Re-translate" buttons in the right pane; they're large forms so a modal still makes sense.

**Narrow viewport (≤ 720px width):** collapse to single-pane. The left pane fills the route; selecting a row navigates to a right-pane view with a back arrow. No auto-select on mount in this mode.

## Left pane

**Sticky header:**

- "Library" title + item count (e.g. `12 videos`)
- Search input — matches `titleTranslated`, `titleOriginal`, `videoId`; client-side, same fields as today
- View toggle `[☰ Rows] [⊞ Cards]` — default Rows; persisted in zustand store (`view`)
- Refresh button

**Row layout (Rows view):**

- 80×45px thumbnail with duration overlay bottom-right
- Title — 2 lines max, prefers `titleTranslated`, falls back to `titleOriginal`
- Meta line: relative date · duration (or `audio` badge if no video)
- Language chips: one per unique transcript/translation language. Transcript-only chips are blue (`$primary`); translation chips (whether or not a transcript also exists for that language) are green (`$accent`).
- Selected row: 2px left border in `$primary` and subtle background tint.

**Cards view:** the existing 216px-wide card, simplified — the numeric transcribe/translation count badges are replaced with the same language-chip strip used in Rows.

**States:**

- No items in library: hero in the *right pane* ("Your library is empty — go to Generate to add your first video"). Left pane shows just the header.
- Fetch error: red banner at top of left pane (matches today's pattern).
- No search matches: small "No matches for `<query>`" note + Clear-search button inside the left pane.

The current client-side `fileKinds()` filter pipeline (All / Video / Audio / SRT) is removed.

## Right pane

Three states:

### A · No selection

Centered hero: "Pick a video on the left to see transcripts and translations." On viewports ≥ 720px, the most-recently-added video is auto-selected on Library mount so this state is rare. Below 720px there is no auto-select.

### B · Video selected (the main view)

**Sticky header:**

- 160×90 thumbnail
- Title (translated) + original title underneath if different
- Meta: channel · `12:34` · `Added Apr 22` · `videoId` badge
- Inline secondary actions: 📂 Open folder · ↗ Open URL

**Transcripts section** (rendered when `transcribes.length > 0`):

- Section header: `Transcripts · 2` + right-aligned `+ Re-transcribe` button
- One `RunRow` per transcript: `▶  EN · whisper-large · 412 segs · 1m 02s   ⟳  🗑` plus a relative timestamp on a second line
  - ▶ Play → mpv-gated play (see "mpv install flow")
  - ⟳ Re-translate from this transcript (opens `NewTranslationModal` with `sourceTranscribeId` prefilled)
  - 🗑 Delete (confirms, then `apiClient.deleteSrt(videoId, "transcribe", id)`; cascades to child translations as today)
- Empty: a dashed placeholder row "No transcripts yet — Re-transcribe to add one"

**Translations section** (rendered when `translations.length > 0` or at least one transcript exists to translate from):

- Section header: `Translations · 3` + `+ Re-translate` button
- Translations grouped by source transcript, like today; group header is "From: EN · whisper-large"
- Each `RunRow`: `▶  中文 · gemini · 412 segs   🗑` plus a relative timestamp
- Orphan translations (source transcript deleted) appear in a final "Orphans" group with a warning icon
- `+ Re-translate` disabled with tooltip "Add a transcript first" when `transcribes.length === 0`

**Sticky footer:**

- `🗑 Delete entire video` → confirm → `apiClient.deleteLibraryItem(videoId)`. On success, right pane returns to State A and the row disappears from the left pane.

### C · Loading

Skeleton shimmer. While the detail request is in flight, the row's data in the left pane already gives us thumb + title, so the header is rendered optimistically and only the transcripts/translations sections are skeleton-ed.

## mpv install flow

### Detection

`backend/core/dependency_manager.py` gains an `mpv` block. `GET /api/dependencies` response gains:

```json
{
  "mpv": {
    "installed": true,
    "source": "system" | "bundled",
    "path": "/usr/local/bin/mpv" | "~/.yt_subtitle_tool/bin/mpv",
    "version": "0.38.0"
  }
}
```

Lookup order:

1. Bundled binary at `~/.yt_subtitle_tool/bin/mpv` (`mpv.exe` on Windows)
2. System `mpv` on `PATH` (via `shutil.which`)
3. Not installed

Whichever is found first is what `apiClient.playMpv()` shells out to.

### Frontend flow on ▶ Play

1. Check cached mpv status (loaded into the dependencies zustand slice on Library mount and refreshed by background polling).
2. If installed → call `apiClient.playMpv(videoId, {transcribeId | translateId})` and return.
3. If missing → open `InstallMpvDialog`:
   - Body: "mpv is required to play with subtitles. Download it now? (~30 MB) It will be installed inside the app folder — your system isn't touched."
   - On Linux (unsupported in v1): body becomes "Download mpv from mpv.io" with an external link; download button hidden.
   - Confirm → `apiClient.installMpv(onEvent)` streams NDJSON; progress bar in the dialog.
   - On completion → auto-trigger the original Play action.

### Background re-check

`useMpvStatusPolling()` is mounted on the Library route:

- Fetches `GET /api/dependencies/mpv-status` on mount.
- Polls every 60s while `document.visibilityState === 'visible'` AND the Tauri window is focused (via `@tauri-apps/api/window` `onFocusChanged`).
- Triggers an immediate fetch on focus regain.
- Cancels on route unmount.

The narrower `mpv-status` endpoint (vs the existing `dependencies` one) keeps the poll cheap by skipping the ffmpeg + Whisper-model probes.

### Backend install

New `POST /api/dependencies/install-mpv` streams NDJSON from `install_mpv(on_event)`:

| Event phase | Fields | Meaning |
|---|---|---|
| `resolving` | `message` | platform detected, URL chosen |
| `downloading` | `bytesReceived`, `bytesTotal` | progress |
| `verifying` | `message` | SHA-256 check |
| `extracting` | `message` | unpacking archive |
| `done` | `path`, `version` | success |
| `error` | `message` | failure (also returned as JSON if fatal before stream starts) |

Implementation outline:

- Detect platform via `sys.platform` + `platform.machine()`.
- Download to `~/.yt_subtitle_tool/.tmp/`; verify SHA-256 against pinned constant; extract (`tarfile` for macOS `.tar.gz`, `zipfile` for Windows `.zip`); move binary to `~/.yt_subtitle_tool/bin/`; set executable bit (Unix); clean up temp.
- Returns 400 with `{supported: false, manualUrl: "https://mpv.io"}` for unsupported platforms.

### Pinned binary sources

A single constant table in `dependency_manager.py`:

| Platform key | URL | SHA-256 | Format |
|---|---|---|---|
| `darwin-arm64` | mpv.io macOS arm64 tarball | pinned | `.tar.gz` |
| `darwin-x86_64` | mpv.io macOS x86_64 tarball | pinned | `.tar.gz` |
| `win32-x86_64` | shinchiro/mpv-winbuild-cmake portable zip | pinned | `.zip` |
| `linux-*` | `null` → endpoint returns `{supported: false}` | — | — |

URLs and SHAs are hard-coded constants; updating mpv means bumping these and shipping an app release. Exact URLs are resolved during implementation (out of scope for the spec to pin a specific tarball — the implementation plan picks the current stable release at the time of work).

### Persistence

`~/.yt_subtitle_tool/` is outside the `.app` bundle (it's where `output/`, `downloads/`, `models/`, and `config.json` already live), so the bundled mpv survives app updates.

## Frontend state and components

### New zustand slice `apps/desktop/src/state/library.ts`

```ts
{
  items: LibraryItem[]
  loading: boolean
  error: string | null
  selectedId: string | null
  detail: VideoDetail | null
  loadingDetail: boolean
  view: 'rows' | 'cards'          // persisted to localStorage
  search: string
  // actions
  fetchList, selectVideo, refreshDetail,
  deleteTranscript, deleteTranslation, deleteVideo
}
```

The ad-hoc local state in today's `library.tsx` and `VideoDetailModal.tsx` collapses into this store. Detail is not cached across selections; in-flight detail requests are debounced 100ms to absorb rapid keyboard navigation.

### New zustand slice `apps/desktop/src/state/dependencies.ts`

```ts
{
  mpv: MpvStatus | null
  loadingMpv: boolean
  installProgress: { phase, bytesReceived, bytesTotal } | null
  refreshMpv,                     // GET /api/dependencies/mpv-status
  installMpv,                     // POST /api/dependencies/install-mpv (streams)
}
```

### New components

- `apps/desktop/app/library.tsx` — route, wires the two panes
- `apps/desktop/src/components/library/LibraryPane.tsx` — left pane container (header, search, view toggle, list)
- `apps/desktop/src/components/library/LibraryRow.tsx` — Rows view item
- `apps/desktop/src/components/library/LibraryCard.tsx` — Cards view item (simplified from today)
- `apps/desktop/src/components/library/DetailPane.tsx` — right pane container with State A / B / C handling
- `apps/desktop/src/components/library/DetailHeader.tsx`
- `apps/desktop/src/components/library/TranscriptsSection.tsx`
- `apps/desktop/src/components/library/TranslationsSection.tsx`
- `apps/desktop/src/components/library/RunRow.tsx` — one transcript or translation row
- `apps/desktop/src/components/library/EmptyRightPane.tsx`
- `apps/desktop/src/components/dependencies/InstallMpvDialog.tsx`

`VideoDetailModal.tsx` is deleted.

### API client additions (`packages/api-client/src/`)

- `fetchMpvStatus()` → `GET /api/dependencies/mpv-status`
- `installMpv(onEvent)` → streams `POST /api/dependencies/install-mpv`, mirrors the existing `installWhisperModel` helper

### Keyboard navigation (v1)

Wired in a route-level `useEffect` that listens to `window` keydown when no input is focused:

- `ArrowUp` / `ArrowDown` move `selectedId` to prev/next item in the filtered list
- `Enter` triggers Play on the most-recently-active version (first translation if any exist, else first transcript)
- `/` focuses the search input

## Backend changes summary

- `backend/core/dependency_manager.py`: add `check_mpv()` and `install_mpv()` (the latter is a streaming generator parallel to the existing Whisper-model installer); pinned URL + SHA-256 constants table.
- `backend/api/routes/dependencies.py`:
  - `GET /api/dependencies` — response gains `mpv` field
  - `POST /api/dependencies/install-mpv` — new, streams NDJSON
  - `GET /api/dependencies/mpv-status` — new, narrow status endpoint for polling
- mpv call site: when bundled mpv exists, invoke that path explicitly instead of relying on `PATH`. The single mpv-invocation helper already accepts a path; only the resolution changes.

## Tests

- `tests/api/test_dependencies.py`:
  - `check_mpv()` lookup-order priority (bundled > system > none), using `tmp_path` + monkeypatched `shutil.which`.
  - `GET /api/dependencies/mpv-status` returns the expected schema.
  - `POST /api/dependencies/install-mpv` returns 400 `{supported: false, manualUrl}` for unsupported platforms.
  - Smoke test for the install endpoint with the network call mocked — verify NDJSON event shape and temp-file cleanup on error.
- No frontend test suite exists today; manual verification covers the UI.

## Manual verification checklist

- [ ] Library with 0 items → left pane empty, right pane hero, Generate link works.
- [ ] Library with 1+ items → most recent auto-selected, right pane renders.
- [ ] Search filters items by title / videoId.
- [ ] View toggle persists across reloads.
- [ ] Keyboard nav: Arrow keys move selection, Enter plays, `/` focuses search.
- [ ] Play with system mpv installed → mpv launches.
- [ ] Play with no mpv → dialog appears; download completes; Play auto-resumes.
- [ ] Background re-check picks up a brew-installed mpv within 60s.
- [ ] Re-transcribe / Re-translate flows still work; detail refreshes after completion.
- [ ] Delete cascade still works (delete transcript → child translations gone; delete video → row gone, right pane back to State A).
- [ ] Narrow window (≤ 720px) collapses to single-pane navigation.
- [ ] Tested at 600 / 800 / 1200 / 1600 widths.

## Risks

- **Pinned URLs rot.** Mitigation: tests verify URL+SHA constants are non-empty, install endpoint returns a clear error with a manual fallback link if download fails. A broken URL ships in the next app update.
- **mpv version drift.** Bundled mpv may lag system mpv. The lookup order prefers system, so users with brew/choco-installed mpv aren't affected.
- **Concurrent re-runs.** Backend already uses shared locks in `core/library_runs.py`; no new concurrency introduced.
- **Two-pane on narrow Tauri windows.** Mitigation: ≤ 720px collapses to single-pane.
