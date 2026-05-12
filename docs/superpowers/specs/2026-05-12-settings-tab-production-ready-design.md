# Settings tab — production-ready redesign — Design

**Date:** 2026-05-12
**Branch:** v2.1
**Status:** Approved (pending spec review)

## Context

The Settings screen (`apps/desktop/app/settings.tsx`, ~1000 lines, one long scroll) is the weakest part of the v2 frontend, and its problems are mostly about **trust**, not layout:

- It advertises features that don't exist — the "Default engine" dropdown lists `faster-whisper ⭐`, `WhisperX`, `insanely-fast-whisper`; the backend STT registry only has `openai-whisper` + `yt_captions`, and `yt_captions` isn't even selectable. A ⭐ on a non-functional option destroys credibility.
- Buttons that lie — "Reset to defaults" calls `fetchConfig()`, which reloads the *current saved* config, not defaults. "Test" (translator) breaks after you save an API key, because the key comes back masked as `***`, the input round-trips it, and the test then sends `***`.
- Wrong-platform cruft — `placeholder="C:\\Users\\you\\Downloads"` on a macOS app; folder fields are bare text inputs with no "Browse…".
- A dangerous knob in plain sight — "Backend URL" is freely editable with no validation and no easy undo; point it wrong and the app is broken until you hand-edit `config.json`.
- The mpv subtitle section — 8 raw hex/pixel text inputs, no pickers, no preview — effectively unusable for a non-technical user.
- Structure — one long scroll, no section nav, no search.

**Goal:** make Settings something you'd ship — nothing in it misleads; it's structured and searchable; it feels like a real desktop app (folder pickers, color pickers, a subtitle preview); and saving/applying changes is safe and clear.

This spec covers the **Settings tab redesign + the backend/desktop changes it directly requires**. Three sizable adjacent features that came up during brainstorming are explicitly **out of scope here** and get their own specs (see "Follow-up specs" at the end).

## Scope

**In scope:** the Settings UI restructure (sub-tab rail + search), the Hybrid save model, the trust/correctness fixes, making the Transcription tab *engine-driven* (it renders whatever engines/models/tunables the backend reports, with machine-compatibility verdicts and downloadable model weights), the Translation tab's named-provider-profiles feature with a real Test round-trip, the Subtitles tab's live preview + proper controls, and the supporting backend endpoints + config-model changes + the `tauri-plugin-dialog` integration.

**Explicitly out of scope (own specs):**
1. **Implementing the `faster-whisper` STT provider** — the actual `core/stt/faster_whisper.py`, its pip dep, HF-Hub model download, and wiring its tunables. This spec only defines the *contract* the Settings tab consumes (engine metadata, model catalog, requirements descriptor); `openai-whisper` + `yt_captions` are the only engines that exist when this lands, and the tab handles that gracefully.
2. **The engine plugin-download system** — letting the *packaged* `.app` download heavyweight engine packages (WhisperX, insanely-fast-whisper) into a user folder. The Settings tab shows those engines with verdict + size but as "add-on (planned)".
3. **The Generate screen's per-job translator/engine picker** — exposing the new translation-provider profiles (and engine choices) per job on the Generate screen. Settings owns the *defaults*; Generate owns the *overrides*.

## IA — structure & navigation

