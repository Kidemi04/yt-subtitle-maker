# Settings Tab — Phase 4: Overview & Sub-Plan Roadmap

> **This is not an executable plan** — it's the map for Phase 4. Phase 4 of the Settings-tab spec (`docs/superpowers/specs/2026-05-12-settings-tab-production-ready-design.md`) is several independent subsystems, so per `superpowers:writing-plans`' "split a multi-subsystem spec into one plan per subsystem" rule it's broken into **five sub-plans, 4a–4e**, each producing working, testable software on its own. Write each sub-plan (in a fresh session) with `superpowers:writing-plans` when you get to it; execute it with `superpowers:subagent-driven-development`. **Phase 4a is already written in full** — see `docs/superpowers/plans/2026-05-12-settings-phase-4a-effective-defaults.md`; start there.

**Status going in:** Phases 1–3 shipped on `v2.1` (last commit `1ef2fe1`). The Settings screen is a two-pane sub-tab-rail layout (General / YouTube / Transcription / Translation / Subtitles / Advanced), with search + `?tab=` deep links, an `ArmedField` (used for Backend URL), the Subtitles tab fully polished (NumberStepper / ColorField / FontPicker / SubtitlePreview / SubtitlePresets), and a Save/Discard footer. The plumbing all lives in `apps/desktop/src/components/settings/` (`SettingsContext.tsx` = the god-context exposing `draft`/`config`/`update`/all the test handlers/`activeTab`/`searchQuery`/`highlightedSettingId`; `shared.tsx` = `Section`/`Field`/`SettingRow`/the constants/`TabId`/`TABS`; `searchIndex.ts` = `SETTINGS_INDEX`; six `XxxTab.tsx` files; `SettingsRail.tsx`; `SettingsSearch.tsx`; `ArmedField.tsx`). Backend is FastAPI over `core/`; `api/routes/config.py` does the camelCase↔snake_case mapping + `_mask_secrets`/`_to_camel` + `GET`/`POST /api/config` + `POST /api/config/reset`. `packages/api-client/src/{client.ts,types.ts}` mirrors the backend.

**Spec drift note:** the spec's "Phasing" section is a rough guide that the plans have already deviated from (Phase 1 punted `ArmedField` → Phase 2; Phase 1 punted "effective defaults" → here; Phase 3 punted `tauri-plugin-dialog` → here). This roadmap re-organizes everything the spec puts under "Phase 4 — Lifecycle + the rest" **plus** the Phase-3-deferred Tauri pieces into the 4a–4e split below.

---

## The five sub-plans

| # | Sub-plan | Size | Depends on | Touches Rust? | Touches backend? |
|---|---|---|---|---|---|
| **4a** | Effective-defaults endpoint + platform-correct placeholders | **S** (~2–3 tasks) | — | no | yes (small) |
| **4b** | Hybrid autosave + per-field `↺` + per-tab "Reset this tab" | **L** (~5–7 tasks) | 4a | no | no |
| **4c** | Engine-driven Transcription tab (`GET /api/system` + `GET /api/engines` + machine-compat verdicts + engine-keyed model downloads + Source-mode control) | **XL** (~7–10 tasks) | — (independent) | no | yes (2 new endpoints + extend `/api/dependencies`) |
| **4d** | Translation named-provider-profiles (`custom_translators`/`active_translator` config + migration + `get_translator` + enhanced `POST /api/translator/test` + `ProviderRow` UI) | **XL** (~7–10 tasks) | — (independent) | no | yes (config-model change + migration + translator changes + test endpoint) |
| **4e** | Native polish: `tauri-plugin-dialog` + folder "Browse…" + armed folder/path fields (exists/writable validation) + optional "Test playback" + Advanced's Open-config-folder / Export / Import | **M–L** (~5–7 tasks) | 4b (the armed-folder validation reuses `ArmedField` + the per-field `↺` UX); a tiny bit of 4a | **yes** (new Tauri plugin + capability + a Rust command or two; needs `cargo`/`tauri` on PATH for the verify loop) | yes (small — a "stat dir / check executable" endpoint, or a Tauri command instead) |

