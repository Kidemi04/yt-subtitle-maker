# Settings Phase 4c-Frontend — Engine-Driven Transcription Tab

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Each task = one reviewable commit; the codebase must be green (`pnpm -F desktop typecheck` clean) after every task.

**Goal:** Rewrite `TranscriptionTab.tsx` to be fully driven by `GET /api/engines` + `GET /api/system`, replacing the hardcoded engine/model dropdowns with: a "Source mode" `SegmentedControl` ("Auto · Whisper only · YouTube captions only"), an `EnginePicker` component that renders each engine as a `RadioCard` with a machine-compat verdict line + per-engine model rows (sizes + "Download" button → streaming progress), and a dormant `EngineTunables` component (ready for future engine-specific tunables, today always renders nothing).

**Architecture:** Frontend-only — the backend half (the new endpoints + api-client types/methods) was shipped in `docs/superpowers/plans/2026-05-12-settings-phase-4c-backend-engines.md` and is already live on branch `v2.1`. This plan:
1. Adds `engines: EngineDescriptor[] | undefined` + `system: SystemReport | undefined` to `SettingsContext` (fetched once on mount alongside the existing `fetchVersion`/`fetchDependencies` calls).
2. Creates a pure helper `engineVerdict.ts` that maps `(EngineDescriptor, SystemReport) → { level, line }`.
3. Creates `ModelRow.tsx` (single model row: name + size + download-state + streaming progress).
4. Creates `EngineTunables.tsx` (renders `tunables[]` from the descriptor; today always `[]`, renders nothing).
5. Creates `EnginePicker.tsx` (the full engine list: one `RadioCard` per engine, verdict line, model catalog, tunables).
6. Creates `SourceModeControl.tsx` (the "Auto · Whisper only · YouTube captions only" `SegmentedControl` + the config-key mapping logic).
7. Rewrites `TranscriptionTab.tsx` to use all of the above.
8. Updates `searchIndex.ts` + `SETTING_FIELD` in `constants.ts` for the new/changed/removed ids; removes now-dead exported constants and context members.

