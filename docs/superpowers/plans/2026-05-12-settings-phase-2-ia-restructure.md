# Settings Tab — Phase 2: IA Restructure (sub-tab rail + search + decomposition) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the one-long-scroll Settings screen into a two-pane layout — a six-item sub-tab rail on the left, one focused panel on the right, a search box that jumps to any setting across tabs — by decomposing the 1150-line `apps/desktop/app/settings.tsx` into a thin shell + a `SettingsProvider` context + six per-tab components, and (the item Phase 1 deferred here) building a reusable `ArmedField` and using it to make the Backend URL safe.

**Architecture:** No backend changes. All work is in `apps/desktop/` (one new directory: `apps/desktop/src/components/settings/`). The route file `app/settings.tsx` becomes a thin shell that mounts `<SettingsProvider>` + the rail + search + the active tab + the existing sticky Save/Discard footer. `SettingsProvider` owns every piece of state and every handler currently inside `Settings()`; the six tab components and the rail/search consume it via `useSettings()`. Each setting is wrapped in a `SettingRow` (label + helper + control + a stable DOM `id`); a static `SETTINGS_INDEX` powers search and "jump + highlight". The existing Save-button model is **kept as-is** — Hybrid autosave is Phase 4.

**Tech Stack:** Expo Router (file-based route) + React + React Native Web + Tamagui + `@tamagui/lucide-icons`; the existing `@yt-subtitle-maker/ui` design system; the singleton `apiClient` from `apps/desktop/src/state/client`; `@yt-subtitle-maker/api-client` for types. No JS test framework — the "test" for every task is `pnpm -F desktop typecheck` plus the concrete manual check the task names. (Backend pytest is untouched; run it once at the end as a regression check.)

**Spec:** `docs/superpowers/specs/2026-05-12-settings-tab-production-ready-design.md` — this plan is **Phase 2** of that spec's four-phase build (Phase 1 shipped: commits `6121651`..`332e521` on `v2.1`). This plan covers the spec's **"IA — structure & navigation"** section, the **"File structure (frontend)"** decomposition, and the **`ArmedField` + Backend-URL** item that Phase 1's plan explicitly punted to Phase 2.

