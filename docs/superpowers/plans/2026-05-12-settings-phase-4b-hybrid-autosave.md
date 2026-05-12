# Settings Tab — Phase 4b: Hybrid Autosave + Per-Field `↺` + Per-Tab "Reset this tab" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Each task = one reviewable commit; the codebase must be green (`pnpm -F desktop typecheck` clean) after every task.

**Goal:** Replace the Settings screen's Save/Discard footer with the spec's **Hybrid save model**: "safe" fields (toggles, dropdowns, segmented controls, the subtitle numbers/colors, source/target language, VAD, etc.) **autosave on change** — debounce ~400 ms → `POST /api/config` the delta → flash a quiet "✓ saved" pill; a failed write shows an inline "couldn't save — retry" and keeps the change. "Armed" fields (today just **Backend URL**; folder/path fields become armed in Phase 4e) keep their Edit→validate→Apply gate, but Apply now also persists immediately under the autosave machinery. Every changed field shows a per-field `↺` that reverts it to the **effective default** (the `_defaults` block added in Phase 4a) — shown only when the field differs from that default. Each tab's footer gets a **"Reset this tab"** button; Advanced keeps its existing **"Reset all to defaults"** (`POST /api/config/reset`). This is where the spec's `useSettingsDraft.ts` hook is born — it subsumes today's `SettingsContext` draft/save logic.