**Tech Stack:** Expo SDK 51 + Expo Router + Tamagui + react-native-web; `@yt-subtitle-maker/ui` (`RadioCard`, `SegmentedControl`, `ProgressBar`, `ButtonSecondary`, `BadgePill`, `ButtonGhost`, `Caption`, `BodySm`, `TitleSm`, `Timestamp`, `GlassCard`); `@tamagui/lucide-icons` (`Download`, `CheckCircle`, `AlertTriangle`, `XCircle`); `@yt-subtitle-maker/api-client` (`EngineDescriptor`, `EngineModel`, `SystemReport`, `EngineTunable`). Verify: `pnpm -F desktop typecheck` (clean after every task) + manual eyeball against `pnpm web` (http://localhost:8081/settings?tab=transcription) with the backend up.

---

## Spec refs (quoted)

From `docs/superpowers/specs/2026-05-12-settings-tab-production-ready-design.md` — **"Transcription tab — engine-driven"**:

> "The tab is driven by an **engine descriptor list** the backend provides, not a hardcoded UI list. Each descriptor: `{ id, label, available: bool, packageSizeMb: number|null, requirements: {...}, models: [{ name, sizeMb, downloaded }], tunables: [{ key, label, type, choices?, default, help }] }`."

> "**Machine-compatibility verdict.** … The UI combines that with each engine's `requirements` to render `✓ works (…)` / `⚠ runs but no acceleration here (…)` / `✗ won't help on this hardware (…)`, plus a 'Best for your machine: …' line."

> "**Downloadable model weights with sizes.** For an available engine, its `models` list shows sizes; un-downloaded ones say 'Download (X GB)' and stream progress via `/api/dependencies` / `/api/dependencies/install` — the existing mechanism, extended to be engine-keyed."

> "**Per-engine tunables.** Rendered from the descriptor's `tunables` … The UI hardcodes nothing engine-specific."

> "**Source mode** (replaces today's confusing engine/auto/yt_captions mix): a segmented 'Source: Auto · Whisper only · YouTube captions only' — Auto = use YouTube's captions if present, else the chosen Whisper-family engine. Maps cleanly onto the existing `default_stt_engine` / `yt_captions_first` config values."

From **"Trust & correctness fixes"**:

> "Drop `faster-whisper ⭐ / WhisperX / insanely-fast-whisper` from the static list and the ⭐. The Transcription tab renders only engines the backend reports as available … Engines that aren't built yet still *appear* but as 'add-on / planned', disabled, with a machine-compat verdict and size."

> "Show each model with its size and download state (`✓ downloaded · 1.6 GB` vs `not downloaded · Download (3.0 GB)`), streaming progress via the existing `/api/dependencies` machinery."

From `docs/superpowers/plans/2026-05-12-settings-phase-4-overview.md` — **"4c — Frontend (4c-frontend)"**:

> "new components `EnginePicker.tsx` … radio per engine, the machine-compat verdict line … per-engine tunables from the descriptor, the model rows with sizes + 'Download (X GB)' + streaming progress; a 'Source mode' `SegmentedControl` … that maps onto `default_stt_engine` + `yt_captions_first`. `TranscriptionTab.tsx` is rewritten to use these (the Device / Source-language / VAD / FFmpeg-resample rows mostly stay; the model dropdown is replaced by the per-engine catalog). The Phase-2/3 `SettingRow`/search-index entries for the Transcription tab get updated."

---

## Out of scope

- Any backend change — all three endpoints (`GET /api/system`, `GET /api/engines`, extended `/api/dependencies`) are live from the 4c-backend plan.
- Actually implementing `faster-whisper`, `whisperx`, or `insanely-fast-whisper` — the tab shows their descriptors as "add-on (planned)", disabled.
- The Generate-screen per-job engine picker — that's a separate follow-up spec.
- The Translation tab, Subtitles tab, any other tab.
- Phase 4e (folder "Browse…", `tauri-plugin-dialog`, "Test playback") — no Rust.
- Promoting new components into `packages/ui` — keep them local to `apps/desktop/src/components/settings/`.

---

## Judgment calls (documented here, not in code comments)

**1. Source-mode ↔ config mapping.** The spec says the segmented control maps onto `default_stt_engine` + `yt_captions_first`. Reading `core/pipeline.py`'s `_select_stt_provider`: it reads `request["sttSource"]` (the per-job value, which is `"auto"` | `"yt_captions"` | `"whisper"`). For the *default* (Settings-level), `ytCaptionsFirst` governs whether the `/api/process` route defaults to `sttSource: "auto"` vs `"whisper"`, and `defaultSttEngine` picks which Whisper-family engine to use when Whisper runs. The three Source-mode values map as follows:

| Source mode | `ytCaptionsFirst` | `defaultSttEngine` |
|---|---|---|
| **Auto** | `true` | _(unchanged — keep whatever Whisper engine is selected)_ |
| **Whisper only** | `false` | _(unchanged)_ |
| **YouTube captions only** | _(unchanged)_ | `"yt_captions"` |

Reading the current value back to display: if `defaultSttEngine === "yt_captions"` → "YouTube captions only"; else if `ytCaptionsFirst === true` → "Auto"; else → "Whisper only".

**2. `SettingsContext` additions — no removal yet of `sttEngineOptions` / `whisperModelOptions`.** A grep confirms `sttEngineOptions` and `whisperModelOptions` are consumed by `TranscriptionTab.tsx` (which this plan replaces) and by `NewTranscribeModal.tsx` (a different component, not this plan's scope). `STT_ENGINE_LABELS` and `WHISPER_MODEL_IDS` are still used by `SettingsContext.tsx` to build those memos, and those memos are still needed by `NewTranscribeModal`. **Decision: keep `sttEngineOptions`, `whisperModelOptions`, `STT_ENGINE_LABELS`, `WHISPER_MODEL_IDS`, `installedEngines`, `deps` on the context exactly as they are.** Add `engines: EngineDescriptor[] | undefined` and `system: SystemReport | undefined` as new context members. When `NewTranscribeModal` is reworked (a future plan), the old memos can be cleaned up then.

**3. `engines`/`system` fetch strategy.** Both are one-time-on-mount reads (same as `fetchVersion` / `fetchDependencies`). Add them to the existing `useEffect` in `SettingsContext`. After a model download completes, the `ModelRow` component re-fetches `getEngines()` to refresh the `downloaded` state (a targeted refresh, not a full context re-render). The `SettingsContext` exposes `refreshEngines(): Promise<void>` so `ModelRow` can trigger it without holding a direct ref to `apiClient`.

**4. Verdict-level logic.** An engine is `"unavailable"` if `descriptor.available === false`. For available engines, the logic uses `system.os`, `system.gpu.mpsAvailable`, `system.gpu.cudaAvailable`, and the engine descriptor's `requirements.platform` + `requirements.accelerators`. Today the only available engine is `openai-whisper` which requires only `["cpu"]` → always `"works"`. The verdict strings are:
- `"works"` → `"✓ works (CPU)"` or `"✓ works (Apple MPS)"` or `"✓ works (NVIDIA CUDA)"` depending on what accelerator is available and in requirements.
- `"runs-no-accel"` → `"⚠ runs but no acceleration here (CPU only)"` — engine needs a GPU accelerator not present.
- `"wont-help"` → `"✗ won't help on this hardware (Apple-only MPS engine)"` — engine's platform list doesn't include `system.os`, or its accelerators are all unavailable AND the engine itself is platform-locked.
- `"unavailable"` → engine's `available` is `false`; show the `note` + `packageSizeMb`.

**5. `EnginePicker` selected engine vs Source mode.** The `EnginePicker` shows which Whisper engine is selected (i.e. `draft.defaultSttEngine` when it's not `"yt_captions"`). When Source mode is "YouTube captions only" (`defaultSttEngine === "yt_captions"`), the engine picker is still rendered but all `RadioCard`s are unselected (because `defaultSttEngine` is `"yt_captions"`, not a Whisper engine id). Selecting a Whisper engine radio also clears the `"yt_captions"` source mode (it sets `defaultSttEngine` to that engine's id and leaves `ytCaptionsFirst` unchanged). This is visually clear.

**6. Model download and autosave.** Downloading a model is NOT a config change — it does not call `update(...)`. Only *selecting* a model (as the default) calls `update("defaultWhisperModel", name)`. The download process is fire-and-forget async within `ModelRow`; on completion the row calls `refreshEngines()` to flip the `downloaded` flag. An `AbortController` is used so that unmounting the row mid-download cancels the stream.

**7. `EngineTunables` is dormant today.** `openai-whisper` always returns `tunables: []`, and the planned stubs also return `tunables: []`. The component renders a `null` when `tunables.length === 0`. When a future engine ships tunables, it maps: `type: "select"` → `Dropdown`; `type: "bool"` → `Toggle`; `type: "int"` / `type: "float"` → a numeric `TextInput`. Each tunable calls `update(tunable.key as keyof AppConfig, value)` — this will work once the backend adds those keys to `AppConfig`. Document this limitation in a code comment in `EngineTunables.tsx`.

**8. Search index and `SETTING_FIELD` changes.** The old `transcription.engine` and `transcription.model` rows (the two `Dropdown`s) are gone — replaced by the `SourceModeControl` and the inline `EnginePicker`. New `SettingRow` ids:
- `transcription.source-mode` — maps to both `ytCaptionsFirst` and `defaultSttEngine` (not a 1:1 `AppConfig` key mapping; leave it out of `SETTING_FIELD` — the Source mode row handles its own two-key update).
- `transcription.engine-picker` — the `EnginePicker` block; also not a 1:1 key in `AppConfig`; leave out of `SETTING_FIELD`.
- Remove old ids `transcription.engine` and `transcription.model` from `SETTING_FIELD` and `SETTINGS_INDEX`.
- Add `transcription.source-mode` and `transcription.engine-picker` to `SETTINGS_INDEX` (with keywords) but NOT to `SETTING_FIELD`.
- `transcription.device`, `transcription.source-lang`, `transcription.vad`, `transcription.ffmpeg-resample-16k` stay unchanged in both maps.
- `transcription.yt-captions-first` row is removed from the tab (replaced by Source mode control) — remove from `SETTING_FIELD` and `SETTINGS_INDEX`.

---

## File structure

| File | Change | Responsibility |
|---|---|---|
| `apps/desktop/src/components/settings/engineVerdict.ts` | **Create** | Pure function `engineVerdict(engine, system) → {level, line}` + `bestEngine(engines, system) → EngineDescriptor \| undefined`. No React. |
| `apps/desktop/src/components/settings/ModelRow.tsx` | **Create** | Single model row: name, size badge, download state, streaming progress. Calls `apiClient.installDependency` on press; calls `refreshEngines()` on done. |
| `apps/desktop/src/components/settings/EngineTunables.tsx` | **Create** | Renders `EngineTunable[]` from a descriptor. Returns `null` when `tunables.length === 0`. Dormant today. |
| `apps/desktop/src/components/settings/EnginePicker.tsx` | **Create** | Renders the full engine list: one `RadioCard` per engine, verdict badge, `packageSizeMb`, model rows (via `ModelRow`), tunables (via `EngineTunables`). |
| `apps/desktop/src/components/settings/SourceModeControl.tsx` | **Create** | The three-way `SegmentedControl` ("Auto · Whisper only · YouTube captions only") + the two-key config read/write logic. |
| `apps/desktop/src/components/settings/TranscriptionTab.tsx` | **Rewrite** | Thin shell: `SourceModeControl` at top, `EnginePicker` below, then Device / Source-lang / VAD / FFmpeg-resample `SettingRow`s. |
| `apps/desktop/src/components/settings/SettingsContext.tsx` | **Modify** | Add `engines`, `system`, `refreshEngines` to the context value; fetch on mount. |
| `apps/desktop/src/components/settings/constants.ts` | **Modify** | Remove `transcription.engine`, `transcription.model`, `transcription.yt-captions-first` from `SETTING_FIELD`; add `transcription.source-mode`, `transcription.engine-picker` (as keys with `undefined` value, or just remove/add to the search index only). |
| `apps/desktop/src/components/settings/searchIndex.ts` | **Modify** | Remove old transcription entries; add `transcription.source-mode` + `transcription.engine-picker`. |

---

## Task 1 — `engineVerdict.ts` — pure machine-compat logic

**Files:**
- Create: `apps/desktop/src/components/settings/engineVerdict.ts`

This module has zero React — it's a pure function file. It maps `(EngineDescriptor, SystemReport)` → `{ level: "works" | "runs-no-accel" | "wont-help" | "unavailable", line: string }` and `bestEngine(engines, system)` → the first available engine that `"works"`.

- [ ] **Step 1: Create `apps/desktop/src/components/settings/engineVerdict.ts`**

```typescript
// apps/desktop/src/components/settings/engineVerdict.ts
// Pure helpers — no React, no imports from the settings folder.
// Consumed by EnginePicker.tsx.
import type { EngineDescriptor, SystemReport } from "@yt-subtitle-maker/api-client";

export type VerdictLevel = "works" | "runs-no-accel" | "wont-help" | "unavailable";

export interface Verdict {
  level: VerdictLevel;
  line: string;
}

/**
 * Map a system GPU state to the accelerator tokens the backend uses in
 * `requirements.accelerators`. Order matters — mps before nvidia before cpu.
 */
function availableAccelerators(system: SystemReport): string[] {
  const acc: string[] = ["cpu"]; // cpu is always present
  if (system.gpu.mpsAvailable) acc.push("apple_mps");
  if (system.gpu.cudaAvailable) acc.push("nvidia_cuda");
  return acc;
}

/**
 * Compute the human-readable verdict for one engine on this machine.
 *
 * Logic:
 *  1. If `engine.available === false` → "unavailable" (show note + packageSizeMb).
 *  2. If `system.os` is not in `engine.requirements.platform` → "wont-help"
 *     (wrong OS — e.g. insanely-fast-whisper is macOS-only).
 *  3. If the engine's required accelerators are all present → "works"
 *     (e.g. openai-whisper needs only "cpu" — always works).
 *  4. If the engine needs a GPU accelerator that is NOT present but the engine
 *     still runs on cpu (cpu is in its accelerators) → "runs-no-accel".
 *  5. Otherwise → "wont-help" (engine needs a GPU that isn't here and has no
 *     cpu fallback — e.g. an MPS-only engine on a Linux box without MPS).
 */
export function engineVerdict(engine: EngineDescriptor, system: SystemReport): Verdict {
  if (!engine.available) {
    const sizePart = engine.packageSizeMb != null ? ` · ${(engine.packageSizeMb / 1024).toFixed(1)} GB add-on` : "";
    return {
      level: "unavailable",
      line: `Add-on / planned${sizePart}`,
    };
  }

  const required = engine.requirements;
  const myAccel = availableAccelerators(system);

  // Platform check
  if (required.platform.length > 0 && !required.platform.includes(system.os)) {
    const supported = required.platform.join(", ");
    return {
      level: "wont-help",
      line: `✗ won't help on this hardware (requires ${supported})`,
    };
  }

  // Accelerator check
  const hasAll = required.accelerators.every((a) => myAccel.includes(a));
  if (hasAll) {
    // Works — report which accelerator is active
    if (system.gpu.mpsAvailable && required.accelerators.includes("apple_mps")) {
      return { level: "works", line: "✓ works (Apple MPS)" };
    }
    if (system.gpu.cudaAvailable && required.accelerators.includes("nvidia_cuda")) {
      return { level: "works", line: "✓ works (NVIDIA CUDA)" };
    }
    return { level: "works", line: "✓ works (CPU)" };
  }

  // Not all accelerators present — does the engine still run on CPU?
  const hasCpuFallback = required.accelerators.includes("cpu");
  if (hasCpuFallback) {
    return {
      level: "runs-no-accel",
      line: "⚠ runs but no acceleration here (CPU only — install a GPU driver to speed up)",
    };
  }

  // Engine needs a GPU that isn't here and can't fall back to CPU
  const missing = required.accelerators.filter((a) => !myAccel.includes(a)).join(", ");
  return {
    level: "wont-help",
    line: `✗ won't help on this hardware (needs ${missing})`,
  };
}