**Recommended order:** 4a → 4b, then 4c and 4d in either order (independent of each other and of 4a/4b), then 4e last (it leans on `ArmedField`'s per-field-reset UX from 4b and is the only one that drags in Rust). 4c and 4d are each big enough that you'll probably want to split *them* into ~2 sub-plans when you write them (e.g. 4c-backend then 4c-frontend; 4d-backend+migration then 4d-frontend).

---

## 4a — Effective-defaults endpoint + platform-correct placeholders  *(written in full: `…-phase-4a-effective-defaults.md`)*

**Goal:** `GET /api/config` gains a `_defaults` sibling block carrying the *effective* default values (the real resolved `output/`/`downloads/`/Whisper-cache paths, the `AppConfig()` defaults for everything else) so the UI's placeholders are true and `↺`-to-default (4b) knows the value — one round-trip, both pieces. Then the folder/path fields' placeholders become the resolved default path instead of `""`/Windows-cruft.

**Backend:** `api/routes/config.py` — `get_config()` returns `{ ..._to_camel(_mask_secrets(asdict(load_config())))..., "_defaults": _to_camel(_mask_secrets(<effective defaults>)) }` where `<effective defaults>` = `asdict(AppConfig())` with the path fields (`output_dir`, `download_dir`, `whisper_cache_dir`, and any others that resolve relative to CWD) replaced by their real resolved values. The executor must find where the pipeline/downloader/dependency-manager resolves those dirs when the config field is blank (CLAUDE.md: "resolved relative to the backend's CWD") and extract/reuse a small `effective_dirs()` helper. Pytest test for the `_defaults` block.

**api-client:** `types.ts` — `AppConfig` gets an optional `_defaults?: AppConfig` (or a dedicated `AppConfigDefaults` alias of the same shape); `client.ts` — `fetchConfig()` already returns the whole object, so the `_defaults` rides along; maybe a tiny `getEffectiveDefaults()` convenience or just read `config._defaults` in the frontend.

**Frontend:** `SettingsContext.tsx` exposes `defaults` (from `config._defaults`); the folder/path `SettingRow`s in `GeneralTab`/`YouTubeTab`/`SubtitlesTab` (`outputDir`, `downloadDir`, `whisperCacheDir`, `mpvPath`, `jsRuntimePath`) use `placeholder={defaults?.outputDir ?? ""}` etc. (and the helper text can say "Leave blank to use `<that path>`").

**Done means:** `GET /api/config` includes a `_defaults` block with real paths; the folder/path fields show those paths as ghost text; pytest green; typecheck clean.

---

## 4b — Hybrid autosave + per-field `↺` + per-tab "Reset this tab"

**Goal:** Replace the Save/Discard footer with the spec's Hybrid model: "safe" fields (toggles, dropdowns, segmented controls, the subtitle numbers/colors, source/target language, VAD, etc.) autosave on change (debounce ~400 ms → `POST /api/config` the delta → flash a quiet "✓ saved" pill; on failure show an inline "couldn't save — retry"). "Armed" fields (Backend URL, and — once 4e lands — the folder/path fields) keep the Edit→validate→Apply gate (Apply persists immediately too, under autosave). Every changed field shows a per-field `↺` (revert to the effective default from 4a) when it differs from that default; each tab footer has "Reset this tab"; Advanced keeps "Reset all to defaults" (`POST /api/config/reset`, already exists). This is where the spec's `useSettingsDraft.ts` hook is born — it subsumes today's `SettingsContext` draft/save logic.

**Files:** `apps/desktop/src/components/settings/` — new `useSettingsDraft.ts` (the debounced-autosave + per-field-dirty + reset hook; `SettingsContext` either becomes a thin wrapper over it or merges into it); `SettingRow.tsx` gains the `↺` button (shown when `value !== defaults[id]`); `ArmedField.tsx`'s `onApply` now also triggers an immediate save (or the autosave picks it up); `app/settings.tsx` — the footer becomes the "✓ saved" pill + per-tab "Reset this tab" + "Advanced › Reset all" (the Discard button goes away — or stays as "undo unsaved", but with autosave there's no "unsaved" state, so probably it goes). The `update(key, value)` API stays the same for callers; under the hood it now schedules a debounced `POST`.

**Backend:** none (uses `POST /api/config` partial updates, which already work, and `_defaults` from 4a).

**Done means:** flipping a toggle shows "✓ saved" and survives a reload with no Save click; a failed `POST` shows "couldn't save — retry" inline and keeps the change; `↺` on a changed field reverts it to the effective default and saves; "Reset this tab" reverts that tab's fields; "Reset all to defaults" still works; armed fields still gate. typecheck clean.