**Out of scope for Phase 2 (do not pull in):**
- Hybrid autosave / per-field `↺` / per-tab "Reset this tab" — **Phase 4** (`useSettingsDraft.ts` is the Phase-4 successor to this plan's `SettingsContext`; the Save/Discard footer stays).
- `tauri-plugin-dialog` "Browse…" buttons on folder fields; arming the folder/path fields (`Output folder`, `Download folder`, `Whisper cache folder`, `JS runtime path`, `mpv executable path`) — **Phase 3**. In Phase 2 those stay plain `TextInput`s. **Only the Backend URL gets armed.**
- The Subtitles live preview, `ColorField`, `NumberStepper`, font `Combobox`, presets, "Test playback" — **Phase 3**.
- The engine-driven Transcription tab, `GET /api/system`, `GET /api/engines`, machine-compat verdicts, engine-keyed model downloads — **Phase 4**. The Phase-2 Transcription tab is just today's "STT Engine" fields re-homed, unchanged.
- The Translation named-provider-profiles feature (`custom_translators`, migration, `ProviderRow`, enhanced `/api/translator/test`) — **Phase 4**. The Phase-2 Translation tab is today's three-slot `gemini`/`local_openai`/`openai` UI re-homed, unchanged.
- Advanced's "Open config folder" / "Export" / "Import" — **Phase 4**. Phase 2's Advanced tab has just the Backend URL (armed) and the (Phase-1) "Reset all to defaults" button.

**Prerequisites on the machine:** `pnpm install` already done; backend venv exists; for the manual checks run the backend (`cd backend && ../backend/.venv/bin/python -m uvicorn api.main:app --host 127.0.0.1 --port 8000 --reload`) in one terminal and `pnpm web` (→ http://localhost:8081) in another. Rust / the Tauri window are **not** needed for any Phase-2 task.

---

## File structure

| File | Change |
|---|---|
| `apps/desktop/src/components/settings/SettingsContext.tsx` | **New.** `SettingsProvider` (holds all state + handlers currently in `Settings()`, plus `activeTab`/`searchQuery`/`highlightedSettingId`) and the `useSettings()` hook. |
| `apps/desktop/src/components/settings/shared.tsx` | **New.** `Section`, `Field`, `SettingRow`; the constant arrays (`COOKIE_BROWSERS`, `VERBOSITY`, `STT_ENGINE_LABELS`, `WHISPER_MODEL_IDS`, `DEVICES`, `LANGS`); `MASK`/`isMasked`; `buildModelOptions`; `TABS`/`TabId`. |
| `apps/desktop/src/components/settings/searchIndex.ts` | **New.** `SearchEntry` type + `SETTINGS_INDEX` array (the static list of searchable settings: `{id, tab, label, keywords}`). |
| `apps/desktop/src/components/settings/GeneralTab.tsx` | **New.** Output folder · Download folder · Whisper cache folder · Logs verbosity. |
| `apps/desktop/src/components/settings/YouTubeTab.tsx` | **New.** Cookie source/profile/cookies.txt + Test + the chromium warning · JS runtime for yt-dlp. |
| `apps/desktop/src/components/settings/TranscriptionTab.tsx` | **New.** Default engine · Default model · Default device · Default source language · Try-YT-captions-first · VAD · FFmpeg 16 kHz pre-resample. |
| `apps/desktop/src/components/settings/TranslationTab.tsx` | **New.** Provider · Default target language · Enable-by-default · Auto-translate-title · the provider-specific blocks (gemini / local_openai / openai), unchanged. |
| `apps/desktop/src/components/settings/SubtitlesTab.tsx` | **New.** mpv executable path · font · size · text/outline/background colors · outline width · bold · bottom margin (all plain controls — Phase 3 adds the preview & pickers). |
| `apps/desktop/src/components/settings/AdvancedTab.tsx` | **New.** Backend URL (plain in Task 2 → armed in Task 6) · "Reset all to defaults". |
| `apps/desktop/src/components/settings/ArmedField.tsx` | **New (Task 6).** Locked → Edit → validate → Apply / Apply-anyway, with an optional secondary action. |
| `apps/desktop/src/components/settings/SettingsRail.tsx` | **New (Task 3).** The six-item left rail. |
| `apps/desktop/src/components/settings/SettingsSearch.tsx` | **New (Task 5).** The search box + results list. |
| `apps/desktop/app/settings.tsx` | **Rewritten incrementally** — ends as a thin shell: `<SettingsProvider><SettingsShell/></SettingsProvider>`; `SettingsShell` = loading/error gate + (rail | (search + active panel)) + sticky footer. |

---

## Note on testing

The frontend has **no JS test framework** — don't add one. Each task's verification is:
1. `pnpm -F desktop typecheck` (run from the repo root) → must exit clean (no output).
2. The named manual check, done against a running backend + `pnpm web` (http://localhost:8081/settings).

Backend pytest is untouched by this plan; Task 6's last step runs `backend/.venv/bin/python -m pytest -q` once to confirm no regression.

---

### Task 1: `SettingsContext` + shared module — pure data-layer refactor, zero visual change

Pull every `useState`, derived value, and handler out of `Settings()` into a `SettingsProvider` context; move the small presentational helpers (`Section`, `Field`) and the module-scope constants into `shared.tsx`. After this task `app/settings.tsx` renders the **exact same screen** — just sourced from `useSettings()`.

**Files:**
- Create: `apps/desktop/src/components/settings/SettingsContext.tsx`
- Create: `apps/desktop/src/components/settings/shared.tsx`
- Modify: `apps/desktop/app/settings.tsx`

- [ ] **Step 1: Create `shared.tsx`**

Move these out of `app/settings.tsx` verbatim into `apps/desktop/src/components/settings/shared.tsx` and `export` each: the constants `MASK`, `isMasked`, `COOKIE_BROWSERS`, `VERBOSITY`, `STT_ENGINE_LABELS`, `WHISPER_MODEL_IDS`, `DEVICES`, `LANGS`; the components `Section` and `Field` (currently lines ~88–118 of `settings.tsx`); and the `buildModelOptions` helper (currently a local function inside `Settings()`, lines ~227–237 — lift it to module scope here). Also add the tab list:

```tsx
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
```

`shared.tsx`'s imports: `import * as React from "react"; import { YStack } from "tamagui"; import { DisplaySm, TitleSm, BodySm, Caption } from "@yt-subtitle-maker/ui";` (whatever `Section`/`Field` actually use — copy their existing imports). `SettingRow` is **not** created here yet — that's Task 2.

- [ ] **Step 2: Create `SettingsContext.tsx`**

This holds everything currently declared inside `Settings()` between `const [config, setConfig] = …` and `testCookies`. Copy those declarations and handler bodies verbatim — the only change is they now live in the provider. Full file:

```tsx
import * as React from "react";
import { apiClient } from "../../state/client";
import {
  ApiClient,
  type AppConfig,
  type TranslatorProvider,
  type DependencyStatus,
} from "@yt-subtitle-maker/api-client";
import { STT_ENGINE_LABELS, WHISPER_MODEL_IDS, type TabId } from "./shared";

export type ConnState = "untested" | "ok" | "warning" | "error";

export interface SettingsContextValue {
  // data
  config: AppConfig | undefined;
  draft: AppConfig | undefined;
  loading: boolean;
  saving: boolean;
  error: string | undefined;
  setError: (e: string | undefined) => void;
  dirty: boolean;
  // secret-field UI
  showApiKey: boolean;
  setShowApiKey: React.Dispatch<React.SetStateAction<boolean>>;
  replacingKey: Record<"gemini" | "openai" | "localOpenai", boolean>;
  setReplacingKey: React.Dispatch<
    React.SetStateAction<Record<"gemini" | "openai" | "localOpenai", boolean>>
  >;
  // connection test statuses
  backendStatus: ConnState;
  setBackendStatus: (s: ConnState) => void;
  translatorStatus: ConnState;
  cookieStatus: ConnState;
  cookieError: string | undefined;
  cookieSource: string | undefined;
  cookiesAttached: boolean | undefined;
  // version / deps derived data
  installedEngines: string[] | undefined;
  jsRuntime: string | null | undefined;
  deps: DependencyStatus | undefined;
  geminiModels: string[];
  localOpenaiModels: string[];
  openaiModels: string[];
  modelsBusy: "gemini" | "local_openai" | "openai" | undefined;
  sttEngineOptions: { label: string; value: string }[];
  whisperModelOptions: { label: string; value: string }[];
  // mutations / actions
  update: <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => void;
  onSave: () => Promise<void>;
  onDiscard: () => void;
  testBackend: () => Promise<void>;
  testTranslator: () => Promise<void>;
  testCookies: () => Promise<void>;
  refreshLocalOpenaiModels: () => Promise<void>;
  refreshOpenaiModels: () => Promise<void>;
  // navigation (Task 3 wires the UI; declared here so the shape is stable)
  activeTab: TabId;
  setActiveTab: (t: TabId) => void;
  // search / highlight (Task 5 wires the UI)
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  highlightedSettingId: string | null;
  setHighlightedSettingId: (id: string | null) => void;
}

const SettingsContext = React.createContext<SettingsContextValue | null>(null);

export function useSettings(): SettingsContextValue {
  const ctx = React.useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within <SettingsProvider>");
  return ctx;
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = React.useState<AppConfig | undefined>();
  const [draft, setDraft] = React.useState<AppConfig | undefined>();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>();
  const [showApiKey, setShowApiKey] = React.useState(false);
  const [replacingKey, setReplacingKey] = React.useState<
    Record<"gemini" | "openai" | "localOpenai", boolean>
  >({ gemini: false, openai: false, localOpenai: false });
  const [backendStatus, setBackendStatus] = React.useState<ConnState>("untested");
  const [translatorStatus, setTranslatorStatus] = React.useState<ConnState>("untested");
  const [cookieStatus, setCookieStatus] = React.useState<ConnState>("untested");
  const [cookieError, setCookieError] = React.useState<string | undefined>();
  const [cookieSource, setCookieSource] = React.useState<string | undefined>();
  const [cookiesAttached, setCookiesAttached] = React.useState<boolean | undefined>();
  const [installedEngines, setInstalledEngines] = React.useState<string[] | undefined>(undefined);
  const [jsRuntime, setJsRuntime] = React.useState<string | null | undefined>(undefined);
  const [geminiModels, setGeminiModels] = React.useState<string[]>([]);
  const [localOpenaiModels, setLocalOpenaiModels] = React.useState<string[]>([]);
  const [openaiModels, setOpenaiModels] = React.useState<string[]>([]);
  const [modelsBusy, setModelsBusy] = React.useState<"gemini" | "local_openai" | "openai" | undefined>(undefined);
  const [deps, setDeps] = React.useState<DependencyStatus | undefined>();
  const [activeTab, setActiveTab] = React.useState<TabId>("general");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [highlightedSettingId, setHighlightedSettingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    apiClient
      .fetchConfig()
      .then((c) => {
        if (cancelled) return;
        setConfig(c);
        setDraft(c);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    apiClient
      .fetchVersion()
      .then((v) => {
        if (cancelled) return;
        setInstalledEngines(v.installedSttEngines ?? []);
        setJsRuntime(v.jsRuntime ?? null);
      })
      .catch(() => undefined);
    apiClient
      .listTranslatorModels({ provider: "gemini" })
      .then((res) => {
        if (cancelled) return;
        if (res.ok) setGeminiModels(res.models);
      })
      .catch(() => undefined);
    apiClient
      .fetchDependencies()
      .then((d) => !cancelled && setDeps(d))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshLocalOpenaiModels = async () => {
    if (!draft) return;
    setModelsBusy("local_openai");
    try {
      const res = await apiClient.listTranslatorModels({
        provider: "local_openai",
        baseUrl: draft.localOpenaiBaseUrl,
        apiKey: draft.localOpenaiApiKey,
      });
      if (res.ok) setLocalOpenaiModels(res.models);
    } catch {
      /* surface via translator status */
    } finally {
      setModelsBusy(undefined);
    }
  };

  const refreshOpenaiModels = async () => {
    if (!draft) return;
    setModelsBusy("openai");
    try {
      const res = await apiClient.listTranslatorModels({
        provider: "openai",
        baseUrl: draft.openaiBaseUrl,
        apiKey: draft.openaiApiKey,
      });
      if (res.ok) setOpenaiModels(res.models);
    } catch {
      /* surface via translator status */
    } finally {
      setModelsBusy(undefined);
    }
  };

  const sttEngineOptions = React.useMemo(() => {
    const ids = ["auto", ...(installedEngines ?? [])];
    return ids
      .filter((id, i) => ids.indexOf(id) === i)
      .map((id) => ({ label: STT_ENGINE_LABELS[id] ?? id, value: id }));
  }, [installedEngines]);

  const whisperModelOptions = React.useMemo(() => {
    const downloaded = deps?.models ?? {};
    const ids = WHISPER_MODEL_IDS.includes(draft?.defaultWhisperModel ?? "")
      ? WHISPER_MODEL_IDS
      : [draft?.defaultWhisperModel ?? "", ...WHISPER_MODEL_IDS].filter(Boolean);
    return ids.map((id) => {
      const star = id === "turbo" ? " ⭐" : "";
      let suffix = "";
      if (deps)
        suffix = downloaded[id as keyof typeof downloaded] ? "  ✓ downloaded" : "  · not downloaded";
      return { label: `${id}${star}${suffix}`, value: id };
    });
  }, [deps, draft?.defaultWhisperModel]);

  const dirty = !!draft && !!config && JSON.stringify(draft) !== JSON.stringify(config);

  const update = <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  };

  const onSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const next = await apiClient.updateConfig(draft);
      setConfig(next);
      setDraft(next);
      setReplacingKey({ gemini: false, openai: false, localOpenai: false });
      apiClient.setBaseUrl(next.backendUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const onDiscard = () => {
    if (config) setDraft(config);
    setReplacingKey({ gemini: false, openai: false, localOpenai: false });
  };

  const testBackend = async () => {
    if (!draft) return;
    setBackendStatus("untested");
    try {
      const tmp = new ApiClient(draft.backendUrl);
      await tmp.fetchVersion();
      setBackendStatus("ok");
    } catch {
      setBackendStatus("error");
    }
  };

  const testTranslator = async () => {
    if (!draft) return;
    setTranslatorStatus("untested");
    try {
      const provider = draft.translatorProvider;
      const baseUrl =
        provider === "local_openai"
          ? draft.localOpenaiBaseUrl
          : provider === "openai"
          ? draft.openaiBaseUrl
          : undefined;
      const apiKey =
        provider === "local_openai"
          ? draft.localOpenaiApiKey
          : provider === "openai"
          ? draft.openaiApiKey
          : draft.geminiApiKey;
      const model =
        provider === "local_openai"
          ? draft.localOpenaiModel
          : provider === "openai"
          ? draft.openaiModel
          : draft.geminiModel;
      const res = await apiClient.testTranslator({ provider, baseUrl, apiKey, model });
      setTranslatorStatus(res.ok ? "ok" : "error");
    } catch {
      setTranslatorStatus("error");
    }
  };

  const testCookies = async () => {
    if (!draft) return;
    setCookieStatus("untested");
    setCookieError(undefined);
    setCookieSource(undefined);
    setCookiesAttached(undefined);
    try {
      const res = await apiClient.testCookies({
        cookieBrowser: draft.cookieBrowser,
        cookieProfile: draft.cookieProfile,
        cookiesTxtPath: draft.cookiesTxtPath,
      });
      setCookieStatus(res.ok ? "ok" : "error");
      setCookieError(res.error);
      setCookieSource(res.cookieSource);
      setCookiesAttached(res.cookiesAttached);
    } catch (err) {
      setCookieStatus("error");
      setCookieError(err instanceof Error ? err.message : String(err));
    }
  };

  const value: SettingsContextValue = {
    config, draft, loading, saving, error, setError, dirty,
    showApiKey, setShowApiKey, replacingKey, setReplacingKey,
    backendStatus, setBackendStatus, translatorStatus,
    cookieStatus, cookieError, cookieSource, cookiesAttached,
    installedEngines, jsRuntime, deps, geminiModels, localOpenaiModels, openaiModels, modelsBusy,
    sttEngineOptions, whisperModelOptions,
    update, onSave, onDiscard, testBackend, testTranslator, testCookies,
    refreshLocalOpenaiModels, refreshOpenaiModels,
    activeTab, setActiveTab, searchQuery, setSearchQuery, highlightedSettingId, setHighlightedSettingId,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
```

> Note: this is intentionally a large "god context" — it's pragmatic for a single settings screen and Phase 4's `useSettingsDraft.ts` will refactor it when autosave lands. Don't try to split it now.

- [ ] **Step 3: Rewrite `app/settings.tsx` to use the provider — no visual change**

Replace the file with: imports of `SettingsProvider`/`useSettings` from `../src/components/settings/SettingsContext` and `Section`/`Field`/the constants from `../src/components/settings/shared` (drop the now-moved local definitions and the now-unused `ApiClient`/`TranslatorProvider`/`DependencyStatus` imports — `app/settings.tsx` no longer references them directly). The default export becomes:

```tsx
export default function Settings() {
  return (
    <SettingsProvider>
      <SettingsShell />
    </SettingsProvider>
  );
}

function SettingsShell() {
  const {
    config, draft, loading, saving, error, dirty, onSave, onDiscard,
    /* …plus everything the JSX below references… */
  } = useSettings();

  if (loading || !draft) {
    return (
      <YStack gap="$lg">
        <Section title="Settings" />
        <GlassCard variant="mid">
          <BodySm color="$textSecondary">
            {error ? `Failed to load config: ${error}` : "Loading config…"}
          </BodySm>
        </GlassCard>
      </YStack>
    );
  }

  return (
    <YStack gap="$lg" paddingBottom={120}>
      {/* the EXACT same JSX that's in Settings() today, lines ~377–1147,
          verbatim — every `draft.x`, `update(...)`, `testCookies`, `replacingKey`,
          `sttEngineOptions`, `whisperModelOptions`, etc. now comes from useSettings() */}
    </YStack>
  );
}
```

Mechanical rule: anything the old `Settings()` JSX referenced by closure (`draft`, `config`, `update`, `dirty`, `saving`, `onSave`, `onDiscard`, `showApiKey`, `setShowApiKey`, `replacingKey`, `setReplacingKey`, `backendStatus`, `testBackend`, `translatorStatus`, `testTranslator`, `cookieStatus`, `cookieError`, `cookieSource`, `cookiesAttached`, `testCookies`, `jsRuntime`, `geminiModels`/`localOpenaiModels`/`openaiModels`, `modelsBusy`, `refreshLocalOpenaiModels`, `refreshOpenaiModels`, `sttEngineOptions`, `whisperModelOptions`, `setError`, `buildModelOptions`) is now destructured from `useSettings()` (except `buildModelOptions`, which is imported from `shared`). The JSX itself does not change. The `apiClient` import is still needed by `app/settings.tsx` **only** if the "Reset all to defaults" `ButtonGhost`'s inline handler stays there — it does for now (it'll move into `AdvancedTab.tsx` in Task 2), so keep `import { apiClient } from "../src/state/client";` for this task.

- [ ] **Step 4: Verify**

Run: `pnpm -F desktop typecheck` — Expected: no errors.

Manual: open http://localhost:8081/settings — the screen looks **identical** to before; flip a toggle → footer shows "unsaved changes"; Save → "all saved"; reload → it stuck; the cookie "Test" button still works; the translator "Test" button still works. Nothing should look or behave differently — this task is a pure refactor.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/components/settings/SettingsContext.tsx apps/desktop/src/components/settings/shared.tsx apps/desktop/app/settings.tsx
git commit -m "refactor(settings): extract SettingsProvider context + shared module (no behavior change)"
```

---

### Task 2: Extract the six tab components + the search index + re-home settings into the six tabs

Carve `SettingsShell`'s big JSX into six tab components, wrapping each setting in a new `SettingRow`. Re-home the settings per the mapping below. After this task `SettingsShell` renders the six tab components **stacked vertically** (no rail/search yet) — so the screen still scrolls, but it's now built from `<GeneralTab/>…<AdvancedTab/>` and every setting has a stable DOM `id`.

**Files:**
- Modify: `apps/desktop/src/components/settings/shared.tsx` (add `SettingRow`)
- Create: `apps/desktop/src/components/settings/searchIndex.ts`
- Create: `apps/desktop/src/components/settings/GeneralTab.tsx`, `YouTubeTab.tsx`, `TranscriptionTab.tsx`, `TranslationTab.tsx`, `SubtitlesTab.tsx`, `AdvancedTab.tsx`
- Modify: `apps/desktop/app/settings.tsx`

#### Tab → settings mapping (where each of today's fields goes)

| New tab | Settings (and where it lives in today's `settings.tsx`) |
|---|---|
| **General** | Output folder *(today: Advanced card)* · Download folder *(today: General card)* · Whisper cache directory *(today: Advanced card)* · Logs verbosity *(today: Advanced card)* |
| **YouTube** | Cookie source · Browser profile *(conditional)* · cookies.txt path · the test-result panel + its Test button · the Chromium-cookies warning callout *(all today: Cookies card)* · JS runtime for yt-dlp *(today: Advanced card)* |
| **Transcription** | Default engine · Default model · Default device · Default source language · Try YouTube auto-captions first · VAD by default *(all today: STT Engine card)* · FFmpeg 16 kHz pre-resample *(today: Advanced card)* |
| **Translation** | Provider · Default target language · Enable translation by default · Auto-translate the video title · the three provider-specific blocks *(gemini / local_openai / openai)* *(all today: Translation card, unchanged)* |
| **Subtitles** | MPV executable path *(today: Advanced card)* · Font family · Font size · Bottom margin · Text color · Outline color · Outline width · Background · Bold *(all today: Subtitle style card)* |
| **Advanced** | Backend URL *(today: General card — stays a plain `TextInput`+Test for now; Task 6 arms it)* · "Reset all to defaults" `ButtonGhost` *(today: Advanced card — move it here verbatim, including its inline handler that calls `apiClient.resetConfig()` etc.)* |

After this re-homing the old "General", "Cookies", "STT Engine", "Translation", "Subtitle style", "Advanced" GlassCards no longer exist as such — their contents have been distributed into the six new tab components. Nothing is dropped, nothing is duplicated.

- [ ] **Step 1: Add `SettingRow` to `shared.tsx`**

```tsx
import { useSettings } from "./SettingsContext"; // add to shared.tsx's imports

/**
 * One configurable setting: a label/helper header + the control(s) beneath it
 * (or label-left/control-right when layout="row", e.g. for a toggle), wrapped
 * with a stable DOM id so search can scroll to + briefly highlight it.
 */
export function SettingRow({
  id,
  label,
  helper,
  layout = "stack",
  children,
}: {
  id: string; // unique across ALL tabs; must match an entry in searchIndex.ts if searchable
  label: string;
  helper?: string;
  layout?: "stack" | "row";
  children: React.ReactNode;
}) {
  const { highlightedSettingId, setHighlightedSettingId } = useSettings();
  const ref = React.useRef<any>(null);
  const highlighted = highlightedSettingId === id;

  React.useEffect(() => {
    if (!highlighted) return;
    const el = ref.current as { scrollIntoView?: (opts?: any) => void } | null;
    if (el && typeof el.scrollIntoView === "function") {
      requestAnimationFrame(() =>
        el.scrollIntoView!({ behavior: "smooth", block: "center" }),
      );
    }
    const t = setTimeout(() => setHighlightedSettingId(null), 2200);
    return () => clearTimeout(t);
  }, [highlighted, setHighlightedSettingId]);

  const highlightProps = highlighted
    ? ({
        borderColor: "$accent",
        borderWidth: 1,
        borderRadius: "$md",
        padding: "$xs",
        margin: -1 * 0, // visual nudge optional; keep simple
      } as const)
    : undefined;

  if (layout === "row") {
    return (
      <XStack
        ref={ref}
        id={id}
        alignItems="center"
        justifyContent="space-between"
        {...highlightProps}
      >
        <Field label={label} helper={helper} />
        {children}
      </XStack>
    );
  }
  return (
    <YStack ref={ref} id={id} gap="$xs" {...highlightProps}>
      <Field label={label} helper={helper} />
      {children}
    </YStack>
  );
}
```

Add `XStack` to `shared.tsx`'s `tamagui` import. If `pnpm -F desktop typecheck` complains that Tamagui's `YStack`/`XStack` don't accept an `id` prop on the type, use `nativeID={id}` instead (react-native-web maps `nativeID` → DOM `id`); keep whichever one typechecks. The `ref` is typed `any` deliberately — on web it lands on the underlying DOM element.

- [ ] **Step 2: Create `searchIndex.ts`**

This is the static list of **searchable** settings (the provider-specific Translation fields are intentionally omitted — the Translation tab is rewritten in Phase 4). The `id`s here are the `id`s you must pass to the matching `SettingRow`s in Steps 3–8.

```tsx
import type { TabId } from "./shared";

export interface SearchEntry {
  id: string;
  tab: TabId;
  label: string;
  keywords: string[];
}

export const SETTINGS_INDEX: SearchEntry[] = [
  // General
  { id: "general.output-dir", tab: "general", label: "Output folder", keywords: ["output", "srt", "save", "directory", "folder"] },
  { id: "general.download-dir", tab: "general", label: "Download folder", keywords: ["download", "audio", "temp", "directory", "folder"] },
  { id: "general.whisper-cache-dir", tab: "general", label: "Whisper cache directory", keywords: ["whisper", "cache", "model", "weights", "directory"] },
  { id: "general.logs-verbosity", tab: "general", label: "Logs verbosity", keywords: ["logs", "verbosity", "debug", "log level"] },
  // YouTube
  { id: "youtube.cookie-source", tab: "youtube", label: "Cookie source", keywords: ["cookies", "browser", "firefox", "chrome", "age restricted"] },
  { id: "youtube.cookie-profile", tab: "youtube", label: "Browser profile", keywords: ["cookie", "profile", "browser"] },
  { id: "youtube.cookies-txt-path", tab: "youtube", label: "cookies.txt path", keywords: ["cookies.txt", "netscape", "cookie file"] },
  { id: "youtube.js-runtime-path", tab: "youtube", label: "JS runtime for yt-dlp", keywords: ["javascript", "node", "deno", "yt-dlp", "runtime"] },
  // Transcription
  { id: "transcription.engine", tab: "transcription", label: "Default engine", keywords: ["stt", "speech", "whisper", "engine"] },
  { id: "transcription.model", tab: "transcription", label: "Default model", keywords: ["whisper", "model", "tiny", "base", "turbo", "large"] },
  { id: "transcription.device", tab: "transcription", label: "Default device", keywords: ["device", "cpu", "gpu", "cuda", "mps"] },
  { id: "transcription.source-lang", tab: "transcription", label: "Default source language", keywords: ["language", "source", "spoken", "detect"] },
  { id: "transcription.yt-captions-first", tab: "transcription", label: "Try YouTube auto-captions first", keywords: ["captions", "auto", "youtube", "subtitles"] },
  { id: "transcription.vad", tab: "transcription", label: "Voice-Activity Detection (VAD) by default", keywords: ["vad", "silence", "voice activity"] },
  { id: "transcription.ffmpeg-resample-16k", tab: "transcription", label: "FFmpeg 16 kHz pre-resample", keywords: ["ffmpeg", "resample", "16khz", "audio"] },
  // Translation (base only)
  { id: "translation.provider", tab: "translation", label: "Provider", keywords: ["translate", "provider", "gemini", "openai", "local ai", "lm studio"] },
  { id: "translation.target-lang", tab: "translation", label: "Default target language", keywords: ["target", "language", "translate to"] },
  { id: "translation.enable-by-default", tab: "translation", label: "Enable translation by default", keywords: ["translate", "enable", "default"] },
  { id: "translation.auto-translate-title", tab: "translation", label: "Auto-translate the video title", keywords: ["title", "translate"] },
  // Subtitles
  { id: "subtitles.mpv-path", tab: "subtitles", label: "MPV executable path", keywords: ["mpv", "player", "executable", "path"] },
  { id: "subtitles.font", tab: "subtitles", label: "Font family", keywords: ["font", "typeface", "family", "cjk"] },
  { id: "subtitles.font-size", tab: "subtitles", label: "Font size", keywords: ["font", "size", "px"] },
  { id: "subtitles.margin-y", tab: "subtitles", label: "Bottom margin", keywords: ["margin", "bottom", "position"] },
  { id: "subtitles.color", tab: "subtitles", label: "Text color", keywords: ["color", "text", "hex", "white"] },
  { id: "subtitles.border-color", tab: "subtitles", label: "Outline color", keywords: ["outline", "border", "color", "hex", "black"] },
  { id: "subtitles.border-size", tab: "subtitles", label: "Outline width", keywords: ["outline", "width", "border", "px"] },
  { id: "subtitles.back-color", tab: "subtitles", label: "Background", keywords: ["background", "box", "color", "alpha"] },
  { id: "subtitles.bold", tab: "subtitles", label: "Bold", keywords: ["bold", "weight"] },
  // Advanced
  { id: "advanced.backend-url", tab: "advanced", label: "Backend URL", keywords: ["backend", "url", "server", "ngrok", "host", "port"] },
  { id: "advanced.reset-all", tab: "advanced", label: "Reset all to defaults", keywords: ["reset", "defaults", "factory", "wipe"] },
];
```

The provider-specific `SettingRow`s you'll create in Step 6 (`translation.gemini-api-key`, `translation.gemini-model`, `translation.local-base-url`, `translation.local-model`, `translation.local-api-key`, `translation.openai-base-url`, `translation.openai-api-key`, `translation.openai-model`) get those `id`s for DOM/consistency but are **not** added to `SETTINGS_INDEX`.

- [ ] **Step 3: Create `GeneralTab.tsx`**

Skeleton every tab follows (adapt the imports to what the tab actually uses):

```tsx
import * as React from "react";
import { YStack } from "tamagui";
import { GlassCard, Dropdown, TextInput } from "@yt-subtitle-maker/ui";
import { useSettings } from "./SettingsContext";
import { Section, SettingRow, VERBOSITY } from "./shared";

export function GeneralTab() {
  const { draft, update } = useSettings();
  if (!draft) return null;
  return (
    <GlassCard variant="mid">
      <YStack gap="$md">
        <Section title="General" />
        <SettingRow id="general.output-dir" label="Output folder" helper="Where finished .srt files are written. Leave blank to use the default location.">
          <TextInput value={draft.outputDir} onChangeText={(v: string) => update("outputDir", v)} placeholder="" />
        </SettingRow>
        <SettingRow id="general.download-dir" label="Download folder" helper="Where downloaded audio is kept. Leave blank to use the default location.">
          <TextInput value={draft.downloadDir} onChangeText={(v: string) => update("downloadDir", v)} placeholder="" />
        </SettingRow>
        <SettingRow id="general.whisper-cache-dir" label="Whisper cache directory" helper="Where Whisper model weights are cached. Leave blank for the default.">
          <TextInput value={draft.whisperCacheDir} onChangeText={(v: string) => update("whisperCacheDir", v)} placeholder="" />
        </SettingRow>
        <SettingRow id="general.logs-verbosity" label="Logs verbosity">
          <Dropdown
            value={draft.logsVerbosity}
            onValueChange={(v) => update("logsVerbosity", v as typeof draft.logsVerbosity)}
            options={VERBOSITY}
            width={240}
          />
        </SettingRow>
      </YStack>
    </GlassCard>
  );
}
```

(The `outputDir` / `whisperCacheDir` helpers above are new neutral one-liners in the same spirit as the Phase-1 "Download folder" fix — today those two fields have no helper; give them these. Don't add a `placeholder` other than `""`.)

- [ ] **Step 4: Create `YouTubeTab.tsx`**

Move the entire contents of today's "Cookies (YouTube)" GlassCard here, plus the "JS runtime for yt-dlp" field from today's Advanced card. Wrap:
- "Cookie source" `Dropdown` (the `COOKIE_BROWSERS`-fed one) → `SettingRow id="youtube.cookie-source" label="Cookie source"`.
- The conditional "Browser profile" `TextInput` (shown only when `draft.cookieBrowser` is truthy) → `SettingRow id="youtube.cookie-profile" label="Browser profile" helper="Optional — leave blank for default profile."`, still inside the same `draft.cookieBrowser ? (...) : null` conditional.
- The "cookies.txt path" `TextInput` → `SettingRow id="youtube.cookies-txt-path" label="cookies.txt path" helper="Optional fallback — overrides browser cookies."`.
- The test-result panel (`<XStack … cookieStatus …>` with the `StatusDot`, the result `BodySm`, the conditional `Caption`, and the `<ButtonSecondary onPress={testCookies}>Test</ButtonSecondary>`) → keep it **verbatim** (it's not a single setting; render it directly inside the tab's `YStack`, not inside a `SettingRow`).
- The `["chrome","edge","brave","opera"].includes(draft.cookieBrowser)` warning callout → keep verbatim, directly in the tab's `YStack`.
- Then a `SettingRow id="youtube.js-runtime-path" label="JS runtime for yt-dlp" helper={jsRuntime ? \`Detected: ${jsRuntime}\` : "⚠ No runtime detected — install Node or Deno, or set the path here. Without one, YouTube extraction degrades."}` wrapping the `jsRuntimePath` `TextInput` (with its existing `placeholder="(auto-detect node/deno on PATH)"`).

`useSettings()` gives `draft`, `update`, `cookieStatus`, `cookieError`, `cookieSource`, `cookiesAttached`, `testCookies`, `jsRuntime`. Import `COOKIE_BROWSERS`, `Section`, `SettingRow` from `./shared`; `Stack`, `Text`, `XStack`, `YStack` from `tamagui`; `GlassCard`, `TextInput`, `Dropdown`, `ButtonSecondary`, `StatusDot`, `BodySm`, `Caption` from `@yt-subtitle-maker/ui` (whichever the moved JSX uses). `Section title="Cookies & YouTube"` (or keep `"Cookies (YouTube)"` — your call; keep its existing `subtitle`).

- [ ] **Step 5: Create `TranscriptionTab.tsx`**

Move today's "STT Engine" GlassCard contents here, plus "FFmpeg 16 kHz pre-resample" from Advanced. The current card uses two-column `<XStack gap="$md" flexWrap="wrap">` rows pairing fields; keep those layout wrappers but put each `<Field>+control` inside a `SettingRow`. Concretely the children of the tab's `<YStack gap="$md">`:
- `<Section title="Transcription" subtitle="Defaults are overridable per-job in Generate." />`
- `<XStack gap="$md" flexWrap="wrap">` containing two `<YStack flex={1} minWidth={220}>`, each holding one `SettingRow`: `transcription.engine` ("Default engine", the `sttEngineOptions` `Dropdown`) and `transcription.model` ("Default model", the `whisperModelOptions` `Dropdown`).
- `<XStack gap="$md" flexWrap="wrap">` with `transcription.device` ("Default device", `DEVICES` `Dropdown`) and `transcription.source-lang` ("Default source language", helper "Setting a default prevents Whisper misdetection on intros / music.", `LANGS` `Dropdown`).
- `SettingRow layout="row" id="transcription.yt-captions-first" label="Try YouTube auto-captions first" helper="Master switch for Auto mode. When off, Whisper always runs."` wrapping the `Toggle` for `draft.ytCaptionsFirst`.
- `SettingRow layout="row" id="transcription.vad" label="Voice-Activity Detection (VAD) by default" helper="Skips silent regions before Whisper — faster on long videos. Per-job override stays on the Generate screen."` wrapping the `Toggle` for `draft.vadEnabled`.
- `SettingRow layout="row" id="transcription.ffmpeg-resample-16k" label="FFmpeg 16 kHz pre-resample" helper="Pre-resamples to 16 kHz mono before Whisper for timestamp accuracy."` wrapping the `Toggle` for `draft.ffmpegResample16k`.

`useSettings()` gives `draft`, `update`, `sttEngineOptions`, `whisperModelOptions`. Import `DEVICES`, `LANGS`, `Section`, `SettingRow` from `./shared`; `XStack`, `YStack` from `tamagui`; `GlassCard`, `Dropdown`, `Toggle` from `@yt-subtitle-maker/ui`.

- [ ] **Step 6: Create `TranslationTab.tsx`**

Move today's "Translation" GlassCard contents here essentially verbatim — this tab is **not** redesigned in Phase 2 (Phase 4 does the named-provider rewrite). Wrap the four always-present settings in `SettingRow`s:
- `SettingRow id="translation.provider" label="Provider"` → the `SegmentedControl` (Gemini / Local AI / OpenAI-compat).
- `SettingRow id="translation.target-lang" label="Default target language"` → the `LANGS` `Dropdown` for `draft.defaultTargetLang` (keep the `<XStack gap="$md" flexWrap="wrap"><YStack flex={1} minWidth={220}>` wrapper if you like; not required).
- `SettingRow layout="row" id="translation.enable-by-default" label="Enable translation by default" helper="Pre-checks the Translation toggle on the Generate screen for new jobs."` → the `Toggle`.
- `SettingRow layout="row" id="translation.auto-translate-title" label="Auto-translate the video title" helper="Also translates the YouTube title into the target language and stores it in the sidecar (titleTranslated)."` → the `Toggle`.
- Then the three `draft.translatorProvider === "…" ? (…) : null` provider-specific blocks, **verbatim** from today, except: convert each labelled sub-field to a `SettingRow` with these `id`s — gemini block: `translation.gemini-api-key` (the masked-key / Replace XStack — keep all its current logic), `translation.gemini-model`; local_openai block: `translation.local-base-url`, `translation.local-model` (the `Dropdown`+`↻` row), `translation.local-api-key` (the masked-key / Replace block); openai block: `translation.openai-base-url`, `translation.openai-api-key` (masked-key / Replace), `translation.openai-model` (`Dropdown`+`↻`). The non-`SettingRow` bits inside those blocks (the "Test connection" `XStack`, the LM-Studio help callout, the `<RefreshCcw>` buttons) stay as direct children. **Do not change the masked-key / Replace behavior** — it's the Phase-1 fix and must keep working.

`useSettings()` gives: `draft`, `update`, `translatorProvider` (via `draft.translatorProvider`), `showApiKey`, `setShowApiKey`, `replacingKey`, `setReplacingKey`, `translatorStatus`, `testTranslator`, `geminiModels`, `localOpenaiModels`, `openaiModels`, `modelsBusy`, `refreshLocalOpenaiModels`, `refreshOpenaiModels`. Import `buildModelOptions`, `isMasked`, `Section`, `SettingRow` from `./shared`; `Eye`, `EyeOff`, `RefreshCcw` from `@tamagui/lucide-icons`; `Stack`, `Text`, `XStack`, `YStack` from `tamagui`; from `@yt-subtitle-maker/ui` whatever the moved JSX uses (`GlassCard`, `TextInput`, `Dropdown`, `SegmentedControl`, `Toggle`, `ButtonSecondary`, `ButtonGhost`, `IconButton`, `StatusDot`, `BodySm`, `Caption`). `type TranslatorProvider` from `@yt-subtitle-maker/api-client` for the `SegmentedControl`'s `onValueChange` cast. `Section title="Translation"`.

- [ ] **Step 7: Create `SubtitlesTab.tsx`**

Move today's "Subtitle style (mpv)" GlassCard contents here, plus "MPV executable path" from Advanced. Order: `<Section title="Subtitles" subtitle="How burned-in subtitles look when you Play with mpv. Leave a field blank to use mpv's default." />`, then `SettingRow id="subtitles.mpv-path" label="MPV executable path" helper="Path to the mpv binary. Leave blank to use mpv on your PATH."` wrapping the `mpvPath` `TextInput` (replace its current `placeholder="(falls back to PATH)"` with `placeholder=""` — the helper now says it), then the existing font/size/margin/colors/outline/background/bold fields, each labelled `<Field>`+control pair converted to a `SettingRow` (`subtitles.font`, `subtitles.font-size`, `subtitles.margin-y`, `subtitles.color`, `subtitles.border-color`, `subtitles.border-size`, `subtitles.back-color`, and `subtitles.bold` with `layout="row"` for the bold `Toggle`). Keep the `<XStack gap="$md">` two-column wrappers around the size/margin and color pairs if you want — wrap each column's `SettingRow` in the existing `<YStack flex={1}>`. **Keep the value-parsing logic verbatim** (the `parseInt(v,10)||0`, the `subBorderSize` `-1` / blank handling, etc.) — controls don't change, only their wrappers do.

`useSettings()` gives `draft`, `update`. Import `Section`, `SettingRow` from `./shared`; `XStack`, `YStack` from `tamagui`; `GlassCard`, `TextInput`, `Toggle` from `@yt-subtitle-maker/ui`.

- [ ] **Step 8: Create `AdvancedTab.tsx`**

```tsx
import * as React from "react";
import { XStack, YStack } from "tamagui";
import { GlassCard, TextInput, ButtonSecondary, ButtonGhost, StatusDot, BodySm } from "@yt-subtitle-maker/ui";
import { apiClient } from "../../state/client";
import { useSettings } from "./SettingsContext";
import { Section, SettingRow } from "./shared";

export function AdvancedTab() {
  const { draft, update, setConfig, setDraft, setError, backendStatus, testBackend } = useSettings();
  if (!draft) return null;
  return (
    <GlassCard variant="mid">
      <YStack gap="$md">
        <Section title="Advanced" />
        <SettingRow id="advanced.backend-url" label="Backend URL" helper="Default 127.0.0.1:8000. Change for V2 ngrok tunneling.">
          <XStack gap="$sm" alignItems="center">
            <TextInput flex={1} value={draft.backendUrl} onChangeText={(v: string) => update("backendUrl", v)} />
            <ButtonSecondary onPress={testBackend}>Test</ButtonSecondary>
            <StatusDot status={backendStatus} size={8} />
          </XStack>
        </SettingRow>
        <SettingRow id="advanced.reset-all" label="Reset all to defaults" helper="Danger zone — overwrites your saved config with the shipped defaults.">
          <XStack>
            <ButtonGhost
              onPress={async () => {
                if (typeof window !== "undefined" && !window.confirm("Reset every setting to its default? This overwrites your saved config and can't be undone.")) return;
                try {
                  const next = await apiClient.resetConfig();
                  setConfig(next);
                  setDraft(next);
                  apiClient.setBaseUrl(next.backendUrl);
                } catch (err) {
                  setError(err instanceof Error ? err.message : String(err));
                }
              }}
            >
              <BodySm fontWeight="500" color="$error">Reset all to defaults</BodySm>
            </ButtonGhost>
          </XStack>
        </SettingRow>
      </YStack>
    </GlassCard>
  );
}
```

This needs `setConfig` and `setDraft` from the context — **add them to `SettingsContextValue` and to the `value` object in `SettingsContext.tsx`** (`setConfig: React.Dispatch<React.SetStateAction<AppConfig | undefined>>` and same for `setDraft`). (They were internal to the provider before; the Reset handler — and Task 6's ArmedField — need them.)

- [ ] **Step 9: Update `app/settings.tsx` to render the six tab components stacked**

`SettingsShell`'s big JSX block (the `<YStack gap="$lg" paddingBottom={120}>…</YStack>` with all the GlassCards) becomes:

```tsx
return (
  <YStack gap="$lg" paddingBottom={120}>
    <Section title="Settings" subtitle="Backend, cookies, STT engine, translation, and advanced." />
    <GeneralTab />
    <YouTubeTab />
    <TranscriptionTab />
    <TranslationTab />
    <SubtitlesTab />
    <AdvancedTab />
    {/* sticky footer — unchanged, still here */}
  </YStack>
);
```

`SettingsShell` now only needs `loading`, `draft`, `error`, `saving`, `dirty`, `onSave`, `onDiscard` from `useSettings()` (for the loading gate + the footer). Drop the now-unused imports from `app/settings.tsx` (the `@tamagui/lucide-icons` icons, most of `@yt-subtitle-maker/ui`, `apiClient`, the constants, `buildModelOptions`, etc. — keep only what the loading gate + footer + `Section` use: `YStack`, `XStack`, `Stack`, `GlassCard`, `BodySm`, `Caption`, `BadgePill`, `BadgeAccent`, `ButtonGhost`, `ButtonPrimary`, `Section`, the six tab components, `SettingsProvider`, `useSettings`).

- [ ] **Step 10: Verify**

Run: `pnpm -F desktop typecheck` — Expected: no errors.

Manual: open http://localhost:8081/settings — the screen still scrolls and now shows six cards in this order: General, Cookies/YouTube, Transcription, Translation, Subtitles, Advanced. Every setting from before is present (count them — none lost): General has Output/Download/Whisper-cache/Logs; YouTube has the cookie controls + Test + JS-runtime; Transcription has engine/model/device/lang/yt-captions/VAD/ffmpeg-resample; Translation has provider/target-lang/enable/auto-title + the provider block; Subtitles has mpv-path + font/size/margin/colors/outline/bold; Advanced has Backend-URL+Test and "Reset all to defaults". Flip a toggle → "unsaved changes"; Save → reload → stuck. The masked Gemini key still shows "•••• key on file" + Replace. "Reset all to defaults" still works.

- [ ] **Step 11: Commit**

```bash
git add apps/desktop/src/components/settings/ apps/desktop/app/settings.tsx
git commit -m "refactor(settings): decompose into 6 per-tab components + searchIndex; re-home settings into tabs"
```

---

### Task 3: Sub-tab rail + active-tab state

Replace the six stacked cards with a two-pane layout: a narrow rail of six buttons on the left, one tab's panel on the right. Active tab = `activeTab` from the context (already declared in Task 1; default `"general"`).

**Files:**
- Create: `apps/desktop/src/components/settings/SettingsRail.tsx`
- Modify: `apps/desktop/app/settings.tsx`

- [ ] **Step 1: Create `SettingsRail.tsx`**

```tsx
import * as React from "react";
import { YStack, XStack, Text } from "tamagui";
import { useSettings } from "./SettingsContext";
import { TABS } from "./shared";

export function SettingsRail() {
  const { activeTab, setActiveTab } = useSettings();
  return (
    <YStack
      gap="$xxs"
      width={184}
      paddingRight="$sm"
      borderRightWidth={1}
      borderRightColor="$borderSubtle"
    >
      {TABS.map((t) => {
        const active = t.id === activeTab;
        return (
          <XStack
            key={t.id}
            tag="button"
            onPress={() => setActiveTab(t.id)}
            paddingVertical="$sm"
            paddingHorizontal="$sm"
            borderRadius="$md"
            backgroundColor={active ? "$surfaceGlass" : "transparent"}
            borderWidth={1}
            borderColor={active ? "$borderSubtle" : "transparent"}
            cursor="pointer"
            hoverStyle={{ backgroundColor: "$surfaceGlass" }}
          >
            <Text
              fontSize="$3"
              fontWeight={active ? "600" : "400"}
              color={active ? "$text" : "$textSecondary"}
            >
              {t.label}
            </Text>
          </XStack>
        );
      })}
    </YStack>
  );
}
```

(If Tamagui's `XStack` doesn't accept `tag="button"` in this codebase's setup, use a `Pressable`/`ButtonGhost` from `@yt-subtitle-maker/ui` instead — match how the existing sidebar in `apps/desktop/app/_layout.tsx` renders its nav items, and mirror that pattern. The goal: six clickable rows, the active one visually distinct.)

- [ ] **Step 2: Render the active tab in `app/settings.tsx`**

In `SettingsShell`, add a small map and a layout. Replace the stacked-cards block with:

```tsx
const TAB_COMPONENTS: Record<TabId, React.ComponentType> = {
  general: GeneralTab,
  youtube: YouTubeTab,
  transcription: TranscriptionTab,
  translation: TranslationTab,
  subtitles: SubtitlesTab,
  advanced: AdvancedTab,
};
```

(Declare it at module scope in `app/settings.tsx`, importing `TabId` from `../src/components/settings/shared` and the six tab components.)

```tsx
function SettingsShell() {
  const { loading, draft, error, saving, dirty, onSave, onDiscard, activeTab } = useSettings();
  if (loading || !draft) {
    return (/* unchanged loading gate */);
  }
  const ActiveTab = TAB_COMPONENTS[activeTab];
  return (
    <YStack gap="$lg" paddingBottom={120}>
      <Section title="Settings" subtitle="Backend, cookies, transcription, translation, subtitles, advanced." />
      <XStack gap="$lg" alignItems="flex-start">
        <SettingsRail />
        <YStack flex={1} gap="$lg">
          <ActiveTab />
        </YStack>
      </XStack>
      {/* sticky footer — unchanged */}
    </YStack>
  );
}
```

The per-tab `<Section title="General"/>` headings inside the tab components are now somewhat redundant with the rail; **leave them** for this task (removing them is cosmetic and risks churn) — the rail + the in-panel title is fine. The sticky Save/Discard footer stays exactly as it is, below the `XStack`.

- [ ] **Step 3: Verify**

Run: `pnpm -F desktop typecheck` — Expected: no errors.

Manual: open http://localhost:8081/settings — left rail with six items; "General" active by default, its panel on the right. Click "Translation" → the rail highlights it, the panel swaps to the Translation tab. Switch to Subtitles, change the font, switch to General and back — the change is still in the draft (footer says "unsaved changes"). Save → reload → defaults back to "General" tab, the saved font persists. The footer is present on every tab.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/components/settings/SettingsRail.tsx apps/desktop/app/settings.tsx
git commit -m "feat(settings): two-pane layout — sub-tab rail + single active panel"
```

---

### Task 4: Sync the active tab to the URL hash (deep-linkable tabs)

`…/settings#translation` opens the Translation tab; clicking the rail updates the hash; the browser back button moves between tabs. Pure browser-`location.hash` wiring (Expo Router's router API has no good hash support).

**Files:**
- Modify: `apps/desktop/src/components/settings/SettingsContext.tsx`

- [ ] **Step 1: Read the hash on mount, write it on change, listen for `hashchange`**

In `SettingsProvider`, just after the `activeTab` `useState`, replace it with hash-aware logic. Add a tiny helper above the provider:

```tsx
import { TABS, type TabId } from "./shared";

const TAB_IDS = TABS.map((t) => t.id);
function tabFromHash(): TabId {
  if (typeof window === "undefined") return "general";
  const h = window.location.hash.replace(/^#/, "").split("/")[0]; // "#translation" or "#translation/<fieldId>"
  return (TAB_IDS as string[]).includes(h) ? (h as TabId) : "general";
}
```

Then:

```tsx
  const [activeTab, setActiveTabState] = React.useState<TabId>(() => tabFromHash());

  const setActiveTab = React.useCallback((t: TabId) => {
    setActiveTabState(t);
    if (typeof window !== "undefined") {
      // setting location.hash adds a history entry; that's the desired behavior
      // (back button = previous tab). Avoid redundant writes.
      if (window.location.hash.replace(/^#/, "").split("/")[0] !== t) {
        window.location.hash = t;
      }
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const onHashChange = () => setActiveTabState(tabFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
```

(The `#<tab>/<fieldId>` form is consumed in Task 5 by the search-result click; here we only care about the `<tab>` part.)

- [ ] **Step 2: Verify**

Run: `pnpm -F desktop typecheck` — Expected: no errors.

Manual: navigate the browser to `http://localhost:8081/settings#subtitles` → the Subtitles tab is active on load. Click "Advanced" in the rail → the address bar shows `…/settings#advanced`. Hit the browser Back button → returns to Subtitles. Navigate to `…/settings#bogus` → falls back to General (no crash).

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/components/settings/SettingsContext.tsx
git commit -m "feat(settings): sync active sub-tab to the URL hash (deep-linkable tabs)"
```

---

### Task 5: Search box + jump-and-highlight

A search box pinned above the panel. Typing filters `SETTINGS_INDEX` (label + keyword substring match, case-insensitive); results render as `Tab › Setting` rows; clicking a result switches to that tab and pulses the target field for ~2 s. Clearing the box restores the active tab's panel. (The `SettingRow` highlight/scroll machinery already exists from Task 2 — this task just drives it.)

**Files:**
- Create: `apps/desktop/src/components/settings/SettingsSearch.tsx`
- Modify: `apps/desktop/app/settings.tsx`

- [ ] **Step 1: Create `SettingsSearch.tsx`**

```tsx
import * as React from "react";
import { YStack, XStack, Text } from "tamagui";
import { TextInput, GlassCard, BodySm, Caption } from "@yt-subtitle-maker/ui";
import { useSettings } from "./SettingsContext";
import { TABS } from "./shared";
import { SETTINGS_INDEX, type SearchEntry } from "./searchIndex";

const tabLabel = (id: string) => TABS.find((t) => t.id === id)?.label ?? id;

export function SettingsSearch() {
  const { searchQuery, setSearchQuery, setActiveTab, setHighlightedSettingId } = useSettings();
  const q = searchQuery.trim().toLowerCase();

  const results: SearchEntry[] = React.useMemo(() => {
    if (q.length < 2) return [];
    return SETTINGS_INDEX.filter(
      (e) =>
        e.label.toLowerCase().includes(q) ||
        e.keywords.some((k) => k.toLowerCase().includes(q)),
    );
  }, [q]);

  const jump = (e: SearchEntry) => {
    setSearchQuery("");
    setActiveTab(e.tab);
    if (typeof window !== "undefined") window.location.hash = `${e.tab}/${e.id}`;
    // let the tab mount/become visible, then highlight (SettingRow scrolls to it)
    setTimeout(() => setHighlightedSettingId(e.id), 0);
  };

  return (
    <YStack gap="$xs">
      <TextInput
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search settings…"
      />
      {q.length >= 2 ? (
        <GlassCard variant="mid">
          <YStack gap="$xxs">
            {results.length === 0 ? (
              <Caption color="$textMuted">No settings match “{searchQuery}”.</Caption>
            ) : (
              results.map((e) => (
                <XStack
                  key={e.id}
                  tag="button"
                  onPress={() => jump(e)}
                  paddingVertical="$xs"
                  paddingHorizontal="$sm"
                  borderRadius="$sm"
                  cursor="pointer"
                  hoverStyle={{ backgroundColor: "$surfaceGlass" }}
                  gap="$xs"
                  alignItems="baseline"
                >
                  <Caption color="$textMuted">{tabLabel(e.tab)} ›</Caption>
                  <BodySm>{e.label}</BodySm>
                </XStack>
              ))
            )}
          </YStack>
        </GlassCard>
      ) : null}
    </YStack>
  );
}
```

(Same `tag="button"` caveat as Task 3 — if it doesn't work in this Tamagui setup, mirror the sidebar/`ButtonGhost` pattern. The behavior that matters: a text input that filters, a clickable result list.)

- [ ] **Step 2: Mount the search box above the panel, and hide the panel while searching**

In `app/settings.tsx`'s `SettingsShell`, pull `searchQuery` from `useSettings()` and render:

```tsx
      <XStack gap="$lg" alignItems="flex-start">
        <SettingsRail />
        <YStack flex={1} gap="$lg">
          <SettingsSearch />
          {searchQuery.trim().length >= 2 ? null : <ActiveTab />}
        </YStack>
      </XStack>
```

So while a query of ≥2 chars is in the box, the results list (rendered by `SettingsSearch`) replaces the tab panel; clicking a result clears the query (→ panel reappears), switches the tab, and highlights the field. (The `SettingRow` for that field is mounted as soon as `ActiveTab` re-renders post-clear; its `useEffect` does the smooth scroll + the 2.2 s pulse, then clears the highlight.)

- [ ] **Step 3: Verify**

Run: `pnpm -F desktop typecheck` — Expected: no errors.

Manual: open http://localhost:8081/settings → type `gemini` in the search box → a result `Translation › Provider` appears (and others matching "gemini" in keywords) → click it → the box clears, the Translation tab opens, the "Provider" row briefly glows and is scrolled into view. Type `outline` → `Subtitles › Outline color` / `Subtitles › Outline width` → click one → Subtitles tab, that row highlighted. Type `xyz` → "No settings match". Clear the box → back to the current tab's normal panel. The address bar shows `…/settings#subtitles/subtitles.border-color` after a jump.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/components/settings/SettingsSearch.tsx apps/desktop/app/settings.tsx
git commit -m "feat(settings): search box — jump to any setting across tabs, with highlight"
```

---

### Task 6: `ArmedField` component + Backend URL becomes an armed field + cleanup

Build the reusable `ArmedField` (locked → Edit → validate → Apply, with "Apply anyway" on validation failure and an optional secondary action) and use it for the Backend URL in the Advanced tab — the item Phase 1's plan explicitly deferred here. Then a small cleanup pass.

**Files:**
- Create: `apps/desktop/src/components/settings/ArmedField.tsx`
- Modify: `apps/desktop/src/components/settings/AdvancedTab.tsx`
- Modify: `apps/desktop/src/components/settings/SettingsContext.tsx` (remove the now-unused `backendStatus`/`setBackendStatus`/`testBackend`)
- Modify: `apps/desktop/app/settings.tsx` (drop the unused `BodyMd` import flagged in Phase 1's final review, if still present)

- [ ] **Step 1: Create `ArmedField.tsx`**

```tsx
import * as React from "react";
import { XStack, YStack, Stack } from "tamagui";
import { Lock, Pencil } from "@tamagui/lucide-icons";
import { TextInput, ButtonSecondary, ButtonGhost, BodySm, Caption } from "@yt-subtitle-maker/ui";

export interface ArmedFieldValidation {
  ok: boolean;
  reason?: string;
}

/**
 * A field you can't fat-finger: shows the current value read-only with an
 * "Edit" affordance. Editing reveals an input + Apply/Cancel; Apply runs an
 * async `validate(value)` first — pass → onApply(value); fail → stays open,
 * shows the reason, offers "Apply anyway" (onApply unconditionally).
 * Optional `secondaryAction` renders an always-visible extra button (e.g.
 * "Reset to 127.0.0.1:8000" for the Backend URL).
 */
export function ArmedField({
  value,
  placeholder,
  validate,
  onApply,
  secondaryAction,
}: {
  value: string;
  placeholder?: string;
  validate: (value: string) => Promise<ArmedFieldValidation>;
  onApply: (value: string) => void;
  secondaryAction?: { label: string; onPress: () => void };
}) {
  const [editing, setEditing] = React.useState(false);
  const [scratch, setScratch] = React.useState(value);
  const [checking, setChecking] = React.useState(false);
  const [failReason, setFailReason] = React.useState<string | null>(null);

  // keep scratch in sync if the underlying value changes while not editing
  React.useEffect(() => {
    if (!editing) setScratch(value);
  }, [value, editing]);

  const startEdit = () => {
    setScratch(value);
    setFailReason(null);
    setEditing(true);
  };
  const cancel = () => {
    setEditing(false);
    setFailReason(null);
  };
  const commit = (v: string) => {
    onApply(v);
    setEditing(false);
    setFailReason(null);
  };
  const apply = async () => {
    setChecking(true);
    setFailReason(null);
    try {
      const r = await validate(scratch);
      if (r.ok) commit(scratch);
      else setFailReason(r.reason ?? "Validation failed.");
    } catch (err) {
      setFailReason(err instanceof Error ? err.message : String(err));
    } finally {
      setChecking(false);
    }
  };

  if (!editing) {
    return (
      <XStack gap="$sm" alignItems="center">
        <Stack
          flex={1}
          padding="$sm"
          borderRadius="$md"
          backgroundColor="$surfaceGlass"
          borderWidth={1}
          borderColor="$borderSubtle"
          flexDirection="row"
          alignItems="center"
          gap="$xs"
        >
          <Lock size={12} color="$textMuted" />
          <BodySm color={value ? "$text" : "$textMuted"}>{value || placeholder || "—"}</BodySm>
        </Stack>
        <ButtonSecondary onPress={startEdit}>
          <XStack gap="$xs" alignItems="center">
            <Pencil size={12} color="$textSecondary" />
            <BodySm color="$textSecondary">Edit</BodySm>
          </XStack>
        </ButtonSecondary>
        {secondaryAction ? (
          <ButtonGhost onPress={secondaryAction.onPress}>
            <BodySm color="$textSecondary">{secondaryAction.label}</BodySm>
          </ButtonGhost>
        ) : null}
      </XStack>
    );
  }

  return (
    <YStack gap="$xs">
      <XStack gap="$sm" alignItems="center">
        <TextInput flex={1} value={scratch} onChangeText={setScratch} placeholder={placeholder} autoFocus />
        <ButtonSecondary onPress={apply} disabled={checking}>{checking ? "Checking…" : "Apply"}</ButtonSecondary>
        <ButtonGhost onPress={cancel} disabled={checking}>Cancel</ButtonGhost>
      </XStack>
      {failReason ? (
        <XStack gap="$sm" alignItems="center">
          <Caption color="$error">{failReason}</Caption>
          <ButtonGhost onPress={() => commit(scratch)}>
            <Caption color="$textSecondary">Apply anyway</Caption>
          </ButtonGhost>
        </XStack>
      ) : null}
    </YStack>
  );
}
```

(If `autoFocus` isn't a valid prop on this `TextInput`, drop it. If `Lock`/`Pencil` aren't exported by `@tamagui/lucide-icons` under those names, pick the closest available — e.g. `LockKeyhole`, `Edit3` — the icons are cosmetic.)

- [ ] **Step 2: Use `ArmedField` for the Backend URL in `AdvancedTab.tsx`**

Replace the `advanced.backend-url` `SettingRow`'s body (the `<XStack>` with the plain `TextInput` + Test + StatusDot) with:

```tsx
        <SettingRow id="advanced.backend-url" label="Backend URL" helper="The address the app talks to. Edit → it pings GET /api/version before applying. Default is 127.0.0.1:8000.">
          <ArmedField
            value={draft.backendUrl}
            placeholder="127.0.0.1:8000"
            validate={async (v) => {
              try {
                await new ApiClient(v).fetchVersion();
                return { ok: true };
              } catch (err) {
                return { ok: false, reason: `Couldn't reach a backend at "${v}": ${err instanceof Error ? err.message : String(err)}` };
              }
            }}
            onApply={(v) => {
              update("backendUrl", v);
              apiClient.setBaseUrl(v);
            }}
            secondaryAction={{
              label: "Reset to 127.0.0.1:8000",
              onPress: () => {
                update("backendUrl", "127.0.0.1:8000");
                apiClient.setBaseUrl("127.0.0.1:8000");
              },
            }}
          />
        </SettingRow>
```

Add to `AdvancedTab.tsx`'s imports: `import { ApiClient } from "@yt-subtitle-maker/api-client";` and `import { ArmedField } from "./ArmedField";`. Note the model is unchanged in spirit: `onApply` writes to `draft` (and updates the in-memory client immediately, like `onSave` does) — it still takes a "Save settings" click to persist to `config.json`. The "armed" part is the Edit → validate gate; that's the Phase-2 deliverable.

Remove the `backendStatus`/`testBackend` references from `AdvancedTab.tsx` (no longer used there).

- [ ] **Step 3: Remove the now-dead `testBackend` plumbing**

In `SettingsContext.tsx`: delete `backendStatus`/`setBackendStatus` state, the `testBackend` function, and their entries in `SettingsContextValue` and the `value` object. (Nothing else references them — grep the `apps/desktop/src/components/settings/` dir to confirm. The `ApiClient` import in `SettingsContext.tsx` may now be unused — if so, remove it.)

In `app/settings.tsx`: if the `BodyMd` import from `@yt-subtitle-maker/ui` is still present and unused (it was, per Phase 1's final review), remove it. Quick grep for any other now-unused import in `app/settings.tsx` and trim.

- [ ] **Step 4: Verify**

Run: `pnpm -F desktop typecheck` — Expected: no errors.
Run: `backend/.venv/bin/python -m pytest -q` — Expected: still 160 passed (this plan doesn't touch the backend; this is a regression check).

Manual: open http://localhost:8081/settings#advanced → "Backend URL" shows the current value read-only with a 🔒 and an "Edit" button, plus a "Reset to 127.0.0.1:8000" ghost button. Click "Edit" → it becomes an editable input with Apply / Cancel → type `nope.invalid:9999` → Apply → "Checking…" → it stays open and shows a red reason like `Couldn't reach a backend at "nope.invalid:9999": …` plus an "Apply anyway" link. Click "Cancel" → reverts to the original value, locked. Click "Edit" again → type a bogus value → "Apply anyway" → the draft now holds the bogus value (footer: "unsaved changes"); click "Reset to 127.0.0.1:8000" → back to the default, still "unsaved changes"; Save → reload → `backendUrl` persisted as `127.0.0.1:8000`. Search still works; the other five tabs are unchanged.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/components/settings/ArmedField.tsx apps/desktop/src/components/settings/AdvancedTab.tsx apps/desktop/src/components/settings/SettingsContext.tsx apps/desktop/app/settings.tsx
git commit -m "feat(settings): ArmedField component; Backend URL is now armed (validate before apply) + cleanup"
```

---

## Self-review (done by plan author)

- **Spec coverage (Phase 2 slice):**
  - "two-pane layout inside the content area — a narrow sub-tab rail on the left" → Task 3 ✓
  - "a search box pinned to the top of the panel area … typing filters to matching settings across all tabs, listed as `Tab › Setting`; clicking a result switches to that tab and highlights the field" → Task 5 ✓
  - "Sub-tab + a `#field-id` hash give deep-linkable settings" → Task 4 (tab in hash) + Task 5 (jump writes `#<tab>/<fieldId>`) ✓
  - "`settings.tsx` … becomes a thin shell — it renders the sub-tab rail + search + the active tab; the active tab is component state … synced to the URL hash" → Tasks 1/3/4 ✓
  - "The tab bodies move to `apps/desktop/src/components/settings/`: `GeneralTab.tsx`, … `AdvancedTab.tsx`, plus shared pieces: `SettingRow.tsx`, `ArmedField.tsx`, …" → Tasks 1/2/6 ✓ (the *other* shared pieces — `ColorField`, `NumberStepper`, `Combobox`, `ProviderRow`, `EnginePicker`, `SubtitlePreview`, `useSettingsDraft` — are Phase 3/4 and out of scope, as stated in the header)
  - The six-tab contents table in the spec ("IA — structure & navigation") → Task 2's re-homing mapping matches it (General = Output/Download/Whisper-cache/Logs; YouTube = cookie source/profile/txt + JS runtime; Transcription = engine/device/source-lang/VAD/FFmpeg-resample + the model picker; Translation = translate-by-default/auto-title/target-lang/provider; Subtitles = mpv path + font/size/colors/outline/bold/margin; Advanced = Backend URL armed + Reset all). The spec also lists "Open config folder / Export / Import" under Advanced — those are explicitly Phase 4 per the spec's phasing and the header's out-of-scope list. ✓
  - "`ArmedField` … built early (needed for the Backend URL fix) and reused" → Task 6 builds it; Backend URL uses it; the folder/path fields stay plain (Phase 3 arms them — header says so). The Phase-1 plan's deviation note ("moves [ArmedField + Backend-URL] to Phase 2") is honored. ✓
  - "Hybrid save model" / per-field `↺` → **deliberately Phase 4**; the existing Save/Discard footer is kept. Header states this. ✓
- **Placeholder scan:** none. The "read the actual control JSX in `app/settings.tsx` and move it verbatim" instructions in Task 2 Steps 4–8 are concrete transformation guidance about an existing file (the controls don't change — only their wrappers and their `draft`/`update` source), not deferred work; the full new-component code is given for `SettingsContext`, `SettingRow`, `SettingsRail`, `SettingsSearch`, `ArmedField`, `GeneralTab`, `AdvancedTab`, and the `searchIndex.ts` data. The `tag="button"` and icon-name caveats are concrete fallbacks, not TODOs. The "(mpv default sans)"-style placeholder removals and the new neutral helpers for `outputDir`/`whisperCacheDir`/`mpvPath` are spelled out.
- **Type/name consistency:** `TabId` / `TABS` defined in `shared.tsx` (Task 1), used by `SettingsContextValue`, `SettingsRail`, `SettingsSearch`, `searchIndex.ts`, and `app/settings.tsx`'s `TAB_COMPONENTS` — all the same six ids (`general`/`youtube`/`transcription`/`translation`/`subtitles`/`advanced`). `useSettings()` is the single accessor everywhere. `SETTINGS_INDEX` entry `id`s in Task 2 Step 2 are exactly the `SettingRow` `id`s assigned in Steps 3–8 (minus the eight provider-specific Translation ids, which are intentionally not indexed). `SettingsContextValue` gains `setConfig`/`setDraft` in Task 2 Step 8 (for the moved Reset handler + Task 6's ArmedField) and loses `backendStatus`/`setBackendStatus`/`testBackend` in Task 6 Step 3 — both changes are called out where they happen. `ArmedField`'s `validate: (value: string) => Promise<{ok: boolean; reason?: string}>` matches its use in `AdvancedTab.tsx`. The hash format `#<tabId>` (Task 4) / `#<tabId>/<fieldId>` (Task 5) is parsed consistently (`split("/")[0]` for the tab).
- **Risk notes for the executor:** Task 1 and Task 2 are the heavy ones (a context extraction and a six-file decomposition); both end with the screen verifiably *unchanged-then-rehomed*, so they're independently checkable. If Task 2 proves too large for one pass, split it tab-by-tab (each sub-step already creates one tab file + updates `app/settings.tsx` to render it) — but the intermediate states stay compilable. The provider-specific Translation fields being only conditionally mounted (and not in the search index) is a known, accepted limitation that Phase 4's Translation rewrite resolves.