**Architecture:** Frontend-only. New leaf module `apps/desktop/src/components/settings/constants.ts` holds `TabId` / `TABS` / `MASK` / `isMasked` / the dropdown-option arrays / `WHISPER_MODEL_IDS` / `STT_ENGINE_LABELS` / `buildModelOptions` — extracted out of `shared.tsx` so it no longer `import`s from `SettingsContext.tsx` (breaking the long-standing `Require cycle: SettingsContext.tsx → shared.tsx → SettingsContext.tsx` Metro warning). New `useSettingsDraft.ts` hook owns `config` + `draft` + a debounced-autosave engine (`update(key,value)` schedules a debounced `POST /api/config` of just the deltas), a save-status machine (`idle | saving | saved | error` + the set of field-ids that failed to save), `revertField(id)` (set to `_defaults[id]`, then save), and `resetTab(tabId)` (revert that tab's fields to `_defaults`, then save). `SettingsContext` becomes a **thin wrapper**: it still owns the version/deps/test-handler/`activeTab`/`searchQuery`/`highlightedSettingId` surface and the masked-key UI state, but delegates `config`/`draft`/`update`/save-status/`revertField`/`resetTab` to `useSettingsDraft`. `SettingRow` gains the `↺` button (resolves its `id` → an `AppConfig` key via a small `SETTING_FIELD` map and shows `↺` when `draft[key] !== defaults[key]`). `app/settings.tsx`'s footer becomes the "✓ saved" pill + "Reset this tab"; the `dirty`/`onSave`/`onDiscard` surface goes away. `ArmedField`'s `onApply` callers persist immediately (the autosave catches it the same as any `update`). **No backend change** — `POST /api/config` already does partial updates with the `***`-keeps-saved-secret rule, and `_defaults` arrives via Phase 4a; `POST /api/config/reset` already exists.

**Tech Stack:** Expo SDK 51 + Expo Router + Tamagui + react-native-web (`apps/desktop`); TypeScript fetch client `@yt-subtitle-maker/api-client` (`packages/api-client`); no JS test framework in the repo — per-task verification is `pnpm -F desktop typecheck` (clean) **plus** the manual eyeball each task describes, run against `pnpm web` (→ http://localhost:8081) with the backend up (`cd backend && ../backend/.venv/bin/python -m uvicorn api.main:app --host 127.0.0.1 --port 8000 --reload`).

**Spec:** `docs/superpowers/specs/2026-05-12-settings-tab-production-ready-design.md` — **"Save model — Hybrid"** ("Safe fields autosave. … on change, debounce ~400 ms, `POST /api/config` the delta, and flash a quiet '✓ saved' pill on the tab footer. A failed write shows an inline 'couldn't save — retry'; nothing is silently lost." / "Armed fields. … Apply runs a real check before committing … Backend URL also calls `apiClient.setBaseUrl`." / "Reset. Per-field `↺` (revert to the shipped default — value comes from the backend's effective-defaults; shown only when the field differs). Per-tab 'Reset this tab' in the footer. 'Reset all to defaults' in Advanced (confirm dialog) → new `POST /api/config/reset`."); the **"Trust & correctness fixes"** rows about `↺`/reset and "Test breaks after saving a key" (the `***`-sentinel discipline); **"Error handling / edge states"** (a failed autosave keeps the value + offers retry); the **"File structure (frontend)"** note that lists `useSettingsDraft.ts` as the autosave/draft hook and `SettingRow.tsx` as "label + helper + control + per-field `↺`". Also `docs/superpowers/plans/2026-05-12-settings-phase-4-overview.md` → section "4b" and "Notes for whoever writes the sub-plans" (break the `shared.tsx ↔ SettingsContext.tsx` require-cycle by extracting `TabId`/`TABS`/the constants into a leaf module; the Save/Discard footer disappears so nothing else may depend on `dirty`/`onSave`/`onDiscard`). Predecessor: `docs/superpowers/plans/2026-05-12-settings-phase-4a-effective-defaults.md` (shipped) added `_defaults?: AppConfig` to the `GET/POST /api/config` responses and `SettingsContext.defaults = config?._defaults`; this plan **consumes** `_defaults`.

**Out of scope for 4b (do not pull in):**
- **Arming the folder/path fields** (`outputDir`, `downloadDir`, `whisperCacheDir`, `mpvPath`, `jsRuntimePath`) + the "Browse…" native folder picker (`tauri-plugin-dialog`) — that's **Phase 4e**. (4b only generalises `ArmedField`'s already-existing Backend-URL use to persist via autosave; it adds **no new armed fields**.)
- The **engine-driven Transcription tab** (`GET /api/system`, `GET /api/engines`, machine-compat verdicts, engine-keyed model downloads, the Source-mode segmented control) — **Phase 4c**.
- The **Translation named-provider-profiles** rework (`custom_translators` / `active_translator` config, migration, `ProviderRow`, enhanced `POST /api/translator/test`) — **Phase 4d**. The masked-key UI in `TranslationTab` (`replacingKey`, `isMasked`) keeps working exactly as it does today; this plan only ensures autosave keeps obeying the `***`-sentinel rule.
- **Any backend change** — `POST /api/config` partial updates already work (and already implement "`***` for a `SECRET_KEY` means keep the saved value"); `POST /api/config/reset` already exists; `_defaults` came in with 4a. No new endpoints, no `core/` change, no Rust.
- Promoting any of these components into `packages/ui` — keep them local to the desktop app.

**Prerequisites:** `pnpm install` done; Phase 4a merged (so `GET /api/config` returns `_defaults` and `SettingsContext` exposes `defaults`). Manual checks need the backend running (`uvicorn`, :8000) + `pnpm web` (:8081). No Rust, no Python venv changes.

---

## File structure

| File | Change |
|---|---|
| `apps/desktop/src/components/settings/constants.ts` | **New leaf module** (imports nothing from the settings folder). Holds `TabId`, `TABS`, `MASK`, `isMasked`, `COOKIE_BROWSERS`, `VERBOSITY`, `STT_ENGINE_LABELS`, `WHISPER_MODEL_IDS`, `DEVICES`, `LANGS`, `buildModelOptions`, **and** a new `SETTING_FIELD: Record<string, keyof AppConfig>` mapping each `SettingRow` id (e.g. `"general.output-dir"`) to its `AppConfig` key (e.g. `"outputDir"`). |
| `apps/desktop/src/components/settings/shared.tsx` | Drop the constants/`TabId`/`TABS`/`MASK`/etc. (now re-exported from `constants.ts` for back-compat, or callers updated — Task 1 updates callers). Keep `Section`, `Field`, `SettingRow`. `SettingRow` gains the per-field `↺` (Task 3). Stops importing from `SettingsContext.tsx` only for the constants — it still uses `useSettings()` for `highlightedSettingId` (that's a one-way edge, not a cycle). |
| `apps/desktop/src/components/settings/useSettingsDraft.ts` | **New hook.** Owns `config`/`draft`; `update(key,value)` schedules a debounced (~400 ms) `POST /api/config` of the accumulated deltas; tracks `saveStatus: "idle"|"saving"|"saved"|"error"` + `failedFields: Set<keyof AppConfig>`; `retrySave()`; `revertField(id)` (set to `_defaults[id]` + save now); `resetTab(tabId)` (set every field of that tab to `_defaults[...]` + save now); `flush()` (fire any pending debounced save immediately — used on unmount); the `***`-sentinel discipline (never POST a literal `***` for a secret key — mirror today's `onSave`). Exposes `setConfig`/`setDraft` for the "Reset all" path in `AdvancedTab`. |
| `apps/desktop/src/components/settings/SettingsContext.tsx` | Becomes a thin wrapper over `useSettingsDraft`: keeps version/deps/test-handler/masked-key-UI/`activeTab`/`searchQuery`/`highlightedSettingId` state; re-exposes `config`/`draft`/`defaults`/`update`/`saveStatus`/`failedFields`/`retrySave`/`revertField`/`resetTab`/`setConfig`/`setDraft` from the hook. Drops `dirty`/`saving`/`onSave`/`onDiscard` from the value (and the interface). `update`'s signature is unchanged. |
| `apps/desktop/app/settings.tsx` | Footer rewrite: remove the Save/Discard buttons + the `unsaved changes`/`all saved` badge + the "Click Save settings to apply changes." caption; add a "✓ saved" status pill driven by `saveStatus` (and a "couldn't save — retry" affordance when `saveStatus === "error"`) + a per-tab **"Reset this tab"** ghost button (→ `resetTab(activeTab)`, disabled when no field on that tab differs from `_defaults`). Stop destructuring `dirty`/`saving`/`onSave`/`onDiscard`. Keep the `?tab=`/`searchQuery` machinery and the loading gate (which now keys off `loading`/`draft`, not `dirty`). |
| `apps/desktop/src/components/settings/AdvancedTab.tsx` | "Reset all to defaults" path unchanged in behaviour (`apiClient.resetConfig()` → `setConfig`/`setDraft`/`apiClient.setBaseUrl`), but pulls `setConfig`/`setDraft` from the (now hook-backed) context — verify it still compiles. `ArmedField`'s Backend-URL `onApply` already calls `update("backendUrl", v)` + `apiClient.setBaseUrl(v)` — under the new `update`, that schedules an autosave; **no code change needed there**, but the plan calls it out as the spec's "Apply persists immediately" requirement and the verify step checks it sticks across reload. |
| `apps/desktop/src/components/settings/SettingsRail.tsx`, `SettingsSearch.tsx`, `searchIndex.ts`, `GeneralTab.tsx`, `YouTubeTab.tsx`, `TranscriptionTab.tsx`, `TranslationTab.tsx`, `SubtitlesTab.tsx`, `app/settings.tsx` | Import `TabId`/`TABS`/`MASK`/`isMasked`/`COOKIE_BROWSERS`/`VERBOSITY`/`DEVICES`/`LANGS`/`buildModelOptions`/`WHISPER_MODEL_IDS`/`STT_ENGINE_LABELS` from `./constants` instead of `./shared` (Task 1). No behaviour change. |

## Note on testing

The repo has **no JS test framework** — do not add one. Per-task verification:
- `pnpm -F desktop typecheck` → must be clean.
- The manual eyeball each task spells out, run against `pnpm web` (http://localhost:8081/settings) with the backend up. Watch the browser console for **Metro require-cycle warnings**: the `Require cycle: …/SettingsContext.tsx -> …/shared.tsx -> …/SettingsContext.tsx` warning **must disappear after Task 1** and stay gone; the unrelated `No font size found $4 …` warning is pre-existing, harmless, and stays. No new require-cycle warning may appear (`useSettingsDraft.ts` must not import `SettingsContext.tsx`; `constants.ts` must import nothing from the settings folder).
- After Task 4: a full smoke pass — open Settings, flip a toggle on each tab, see "✓ saved", **reload the page**, confirm it stuck (no Save click); `?tab=subtitles` deep-links correctly; search "gemini key" → click result → switches tab + highlights; `↺` shows on a changed field and reverts it; "Reset this tab" reverts the active tab; "Reset all to defaults" still wipes everything; the Backend-URL armed field's Apply still gates and the value sticks across reload.

---

### Task 1: Extract `TabId`/`TABS`/constants into a leaf `constants.ts` — break the require-cycle

**Why first:** every later task imports from this module, and breaking the `SettingsContext ↔ shared` cycle now means the rest of the refactor doesn't reintroduce it.

**Files:** New `apps/desktop/src/components/settings/constants.ts`; modify `shared.tsx`, `SettingsContext.tsx`, `SettingsRail.tsx`, `SettingsSearch.tsx`, `searchIndex.ts`, `GeneralTab.tsx`, `YouTubeTab.tsx`, `TranscriptionTab.tsx`, `TranslationTab.tsx`, `SubtitlesTab.tsx`, `AdvancedTab.tsx`, `app/settings.tsx`.

- [ ] **Step 1: Create `constants.ts`**

```typescript
// apps/desktop/src/components/settings/constants.ts
// Leaf module: imports NOTHING from the settings folder (only the api-client
// type). Holds the tab list, the masked-secret sentinel, the dropdown option
// arrays, and the SettingRow-id → AppConfig-key map. Splitting these out of
// shared.tsx breaks the old `SettingsContext.tsx -> shared.tsx -> SettingsContext.tsx`
// Metro require-cycle warning.
import type { AppConfig } from "@yt-subtitle-maker/api-client";

export const MASK = "***";
export const isMasked = (v: string | undefined): boolean => v === MASK;

export type TabId =
  | "general"
  | "youtube"
  | "transcription"
  | "translation"
  | "subtitles"
  | "advanced";

export const TABS: { id: TabId; label: string }[] = [
  { id: "general", label: "General" },
  { id: "youtube", label: "YouTube" },
  { id: "transcription", label: "Transcription" },
  { id: "translation", label: "Translation" },
  { id: "subtitles", label: "Subtitles" },
  { id: "advanced", label: "Advanced" },
];

export const COOKIE_BROWSERS = [
  { label: "None", value: "" },
  { label: "Firefox (recommended)", value: "firefox" },
  { label: "Chrome (may fail)", value: "chrome" },
  { label: "Edge (may fail)", value: "edge" },
  { label: "Brave (may fail)", value: "brave" },
  { label: "Opera (may fail)", value: "opera" },
];

export const VERBOSITY = [
  { label: "Error", value: "error" },
  { label: "Warning", value: "warning" },
  { label: "Info", value: "info" },
  { label: "Debug", value: "debug" },
];

// Human labels for STT engine ids the backend may report as installed.
export const STT_ENGINE_LABELS: Record<string, string> = {
  auto: "Auto — use YouTube's captions if present, else Whisper",
  "openai-whisper": "openai-whisper (the reference engine)",
  yt_captions: "YouTube captions only",
};

// base id list — keep in sync with the backend's MODELS_URLS keys.
export const WHISPER_MODEL_IDS = ["tiny", "base", "small", "medium", "turbo", "large-v3"];

export const DEVICES = [
  { label: "Auto", value: "auto" },
  { label: "CPU", value: "cpu" },
  { label: "GPU", value: "gpu" },
];

export const LANGS = [
  { label: "English", value: "en" },
  { label: "中文", value: "zh" },
  { label: "日本語", value: "ja" },
  { label: "한국어", value: "ko" },
  { label: "Español", value: "es" },
  { label: "Français", value: "fr" },
  { label: "Deutsch", value: "de" },
  { label: "Português", value: "pt" },
  { label: "Tiếng Việt", value: "vi" },
];

/** Build dropdown option lists; if the saved value isn't in `fetched`, prepend
 * it as a "(current)" option so the dropdown can still render it. */
export const buildModelOptions = (
  fetched: string[],
  current: string | undefined,
): { label: string; value: string }[] => {
  const set = new Set(fetched);
  const out = fetched.map((m) => ({ label: m, value: m }));
  if (current && !set.has(current)) {
    out.unshift({ label: `${current} (current)`, value: current });
  }
  return out;
};

/**
 * SettingRow `id` → the `AppConfig` key it edits. Used by the per-field `↺`
 * (Task 3) to know which config value a row owns and what its effective default
 * is. Rows whose id is NOT in this map don't get a `↺` (e.g. armed-field rows,
 * the "Reset all" row, the cookie-Test row, the masked-key Replace rows — those
 * are handled by their own affordances). Keys must match the `nativeID`s used in
 * the tab components and the entries in `searchIndex.ts`.
 */
export const SETTING_FIELD: Partial<Record<string, keyof AppConfig>> = {
  // General
  "general.output-dir": "outputDir",
  "general.download-dir": "downloadDir",
  "general.whisper-cache-dir": "whisperCacheDir",
  "general.logs-verbosity": "logsVerbosity",
  // YouTube
  "youtube.cookie-source": "cookieBrowser",
  "youtube.cookie-profile": "cookieProfile",
  "youtube.cookies-txt-path": "cookiesTxtPath",
  "youtube.js-runtime-path": "jsRuntimePath",
  // Transcription
  "transcription.engine": "defaultSttEngine",
  "transcription.model": "defaultWhisperModel",
  "transcription.device": "defaultWhisperDevice",
  "transcription.source-lang": "defaultSourceLang",
  "transcription.yt-captions-first": "ytCaptionsFirst",
  "transcription.vad": "vadEnabled",
  "transcription.ffmpeg-resample-16k": "ffmpegResample16k",
  // Translation
  "translation.provider": "translatorProvider",
  "translation.target-lang": "defaultTargetLang",
  "translation.enable-by-default": "enableTranslation",
  "translation.auto-translate-title": "autoTranslateTitle",
  // Subtitles
  "subtitles.mpv-path": "mpvPath",
  "subtitles.font": "subFont",
  "subtitles.font-size": "subFontSize",
  "subtitles.margin-y": "subMarginY",
  "subtitles.color": "subColor",
  "subtitles.border-color": "subBorderColor",
  "subtitles.border-size": "subBorderSize",
  "subtitles.back-color": "subBackColor",
  "subtitles.bold": "subBold",
  // Advanced — `advanced.backend-url` is an armed field (no ↺ row affordance;
  // it has "Reset to 127.0.0.1:8000" instead); `advanced.reset-all` isn't a field.
};

/** All SettingRow ids that belong to a given tab (derived from the id prefix). */
export const tabOfSettingId = (id: string): TabId | undefined => {
  const prefix = id.split(".")[0];
  return (TABS.some((t) => t.id === prefix) ? (prefix as TabId) : undefined);
};
```

- [ ] **Step 2: Slim `shared.tsx`**

Remove from `shared.tsx`: the `MASK`/`isMasked` consts, `COOKIE_BROWSERS`, `VERBOSITY`, `STT_ENGINE_LABELS`, `WHISPER_MODEL_IDS`, `DEVICES`, `LANGS`, `buildModelOptions`, `type TabId`, `TABS`. Keep `Section`, `Field`, `SettingRow` and `import { useSettings } from "./SettingsContext"` (that's the one-directional edge `shared → SettingsContext`, used only for `highlightedSettingId`; with the constants gone there's no path back from `SettingsContext` to `shared`, so no cycle). At the bottom of `shared.tsx`, for back-compat during the refactor, you *may* re-export: `export { MASK, isMasked, TABS, type TabId, ... } from "./constants";` — but it's cleaner to just update the importers (next step) and not re-export.

- [ ] **Step 3: Repoint importers**

Update these import sites (from `"./shared"` / `"../shared"` to `"./constants"`; keep `Section`/`Field`/`SettingRow` coming from `"./shared"`):
- `SettingsContext.tsx`: `import { STT_ENGINE_LABELS, TABS, WHISPER_MODEL_IDS, type TabId } from "./constants";` (keep nothing from `./shared` — it no longer imports `shared`, which is the cycle break).
- `SettingsRail.tsx`: `import { TABS } from "./constants";`
- `SettingsSearch.tsx`: `import { TABS } from "./constants";`
- `searchIndex.ts`: `import type { TabId } from "./constants";`
- `GeneralTab.tsx`: `import { Section, SettingRow } from "./shared"; import { VERBOSITY } from "./constants";`
- `YouTubeTab.tsx`: `import { Section, SettingRow } from "./shared"; import { COOKIE_BROWSERS } from "./constants";`
- `TranscriptionTab.tsx`: `import { Section, SettingRow } from "./shared"; import { DEVICES, LANGS } from "./constants";`
- `TranslationTab.tsx`: `import { Section, SettingRow } from "./shared"; import { buildModelOptions, isMasked, LANGS } from "./constants";`
- `SubtitlesTab.tsx`: `import { Section, SettingRow } from "./shared";` (it imports only `Section`/`SettingRow` today — leave it, or split if it also pulls a constant; check the file).
- `AdvancedTab.tsx`: `import { Section, SettingRow } from "./shared";` (unchanged).
- `app/settings.tsx`: `import { Section } from "../src/components/settings/shared"; import { type TabId } from "../src/components/settings/constants";`

- [ ] **Step 4: Verify**

`pnpm -F desktop typecheck` → clean. Then with backend + `pnpm web` running, open http://localhost:8081/settings: the screen renders identically; all six tabs work; search works; **open the browser console** — the `Require cycle: …/SettingsContext.tsx -> …/shared.tsx -> …/SettingsContext.tsx` warning is **gone**; the `No font size found $4 …` warning may still be there (unrelated, ignore); **no new** `Require cycle` warning involving `constants.ts`/`useSettingsDraft.ts` appears.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/components/settings/constants.ts apps/desktop/src/components/settings/shared.tsx apps/desktop/src/components/settings/SettingsContext.tsx apps/desktop/src/components/settings/SettingsRail.tsx apps/desktop/src/components/settings/SettingsSearch.tsx apps/desktop/src/components/settings/searchIndex.ts apps/desktop/src/components/settings/GeneralTab.tsx apps/desktop/src/components/settings/YouTubeTab.tsx apps/desktop/src/components/settings/TranscriptionTab.tsx apps/desktop/src/components/settings/TranslationTab.tsx apps/desktop/src/components/settings/SubtitlesTab.tsx apps/desktop/src/components/settings/AdvancedTab.tsx apps/desktop/app/settings.tsx
git commit -m "refactor(settings): extract TabId/TABS/constants into a leaf constants.ts (break the SettingsContext↔shared require-cycle)"
```

---

### Task 2: `useSettingsDraft.ts` — the debounced-autosave + per-field-dirty + reset hook

**Files:** New `apps/desktop/src/components/settings/useSettingsDraft.ts`; modify `SettingsContext.tsx` to consume it.

- [ ] **Step 1: Write the hook**

```typescript
// apps/desktop/src/components/settings/useSettingsDraft.ts
import * as React from "react";
import { apiClient } from "../../state/client";
import type { AppConfig } from "@yt-subtitle-maker/api-client";
import { MASK, SETTING_FIELD, tabOfSettingId, type TabId } from "./constants";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

// AppConfig keys that hold a masked secret on GET ("***" == "no change").
// Mirrors the backend's SECRET_KEYS — never POST a literal "***" for these.
const SECRET_KEYS: (keyof AppConfig)[] = ["geminiApiKey", "localOpenaiApiKey", "openaiApiKey"];

const DEBOUNCE_MS = 400;
const SAVED_PILL_MS = 1600;

export interface SettingsDraft {
  config: AppConfig | undefined;
  draft: AppConfig | undefined;
  defaults: AppConfig | undefined;
  loading: boolean;
  error: string | undefined;
  setError: (e: string | undefined) => void;
  saveStatus: SaveStatus;
  failedFields: Set<keyof AppConfig>;
  /** Edit a field; schedules a debounced POST of the accumulated deltas. */
  update: <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => void;
  /** Re-run the last failed save now. */
  retrySave: () => void;
  /** True if any field on `tabId` differs from its effective default. */
  tabDiffersFromDefaults: (tabId: TabId) => boolean;
  /** Revert one SettingRow's field to its effective default and save now. */
  revertField: (settingId: string) => void;
  /** Revert every field on `tabId` to its effective default and save now. */
  resetTab: (tabId: TabId) => void;
  /** Fire any pending debounced save immediately (used on unmount). */
  flush: () => void;
  // exposed for the "Reset all to defaults" path in AdvancedTab
  setConfig: React.Dispatch<React.SetStateAction<AppConfig | undefined>>;
  setDraft: React.Dispatch<React.SetStateAction<AppConfig | undefined>>;
}

export function useSettingsDraft(): SettingsDraft {
  const [config, setConfig] = React.useState<AppConfig | undefined>();
  const [draft, setDraft] = React.useState<AppConfig | undefined>();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | undefined>();
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>("idle");
  const [failedFields, setFailedFields] = React.useState<Set<keyof AppConfig>>(new Set());

  // refs used by the debounce so we don't capture stale state
  const draftRef = React.useRef<AppConfig | undefined>();
  const configRef = React.useRef<AppConfig | undefined>();
  const pendingKeys = React.useRef<Set<keyof AppConfig>>(new Set());
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = React.useRef(false);
  const savedPillTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  draftRef.current = draft;
  configRef.current = config;

  React.useEffect(() => {
    let cancelled = false;
    apiClient
      .fetchConfig()
      .then((c) => {
        if (cancelled) return;
        setConfig(c);
        setDraft(c);
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : String(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const defaults = config?._defaults;

  // Build the delta payload from pendingKeys, applying the secret-mask rule:
  // if a secret key's current draft value is the MASK sentinel, skip it
  // (the backend keeps the saved one); if it equals the saved config value,
  // also skip it (nothing changed). Returns {} if there's nothing to send.
  const buildDelta = React.useCallback((): Partial<AppConfig> => {
    const d = draftRef.current;
    const c = configRef.current;
    if (!d) return {};
    const out: Partial<AppConfig> = {};
    for (const key of pendingKeys.current) {
      const v = d[key] as unknown;
      if (SECRET_KEYS.includes(key) && v === MASK) continue; // "*** == no change"
      if (c && JSON.stringify(c[key]) === JSON.stringify(v)) continue; // unchanged
      (out as Record<string, unknown>)[key as string] = v;
    }
    return out;
  }, []);

  const runSave = React.useCallback(async () => {
    if (inFlight.current) return; // a save is mid-flight; the new edits stay in
                                  // pendingKeys and the post-flight code re-checks
    const delta = buildDelta();
    if (Object.keys(delta).length === 0) {
      pendingKeys.current.clear();
      return;
    }
    const sentKeys = new Set(pendingKeys.current);
    pendingKeys.current.clear();
    inFlight.current = true;
    setSaveStatus("saving");
    try {
      const next = await apiClient.updateConfig(delta);
      setConfig(next);
      // Merge the server's truth back into the draft, but DON'T clobber any
      // field the user has since re-edited (i.e. that's back in pendingKeys).
      setDraft((cur) => {
        if (!cur) return next;
        const merged = { ...next };
        for (const k of pendingKeys.current) {
          (merged as Record<string, unknown>)[k as string] = (cur as Record<string, unknown>)[k as string];
        }
        return merged;
      });
      apiClient.setBaseUrl(next.backendUrl);
      setFailedFields((prev) => {
        const n = new Set(prev);
        for (const k of sentKeys) n.delete(k);
        return n;
      });
      setSaveStatus("saved");
      if (savedPillTimer.current) clearTimeout(savedPillTimer.current);
      savedPillTimer.current = setTimeout(() => {
        // only drop the pill if nothing went wrong since
        setSaveStatus((s) => (s === "saved" ? "idle" : s));
      }, SAVED_PILL_MS);
    } catch (err) {
      // keep the edited values; mark the fields as failed; surface "retry"
      for (const k of sentKeys) pendingKeys.current.add(k); // so retrySave resends them
      setFailedFields((prev) => {
        const n = new Set(prev);
        for (const k of sentKeys) n.add(k);
        return n;
      });
      setError(err instanceof Error ? err.message : String(err));
      setSaveStatus("error");
    } finally {
      inFlight.current = false;
      // edits arrived during the in-flight save (or a failure re-queued some) →
      // schedule another pass
      if (pendingKeys.current.size > 0) {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => void runSave(), DEBOUNCE_MS);
      }
    }
  }, [buildDelta]);

  const scheduleSave = React.useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void runSave(), DEBOUNCE_MS);
  }, [runSave]);

  const update = React.useCallback(
    <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => {
      setDraft((d) => (d ? { ...d, [key]: value } : d));
      pendingKeys.current.add(key);
      scheduleSave();
    },
    [scheduleSave],
  );

  const retrySave = React.useCallback(() => {
    // pendingKeys already holds the failed keys (re-queued in the catch)
    if (timer.current) clearTimeout(timer.current);
    void runSave();
  }, [runSave]);

  const flush = React.useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (pendingKeys.current.size > 0) void runSave();
  }, [runSave]);

  // flush on unmount so a mid-debounce edit isn't lost
  React.useEffect(() => () => flush(), [flush]);

  const tabDiffersFromDefaults = React.useCallback(
    (tabId: TabId) => {
      const d = draftRef.current;
      if (!d || !defaults) return false;
      for (const [settingId, key] of Object.entries(SETTING_FIELD)) {
        if (tabOfSettingId(settingId) !== tabId) continue;
        const k = key as keyof AppConfig;
        if (JSON.stringify(d[k]) !== JSON.stringify((defaults as AppConfig)[k])) return true;
      }
      return false;
    },
    [defaults],
  );

  const revertField = React.useCallback(
    (settingId: string) => {
      const key = SETTING_FIELD[settingId];
      if (!key || !defaults) return;
      update(key, (defaults as AppConfig)[key]);
    },
    [defaults, update],
  );

  const resetTab = React.useCallback(
    (tabId: TabId) => {
      if (!defaults) return;
      setDraft((d) => {
        if (!d) return d;
        const next = { ...d };
        for (const [settingId, key] of Object.entries(SETTING_FIELD)) {
          if (tabOfSettingId(settingId) !== tabId) continue;
          const k = key as keyof AppConfig;
          if (JSON.stringify(next[k]) === JSON.stringify((defaults as AppConfig)[k])) continue;
          (next as Record<string, unknown>)[k as string] = (defaults as AppConfig)[k];
          pendingKeys.current.add(k);
        }
        return next;
      });
      scheduleSave();
    },
    [defaults, scheduleSave],
  );

  return {
    config, draft, defaults, loading, error, setError,
    saveStatus, failedFields, update, retrySave,
    tabDiffersFromDefaults, revertField, resetTab, flush,
    setConfig, setDraft,
  };
}
```

> **Design note (record in the commit body):** `SettingsContext` becomes a **thin wrapper** over this hook rather than merging it in — the hook owns only `config`/`draft`/save; `SettingsContext` keeps the version/deps/test-handler/masked-key-UI/`activeTab`/`searchQuery`/`highlightedSettingId` surface and just re-exposes the hook's API. `update`'s signature is unchanged (`<K extends keyof AppConfig>(key: K, value: AppConfig[K]) => void`). **Debounce policy:** rapid double-edits to the same field = one POST with the latest value (the debounce timer resets, the draft already holds the latest, `pendingKeys` is a `Set`); unmount mid-debounce = `flush()` (a synchronous best-effort fire — the request itself can't be awaited in a cleanup, but it's dispatched); an in-flight save when a new edit lands = the new edit stays in `pendingKeys` and the `finally` block schedules a follow-up save (supersede-by-queue, not cancel — `fetch` can't be cancelled here and the second POST carries the truth). A failed save keeps the values, marks the fields in `failedFields`, leaves `saveStatus === "error"`, and re-queues those keys so "retry" resends them.

- [ ] **Step 2: Rewire `SettingsContext.tsx` to consume the hook**

In `SettingsContext.tsx`:
- `import { useSettingsDraft, type SaveStatus } from "./useSettingsDraft";`
- In `SettingsProvider`, replace the `config`/`draft`/`loading`/`error`/`setError` state and the `update`/`onSave`/`onDiscard`/`dirty` definitions and the `apiClient.fetchConfig()` block with `const ds = useSettingsDraft();` and read `const { config, draft, defaults, loading, error, setError, saveStatus, failedFields, update, retrySave, tabDiffersFromDefaults, revertField, resetTab, setConfig, setDraft } = ds;`. Keep everything else (`saving` for the *translator/cookie* tests is unrelated — but actually there's no separate `saving` for tests; the only `saving` was for the config save, so drop it). Keep the `fetchVersion`/`listTranslatorModels`/`fetchDependencies` `useEffect`, the `replacingKey`/`showApiKey` state, `translatorStatus`/`cookieStatus`/etc., `installedEngines`/`jsRuntime`/`deps`/`geminiModels`/`localOpenaiModels`/`openaiModels`/`modelsBusy`, `sttEngineOptions`/`whisperModelOptions`, `refreshLocalOpenaiModels`/`refreshOpenaiModels`, `testTranslator`/`testCookies`, and the `activeTab`/`setActiveTab`/`searchQuery`/`highlightedSettingId` block.
- Update `SettingsContextValue`: **remove** `dirty`, `saving`, `onSave`, `onDiscard`; **add** `saveStatus: SaveStatus`, `failedFields: Set<keyof AppConfig>`, `retrySave: () => void`, `tabDiffersFromDefaults: (t: TabId) => boolean`, `revertField: (id: string) => void`, `resetTab: (t: TabId) => void`. Keep `defaults`, `update`, `setConfig`, `setDraft`, `config`, `draft`, `loading`, `error`, `setError`.
- Build the `value` object accordingly.
- Remove the now-unused imports (`STT_ENGINE_LABELS`/etc. stay if still used by `sttEngineOptions`/`whisperModelOptions`; remove any that became dead).

- [ ] **Step 3: Verify**

`pnpm -F desktop typecheck` → it will report errors in `app/settings.tsx` (it still uses `dirty`/`onSave`/`onDiscard`) and possibly `AdvancedTab.tsx` — **that's expected; those are fixed in Tasks 3–4.** To keep this task's commit green, do a *minimal* stopgap in `app/settings.tsx`: stop destructuring `dirty`/`saving`/`onSave`/`onDiscard`, and temporarily render a plain `<BadgePill tone="success">saved</BadgePill>` placeholder footer with no buttons (Task 4 builds the real one). After that stopgap, `pnpm -F desktop typecheck` → clean. Manual: open `/settings`, flip a toggle (e.g. Transcription → VAD) — within ~½ s nothing visible yet changes (the footer is the stopgap pill), but **reload the page** → the toggle stuck (autosave worked). Flip another toggle, then immediately reload before ~400 ms elapses → it still stuck (`flush()` on unmount fired). Console has no require-cycle warning.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/components/settings/useSettingsDraft.ts apps/desktop/src/components/settings/SettingsContext.tsx apps/desktop/app/settings.tsx
git commit -m "feat(settings): useSettingsDraft hook — debounced autosave + per-field-dirty + revertField/resetTab; SettingsContext becomes a thin wrapper"
```

---

### Task 3: per-field `↺` in `SettingRow` + per-row "couldn't save — retry"

**Files:** Modify `apps/desktop/src/components/settings/shared.tsx` (the `SettingRow` component).

- [ ] **Step 1: Add the `↺` button + retry affordance to `SettingRow`**

In `shared.tsx`, `SettingRow` already pulls `useSettings()` for `highlightedSettingId`/`setHighlightedSettingId`. Extend it to also pull `draft`, `defaults`, `revertField`, `failedFields`, `retrySave`, and `SETTING_FIELD` (from `./constants`). Logic:
- `const fieldKey = SETTING_FIELD[id];` — if undefined, no `↺` and no retry row for this `SettingRow` (armed fields, "Reset all", etc. handle their own state).
- `const changed = !!fieldKey && !!draft && !!defaults && JSON.stringify(draft[fieldKey]) !== JSON.stringify(defaults[fieldKey]);` — render the `↺` icon button **only when `changed`**. Place it inline with the label: in the `Field` header area, or as a small `<ButtonGhost>` next to `<Field>`. Use `RotateCcw` (or `RefreshCcw`) from `@tamagui/lucide-icons`, tooltip/aria-label `"Reset to default"`. `onPress={() => revertField(id)}`.
- `const failed = !!fieldKey && failedFields.has(fieldKey);` — when `failed`, render a small inline row beneath the control: `<Caption color="$error">couldn't save</Caption>` + `<ButtonGhost onPress={retrySave}><Caption color="$textSecondary">retry</Caption></ButtonGhost>`.

Concretely, change the two return branches:

```tsx
// inside SettingRow, after the existing highlight machinery:
const { draft, defaults, revertField, failedFields, retrySave } = useSettings();
const fieldKey = SETTING_FIELD[id];
const changed =
  !!fieldKey && !!draft && !!defaults &&
  JSON.stringify((draft as any)[fieldKey]) !== JSON.stringify((defaults as any)[fieldKey]);
const failed = !!fieldKey && failedFields.has(fieldKey);

const labelHeader = (
  <XStack alignItems="flex-start" gap="$xs">
    <YStack flex={1}><Field label={label} helper={helper} /></YStack>
    {changed ? (
      <ButtonGhost size="$2" onPress={() => revertField(id)} aria-label="Reset to default">
        <RotateCcw size={12} color="$textSecondary" />
      </ButtonGhost>
    ) : null}
  </XStack>
);
const retryRow = failed ? (
  <XStack gap="$sm" alignItems="center">
    <Caption color="$error">couldn't save</Caption>
    <ButtonGhost onPress={retrySave}><Caption color="$textSecondary">retry</Caption></ButtonGhost>
  </XStack>
) : null;

if (layout === "row") {
  return (
    <YStack ref={ref} nativeID={id} {...highlightProps}>
      <XStack alignItems="center" justifyContent="space-between" gap="$sm">
        {labelHeader}
        {children}
      </XStack>
      {retryRow}
    </YStack>
  );
}
return (
  <YStack ref={ref} nativeID={id} gap="$xs" {...highlightProps}>
    {labelHeader}
    {children}
    {retryRow}
  </YStack>
);
```

(Adjust to the actual `ButtonGhost`/`Caption` props in `@yt-subtitle-maker/ui`; import `RotateCcw` from `@tamagui/lucide-icons` and `SETTING_FIELD` from `./constants`. Keep the `nativeID={id}` on the outer container so search-scroll/highlight still works. Note `layout === "row"`'s container changed from `XStack` to `YStack` wrapping an inner `XStack` so the retry row can sit beneath — make sure the row layout still looks right; if it's awkward, keep `XStack` and append the retry row in a fragment via a wrapping `YStack` only when `failed`.)

> **Decision recorded:** `SettingRow` maps `id → AppConfig key` via the `SETTING_FIELD` map in `constants.ts` (chosen over adding a `field` prop to every `SettingRow` call site — the map is one place to keep in sync with `searchIndex.ts`, and rows that legitimately don't own a single config field just stay out of the map). The "✓ saved" pill lives on the tab footer (Task 4); the per-row affordance here is only the **failure** case ("couldn't save — retry"), per the spec ("A failed write shows an inline 'couldn't save — retry'").

- [ ] **Step 2: Verify**

`pnpm -F desktop typecheck` → clean. Manual (backend + `pnpm web`): open `/settings` → **Transcription** → toggle "VAD by default" (so it differs from the default `false`) → a small `↺` appears by that row's label; click it → the toggle flips back to `false` and the `↺` disappears (and it autosaves — reload confirms). Do the same on **Subtitles** → change "Font size" from 0 to e.g. 60 → `↺` appears → click → back to 0. Then simulate a save failure: stop the backend (`Ctrl-C` the uvicorn) → flip a toggle → after ~½ s the footer shows the error state (Task 4) **and** the row shows "couldn't save · retry"; restart the backend → click "retry" → it saves, the row's error affordance clears, reload confirms the value stuck. Confirm `↺` does **not** appear on the Backend-URL armed-field row or the "Reset all" row.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/components/settings/shared.tsx
git commit -m "feat(settings): per-field ↺ (revert-to-default, shown when differs) + inline 'couldn't save — retry' on SettingRow"
```

---

### Task 4: footer rewrite in `app/settings.tsx` — "✓ saved" pill + per-tab "Reset this tab" (remove Save/Discard)

**Files:** Modify `apps/desktop/app/settings.tsx`; touch `apps/desktop/src/components/settings/AdvancedTab.tsx` only if its `setConfig`/`setDraft` destructure needs adjusting.

- [ ] **Step 1: Rewrite the footer**

In `SettingsShell`, change the destructure to `const { draft, loading, error, saveStatus, retrySave, activeTab, searchQuery, tabDiffersFromDefaults, resetTab } = useSettings();`. Keep the loading gate (`if (loading || !draft) { … }`) but it no longer references `dirty`. Replace the sticky footer's contents:

```tsx
<XStack
  marginTop="$lg"
  padding="$md"
  backgroundColor="$bgElevated"
  borderTopWidth={1}
  borderTopColor="$borderSubtle"
  alignItems="center"
  gap="$sm"
  style={{ position: "sticky", bottom: 0, zIndex: 50 }}
>
  {/* status, left-anchored */}
  {saveStatus === "saving" ? (
    <BadgePill>saving…</BadgePill>
  ) : saveStatus === "saved" ? (
    <BadgePill tone="success">✓ saved</BadgePill>
  ) : saveStatus === "error" ? (
    <XStack gap="$sm" alignItems="center">
      <BadgePill tone="danger">couldn't save</BadgePill>
      <ButtonGhost onPress={retrySave}>
        <Caption color="$textSecondary">retry</Caption>
      </ButtonGhost>
    </XStack>
  ) : (
    <Caption color="$textMuted">Changes save automatically.</Caption>
  )}
  <Stack flex={1} />
  <ButtonGhost
    onPress={() => {
      if (typeof window !== "undefined" &&
          !window.confirm(`Reset every setting on the ${TABS.find((t) => t.id === activeTab)?.label} tab to its default?`)) return;
      resetTab(activeTab);
    }}
    disabled={!tabDiffersFromDefaults(activeTab)}
  >
    <BodySm color="$textSecondary">Reset this tab</BodySm>
  </ButtonGhost>
</XStack>
```

Imports: add `TABS` from `../src/components/settings/constants`; keep `BadgePill`, `ButtonGhost`, `Caption`, `BodySm`, `Stack`, `XStack`, `YStack` from `@yt-subtitle-maker/ui`/`tamagui`; **remove** `ButtonPrimary`, `BadgeAccent` if now unused. Keep `GlassCard`, `Section`, the rail/search/tab-component wiring and `searchQuery.trim().length >= 2 ? null : <ActiveTab />` exactly as is. (`BadgePill`'s `tone` prop — check `packages/ui`: today the file uses `tone="success"`; if there's no `"danger"` tone, use `tone` as available or wrap the error pill in a `<Stack>` with an error background; don't invent a tone that doesn't exist.)

- [ ] **Step 2: Sanity-check `AdvancedTab.tsx`**

It destructures `{ draft, update, setConfig, setDraft, setError }` — all still on the context (re-exposed from the hook). The "Reset all to defaults" `onPress` (`apiClient.resetConfig()` → `setConfig(next)` / `setDraft(next)` / `apiClient.setBaseUrl(next.backendUrl)`) is unchanged and still correct (the hook's `setConfig`/`setDraft` are the same React setters). The Backend-URL `ArmedField`'s `onApply` is unchanged (`update("backendUrl", v)` now schedules an autosave; `apiClient.setBaseUrl(v)` stays). If typecheck flags anything here, fix the destructure to match the new context value; otherwise leave it.

- [ ] **Step 3: Verify**

`pnpm -F desktop typecheck` → clean. Manual full smoke (backend + `pnpm web`):
1. `/settings` → **General** → change "Logs verbosity" → footer flashes "✓ saved" then settles to "Changes save automatically." → reload → it stuck.
2. **YouTube**, **Transcription**, **Translation**, **Subtitles** — flip one field each, see "✓ saved", reload, all stuck. (Translation: changing **Target language** autosaves; the masked Gemini key still shows `•••• (saved)` + Replace and is untouched — confirm a separate edit of another field does **not** wipe the saved key, i.e. no `***` was POSTed.)
3. **Reset this tab**: on Subtitles, change font size + outline width → "Reset this tab" enables → click → confirm dialog → both revert to defaults, button disables, reload confirms.
4. **Per-field `↺`** still works (from Task 3).
5. **Advanced** → "Backend URL" → Edit → type `127.0.0.1:9999` (no backend there) → Apply → it rejects with "Couldn't reach a backend…" and stays; type back `127.0.0.1:8000` → Apply → applies → reload → still `127.0.0.1:8000`. → "Reset to 127.0.0.1:8000" secondary button works. → "Reset all to defaults" → confirm → every tab back to defaults, reload confirms.
6. **Deep links / search**: `http://localhost:8081/settings?tab=subtitles` opens on Subtitles; the search box → type "outline" → results listed as `Subtitles › Outline …` → click → switches to Subtitles + the row highlights for ~2 s. Clearing the search → back to the active tab.
7. **Failure path**: stop the backend → flip a toggle → footer shows "couldn't save · retry" + the row shows "couldn't save · retry"; restart backend → click footer "retry" → "✓ saved", error clears, reload confirms.
8. Console: no `Require cycle` warning; the `No font size found $4` one may persist (ignore).

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/app/settings.tsx apps/desktop/src/components/settings/AdvancedTab.tsx
git commit -m "feat(settings): replace Save/Discard footer with autosave '✓ saved' pill + per-tab 'Reset this tab'"
```

---

### Task 5: `ArmedField` Apply persists via autosave — confirm + tighten (no new armed fields)

**Files:** Review `apps/desktop/src/components/settings/ArmedField.tsx` and `AdvancedTab.tsx`; modify only if needed.

This task is mostly a **verification + small-polish** task — `ArmedField`'s only consumer today is the Backend-URL row, whose `onApply` already calls `update("backendUrl", v)` (which, post-Task-2, schedules an autosave) plus `apiClient.setBaseUrl(v)`. The spec says armed-field Apply must "persist immediately". The autosave debounce (~400 ms) is "immediately enough", but Apply is a deliberate, infrequent action, so:

- [ ] **Step 1: Decide & implement — Apply flushes the save**

Make `ArmedField`'s `commit(v)` (the success path of `apply()`) call an optional `onApply` that we let trigger an *immediate* save rather than a debounced one. Cleanest: keep `onApply` as-is in `ArmedField` (it just calls back to the consumer), and in `AdvancedTab.tsx` change the Backend-URL `onApply` to `(v) => { update("backendUrl", v); apiClient.setBaseUrl(v); flush(); }` — pulling `flush` from `useSettings()` (re-expose it on the context value from the hook: add `flush: () => void` to `SettingsContextValue` and the `value` object). The "Reset to 127.0.0.1:8000" secondary action likewise: `update("backendUrl", "127.0.0.1:8000"); apiClient.setBaseUrl("127.0.0.1:8000"); flush();`. (Alternative considered and rejected: have `onApply` itself `await apiClient.updateConfig({...})` directly — that bypasses the hook's draft/status machinery and double-writes; flushing the existing pipeline is simpler.)

If you'd rather not thread `flush`, the no-code-change option is also acceptable (the debounced autosave catches it within ~400 ms) — but record the decision in the commit body. **Recommended: thread `flush`.**

- [ ] **Step 2: Verify**

`pnpm -F desktop typecheck` → clean. Manual: Advanced → Backend URL → Edit → `127.0.0.1:8000` → Apply → **immediately** reload (don't wait) → still `127.0.0.1:8000` (flush fired synchronously). The validation gate still works (bogus host → reject + "Apply anyway"). No new armed fields appear anywhere (the folder/path fields are still plain `TextInput`s — that's Phase 4e).

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/components/settings/ArmedField.tsx apps/desktop/src/components/settings/AdvancedTab.tsx apps/desktop/src/components/settings/SettingsContext.tsx apps/desktop/src/components/settings/useSettingsDraft.ts
git commit -m "feat(settings): ArmedField Apply flushes the autosave (Backend URL persists immediately)"
```

---

### Task 6: docs/cleanup pass + error-affordance polish

**Files:** Modify `apps/desktop/src/components/settings/SettingsContext.tsx` (dead-code sweep); optionally `app/settings.tsx`; update this plan / the overview's status if you keep that habit.

- [ ] **Step 1: Dead-code sweep**

In `SettingsContext.tsx`, remove anything left orphaned by the refactor: the `dirty`/`saving`/`onSave`/`onDiscard` are gone from the interface and value (done in Task 2) — confirm no stale references; remove unused imports (`router`/`useLocalSearchParams` stay — `activeTab` still uses them; `STT_ENGINE_LABELS`/`TABS`/`WHISPER_MODEL_IDS` stay if `sttEngineOptions`/`whisperModelOptions` still use them). `git grep -n "onSave\|onDiscard\|\.dirty\b" apps/desktop` → only this file's *history*, no live references. `git grep -n "from \"./shared\"" apps/desktop/src/components/settings` → only `Section`/`Field`/`SettingRow` imports remain.

- [ ] **Step 2: Polish the error copy (optional, cheap)**

Make the footer error pill clickable-to-retry obvious, and surface the underlying message on hover/aria (`error` from the context). If the saved pill flicker is annoying during rapid edits, the `SAVED_PILL_MS` debounce in the hook already coalesces it — leave as is unless it visibly stutters.

- [ ] **Step 3: Final verification**

`pnpm -F desktop typecheck` → clean. Re-run the Task-4 full smoke pass once more. Confirm: the require-cycle warning is gone; no new warning; autosave works on every tab; `↺` works; "Reset this tab" works; "Reset all" works; armed Backend-URL works; `?tab=`/search/highlight work; a forced failure shows "couldn't save — retry" both on the row and the footer and retry recovers it.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(settings): dead-code sweep + error-affordance polish after the autosave refactor"
```

---

## Self-review (done by plan author)

- **Spec coverage (4b slice):**
  - "Safe fields autosave … debounce ~400 ms, `POST /api/config` the delta, flash a quiet '✓ saved' pill" → Task 2 (`useSettingsDraft`'s `update` → debounced `runSave` with `buildDelta` → `POST` only the changed keys) + Task 4 (the footer's `saveStatus === "saved"` pill) ✓.
  - "A failed write shows an inline 'couldn't save — retry'; nothing is silently lost" → Task 2 (`failedFields`, values kept, keys re-queued) + Task 3 (per-row "couldn't save · retry") + Task 4 (footer error state + retry) ✓.
  - "Armed fields … Apply runs a real check before committing … Backend URL also calls `apiClient.setBaseUrl`" → unchanged `ArmedField` + Task 5 (Apply now also `flush()`es the autosave so it persists immediately) ✓.
  - "Per-field `↺` (revert to the shipped default — value comes from the backend's effective-defaults; shown only when the field differs)" → Task 3 (`changed` gate + `revertField` reading `defaults[fieldKey]`, where `defaults = config?._defaults` from Phase 4a) ✓.
  - "Per-tab 'Reset this tab' in the footer" → Task 4 (`resetTab(activeTab)`, disabled via `tabDiffersFromDefaults`) ✓.
  - "'Reset all to defaults' in Advanced (confirm dialog) → `POST /api/config/reset`" → unchanged in `AdvancedTab` (Task 4 just confirms it still compiles/works) ✓.
  - "Test breaks after saving a key … stop round-tripping the mask" → the `SECRET_KEYS`/`MASK` discipline in `buildDelta` ("never POST a literal `***`") preserves today's behaviour; the `replacingKey`/`isMasked` UI in `TranslationTab` is untouched ✓ (the full named-provider rework is out of scope, Phase 4d).
  - File-structure: `useSettingsDraft.ts` born (Task 2); `SettingRow.tsx` gains the per-field `↺` (Task 3) — matches the spec's "File structure (frontend)" list ✓.
- **Overview-4b coverage:** require-cycle broken by extracting `TabId`/`TABS`/constants into a leaf module (Task 1 → `constants.ts`, which imports nothing from the settings folder; `shared.tsx` no longer imports `SettingsContext.tsx` for constants) ✓. Save/Discard footer gone; nothing else depends on `dirty`/`onSave`/`onDiscard` afterward — `app/settings.tsx`'s loading gate now keys off `loading`/`draft` only, `AdvancedTab` never used them, and Task 6's `git grep` confirms no stragglers ✓. The `?tab=`/search/highlight machinery and the six tab components stay (verified in every task's manual step) ✓.
- **Placeholder scan:** none. Task 1 gives the literal `constants.ts` (incl. the full `SETTING_FIELD` map keyed by the actual `SettingRow` ids from `searchIndex.ts` mapped to the actual `AppConfig` camelCase keys from `packages/api-client/src/types.ts`) and the exact import-repointing list. Task 2 gives the full `useSettingsDraft.ts` source incl. the debounce/in-flight/flush/secret-mask logic and the `SettingsContext` rewiring instructions. Task 3 gives the `SettingRow` JSX changes. Task 4 gives the footer JSX. Task 5 gives the `flush`-threading change. The only "check against the codebase" notes are about *existing* conventions (the `@yt-subtitle-maker/ui` `BadgePill` `tone` values; whether `SubtitlesTab` imports a constant; `@tamagui/lucide-icons` icon names) — not deferred work.
- **Type/name consistency:** `SaveStatus`/`saveStatus`, `failedFields: Set<keyof AppConfig>`, `revertField(id: string)`, `resetTab(t: TabId)`, `tabDiffersFromDefaults`, `flush` are the same names in `useSettingsDraft.ts`, on `SettingsContextValue`, and at the call sites (`shared.tsx`, `app/settings.tsx`, `AdvancedTab.tsx`). `SETTING_FIELD` keys ⊆ the `nativeID`s used in the tab components ⊆ the `SETTINGS_INDEX` ids (the comment in `constants.ts` calls this invariant out). `update`'s generic signature is unchanged so all existing `update("xField", v)` calls keep type-checking.
- **Risk notes / watch-outs (all flagged in-task):**
  1. **Masked-secret autosave hazard** — `buildDelta` skips any `SECRET_KEYS` field whose draft value is `MASK`, exactly like today's `onSave`; a regression here would overwrite a saved Gemini/OpenAI/LM-Studio key with the literal `"***"`. Task 4's manual step explicitly checks "editing another field doesn't wipe the saved key".
  2. **The require-cycle fix** — `constants.ts` must import *nothing* from the settings folder, and `useSettingsDraft.ts` must not import `SettingsContext.tsx` (the hook is the leaf, the context wraps it). Every task's verify step checks the console for `Require cycle` warnings; Task 1 is where the old one disappears.
  3. **`?tab=`/search/highlight** — unchanged code, but it lives in `SettingsContext` (`activeTab` from `useLocalSearchParams`, `searchQuery`, `highlightedSettingId`) which Task 2 rewires; Tasks 1/2/4's manual steps re-test deep links + search-click-highlight.
  4. **Pre-existing benign Metro warnings** — the `SettingsContext → shared → SettingsContext` cycle warning **must vanish after Task 1**; the `No font size found $4 …` warning is unrelated (a Tamagui token thing elsewhere) and stays — don't chase it.
  5. **Debounce edge cases** — rapid double-edit to the same field → one POST with the latest value (timer resets, draft holds latest, `pendingKeys` is a Set); unmount mid-debounce → `flush()` (best-effort synchronous dispatch); in-flight save + new edit → the new edit stays queued and the `finally` schedules a follow-up POST (supersede-by-queue; `fetch` isn't cancellable here, and the second POST carries the truth — accepting one redundant round-trip in that rare race). A failed POST keeps the values, re-queues the keys, and leaves `saveStatus === "error"` until a successful save (auto-retry of newly-edited fields, or the explicit "retry" button).
- **No backend / no Rust / no new endpoint touched** — `POST /api/config` partial updates (incl. the `***`-keeps-secret rule) and `POST /api/config/reset` already exist; `_defaults` arrived in Phase 4a; this plan is entirely under `apps/desktop/`. The repo's lack of a JS test framework is respected — per-task verification is `pnpm -F desktop typecheck` + the manual eyeball each task spells out (no test runner invented).