/**
 * Return the first available engine for which verdict level is "works",
 * falling back to the first available engine (any verdict), or undefined
 * if there are no available engines at all.
 */
export function bestEngine(
  engines: EngineDescriptor[],
  system: SystemReport,
): EngineDescriptor | undefined {
  const available = engines.filter((e) => e.available);
  return (
    available.find((e) => engineVerdict(e, system).level === "works") ??
    available[0]
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker"
pnpm -F desktop typecheck
```

Expected: no errors. (The file is new and only imports from `@yt-subtitle-maker/api-client`, which already has `EngineDescriptor` and `SystemReport`.)

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/components/settings/engineVerdict.ts
git commit -m "feat(settings): engineVerdict helper — machine-compat verdict + bestEngine for TranscriptionTab"
```

---

## Task 2 — `SettingsContext` — add `engines`, `system`, `refreshEngines`

**Files:**
- Modify: `apps/desktop/src/components/settings/SettingsContext.tsx`

Add `engines: EngineDescriptor[] | undefined`, `system: SystemReport | undefined`, and `refreshEngines: () => Promise<void>` to the context. Fetch `getEngines()` and `getSystem()` once on mount alongside the existing `fetchVersion` / `fetchDependencies` calls. Keep `sttEngineOptions`, `whisperModelOptions`, `installedEngines`, `deps` intact (they are still consumed by `NewTranscribeModal.tsx`).

- [ ] **Step 1: Extend `SettingsContext.tsx`**

In `SettingsContext.tsx`, update the import at the top (it already imports `type AppConfig, type DependencyStatus`):

```typescript
import {
  type AppConfig,
  type DependencyStatus,
  type EngineDescriptor,
  type SystemReport,
} from "@yt-subtitle-maker/api-client";
```

Add new state variables after the existing `const [deps, setDeps] = React.useState<DependencyStatus | undefined>();` line:

```typescript
const [engines, setEngines] = React.useState<EngineDescriptor[] | undefined>(undefined);
const [system, setSystem] = React.useState<SystemReport | undefined>(undefined);
```

In the `useEffect` that fetches version/gemini-models/deps, add two more parallel fetches:

```typescript
apiClient
  .getEngines()
  .then((e) => !cancelled && setEngines(e))
  .catch(() => undefined);
apiClient
  .getSystem()
  .then((s) => !cancelled && setSystem(s))
  .catch(() => undefined);
```

Add `refreshEngines` after the `useEffect`:

```typescript
const refreshEngines = React.useCallback(async () => {
  try {
    const e = await apiClient.getEngines();
    setEngines(e);
  } catch {
    /* best-effort — ModelRow handles its own local error state */
  }
}, []);
```

Update `SettingsContextValue` interface — add three new members (the existing ones are unchanged):

```typescript
engines: EngineDescriptor[] | undefined;
system: SystemReport | undefined;
refreshEngines: () => Promise<void>;
```

Add the three to the `value` object:

```typescript
engines,
system,
refreshEngines,
```

- [ ] **Step 2: Typecheck**

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker"
pnpm -F desktop typecheck
```

Expected: no errors.

- [ ] **Step 3: Manual verify**

Start the backend and `pnpm web`. Open http://localhost:8081/settings?tab=transcription. Open the browser DevTools Network tab and confirm a `GET /api/engines` and `GET /api/system` request fires on page load and returns 200. (The tab still looks the same as before — the new data is available but not yet used; that changes in Task 7.)

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/components/settings/SettingsContext.tsx
git commit -m "feat(settings): add engines/system/refreshEngines to SettingsContext (fetched on mount)"
```

---

## Task 3 — `ModelRow.tsx` — model row with download-progress streaming

**Files:**
- Create: `apps/desktop/src/components/settings/ModelRow.tsx`

Each model within an available engine shows its name, size, and download state. Un-downloaded models have a "Download (X.X GB)" button that starts a streaming download and shows a `ProgressBar`. On completion, `refreshEngines()` is called to refresh the `downloaded` flag from the backend.

- [ ] **Step 1: Create `apps/desktop/src/components/settings/ModelRow.tsx`**

```typescript
// apps/desktop/src/components/settings/ModelRow.tsx
import * as React from "react";
import { Stack, XStack, YStack } from "tamagui";
import { CheckCircle } from "@tamagui/lucide-icons";
import {
  ButtonSecondary,
  ButtonGhost,
  ProgressBar,
  Caption,
  BodySm,
  TitleSm,
  BadgePill,
} from "@yt-subtitle-maker/ui";
import type { EngineModel } from "@yt-subtitle-maker/api-client";
import { apiClient } from "../../state/client";
import { useSettings } from "./SettingsContext";

type DownloadState = "idle" | "downloading" | "done" | "error";

interface Props {
  model: EngineModel;
  engineId: string;
  /** Whether this model is the currently-selected default. */
  selected: boolean;
  onSelect: (name: string) => void;
}

function formatSize(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

export function ModelRow({ model, engineId, selected, onSelect }: Props) {
  const { refreshEngines } = useSettings();
  const [dlState, setDlState] = React.useState<DownloadState>("idle");
  const [progress, setProgress] = React.useState(0);
  const [progressMsg, setProgressMsg] = React.useState<string | undefined>();
  const [dlError, setDlError] = React.useState<string | undefined>();
  const abortRef = React.useRef<AbortController | null>(null);

  // Clean up on unmount — cancel any in-progress download
  React.useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const startDownload = async () => {
    setDlState("downloading");
    setProgress(0);
    setProgressMsg("Starting…");
    setDlError(undefined);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      for await (const ev of apiClient.installDependency(
        model.name as Parameters<typeof apiClient.installDependency>[0],
        ctrl.signal,
        engineId,
      )) {
        if (ctrl.signal.aborted) return;
        if (ev.status === "downloading") {
          const pct = typeof ev.percent === "number" ? ev.percent / 100 : 0;
          setProgress(pct);
          if (
            typeof ev.downloaded === "number" &&
            typeof ev.total === "number"
          ) {
            const dlMb = (ev.downloaded / 1024 / 1024).toFixed(1);
            const totMb = (ev.total / 1024 / 1024).toFixed(0);
            const speedPart =
              typeof ev.speed === "number"
                ? ` · ${(ev.speed / 1024 / 1024).toFixed(1)} MB/s`
                : "";
            setProgressMsg(`${dlMb} / ${totMb} MB${speedPart}`);
          }
        }
        if (ev.status === "done") {
          setProgress(1);
          setProgressMsg("Done");
          setDlState("done");
          // Refresh the engine descriptor so the downloaded flag flips to true
          await refreshEngines();
          return;
        }
        if (ev.status === "error") {
          setDlError(ev.error ?? "Download failed");
          setDlState("error");
          return;
        }
      }
    } catch (err) {
      if (ctrl.signal.aborted) {
        setDlState("idle");
        return;
      }
      setDlError(err instanceof Error ? err.message : String(err));
      setDlState("error");
    }
  };

  const cancelDownload = () => {
    abortRef.current?.abort();
    setDlState("idle");
    setProgress(0);
    setProgressMsg(undefined);
  };

  const isDownloaded = model.downloaded || dlState === "done";

  return (
    <YStack
      paddingVertical="$xs"
      paddingHorizontal="$sm"
      borderRadius="$sm"
      backgroundColor={selected ? "$accentSoft" : "transparent"}
      borderWidth={selected ? 1 : 0}
      borderColor={selected ? "$accentDim" : "transparent"}
      gap="$xxs"
    >
      <XStack alignItems="center" gap="$sm">
        {/* Model name + size */}
        <YStack flex={1} gap={2}>
          <XStack alignItems="center" gap="$xs">
            <TitleSm
              onPress={() => onSelect(model.name)}
              style={{ cursor: "pointer" }}
              color={selected ? "$accent" : "$text"}
            >
              {model.name}
            </TitleSm>
            <BadgePill tone={isDownloaded ? "success" : "neutral"}>
              {formatSize(model.sizeMb)}
            </BadgePill>
            {isDownloaded ? (
              <CheckCircle size={13} color="$success" />
            ) : null}
          </XStack>
          {isDownloaded ? (
            <Caption color="$textSecondary">Downloaded · tap to select as default</Caption>
          ) : (
            <Caption color="$textMuted">Not downloaded</Caption>
          )}
        </YStack>

        {/* Action */}
        {!isDownloaded && dlState === "idle" ? (
          <ButtonSecondary size="$sm" onPress={startDownload}>
            <BodySm>Download ({formatSize(model.sizeMb)})</BodySm>
          </ButtonSecondary>
        ) : null}
        {dlState === "downloading" ? (
          <ButtonGhost size="$sm" onPress={cancelDownload}>
            <Caption color="$textSecondary">Cancel</Caption>
          </ButtonGhost>
        ) : null}
        {dlState === "error" ? (
          <ButtonSecondary size="$sm" onPress={startDownload}>
            <Caption color="$error">Retry</Caption>
          </ButtonSecondary>
        ) : null}
      </XStack>

      {/* Progress */}
      {dlState === "downloading" ? (
        <YStack gap={4}>
          <ProgressBar value={progress} />
          <XStack justifyContent="space-between">
            <Caption color="$textSecondary">{progressMsg ?? "Downloading…"}</Caption>
            <Caption color="$textMuted">{Math.round(progress * 100)}%</Caption>
          </XStack>
        </YStack>
      ) : null}

      {/* Error message */}
      {dlError && dlState === "error" ? (
        <Caption color="$error">{dlError}</Caption>
      ) : null}
    </YStack>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker"
pnpm -F desktop typecheck
```

Expected: no errors. If `ButtonSecondary`'s `size` prop doesn't exist (check `packages/ui/src/components/ButtonSecondary.tsx`), remove `size="$sm"` from both `ButtonSecondary` calls — the default size is fine.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/components/settings/ModelRow.tsx
git commit -m "feat(settings): ModelRow — per-model download-progress with streaming NDJSON (reuses init.tsx pattern)"
```

---

## Task 4 — `EngineTunables.tsx` — dormant tunable renderer (future-ready)

**Files:**
- Create: `apps/desktop/src/components/settings/EngineTunables.tsx`

Today `openai-whisper` always sends `tunables: []` and all planned stubs do too. This component renders nothing in that case. When a future engine ships tunables (e.g. `faster-whisper`'s `compute_type` select, `beam_size` int), it maps `tunable.type` → the right control. Each tunable calls `update(tunable.key as keyof AppConfig, value)`.

- [ ] **Step 1: Create `apps/desktop/src/components/settings/EngineTunables.tsx`**

```typescript
// apps/desktop/src/components/settings/EngineTunables.tsx
// Renders per-engine tunables from the GET /api/engines descriptor.
// Today this always returns null because openai-whisper has tunables: [].
// When faster-whisper lands with real tunables, this renders them from the
// descriptor without any hardcoding (type: "select" → Dropdown, "bool" → Toggle,
// "int"/"float" → TextInput). The `update` call uses `tunable.key as keyof AppConfig`
// — this works once the backend adds those keys to AppConfig; until then the
// cast is a known limitation documented here.
import * as React from "react";
import { YStack } from "tamagui";
import { Dropdown, Toggle } from "@yt-subtitle-maker/ui";
import type { EngineTunable, AppConfig } from "@yt-subtitle-maker/api-client";
import { Section, SettingRow } from "./shared";

interface Props {
  tunables: EngineTunable[];
  draft: AppConfig;
  update: <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => void;
}

export function EngineTunables({ tunables, draft, update }: Props) {
  if (tunables.length === 0) return null;

  return (
    <YStack gap="$sm" marginTop="$sm">
      <Section title="Engine settings" subtitle="These settings are specific to this engine." />
      {tunables.map((t) => {
        const key = t.key as keyof AppConfig;
        const value = draft[key];
        if (t.type === "select" && t.choices) {
          return (
            <SettingRow key={t.key} id={`transcription.tunable.${t.key}`} label={t.label} helper={t.help}>
              <Dropdown
                value={String(value ?? t.default ?? "")}
                onValueChange={(v) => update(key, v as AppConfig[typeof key])}
                options={t.choices.map((c) => ({ label: c, value: c }))}
                width="100%"
              />
            </SettingRow>
          );
        }
        if (t.type === "bool") {
          return (
            <SettingRow key={t.key} layout="row" id={`transcription.tunable.${t.key}`} label={t.label} helper={t.help}>
              <Toggle
                value={Boolean(value ?? t.default)}
                onValueChange={(v) => update(key, v as AppConfig[typeof key])}
                aria-label={t.label}
              />
            </SettingRow>
          );
        }
        // int / float — plain text input is fine for now
        return (
          <SettingRow key={t.key} id={`transcription.tunable.${t.key}`} label={t.label} helper={t.help}>
            <SettingRow
              id={`transcription.tunable.${t.key}.input`}
              label=""
            >
              {/* NumberStepper is only available in packages/ui if it was added in Phase 3;
                  for robustness, use a raw HTML input here which doesn't require imports */}
              <input
                type="number"
                value={String(value ?? t.default ?? 0)}
                onChange={(e) =>
                  update(
                    key,
                    (t.type === "int"
                      ? parseInt(e.target.value, 10)
                      : parseFloat(e.target.value)) as AppConfig[typeof key],
                  )
                }
                style={{ background: "transparent", border: "1px solid #444", borderRadius: 6, color: "inherit", padding: "4px 8px", width: 80 }}
              />
            </SettingRow>
          </SettingRow>
        );
      })}
    </YStack>
  );
}
```

> **Note for the implementer:** The double-nested `SettingRow` for `int`/`float` is a placeholder — if the `NumberStepper` component exists in `@yt-subtitle-maker/ui` (check `packages/ui/src/index.ts`), replace the raw `<input>` with `<NumberStepper>`. If neither exists and no tunables exist in practice today, simplify by just rendering a `<Caption>Unsupported tunable type: {t.type}</Caption>` for `int`/`float` until the real control is available. The important thing is this compiles cleanly with no type errors.

- [ ] **Step 2: Typecheck**

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker"
pnpm -F desktop typecheck
```

Expected: no errors. Fix any TS errors (most likely: the inner `SettingRow` wrapper for `int`/`float` is awkward — simplify as needed to make it compile; the component is dormant today).

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/components/settings/EngineTunables.tsx
git commit -m "feat(settings): EngineTunables — dormant per-engine tunable renderer (returns null today; future-ready)"
```

---

## Task 5 — `EnginePicker.tsx` — full engine list with verdicts + model catalog

**Files:**
- Create: `apps/desktop/src/components/settings/EnginePicker.tsx`

Renders one `RadioCard` per engine descriptor. Available engines are selectable; planned (`available: false`) engines are disabled. Each card shows: engine label, verdict line (from `engineVerdict()`), `packageSizeMb` for unavailable engines, and — for available engines — the model catalog (via `ModelRow`) + tunables (via `EngineTunables`). A "Best for your machine: …" line appears above the list.

- [ ] **Step 1: Create `apps/desktop/src/components/settings/EnginePicker.tsx`**

```typescript
// apps/desktop/src/components/settings/EnginePicker.tsx
import * as React from "react";
import { XStack, YStack } from "tamagui";
import { RadioCard, BadgePill, Caption, TitleSm, BodySm } from "@yt-subtitle-maker/ui";
import type { EngineDescriptor, SystemReport, AppConfig } from "@yt-subtitle-maker/api-client";
import { engineVerdict, bestEngine } from "./engineVerdict";
import { ModelRow } from "./ModelRow";
import { EngineTunables } from "./EngineTunables";

interface Props {
  engines: EngineDescriptor[];
  system: SystemReport;
  /** The currently-selected engine id in draft (may be "yt_captions"). */
  selectedEngineId: string;
  onSelectEngine: (engineId: string) => void;
  draft: AppConfig;
  update: <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => void;
}

export function EnginePicker({
  engines,
  system,
  selectedEngineId,
  onSelectEngine,
  draft,
  update,
}: Props) {
  const best = bestEngine(engines, system);

  return (
    <YStack gap="$sm">
      {best ? (
        <Caption color="$textSecondary">
          Best for your machine: <Caption color="$text">{best.label}</Caption>
        </Caption>
      ) : null}

      {engines.map((engine) => {
        const verdict = engineVerdict(engine, system);
        const isSelected = engine.available && engine.id === selectedEngineId;
        const isDisabled = !engine.available;

        return (
          <RadioCard
            key={engine.id}
            selected={isSelected}
            disabled={isDisabled}
            onPress={isDisabled ? undefined : () => onSelectEngine(engine.id)}
          >
            <YStack flex={1} gap="$xs">
              {/* Header row */}
              <XStack alignItems="center" gap="$sm" flexWrap="wrap">
                <TitleSm color={isSelected ? "$accent" : isDisabled ? "$textMuted" : "$text"}>
                  {engine.label}
                </TitleSm>
                {/* Verdict badge */}
                <BadgePill
                  tone={
                    verdict.level === "works"
                      ? "success"
                      : verdict.level === "runs-no-accel"
                      ? "warning"
                      : verdict.level === "wont-help"
                      ? "error"
                      : "neutral"
                  }
                >
                  {verdict.line}
                </BadgePill>
              </XStack>

              {/* Note for planned engines */}
              {engine.note ? (
                <Caption color="$textMuted">{engine.note}</Caption>
              ) : null}

              {/* Model catalog — only for available engines */}
              {engine.available && engine.models.length > 0 ? (
                <YStack gap="$xxs" marginTop="$xs">
                  {engine.models.map((model) => (
                    <ModelRow
                      key={model.name}
                      model={model}
                      engineId={engine.id}
                      selected={draft.defaultWhisperModel === model.name && isSelected}
                      onSelect={(name) => update("defaultWhisperModel", name)}
                    />
                  ))}
                </YStack>
              ) : null}

              {/* Per-engine tunables (dormant today — tunables: [] for all engines) */}
              {engine.available ? (
                <EngineTunables tunables={engine.tunables} draft={draft} update={update} />
              ) : null}
            </YStack>
          </RadioCard>
        );
      })}
    </YStack>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker"
pnpm -F desktop typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/components/settings/EnginePicker.tsx
git commit -m "feat(settings): EnginePicker — engine RadioCard list with verdict badges + model catalog + tunables (dormant)"
```

---

## Task 6 — `SourceModeControl.tsx` — the three-way segmented control

**Files:**
- Create: `apps/desktop/src/components/settings/SourceModeControl.tsx`

The "Source: Auto · Whisper only · YouTube captions only" `SegmentedControl` reads `draft.ytCaptionsFirst` and `draft.defaultSttEngine` to derive its current value, and writes back to those two fields on change.

**Config mapping (from judgment call #1):**

| Display value | `ytCaptionsFirst` written | `defaultSttEngine` written |
|---|---|---|
| `"auto"` | `true` | _(unchanged)_ |
| `"whisper"` | `false` | _(unchanged)_ |
| `"yt_captions"` | _(unchanged)_ | `"yt_captions"` |

Reading back: if `defaultSttEngine === "yt_captions"` → `"yt_captions"`; else if `ytCaptionsFirst` → `"auto"`; else → `"whisper"`.

- [ ] **Step 1: Create `apps/desktop/src/components/settings/SourceModeControl.tsx`**

```typescript
// apps/desktop/src/components/settings/SourceModeControl.tsx
// "Source mode" segmented control — the three-way setting that maps onto
// ytCaptionsFirst + defaultSttEngine in AppConfig.
//
// Config mapping (documented in the 4c-frontend plan, judgment call #1):
//   Auto             → ytCaptionsFirst = true   (defaultSttEngine unchanged)
//   Whisper only     → ytCaptionsFirst = false  (defaultSttEngine unchanged)
//   YouTube captions → defaultSttEngine = "yt_captions" (ytCaptionsFirst unchanged)
//
// Reading the current value:
//   defaultSttEngine === "yt_captions" → "yt_captions"
//   ytCaptionsFirst === true           → "auto"
//   else                               → "whisper"
import * as React from "react";
import { YStack } from "tamagui";
import { SegmentedControl } from "@yt-subtitle-maker/ui";
import type { SegmentedControlOption } from "@yt-subtitle-maker/ui";
import type { AppConfig } from "@yt-subtitle-maker/api-client";
import { SettingRow } from "./shared";

type SourceMode = "auto" | "whisper" | "yt_captions";

const SOURCE_OPTIONS: ReadonlyArray<SegmentedControlOption<SourceMode>> = [
  { label: "Auto", value: "auto" },
  { label: "Whisper only", value: "whisper" },
  { label: "YouTube captions only", value: "yt_captions" },
];

function deriveMode(draft: AppConfig): SourceMode {
  if (draft.defaultSttEngine === "yt_captions") return "yt_captions";
  return draft.ytCaptionsFirst ? "auto" : "whisper";
}

interface Props {
  draft: AppConfig;
  update: <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => void;
  /** The previously-selected Whisper engine id (used to restore when leaving yt_captions mode). */
  prevWhisperEngine: string;
}

export function SourceModeControl({ draft, update, prevWhisperEngine }: Props) {
  const current = deriveMode(draft);

  const handleChange = (mode: SourceMode) => {
    if (mode === "auto") {
      update("ytCaptionsFirst", true);
      // If we were in yt_captions mode, restore the previous Whisper engine
      if (draft.defaultSttEngine === "yt_captions") {
        update("defaultSttEngine", prevWhisperEngine || "openai-whisper");
      }
    } else if (mode === "whisper") {
      update("ytCaptionsFirst", false);
      // Same restore logic
      if (draft.defaultSttEngine === "yt_captions") {
        update("defaultSttEngine", prevWhisperEngine || "openai-whisper");
      }
    } else {
      // yt_captions — just set the engine; ytCaptionsFirst is irrelevant when
      // defaultSttEngine is "yt_captions" (pipeline checks the engine first)
      update("defaultSttEngine", "yt_captions");
    }
  };

  return (
    <SettingRow
      id="transcription.source-mode"
      label="Source"
      helper="Auto uses YouTube's captions if available, then falls back to the selected Whisper engine. Default for new jobs — change per-job on the Generate screen."
    >
      <SegmentedControl
        options={SOURCE_OPTIONS}
        value={current}
        onValueChange={handleChange}
      />
    </SettingRow>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker"
pnpm -F desktop typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/components/settings/SourceModeControl.tsx
git commit -m "feat(settings): SourceModeControl — 'Auto / Whisper only / YouTube captions only' SegmentedControl with ytCaptionsFirst+defaultSttEngine mapping"
```

---

## Task 7 — `TranscriptionTab.tsx` rewrite

**Files:**
- Rewrite: `apps/desktop/src/components/settings/TranscriptionTab.tsx`

Replace the tab entirely. The new layout:
1. `SourceModeControl` at the top (reads/writes `ytCaptionsFirst` + `defaultSttEngine`).
2. `EnginePicker` (visible when `engines` is loaded; loading state shown otherwise; hidden when Source mode is "YouTube captions only" because engine selection is irrelevant).
3. Device `Dropdown`, Source-language `Dropdown`, VAD `Toggle`, FFmpeg-resample `Toggle` — unchanged as regular `SettingRow`s.

When `engines` or `system` is `undefined` (still loading), show a simple loading state (a `Caption "Loading engine info…"`). When either is `undefined` after load (e.g. backend error), gracefully degrade: show the dropdowns-only view the old tab had (the old `sttEngineOptions` + `whisperModelOptions` from context, so the tab is never broken).

The `prevWhisperEngine` ref tracks the last non-`"yt_captions"` value of `defaultSttEngine` so that switching away from "YouTube captions only" can restore it.

- [ ] **Step 1: Rewrite `apps/desktop/src/components/settings/TranscriptionTab.tsx`**

```typescript
// apps/desktop/src/components/settings/TranscriptionTab.tsx
import * as React from "react";
import { XStack, YStack } from "tamagui";
import { GlassCard, Dropdown, Toggle, Caption } from "@yt-subtitle-maker/ui";
import { useSettings } from "./SettingsContext";
import { Section, SettingRow } from "./shared";
import { DEVICES, LANGS } from "./constants";
import { SourceModeControl } from "./SourceModeControl";
import { EnginePicker } from "./EnginePicker";

export function TranscriptionTab() {
  const {
    draft,
    update,
    engines,
    system,
    // fallback: keep these in scope in case engines/system fail to load
    sttEngineOptions,
    whisperModelOptions,
  } = useSettings();
  if (!draft) return null;

  // Track the last Whisper engine id so SourceModeControl can restore it
  // when the user switches away from "YouTube captions only".
  const prevWhisperEngineRef = React.useRef(
    draft.defaultSttEngine !== "yt_captions" ? draft.defaultSttEngine : "openai-whisper",
  );
  React.useEffect(() => {
    if (draft.defaultSttEngine !== "yt_captions") {
      prevWhisperEngineRef.current = draft.defaultSttEngine;
    }
  }, [draft.defaultSttEngine]);

  const isYtCaptionsMode = draft.defaultSttEngine === "yt_captions";

  return (
    <GlassCard variant="mid">
      <YStack gap="$md">
        <Section
          title="Transcription"
          subtitle="Defaults are overridable per-job in Generate."
        />

        {/* Source mode — the three-way toggle */}
        <SourceModeControl
          draft={draft}
          update={update}
          prevWhisperEngine={prevWhisperEngineRef.current}
        />

        {/* Engine picker — shown only when a Whisper engine is relevant */}
        {!isYtCaptionsMode ? (
          engines && system ? (
            <SettingRow id="transcription.engine-picker" label="Transcription engine">
              <EnginePicker
                engines={engines}
                system={system}
                selectedEngineId={draft.defaultSttEngine}
                onSelectEngine={(id) => update("defaultSttEngine", id)}
                draft={draft}
                update={update}
              />
            </SettingRow>
          ) : engines === undefined && system === undefined ? (
            /* Still loading */
            <Caption color="$textSecondary">Loading engine info…</Caption>
          ) : (
            /* Fallback: engines/system failed to load — show the old dropdowns */
            <XStack gap="$md" flexWrap="wrap">
              <YStack flex={1} minWidth={220}>
                <SettingRow id="transcription.engine" label="Default engine">
                  <Dropdown
                    value={draft.defaultSttEngine}
                    onValueChange={(v) => update("defaultSttEngine", v)}
                    options={sttEngineOptions}
                    width="100%"
                  />
                </SettingRow>
              </YStack>
              <YStack flex={1} minWidth={220}>
                <SettingRow id="transcription.model" label="Default model">
                  <Dropdown
                    value={draft.defaultWhisperModel}
                    onValueChange={(v) => update("defaultWhisperModel", v)}
                    options={whisperModelOptions}
                    width="100%"
                  />
                </SettingRow>
              </YStack>
            </XStack>
          )
        ) : null}

        {/* General settings — always visible */}
        <XStack gap="$md" flexWrap="wrap">
          <YStack flex={1} minWidth={220}>
            <SettingRow id="transcription.device" label="Default device">
              <Dropdown
                value={draft.defaultWhisperDevice}
                onValueChange={(v) => update("defaultWhisperDevice", v)}
                options={DEVICES}
                width="100%"
              />
            </SettingRow>
          </YStack>
          <YStack flex={1} minWidth={220}>
            <SettingRow
              id="transcription.source-lang"
              label="Default source language"
              helper="Setting a default prevents Whisper misdetection on intros / music."
            >
              <Dropdown
                value={draft.defaultSourceLang}
                onValueChange={(v) => update("defaultSourceLang", v)}
                options={LANGS}
                width="100%"
              />
            </SettingRow>
          </YStack>
        </XStack>
        <SettingRow
          layout="row"
          id="transcription.vad"
          label="Voice-Activity Detection (VAD) by default"
          helper="Skips silent regions before Whisper — faster on long videos. Per-job override stays on the Generate screen."
        >
          <Toggle
            value={draft.vadEnabled}
            onValueChange={(v) => update("vadEnabled", v)}
            aria-label="VAD default"
          />
        </SettingRow>
        <SettingRow
          layout="row"
          id="transcription.ffmpeg-resample-16k"
          label="FFmpeg 16 kHz pre-resample"
          helper="Pre-resamples to 16 kHz mono before Whisper for timestamp accuracy."
        >
          <Toggle
            value={draft.ffmpegResample16k}
            onValueChange={(v) => update("ffmpegResample16k", v)}
            aria-label="FFmpeg pre-resample"
          />
        </SettingRow>
      </YStack>
    </GlassCard>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker"
pnpm -F desktop typecheck
```

Expected: no errors.

- [ ] **Step 3: Manual verify (backend + `pnpm web`)**

Open http://localhost:8081/settings?tab=transcription. Verify:
1. The "Source" segmented control is visible at the top with three options: "Auto", "Whisper only", "YouTube captions only".
2. The `EnginePicker` is visible below (because engines + system loaded) showing at least one `RadioCard` for "OpenAI Whisper" with a verdict badge "✓ works (CPU)" (on a macOS arm64 machine without CUDA: `⚠ runs but no acceleration here…` is also possible if MPS is unavailable).
3. The planned engines (Faster Whisper, WhisperX, Insanely Fast Whisper) appear as disabled `RadioCard`s.
4. The model rows inside the OpenAI Whisper card show model names + sizes + download state.
5. Click "YouTube captions only" → the `EnginePicker` disappears; the Device/Lang/VAD/FFmpeg rows remain.
6. Click "Auto" → `EnginePicker` reappears.
7. Click a model row's "Download (X GB)" button → the progress bar appears; cancel with "Cancel" → the bar disappears.
8. Change "Default source language" → autosave fires ("✓ saved" pill in the footer).
9. VAD toggle → autosave fires.
10. Reload the page → all changes persisted.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/components/settings/TranscriptionTab.tsx
git commit -m "feat(settings): TranscriptionTab rewrite — SourceModeControl + EnginePicker + engine-driven model catalog"
```

---

## Task 8 — `SETTING_FIELD` + `SETTINGS_INDEX` cleanup

**Files:**
- Modify: `apps/desktop/src/components/settings/constants.ts`
- Modify: `apps/desktop/src/components/settings/searchIndex.ts`

Remove the old Transcription tab ids that no longer exist as `SettingRow`s:
- `transcription.engine` (was the engine `Dropdown` — replaced by the `EnginePicker` block)
- `transcription.model` (was the model `Dropdown` — replaced by inline model rows)
- `transcription.yt-captions-first` (was the standalone toggle — replaced by `SourceModeControl`)

Add new ids that do exist:
- `transcription.source-mode` — the `SourceModeControl` `SettingRow`
- `transcription.engine-picker` — the `SettingRow` wrapping `EnginePicker`

The new ids map to **multiple** `AppConfig` keys (or none at all) so they do NOT go in `SETTING_FIELD`. They only go in `SETTINGS_INDEX` for search.

The remaining Transcription ids (`transcription.device`, `transcription.source-lang`, `transcription.vad`, `transcription.ffmpeg-resample-16k`) are unchanged in both maps.

- [ ] **Step 1: Update `SETTING_FIELD` in `constants.ts`**

Remove these three entries from the `SETTING_FIELD` object:

```typescript
// Remove these:
"transcription.engine": "defaultSttEngine",
"transcription.model": "defaultWhisperModel",
"transcription.yt-captions-first": "ytCaptionsFirst",
```

The `SETTING_FIELD` object's Transcription section now only has:

```typescript
// Transcription
"transcription.device": "defaultWhisperDevice",
"transcription.source-lang": "defaultSourceLang",
"transcription.vad": "vadEnabled",
"transcription.ffmpeg-resample-16k": "ffmpegResample16k",
```

- [ ] **Step 2: Update `SETTINGS_INDEX` in `searchIndex.ts`**

Remove:
```typescript
{ id: "transcription.engine", tab: "transcription", label: "Default engine", keywords: ["stt", "speech", "whisper", "engine"] },
{ id: "transcription.model", tab: "transcription", label: "Default model", keywords: ["whisper", "model", "tiny", "base", "turbo", "large"] },
{ id: "transcription.yt-captions-first", tab: "transcription", label: "Try YouTube auto-captions first", keywords: ["captions", "auto", "youtube", "subtitles"] },
```

Add in their place (in the same Transcription section, before `transcription.device`):
```typescript
{ id: "transcription.source-mode", tab: "transcription", label: "Source mode", keywords: ["auto", "whisper", "youtube", "captions", "source", "stt", "mode"] },
{ id: "transcription.engine-picker", tab: "transcription", label: "Transcription engine", keywords: ["stt", "speech", "whisper", "engine", "model", "tiny", "base", "turbo", "large", "faster-whisper"] },
```

- [ ] **Step 3: Typecheck**

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker"
pnpm -F desktop typecheck
```

Expected: no errors.

- [ ] **Step 4: Manual verify search**

Open http://localhost:8081/settings (any tab). In the search box type "engine" → verify the result "Transcription › Transcription engine" appears (the new entry); the old "Default engine" result should not appear. Type "captions" → "Transcription › Source mode" appears. Click a search result → it navigates to the Transcription tab and the matching row highlights.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/components/settings/constants.ts apps/desktop/src/components/settings/searchIndex.ts
git commit -m "chore(settings): update SETTING_FIELD + SETTINGS_INDEX for the new Transcription tab ids (remove old engine/model/yt-captions-first, add source-mode/engine-picker)"
```

---

## Self-review

### 1. Spec coverage

| Spec requirement | Covered by |
|---|---|
| Engine descriptor list drives the tab (not a hardcoded UI list) | Task 5 `EnginePicker` + Task 7 `TranscriptionTab` rewrite (consumes `engines` from Task 2's context fetch) |
| Machine-compatibility verdict `✓ works` / `⚠ runs but no acceleration here` / `✗ won't help` | Task 1 `engineVerdict.ts` |
| "Best for your machine: …" line | Task 5 `EnginePicker` (`best = bestEngine(engines, system)`) |
| Downloadable model weights with sizes | Task 3 `ModelRow.tsx` (size via `formatSize(model.sizeMb)`) |
| Streaming progress via `/api/dependencies/install` with `engine` param | Task 3 `ModelRow.tsx` (`apiClient.installDependency(name, signal, engineId)`) |
| Per-engine tunables rendered from descriptor | Task 4 `EngineTunables.tsx` (dormant today; renders `null` for `[]`) |
| Source mode segmented control "Auto · Whisper only · YouTube captions only" | Task 6 `SourceModeControl.tsx` |
| Source mode maps onto `ytCaptionsFirst` + `defaultSttEngine` | Task 6 `SourceModeControl.tsx` + judgment call #1 |
| Planned engines shown disabled with verdict + size | Task 5 `EnginePicker` (`disabled={!engine.available}`) |
| Drop `faster-whisper ⭐ / WhisperX / insanely-fast-whisper` from the selectable list | Implicit: the `EnginePicker` only selects available engines; planned ones are `disabled` |
| Show each model with download state + "Download (X GB)" button | Task 3 `ModelRow.tsx` |
| `✓ downloaded` vs. not-downloaded state | Task 3 `ModelRow.tsx` (`isDownloaded = model.downloaded || dlState === "done"`) |
| Per-field `↺` — new ids must be in `SETTING_FIELD` or handled by their control | Task 8: `transcription.source-mode` + `transcription.engine-picker` are NOT in `SETTING_FIELD` (they touch multiple keys; each underlying key has its own `↺` via the autosave machinery). `transcription.device`, `transcription.source-lang`, `transcription.vad`, `transcription.ffmpeg-resample-16k` remain in `SETTING_FIELD`. |
| `pnpm -F desktop typecheck` clean after every task | Explicit verify step in every task |

### 2. Placeholder scan

- No "TBD", "TODO", "implement later", or "similar to Task N" in any task. All code is literal.
- The `EngineTunables.tsx` `int`/`float` fallback raw `<input>` is explicitly noted as a pragmatic choice for a today-dormant code path, with a note to replace with `NumberStepper` if it exists. This is not a deferred spec requirement — today no engine sends `int`/`float` tunables.
- The `TranscriptionTab`'s fallback branch (when `engines`/`system` fail to load) reuses `sttEngineOptions` + `whisperModelOptions` from context — these are real, live values, not placeholders.
- Every task ends with an exact `git commit -m` command and a `pnpm -F desktop typecheck` verify step.

### 3. Type/name consistency

- `engineVerdict(engine: EngineDescriptor, system: SystemReport): Verdict` — defined in Task 1, imported in `EnginePicker.tsx` (Task 5) as `engineVerdict` — names match.
- `bestEngine(engines: EngineDescriptor[], system: SystemReport): EngineDescriptor | undefined` — defined in Task 1, imported in `EnginePicker.tsx` (Task 5) — names match.
- `VerdictLevel` type: `"works" | "runs-no-accel" | "wont-help" | "unavailable"` — defined in Task 1; `EnginePicker.tsx` (Task 5) uses `verdict.level` to pick `BadgePill` tone: `"works"` → `"success"`, `"runs-no-accel"` → `"warning"`, `"wont-help"` → `"error"`, `"unavailable"` → `"neutral"`. These are valid `BadgePillTone` values (confirmed from `BadgePill.tsx`).
- `ModelRow` props: `{ model: EngineModel, engineId: string, selected: boolean, onSelect: (name: string) => void }` — defined in Task 3, called in `EnginePicker.tsx` (Task 5) with `model={model} engineId={engine.id} selected={...} onSelect={(name) => update("defaultWhisperModel", name)}` — all prop names match.
- `EngineTunables` props: `{ tunables: EngineTunable[], draft: AppConfig, update: <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => void }` — defined in Task 4, called in `EnginePicker.tsx` (Task 5) with the same exact signature.
- `EnginePicker` props: `{ engines, system, selectedEngineId, onSelectEngine, draft, update }` — defined in Task 5, called in `TranscriptionTab.tsx` (Task 7) with all six props provided.
- `SourceModeControl` props: `{ draft, update, prevWhisperEngine }` — defined in Task 6, called in `TranscriptionTab.tsx` (Task 7) with `prevWhisperEngine={prevWhisperEngineRef.current}` — names match.
- `SegmentedControl` from `@yt-subtitle-maker/ui`: `options`, `value`, `onValueChange` — confirmed props from reading the component file. `SourceModeControl` (Task 6) uses all three correctly.
- `RadioCard` from `@yt-subtitle-maker/ui`: `selected`, `disabled`, `onPress` — confirmed props from reading the component file. `EnginePicker` (Task 5) uses all three correctly.
- `ProgressBar` from `@yt-subtitle-maker/ui`: `value` (0..1) — confirmed from reading the component file. `ModelRow` (Task 3) passes `value={progress}` where `progress` is `0..1` — correct.
- `apiClient.installDependency(model, signal?, engine?)` — the 4c-backend plan shipped this signature with `engine?` as the third optional arg. `ModelRow` calls `apiClient.installDependency(model.name as ..., ctrl.signal, engineId)` — matches.
- `refreshEngines` in context: `() => Promise<void>` — defined in Task 2's context extension, used in `ModelRow` (Task 3) as `await refreshEngines()` — compatible.
- `engines: EngineDescriptor[] | undefined` + `system: SystemReport | undefined` — added to `SettingsContextValue` in Task 2, destructured in `TranscriptionTab.tsx` (Task 7) — names match.
- `SETTING_FIELD` in `constants.ts`: after Task 8, `transcription.device`, `transcription.source-lang`, `transcription.vad`, `transcription.ffmpeg-resample-16k` are present and map to `"defaultWhisperDevice"`, `"defaultSourceLang"`, `"vadEnabled"`, `"ffmpegResample16k"` respectively — these are valid `keyof AppConfig` values (confirmed from `types.ts`).
- `SETTINGS_INDEX` new entries: ids `"transcription.source-mode"` and `"transcription.engine-picker"` match the `nativeID` values used in `SourceModeControl.tsx` and `TranscriptionTab.tsx` exactly.