The Settings route becomes a **two-pane layout inside the content area**: a narrow **sub-tab rail** on the left (inside the app's existing sidebar → so two levels of nav, like VS Code / Slack / macOS System Settings) and a single focused panel on the right, with a **search box** pinned to the top of the panel area.

**The six tabs:**

| Tab | Contents |
|---|---|
| **General** | Output folder · Download folder · Whisper cache folder · Logs verbosity. (All three folder fields get a "Browse…" button — see Desktop changes.) |
| **YouTube** | Cookie source (browser + profile, or a `cookies.txt` path) with the existing Test button and honest result copy · JS runtime for yt-dlp (shows the auto-detected one; warns if none). Everything about pulling video *from* YouTube. |
| **Transcription** | Engine picker (engine-driven — see below) with machine-compat verdicts and downloadable model weights · Device · Source language · VAD · FFmpeg 16 kHz pre-resample. |
| **Translation** | Translate-by-default · Auto-translate title · Target language · Provider profile list (named, incl. user-added DeepSeek-style endpoints) — see below. |
| **Subtitles** | mpv executable path (armed) · font · size · text/outline/background colors (real pickers) · outline width · bold · bottom margin — **with a live preview frame** · style presets · optional "Test playback". |
| **Advanced** | Backend URL (armed: Edit → ping `GET /api/version` → apply; one-click "Reset to 127.0.0.1:8000") · Open config folder · Export / Import settings · **Reset all to defaults** (danger zone — real backend reset). |

**Search:** a box at the top of the panel. Each setting carries a label + a few keyword aliases; typing filters to matching settings across all tabs, listed as `Tab › Setting`; clicking a result switches to that tab and highlights the field. Clear it → back to the current tab. Sub-tab + a `#field-id` hash give deep-linkable settings.

**File structure (frontend):** `apps/desktop/app/settings.tsx` stays as a single Expo Router route but becomes a **thin shell** — it renders the sub-tab rail + search + the active tab; the active tab is component state (or a tiny zustand slice) synced to the URL hash. The tab bodies move to `apps/desktop/src/components/settings/`: `GeneralTab.tsx`, `YouTubeTab.tsx`, `TranscriptionTab.tsx`, `TranslationTab.tsx`, `SubtitlesTab.tsx`, `AdvancedTab.tsx`, plus shared pieces: `SettingRow.tsx` (label + helper + control + per-field `↺`), `ArmedField.tsx` (locked → Edit → validate → apply), `ColorField.tsx`, `NumberStepper.tsx`, `Combobox.tsx`, `ProviderRow.tsx`, `EnginePicker.tsx`, `SubtitlePreview.tsx`, and `useSettingsDraft.ts` (the autosave/draft hook). Keep these local to the desktop app unless one turns out obviously reusable enough to promote into `packages/ui`.

## Save model — Hybrid

- **Safe fields autosave.** Toggles, dropdowns, segmented controls, the subtitle numbers/colors, source/target language, VAD, etc. — on change, debounce ~400 ms, `POST /api/config` the delta, and flash a quiet "✓ saved" pill on the tab footer. A failed write shows an inline "couldn't save — retry"; nothing is silently lost.
- **Armed fields.** Backend URL, Output folder, Download folder, Whisper cache folder, JS-runtime path, mpv executable path. Rendered read-only with the current value + a 🔒/"Edit". Editing opens an Apply/Cancel state; **Apply runs a real check before committing** — Backend URL → `GET /api/version` against it; folders → exists & writable; runtime/mpv path → executable. Pass = applied (Backend URL also calls `apiClient.setBaseUrl`). Fail = stays put, shows the reason, offers "Apply anyway". Backend URL additionally has a one-click "Reset to 127.0.0.1:8000".
- **Reset.** Per-field `↺` (revert to the shipped default — value comes from the backend's effective-defaults; shown only when the field differs). Per-tab "Reset this tab" in the footer. **"Reset all to defaults"** in Advanced (confirm dialog) → new `POST /api/config/reset`. (The current button is a no-op-ish lie and gets removed.)
- The `ArmedField` component is built early (it's needed for the Backend URL fix in phase 1) and reused.

## Trust & correctness fixes

| Problem | Fix |
|---|---|
| Fake STT engines | Drop `faster-whisper ⭐ / WhisperX / insanely-fast-whisper` from the static list and the ⭐. The Transcription tab renders only engines the backend reports as available (today: `openai-whisper`; plus the YT-captions "source mode"). Engines that aren't built yet still *appear* (per the user's request) but as "add-on / planned", disabled, with a machine-compat verdict and size. |
| "Reset to defaults" is a lie | New `POST /api/config/reset` returns `asdict(AppConfig())` (masked) and persists it; the Advanced button (with confirm) calls it. |
| "Test" breaks after saving a key | Stop round-tripping the mask through the input — show `•••• (saved)` + a "Replace" button; the input is empty unless replacing. `POST /api/translator/test` accepts either an ad-hoc spec (for testing before Save) or an existing provider id + `useSavedKey: true` (uses the persisted key server-side). |
| Wrong-platform copy | Replace `C:\Users\...` placeholders with the **actual resolved default path** (`~/Downloads`, the real output dir) — backend exposes effective defaults so placeholders are true and `↺`-to-default knows the value. |
| Backend URL exposed | Moves to Advanced; becomes an armed field with validation + one-click reset. |
| Whisper-model picker is blind | Show each model with its size and download state (`✓ downloaded · 1.6 GB` vs `not downloaded · Download (3.0 GB)`), streaming progress via the existing `/api/dependencies` machinery — Settings stops diverging from the Init screen. |
| Cookie "(may fail)" guesswork | Keep the Firefox-is-most-reliable guidance but lean on the real `Test` result (it already reports `cookieSource` / `cookiesAttached`) rather than pre-judging every option in its label. |
| Defaults vs. per-job is fuzzy | Every "default" gets one consistent line: "Default for new jobs — change it per-job on the Generate screen." |

## Transcription tab — engine-driven

The tab is driven by an **engine descriptor list** the backend provides, not a hardcoded UI list. Each descriptor: `{ id, label, available: bool, packageSizeMb: number|null, requirements: {...}, models: [{ name, sizeMb, downloaded }], tunables: [{ key, label, type, choices?, default, help }] }`.

- **Machine-compatibility verdict.** Backend exposes a system report via a new dedicated `GET /api/system`: `{ os: "macos"|"windows"|"linux", arch: "arm64"|"x86_64", gpu: { vendor: "apple"|"nvidia"|"amd"|"intel"|"none", name, cudaAvailable, mpsAvailable } }` — superseding the `cudaAvailable` hint currently tacked onto `/api/version`. The UI combines that with each engine's `requirements` to render `✓ works (…)` / `⚠ runs but no acceleration here (…)` / `✗ won't help on this hardware (…)`, plus a "Best for your machine: …" line.
- **Downloadable model weights with sizes.** For an available engine, its `models` list shows sizes; un-downloaded ones say "Download (X GB)" and stream progress via `/api/dependencies` / `/api/dependencies/install` — the existing mechanism, extended to be engine-keyed (an optional `engine` param; absent ⇒ today's Whisper behaviour, so it stays backward compatible).
- **Per-engine tunables.** Rendered from the descriptor's `tunables` (e.g. faster-whisper's `compute_type` ∈ {int8, int8_float16, float16, float32}, `beam_size`, `vad_filter`). The UI hardcodes nothing engine-specific.
- **Source mode** (replaces today's confusing engine/auto/yt_captions mix): a segmented "Source: Auto · Whisper only · YouTube captions only" — Auto = use YouTube's captions if present, else the chosen Whisper-family engine. Maps cleanly onto the existing `default_stt_engine` / `yt_captions_first` config values.
- Until the backend grows more engines, the descriptor list is `[openai-whisper (available)]` plus static "planned" stubs for the others — the tab looks complete and is honest.

## Translation tab — named provider profiles

Replace the three fixed slots (`gemini` / `local_openai` / `openai`) with a **list of provider profiles** + a chosen active one.

- **Config shape change** (`backend/core/config.py`): add `custom_translators: list[dict]` where each entry is `{ id, name, base_url, api_key, model }`; add `active_translator: str` = `"gemini" | "local_openai" | "custom:<id>"`. Keep `gemini_*` / `local_openai_*` as the two built-in profiles' storage. **Migration:** on load, a non-empty legacy `openai_*` block becomes a `custom_translators` entry named "OpenAI"; legacy `translator_provider` maps to `active_translator`. The masked-secret handling extends to per-profile `api_key`s.
- **`core/translator/__init__.py`:** `get_translator` resolves `active_translator` — built-ins as today; `custom:<id>` → `OpenAICompatTranslator(base_url, api_key, model, name)` (the class already exists; we just allow many, named, persisted).
- **UI:** the tab shows the provider list (rows: radio = active, name, endpoint, model, last-test dot + timestamp, actions Test/Edit/Duplicate/Delete; built-ins can't be deleted). "+ Add provider" → preset menu (DeepSeek · Groq · OpenRouter · Together · Mistral · xAI · Fireworks · OpenAI · Custom…) prefilling name+endpoint → form (name / endpoint / key / model with `↻` to fetch `/v1/models`) → Test → Save. "Duplicate" clones a row.
- **`POST /api/translator/test`** (enhance the existing one): accepts an ad-hoc spec or an existing-profile id (+ `useSavedKey`); performs a **real one-line translation round-trip** (roughly `"Translate to {target language}. Reply with only the translation.\n\nHello, world."`); returns `{ ok, sample: {src, dst}, latencyMs, model, error }`. On failure the `error` is the actual cause — 401, model-not-found (404), DNS/connection refused, timeout, non-OpenAI-shaped response, quota exceeded. The same round-trip pattern applies to Gemini (via the SDK) and Local AI.
- **`POST /api/translator/list-models`** (already exists for OpenAI-compat) — reused for the `↻` button on custom providers.
- **Safety:** if the active provider's last test failed, a banner on the tab (and surfaced on the Generate screen's translation toggle): "Translation may fail — DeepSeek's last test failed (401)…". Deleting the active provider prompts for a replacement (Gemini is the fallback).

## Subtitles tab — live preview + real controls

- **Live preview frame** — a mock video still (a dark gradient image) with sample subtitle text rendered (HTML/CSS approximation of mpv's output — not pixel-exact but good enough to dial in the look). Two lines (shows wrapping) including a CJK line (the common translation target — catches missing-glyph fonts). Fields left at "default" render mpv's real default value, greyed.
- **Controls:** native color pickers (swatch + hex; background gets an alpha control) for text/outline/background; `NumberStepper` for size / outline-width / bottom-margin; a font `Combobox` (curated list of safe fonts + "type a custom name", with a "must be installed on your OS — mpv won't download fonts" warning); a bold toggle. A few **style presets** (Clean white · YouTube-style box · Big & bold · Reset to mpv defaults).
- **Underlying config fields and "blank = mpv default" semantics are unchanged** — only the controls and the preview are new, so anyone who's already tuned this loses nothing.
- `mpv executable path` is an armed field. Optional "Test playback" button (launch mpv on a tiny bundled clip with the current style) — flagged as polish-phase.

## Backend changes (summary)

1. `POST /api/config/reset` → reset to `AppConfig()` defaults, return masked config.
2. Effective defaults — `GET /api/config` gains a `_defaults` sibling block carrying the real default values/paths, so the UI knows what placeholders to show and what `↺` reverts to (one round-trip, both pieces).
3. `GET /api/system` → OS / arch / GPU report (see Transcription).
4. `GET /api/engines` → the engine descriptor list (id, label, available, packageSizeMb, requirements, models[], tunables[]). For now it reflects `openai-whisper` (available) + static "planned" stubs; the faster-whisper follow-up spec fleshes out a real descriptor.
4b. `/api/dependencies` model-download endpoints gain an optional `engine` param (absent ⇒ today's Whisper behaviour — backward compatible).
5. `core/config.py` — `custom_translators` + `active_translator` fields; migration from `openai_*` + `translator_provider`; per-profile secret masking.
6. `core/translator/__init__.py` — `get_translator` resolves `active_translator` incl. `custom:<id>`.
7. `POST /api/translator/test` — enhanced (real round-trip; accepts ad-hoc spec or saved-profile id + `useSavedKey`; structured `{ok, sample, latencyMs, model, error}`).
8. The config camelCase↔snake_case mapping (`backend/api/routes/config.py`) updated for the new fields; `SECRET_KEYS` covers nested per-profile keys.

## Desktop / Tauri changes

- **`tauri-plugin-dialog`** added (`apps/desktop/src-tauri/Cargo.toml` + `@tauri-apps/plugin-dialog` + a capability entry) for the folder "Browse…" buttons (open-directory dialog). A small `apps/desktop/src/lib/native.ts` wraps it with an `isTauri()` guard — **in the `pnpm web` dev flow there's no Tauri runtime, so "Browse…" is hidden/disabled and you fall back to typing the path** (with the resolved-default placeholder). Same guard gates the optional "Test playback" button.
- `app/settings.tsx` decomposed as described in "File structure".
- New local UI components: `SettingRow`, `ArmedField`, `ColorField`, `NumberStepper`, `Combobox`, `ProviderRow`, `EnginePicker`, `SubtitlePreview`, `useSettingsDraft`.
- `packages/api-client` — new types (provider profiles, engine descriptors, system report, structured test result, effective defaults) + methods: `resetConfig`, `getSystem`, `getEngines`; `testTranslator` updated to the structured result + ad-hoc-spec-or-saved-id forms; the dependency model-download methods gain an optional `engine` argument.

## Error handling / edge states

- **Armed-field Apply fails validation** → field stays at the old value, inline reason shown, "Apply anyway" offered.
- **Autosave POST fails** → inline "couldn't save — retry" on that field; the draft keeps the change so the user doesn't lose it.
- **Active translator's last test failed** → warning banner on the Translation tab + on the Generate screen's translation toggle.
- **Delete the active translator** → prompt to choose a new active one (cannot be left with none).
- **Engine not available** → shown in the list with verdict + size + "add-on (planned)"; not selectable.
- **No Tauri runtime (`pnpm web`)** → "Browse…" and "Test playback" hidden; folder/path fields are plain text with resolved-default placeholders; everything else works.
- **Backend unreachable** → Settings shows the existing "can't load config" state; no crash.
- **Hand-edited / older `config.json`** → `load_config` already filters unknown keys; migration code fills in the new fields.

## Verification

**Backend (pytest):**
- `POST /api/config/reset` returns + persists `AppConfig()` defaults (secrets masked).
- `GET /api/system` returns plausible OS/arch/GPU on the test machine.
- Engine descriptor endpoint returns `openai-whisper` available + the planned stubs; model catalog reflects `/api/dependencies` state.
- `POST /api/translator/test`: with an ad-hoc spec → does a round-trip (mock the provider); with a saved-profile id + `useSavedKey` → uses the persisted key; structured error on bad key / bad model / unreachable.
- Config migration: a `config.json` with legacy `openai_*` + `translator_provider="openai"` loads as a `custom_translators` entry that's the active one; round-trips through GET/POST with the new camelCase keys.
- Existing suite still green.

**Frontend:** `pnpm -F desktop typecheck`, plus manual e2e in `pnpm dev` (or `pnpm web` + backend): open Settings → the six sub-tabs render; search "gemini key" / "outline" jumps correctly; flip a toggle → "✓ saved" pill, reload → it stuck; edit "Backend URL" to a bogus host → Apply rejects with a reason → "Reset to 127.0.0.1:8000" works; "Browse…" opens a native folder picker in `pnpm dev` and is absent in `pnpm web`; add a DeepSeek provider from the preset → Test shows a real `"Hello, world." → "..."` round-trip (or a precise error); `↺` on a changed field reverts it; "Reset all to defaults" (confirm) wipes back to defaults; tweak subtitle font/size/colors → the preview updates; pick a Whisper model that isn't downloaded → "Download (X GB)" streams progress.

## Phasing (for the implementation plan)

- **Phase 1 — Trust/correctness, in the *current* single-scroll layout.** Cut fake engines; `POST /api/config/reset` + wire the real Reset; masked-key/`Test`-after-save fix; platform-correct placeholders + effective-defaults endpoint; Whisper-model picker shows installed/download-able; move Backend URL into a (new, reusable) `ArmedField` with validation. Ships standalone value; no structural churn yet.
- **Phase 2 — IA restructure.** Sub-tab rail + search; decompose `settings.tsx` into the per-tab components; re-home settings into the six tabs.
- **Phase 3 — Native polish.** `tauri-plugin-dialog` + folder "Browse…" (with web-flow degradation); Subtitles tab — `ColorField`, `NumberStepper`, font `Combobox`, presets, live `SubtitlePreview`; optional "Test playback".
- **Phase 4 — Lifecycle + the rest.** Hybrid autosave for safe fields; per-field/per-tab `↺`; the engine-descriptor-driven Transcription tab + `GET /api/system` + machine-compat verdicts + engine-keyed model downloads; the Translation named-provider-profiles feature (`custom_translators` config, migration, the provider list UI, enhanced `/api/translator/test`); Advanced's Open-config-folder / Export / Import.

(P1 is independently shippable; whether the implementation plan is one phased document or P1-as-its-own-plan-then-P2-4 is a call for the writing-plans step.)

## Follow-up specs (created after this one)

1. **`faster-whisper` STT provider** — implement the provider, its pip dep, HF-Hub model download, and wire its tunables into the engine descriptor this spec consumes. Likely bundled into the packaged app (small deps).
2. **STT engine plugin-download system** — let the packaged `.app` fetch heavyweight engine packages (WhisperX, insanely-fast-whisper) into a user folder and add them to `sys.path`.
3. **Generate screen — per-job translator & engine pickers** — surface the new translation-provider profiles (and engine choices) per job on the Generate screen.