**Watch out:** the masked-secret fields (`geminiApiKey` etc.) — autosave must keep sending the `***` sentinel as "no change" the same way `onSave` does today; don't autosave a `***` value as the literal key. The `?tab=` query param + `searchQuery`/`highlightedSettingId` machinery from Phase 2 stays. Decide whether `backendUrl` autosaves on Apply (yes — match what `onSave` does today: `apiClient.setBaseUrl` + persist).

---

## 4c — Engine-driven Transcription tab  *(big — likely 2 sub-plans: 4c-backend, 4c-frontend)*

**Goal:** The Transcription tab stops being a hardcoded UI list and renders whatever the backend reports: an **engine descriptor list** + a **machine-compatibility report**, with per-engine model catalogs (sizes + download state, streamed via the existing `/api/dependencies` machinery, now engine-keyed), per-engine tunables, and a "Source: Auto · Whisper only · YouTube captions only" segmented control replacing today's engine/auto/yt_captions mix. Engines that aren't built yet still appear as "add-on (planned)", disabled, with a verdict + size.

**Backend (4c-backend):**
- `GET /api/system` → `{ os: "macos"|"windows"|"linux", arch: "arm64"|"x86_64", gpu: { vendor: "apple"|"nvidia"|"amd"|"intel"|"none", name, cudaAvailable, mpsAvailable } }` — supersedes the `cudaAvailable` hint currently tacked onto `/api/version`. (Detect via `platform`, `torch.cuda.is_available()`, `torch.backends.mps.is_available()`, maybe `subprocess` for the GPU name on macOS/Linux.)
- `GET /api/engines` → `[{ id, label, available: bool, packageSizeMb: number|null, requirements: {...}, models: [{ name, sizeMb, downloaded }], tunables: [{ key, label, type, choices?, default, help }] }]`. For now: `openai-whisper` (available; its models from `core/stt/whisper_local.py`'s `MODELS_URLS` with sizes & `dependency_manager`'s downloaded-state) + static "planned" stubs for `faster-whisper` / `whisperx` / `insanely-fast-whisper` (the real `faster-whisper` descriptor is a separate follow-up spec).
- `/api/dependencies` model-download endpoints gain an optional `engine` param (absent ⇒ today's Whisper behaviour — backward compatible).
- pytest for all three.

**api-client (4c-backend):** new types `SystemReport`, `EngineDescriptor`, `EngineModel`, `EngineTunable`; methods `getSystem()`, `getEngines()`; the dependency model-download methods gain an optional `engine` arg.

**Frontend (4c-frontend):** new components `EnginePicker.tsx` (renders the descriptor list: radio per engine, the machine-compat verdict line — `✓ works (…)` / `⚠ runs but no acceleration here (…)` / `✗ won't help on this hardware (…)` + "Best for your machine: …", per-engine tunables from the descriptor, the model rows with sizes + "Download (X GB)" + streaming progress); a "Source mode" `SegmentedControl` ("Auto · Whisper only · YouTube captions only") that maps onto `default_stt_engine` + `yt_captions_first`. `TranscriptionTab.tsx` is rewritten to use these (the Device / Source-language / VAD / FFmpeg-resample rows mostly stay; the model dropdown is replaced by the per-engine catalog). The Phase-2/3 `SettingRow`/search-index entries for the Transcription tab get updated.

**Done means:** the tab renders from `GET /api/engines` + `GET /api/system` with honest verdicts; picking a Whisper model that isn't downloaded shows "Download (X GB)" and streams progress; the Source-mode control round-trips to the config; the "planned" engines show but aren't selectable; pytest green; typecheck clean. (Out of scope: actually implementing `faster-whisper` — that's its own spec; 4c only consumes the contract.)

---

## 4d — Translation named-provider-profiles  *(big — likely 2 sub-plans: 4d-backend+migration, 4d-frontend)*

**Goal:** Replace the three fixed translator slots (`gemini` / `local_openai` / `openai`) with a **list of named provider profiles** + a chosen active one, with a real one-line-translation Test round-trip and structured errors.

**Backend (4d-backend):**
- `core/config.py` — add `custom_translators: list[dict]` (each `{ id, name, base_url, api_key, model }`) and `active_translator: str` = `"gemini" | "local_openai" | "custom:<id>"`. Keep `gemini_*` / `local_openai_*` as the two built-in profiles' storage. **Migration on load:** a non-empty legacy `openai_*` block becomes a `custom_translators` entry named "OpenAI"; legacy `translator_provider` maps to `active_translator`. (The current `load_config` filters unknown keys — extend it to do this migration.)
- `core/translator/__init__.py` — `get_translator` resolves `active_translator`: built-ins as today; `custom:<id>` → `OpenAICompatTranslator(base_url, api_key, model, name)` (the class already exists; just allow many, named, persisted).
- `POST /api/translator/test` — enhanced: accepts either an ad-hoc spec **or** an existing-profile id (+ `useSavedKey: true` → uses the persisted key server-side); does a **real one-line translation round-trip** (≈ `"Translate to {target language}. Reply with only the translation.\n\nHello, world."`); returns `{ ok, sample: {src, dst}, latencyMs, model, error }` where `error` is the actual cause (401, 404 model-not-found, DNS/connection-refused, timeout, non-OpenAI-shaped response, quota). Same round-trip for Gemini (via the SDK) and Local AI.
- `POST /api/translator/list-models` — already exists for OpenAI-compat; reused for the `↻` button on custom providers (no backend change needed beyond accepting an ad-hoc base_url/api_key).
- `api/routes/config.py` — the camelCase↔snake_case map + `_mask_secrets` updated for `custom_translators`/`active_translator`; `SECRET_KEYS` (or the masking logic) extended to cover the nested per-profile `api_key`s (mask each profile's `api_key` to `***` on GET; on POST, a `***` per-profile key = "keep the saved one").
- pytest: the migration (a `config.json` with legacy `openai_*` + `translator_provider="openai"` loads as a `custom_translators` entry that's active; round-trips through GET/POST with the new camelCase keys); `POST /api/translator/test` with an ad-hoc spec (mock the provider → round-trip) and with a saved-profile id + `useSavedKey` (uses the persisted key); structured error on bad key / bad model / unreachable.

**api-client (4d-backend):** new types for provider profiles + the structured test result; `testTranslator` updated to the structured result + the ad-hoc-spec-or-saved-id forms.

**Frontend (4d-frontend):** new components `ProviderRow.tsx` (radio = active, name, endpoint, model, last-test dot + timestamp, actions Test/Edit/Duplicate/Delete; built-ins can't be deleted) and the "+ Add provider" flow (preset menu — DeepSeek · Groq · OpenRouter · Together · Mistral · xAI · Fireworks · OpenAI · Custom… — prefilling name+endpoint → a form: name / endpoint / key / model with a `↻` to fetch `/v1/models` → Test → Save; "Duplicate" clones a row). `TranslationTab.tsx` rewritten to show the provider list + the active selection + the existing translate-by-default / auto-title / target-language rows. A safety banner when the active provider's last test failed (and surface it on the Generate screen's translation toggle — or note that as a follow-up). Deleting the active provider prompts for a replacement (Gemini is the fallback). The Phase-2 `SettingRow`/search-index entries for the Translation tab get updated (the provider-specific rows finally become searchable / properly handled).

**Done means:** add a DeepSeek-style provider from the preset → Test shows a real `"Hello, world." → "..."` round-trip (or a precise error); the active profile round-trips through the config; built-ins can't be deleted; the migration loads a legacy `openai_*` config correctly; pytest green; typecheck clean. (Out of scope: the Generate-screen per-job translator picker — its own follow-up spec.)

---

## 4e — Native polish: folder "Browse…" + armed folder/path fields + Test playback + Advanced Open-config/Export/Import  *(needs Rust)*

**Goal:** The native-integration bits the spec puts under "Native polish" that Phase 3 deferred: `tauri-plugin-dialog` for folder pickers, the folder/path fields become armed (read-only → Edit → validate exists & writable / executable → Apply, with "Browse…" in the Tauri runtime), the optional "Test playback" button (launch mpv on a tiny bundled clip with the current style), and Advanced's Open-config-folder / Export / Import.

**Tauri / Rust:** add `tauri-plugin-dialog` to `apps/desktop/src-tauri/Cargo.toml`, register the plugin in `src-tauri/src/lib.rs`, add a capability entry; add `@tauri-apps/plugin-dialog` to `apps/desktop/package.json`. A small `apps/desktop/src/lib/native.ts` wraps it: `isTauri()` guard + `openDirectoryDialog()` (and, for Test playback / Open-config-folder, either Tauri commands — `src-tauri/src/lib.rs` gains `#[tauri::command]`s — or backend endpoints; the backend runs on the user's machine so `subprocess.run(["open", path])` works for "open folder" and `mpv <clip> --sub-…` works for "test playback" — pick whichever is cleaner; a backend endpoint avoids a Rust round-trip but a Tauri command keeps it local). In `pnpm web` there's no Tauri runtime → `isTauri()` is false → "Browse…" and "Test playback" are hidden, folder fields fall back to typing (with the 4a resolved-default placeholder) — verifiable in the normal `pnpm web` flow; the native behaviour is only verifiable in `pnpm -F desktop tauri:dev` (needs `source "$HOME/.cargo/env"` first) or the packaged app.

**Backend:** a small "validate a path" endpoint (`POST /api/fs/check` → `{ exists, isDir, writable }` / `{ executable }`) for the armed folder/path fields' Apply step — OR do that check in a Tauri command (same call from `ArmedField`'s `validate`). Plus, if you go the backend route for "open config folder" / "test playback": `POST /api/system/open-config-dir`, `POST /api/system/test-playback`. pytest for whatever endpoints land. Bundle a tiny clip for Test playback (a few-second silent-ish video with a visible frame) under `backend/packaging/` or `src-tauri/`.

**Frontend:** the folder/path `SettingRow`s in `GeneralTab`/`YouTubeTab`/`SubtitlesTab` (`outputDir`, `downloadDir`, `whisperCacheDir`, `jsRuntimePath`, `mpvPath`) become `<ArmedField>` with a `validate` that calls the path-check, an `onApply` (via 4b's autosave), and — when `isTauri()` — a "Browse…" secondary action that opens the dir dialog and fills the value. The Subtitles tab gets a "Test playback" button next to the mpv-path armed field (Tauri-only). `AdvancedTab.tsx` gets "Open config folder" (opens `~/.yt_subtitle_tool/`), "Export settings" (download the config JSON), "Import settings" (file-pick a JSON → `POST /api/config` it). The Phase-2 `SettingRow`/search-index entries get any new ids.

**Done means:** in `pnpm dev` / the packaged app, "Browse…" opens a native folder picker and the armed field's Apply rejects a non-existent/non-writable dir with a reason; in `pnpm web` "Browse…"/"Test playback" are absent and the fields are plain text with the resolved-default placeholder; "Open config folder" opens the dir; Export downloads a JSON; Import applies one; "Test playback" launches mpv with the current style (Tauri only); pytest green; typecheck clean; the Rust crate builds (`source "$HOME/.cargo/env" && cd apps/desktop/src-tauri && cargo build`).

---

## Notes for whoever writes the sub-plans

- Re-read the relevant spec section before writing each (the spec has detailed prose on the engine descriptor shape, the provider-profile UI, the Hybrid save model, the error/edge states, and the per-feature backend changes — quote it).
- Each sub-plan should have the standard `superpowers:writing-plans` header (Goal / Architecture / Tech Stack / Spec ref / out-of-scope), a file-structure table, bite-sized tasks with literal code + commands + commits, and a self-review section. No placeholders.
- 4c and 4d are each XL — split them (backend+migration first, frontend second) so each plan is digestible and each commit-able unit is reviewable.
- 4e is the only one that needs `cargo`/`rustc`/`tauri` on PATH (`source "$HOME/.cargo/env"` in non-interactive shells, per CLAUDE.md) — flag that prominently and note that the native behaviour is only verifiable in `tauri:dev`/the packaged app while the `pnpm web` degradation is verifiable normally.
- Mind the pre-existing benign Metro warnings (`Require cycle: SettingsContext.tsx → shared.tsx → …`; `No font size found $4 …`) — 4b's `useSettingsDraft` refactor is a natural moment to break that `shared.tsx ↔ SettingsContext.tsx` cycle by extracting `TabId`/`TABS`/the constants into a leaf `types.ts`.
- The Save/Discard footer disappears in 4b — make sure nothing else (`app/settings.tsx`'s loading gate, etc.) depends on `dirty`/`onSave`/`onDiscard` after that; the `?tab=`/search/highlight machinery and the six tab components stay.
