# Settings Phase 4d — Frontend: Translation Named-Provider-Profiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the three fixed translator slots (gemini / local_openai / openai) in `TranslationTab.tsx` with a list of named provider profiles — built-in rows plus user-added custom providers — backed by the `customTranslators`/`activeTranslator` fields that Phase 4d-backend already ships in `GET`/`POST /api/config`.

**Architecture:** Eight focused tasks, each typecheck-clean on its own commit. `SettingsContext` grows four new surface-area items (`customTranslators`, `activeTranslator`, `lastTestResult`, and the CRUD helpers + test methods). Three new component files (`ProviderRow.tsx`, `ProviderForm.tsx`, `AddProviderModal.tsx`) hold the list/edit/add UI. `TranslationTab.tsx` is rewritten to compose them. A small Generate-screen banner reads the same context. `searchIndex.ts` + `constants.ts` are updated to match the new row ids. The old global `replacingKey` machinery's openai-specific slot is retired; per-profile key replacement moves into `ProviderForm` local state. No backend changes — that's 4d-backend, already done.

**Tech Stack:** TypeScript · React · Expo Router · Tamagui (`Stack`, `XStack`, `YStack`, `Text`) · `@yt-subtitle-maker/ui` (`GlassCard`, `Dropdown`, `TextInput`, `Toggle`, `ButtonPrimary`, `ButtonSecondary`, `ButtonGhost`, `IconButton`, `BadgePill`, `StatusDot`, `Caption`, `BodySm`, `TitleSm`) · `@yt-subtitle-maker/api-client` (`TranslatorProfile`, `TranslatorTestResult`, `apiClient`) · `pnpm -F desktop typecheck` for verification.

---

## Spec reference

From `docs/superpowers/specs/2026-05-12-settings-tab-production-ready-design.md`, **§ "Translation tab — named provider profiles"** (quoted):

> "Replace the three fixed slots (gemini / local_openai / openai) with a **list of provider profiles** + a chosen active one. … the tab shows the provider list (rows: radio = active, name, endpoint, model, last-test dot + timestamp, actions Test/Edit/Duplicate/Delete; built-ins can't be deleted). '+ Add provider' → preset menu (DeepSeek · Groq · OpenRouter · Together · Mistral · xAI · Fireworks · OpenAI · Custom…) prefilling name+endpoint → form (name / endpoint / key / model with ↻ to fetch /v1/models) → Test → Save. 'Duplicate' clones a row."

And from **§ "Error handling / edge states"**:

> "**Active translator's last test failed** → warning banner on the Translation tab + on the Generate screen's translation toggle."
> "**Delete the active translator** → prompt to choose a new active one (cannot be left with none)."

---

## Out of scope

- Any backend change — Phase 4d-backend already shipped `customTranslators`, `activeTranslator`, `POST /api/translator/test` (ad-hoc + profileId forms), and `POST /api/translator/list-models`.
- The Generate-screen **per-job** translator picker — that's its own follow-up spec.
- Any Rust / Tauri change.
- `faster-whisper` or other STT engines — Phase 4c.

---

## Judgment calls (documented)

| Decision | Choice | Rationale |
|---|---|---|
| `replacingKey` global (`{gemini, openai, localOpenai}`) | Retire the `openai` slot; Gemini + `localOpenai` slots stay (those two built-in forms still use them). Per-custom-profile "am I replacing the key?" moves into **`ProviderForm` local state** (`replacingThisKey: boolean`). | No cross-tab coupling needed; simpler than a per-profile-id set in context. |
| `lastTestResult` location | `SettingsContext` (not zustand, not local). | The Generate-screen banner needs to read it via `useSettings()` without re-running the test; it must survive tab switches. |
| ID generation for new custom providers | `"custom-" + Date.now().toString(36)` (e.g. `"custom-lk3v9a2"`). Stored verbatim as the profile's `id`; `activeTranslator` is set to this id directly (the backend prefix `"custom:<id>"` is the config value format). | Stable, readable, no extra dep. |
| Delete-active-translator | **Refuse + nudge**: show a `BadgePill tone="warning"` inline — "Make another provider active first, then delete this one." No picker modal. | Simpler; Gemini is always present as fallback, so the user is never stuck. |
| Built-in rows (`gemini`, `local_openai`) | Shown in the provider list as non-deletable rows. Their `Edit` form writes directly into `draft.geminiApiKey`/`geminiModel` (Gemini) and `draft.localOpenaiBaseUrl`/`localOpenaiModel`/`localOpenaiApiKey` (LM Studio) via the existing `update()` — **not** the `customTranslators` array. | The built-in fields are still stored in legacy config keys; no migration needed. |
| `activeTranslator` id format | The frontend stores the short profile id for custom profiles. When POSTing to `POST /api/config`, `update("activeTranslator", "custom-lk3v9a2")` — the backend wraps it with `custom:` prefix on its end. For built-ins, `update("activeTranslator", "gemini")` / `"local_openai"`. | Matches what 4d-backend documented: `activeTranslator` = `"gemini" | "local_openai" | "custom:<id>"`. Wait — the backend stores it as `"custom:<id>"`. So the frontend must store the full string. Use `"custom:" + id` when activating a custom profile. |
| `testAdhoc` vs `testTranslator` naming | Rename the current `testTranslator()` in `SettingsContext` to `testAdhoc()`. Add `testProfile(profileId)`. Keep a `testTranslator` alias pointing at `testAdhoc` so no existing callers break (there's one usage in the old `TranslationTab` which is being rewritten anyway — so just update it). | Clean separation. |
| Generate-screen banner | Include in this plan (the spec lists it explicitly; the change is ~10 lines). |  |
| Provider presets | Hardcoded `PROVIDER_PRESETS` const in `ProviderRow.tsx` (same file as the component, not a separate file). | Single source of truth; small enough to inline. |

---

## File structure

| File | Action | Responsibility |
|---|---|---|
| `apps/desktop/src/components/settings/SettingsContext.tsx` | **Modify** | Add `customTranslators`, `activeTranslator`, `lastTestResult`, `recordTestResult`, `testProfile`, `testAdhoc`, `setActiveTranslator`, `addCustomTranslator`, `removeCustomTranslator`, `updateCustomTranslator` to the interface + provider. |
| `apps/desktop/src/components/settings/ProviderRow.tsx` | **Create** | `PROVIDER_PRESETS` const + `ProviderRow` component (one row in the provider list, including its collapsed/expanded states). |
| `apps/desktop/src/components/settings/ProviderForm.tsx` | **Create** | Inline-edit form (name / endpoint / api-key / model). Used by `ProviderRow` when `isEditing`. |
| `apps/desktop/src/components/settings/AddProviderModal.tsx` | **Create** | "+ Add provider" preset-picker UI + initial blank `ProviderForm`. |
| `apps/desktop/src/components/settings/TranslationTab.tsx` | **Rewrite** | Compose the provider list (built-in rows + custom rows + "+ Add provider") + safety banner + the three unchanged setting rows (target lang / enable-by-default / auto-title). |
| `apps/desktop/app/index.tsx` | **Modify** | Add the small translation-may-fail `BadgePill` near the translation toggle on the Generate screen. |
| `apps/desktop/src/components/settings/searchIndex.ts` | **Modify** | Replace stale `translation.provider` / `translation.gemini-*` / `translation.openai-*` / `translation.local-*` entries; add `translation.active-provider` + `translation.add-provider`. |
| `apps/desktop/src/components/settings/constants.ts` | **Modify** | Remove `"translation.provider"` from `SETTING_FIELD` (it no longer maps to a single `AppConfig` key); keep the three unchanged rows. |

---

## Task 1: Extend `SettingsContext` with translator profile surface

**Files:**
- Modify: `apps/desktop/src/components/settings/SettingsContext.tsx`

### Background

`SettingsContext` today exposes `translatorStatus: ConnState` (a single global status) and `testTranslator()` (fires the old ad-hoc form). After this task it will expose:

- `customTranslators: TranslatorProfile[] | undefined` — derived from `draft?.customTranslators`
- `activeTranslator: string | undefined` — derived from `draft?.activeTranslator`
- `lastTestResult: Record<string, TranslatorTestResult & { at: number }>` — in-memory, per profile id
- `recordTestResult(profileId: string, result: TranslatorTestResult): void`
- `testProfile(profileId: string): Promise<TranslatorTestResult>` — calls `apiClient.testTranslator({ profileId, useSavedKey: true, targetLang: draft.defaultTargetLang })`
- `testAdhoc(spec): Promise<TranslatorTestResult>` — the ad-hoc form (replaces `testTranslator`)
- `setActiveTranslator(id: string): void` — wraps `update("activeTranslator", id)`
- `addCustomTranslator(profile: TranslatorProfile): void`
- `removeCustomTranslator(id: string): void`
- `updateCustomTranslator(id: string, patch: Partial<TranslatorProfile>): void`

The old `translatorStatus` + `testTranslator()` stay in the interface (the old `TranslationTab` is being replaced but keeping them avoids a build error mid-plan; we'll remove them in Task 5 cleanup).

- [ ] **Step 1: Add new types to the `SettingsContextValue` interface**

Open `apps/desktop/src/components/settings/SettingsContext.tsx`. After line 59 (`testTranslator: () => Promise<void>;`), add:

```typescript
  // Phase 4d-frontend: named provider profiles
  customTranslators: TranslatorProfile[] | undefined;
  activeTranslator: string | undefined;
  lastTestResult: Record<string, TranslatorTestResult & { at: number }>;
  recordTestResult: (profileId: string, result: TranslatorTestResult) => void;
  testProfile: (profileId: string) => Promise<TranslatorTestResult>;
  testAdhoc: (
    spec:
      | { provider: TranslatorProvider; baseUrl?: string; apiKey?: string; model?: string; targetLang?: string }
      | { profileId: string; useSavedKey: true; targetLang?: string },
  ) => Promise<TranslatorTestResult>;
  setActiveTranslator: (id: string) => void;
  addCustomTranslator: (profile: TranslatorProfile) => void;
  removeCustomTranslator: (id: string) => void;
  updateCustomTranslator: (id: string, patch: Partial<TranslatorProfile>) => void;
```

Also update the import at the top of `SettingsContext.tsx` to pull in `TranslatorProfile` and `TranslatorTestResult`:

```typescript
import {
  type AppConfig,
  type DependencyStatus,
  type EngineDescriptor,
  type SystemReport,
  type TranslatorProfile,
  type TranslatorTestResult,
} from "@yt-subtitle-maker/api-client";
```

(Add the two new type imports; `TranslatorProvider` is already used via `constants.ts`/`TranslatorProvider` — check if it's needed directly here; it is, for `testAdhoc`'s union type. Also import it.)

```typescript
import {
  type AppConfig,
  type DependencyStatus,
  type EngineDescriptor,
  type SystemReport,
  type TranslatorProfile,
  type TranslatorProvider,
  type TranslatorTestResult,
} from "@yt-subtitle-maker/api-client";
```

- [ ] **Step 2: Add `lastTestResult` state in `SettingsProvider`**

Inside `SettingsProvider`, after the `[modelsBusy, setModelsBusy]` state, add:

```typescript
  const [lastTestResult, setLastTestResult] = React.useState<
    Record<string, TranslatorTestResult & { at: number }>
  >({});
```

- [ ] **Step 3: Implement `recordTestResult`**

Add after the state declaration above:

```typescript
  const recordTestResult = React.useCallback(
    (profileId: string, result: TranslatorTestResult) => {
      setLastTestResult((prev) => ({
        ...prev,
        [profileId]: { ...result, at: Date.now() },
      }));
    },
    [],
  );
```

- [ ] **Step 4: Implement `testProfile`**

Add after `recordTestResult`:

```typescript
  const testProfile = React.useCallback(
    async (profileId: string): Promise<TranslatorTestResult> => {
      if (!draft) throw new Error("No draft");
      const result = await apiClient.testTranslator({
        profileId,
        useSavedKey: true,
        targetLang: draft.defaultTargetLang,
      });
      recordTestResult(profileId, result);
      return result;
    },
    [draft, recordTestResult],
  );
```

- [ ] **Step 5: Implement `testAdhoc` (rename existing `testTranslator`)**

Replace the existing `testTranslator` implementation with `testAdhoc`. Keep `testTranslator` as an alias that calls `testAdhoc` with the old ad-hoc form so nothing breaks yet.

Replace the existing `testTranslator` function body with:

```typescript
  const testAdhoc = React.useCallback(
    async (
      spec:
        | { provider: TranslatorProvider; baseUrl?: string; apiKey?: string; model?: string; targetLang?: string }
        | { profileId: string; useSavedKey: true; targetLang?: string },
    ): Promise<TranslatorTestResult> => {
      const result = await apiClient.testTranslator(spec);
      // For ad-hoc specs with a profileId, record the result
      if ("profileId" in spec) {
        recordTestResult(spec.profileId, result);
      }
      return result;
    },
    [recordTestResult],
  );

  // Legacy alias — used by the old Translation tab (being replaced in Task 5)
  const testTranslator = React.useCallback(async () => {
    if (!draft) return;
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
    try {
      const res = await apiClient.testTranslator({ provider, baseUrl, apiKey, model });
      setTranslatorStatus(res.ok ? "ok" : "error");
    } catch {
      setTranslatorStatus("error");
    }
  }, [draft]);
```

- [ ] **Step 6: Implement the CRUD helpers**

Add after `testAdhoc`:

```typescript
  const setActiveTranslator = React.useCallback(
    (id: string) => {
      update("activeTranslator", id);
    },
    [update],
  );

  const addCustomTranslator = React.useCallback(
    (profile: TranslatorProfile) => {
      update("customTranslators", [
        ...(draft?.customTranslators ?? []),
        profile,
      ]);
    },
    [draft, update],
  );

  const removeCustomTranslator = React.useCallback(
    (id: string) => {
      update(
        "customTranslators",
        (draft?.customTranslators ?? []).filter((p) => p.id !== id),
      );
    },
    [draft, update],
  );

  const updateCustomTranslator = React.useCallback(
    (id: string, patch: Partial<TranslatorProfile>) => {
      update(
        "customTranslators",
        (draft?.customTranslators ?? []).map((p) =>
          p.id === id ? { ...p, ...patch } : p,
        ),
      );
    },
    [draft, update],
  );
```

- [ ] **Step 7: Wire the new items into `value`**

In the `value: SettingsContextValue` object, add after `testTranslator`:

```typescript
    customTranslators: draft?.customTranslators,
    activeTranslator: draft?.activeTranslator,
    lastTestResult,
    recordTestResult,
    testProfile,
    testAdhoc,
    setActiveTranslator,
    addCustomTranslator,
    removeCustomTranslator,
    updateCustomTranslator,
```

- [ ] **Step 8: Verify**

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker"
pnpm -F desktop typecheck
```

Expected: clean (0 errors). If `TranslatorProvider` is already imported via `constants.ts` re-export, remove the duplicate.

- [ ] **Step 9: Commit**

```bash
git add apps/desktop/src/components/settings/SettingsContext.tsx
git commit -m "feat(settings): expose translator profile surface in SettingsContext (4d-frontend task 1)"
```

---

## Task 2: `PROVIDER_PRESETS` const and `ProviderRow.tsx` component

**Files:**
- Create: `apps/desktop/src/components/settings/ProviderRow.tsx`

### What `ProviderRow` renders

A single row in the provider list. It has two visual states:

**Collapsed (default):**
```
[radio] [name]  [endpoint subtitle]    [model badge]  [test-dot ⬤] [time-ago]  [Test] [Edit] [⋮]
```

**Expanded (isEditing = true):** the row body is replaced by `<ProviderForm>` (Task 3). The row passes through all needed callbacks.

Props:

```typescript
interface ProviderRowProps {
  profileId: string;
  name: string;
  baseUrl: string;
  model: string;
  apiKeyMasked: boolean; // true if apiKey === "***" or non-empty saved key
  isActive: boolean;
  isBuiltIn: boolean; // true for "gemini" | "local_openai"
  isEditing: boolean;
  lastTest?: TranslatorTestResult & { at: number };
  onActivate: () => void;
  onTest: () => Promise<void>;
  onEditToggle: () => void; // toggle isEditing (parent owns the state)
  onDuplicate?: () => void;
  onDelete?: () => void; // absent for built-ins
  // Form save/cancel callbacks (passed through to ProviderForm when isEditing)
  onSave: (patch: { name: string; baseUrl: string; apiKey: string; model: string }) => void;
  onCancelEdit: () => void;
}
```

`PROVIDER_PRESETS`:

```typescript
export const PROVIDER_PRESETS = [
  { label: "DeepSeek",    name: "DeepSeek",    baseUrl: "https://api.deepseek.com/v1" },
  { label: "Groq",        name: "Groq",        baseUrl: "https://api.groq.com/openai/v1" },
  { label: "OpenRouter",  name: "OpenRouter",  baseUrl: "https://openrouter.ai/api/v1" },
  { label: "Together",    name: "Together",    baseUrl: "https://api.together.xyz/v1" },
  { label: "Mistral",     name: "Mistral",     baseUrl: "https://api.mistral.ai/v1" },
  { label: "xAI",         name: "xAI",         baseUrl: "https://api.x.ai/v1" },
  { label: "Fireworks",   name: "Fireworks",   baseUrl: "https://api.fireworks.ai/inference/v1" },
  { label: "OpenAI",      name: "OpenAI",      baseUrl: "https://api.openai.com/v1" },
  { label: "Custom…",     name: "",            baseUrl: "" },
] as const;
```

- [ ] **Step 1: Create `ProviderRow.tsx`**

Create `apps/desktop/src/components/settings/ProviderRow.tsx` with the following content:

```typescript
import * as React from "react";
import { Stack, XStack, YStack } from "tamagui";
import { MoreHorizontal } from "@tamagui/lucide-icons";
import {
  BadgePill,
  StatusDot,
  ButtonSecondary,
  ButtonGhost,
  IconButton,
  Caption,
  TitleSm,
  BodySm,
} from "@yt-subtitle-maker/ui";
import type { TranslatorTestResult } from "@yt-subtitle-maker/api-client";
import { ProviderForm } from "./ProviderForm";

// ─── Provider preset definitions ───────────────────────────────────────────

export interface ProviderPreset {
  label: string;
  name: string;
  baseUrl: string;
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  { label: "DeepSeek",   name: "DeepSeek",   baseUrl: "https://api.deepseek.com/v1" },
  { label: "Groq",       name: "Groq",       baseUrl: "https://api.groq.com/openai/v1" },
  { label: "OpenRouter", name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1" },
  { label: "Together",   name: "Together",   baseUrl: "https://api.together.xyz/v1" },
  { label: "Mistral",    name: "Mistral",    baseUrl: "https://api.mistral.ai/v1" },
  { label: "xAI",        name: "xAI",        baseUrl: "https://api.x.ai/v1" },
  { label: "Fireworks",  name: "Fireworks",  baseUrl: "https://api.fireworks.ai/inference/v1" },
  { label: "OpenAI",     name: "OpenAI",     baseUrl: "https://api.openai.com/v1" },
  { label: "Custom…",    name: "",           baseUrl: "" },
];

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ProviderRowSavePayload {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface ProviderRowProps {
  profileId: string;
  name: string;
  baseUrl: string;
  model: string;
  /** true when the profile's saved apiKey is non-empty (masked to "***" on GET). */
  apiKeyMasked: boolean;
  isActive: boolean;
  isBuiltIn: boolean;
  isEditing: boolean;
  lastTest?: TranslatorTestResult & { at: number };
  onActivate: () => void;
  onTest: () => Promise<void>;
  onEditToggle: () => void;
  onDuplicate?: () => void;
  /** Absent for built-in profiles. */
  onDelete?: () => void;
  onSave: (patch: ProviderRowSavePayload) => void;
  onCancelEdit: () => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTimeAgo(at: number): string {
  const secs = Math.round((Date.now() - at) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

function testDotStatus(lastTest: (TranslatorTestResult & { at: number }) | undefined) {
  if (!lastTest) return "neutral" as const;
  return lastTest.ok ? ("success" as const) : ("error" as const);
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ProviderRow({
  profileId,
  name,
  baseUrl,
  model,
  apiKeyMasked,
  isActive,
  isBuiltIn,
  isEditing,
  lastTest,
  onActivate,
  onTest,
  onEditToggle,
  onDuplicate,
  onDelete,
  onSave,
  onCancelEdit,
}: ProviderRowProps) {
  const [testing, setTesting] = React.useState(false);
  const [kebabOpen, setKebabOpen] = React.useState(false);

  const handleTest = async () => {
    setTesting(true);
    try {
      await onTest();
    } finally {
      setTesting(false);
    }
  };

  const dotStatus = testDotStatus(lastTest);

  if (isEditing) {
    return (
      <Stack
        borderRadius="$lg"
        backgroundColor="$surfaceGlass"
        borderWidth={1}
        borderColor="$borderSubtle"
        padding="$md"
      >
        <ProviderForm
          profileId={profileId}
          initialName={name}
          initialBaseUrl={baseUrl}
          initialModel={model}
          apiKeyMasked={apiKeyMasked}
          onSave={onSave}
          onCancel={onCancelEdit}
        />
      </Stack>
    );
  }

  return (
    <XStack
      alignItems="center"
      gap="$sm"
      paddingHorizontal="$md"
      paddingVertical="$sm"
      borderRadius="$lg"
      backgroundColor={isActive ? "$surfaceGlassHover" : "$surfaceGlass"}
      borderWidth={1}
      borderColor={isActive ? "$accent" : "$borderSubtle"}
    >
      {/* Radio selector */}
      <Stack
        tag="button"
        role="radio"
        aria-checked={isActive}
        width={20}
        height={20}
        borderRadius="$pill"
        borderWidth={2}
        borderColor={isActive ? "$accent" : "$borderSubtle"}
        backgroundColor={isActive ? "$accent" : "transparent"}
        alignItems="center"
        justifyContent="center"
        cursor="pointer"
        pressStyle={{ scale: 0.9 }}
        animation="quick"
        onPress={onActivate}
        flexShrink={0}
      >
        {isActive ? (
          <Stack
            width={8}
            height={8}
            borderRadius="$pill"
            backgroundColor="$background"
          />
        ) : null}
      </Stack>

      {/* Name + endpoint */}
      <YStack flex={1} minWidth={0} gap={2}>
        <TitleSm numberOfLines={1}>{name || "(unnamed)"}</TitleSm>
        {baseUrl ? (
          <Caption color="$textSecondary" numberOfLines={1}>
            {baseUrl}
          </Caption>
        ) : null}
      </YStack>

      {/* Model badge */}
      {model ? (
        <BadgePill tone="neutral">
          <Caption>{model}</Caption>
        </BadgePill>
      ) : null}

      {/* Last-test dot + timestamp */}
      <XStack alignItems="center" gap="$xs">
        <StatusDot status={dotStatus} size={8} />
        {lastTest ? (
          <Caption color="$textMuted">{formatTimeAgo(lastTest.at)}</Caption>
        ) : null}
      </XStack>

      {/* Actions */}
      <XStack gap="$xs" alignItems="center">
        <ButtonSecondary
          size="$sm"
          onPress={handleTest}
          disabled={testing}
        >
          {testing ? "Testing…" : "Test"}
        </ButtonSecondary>
        <ButtonGhost size="$sm" onPress={onEditToggle}>
          Edit
        </ButtonGhost>
        {/* Kebab menu — Duplicate + Delete (built-ins: only Duplicate) */}
        <Stack position="relative">
          <IconButton
            icon={<MoreHorizontal size={16} color="$textSecondary" />}
            size={32}
            aria-label="More actions"
            onPress={() => setKebabOpen((v) => !v)}
          />
          {kebabOpen ? (
            <Stack
              position="absolute"
              top={36}
              right={0}
              zIndex={100}
              backgroundColor="$surfaceGlass"
              borderWidth={1}
              borderColor="$borderSubtle"
              borderRadius="$md"
              padding="$xs"
              minWidth={120}
              onPress={() => setKebabOpen(false)}
            >
              {onDuplicate ? (
                <Stack
                  tag="button"
                  role="button"
                  paddingHorizontal="$sm"
                  paddingVertical="$xs"
                  borderRadius="$sm"
                  hoverStyle={{ backgroundColor: "$surfaceGlassHover" }}
                  cursor="pointer"
                  onPress={() => {
                    setKebabOpen(false);
                    onDuplicate();
                  }}
                >
                  <BodySm>Duplicate</BodySm>
                </Stack>
              ) : null}
              {onDelete ? (
                <Stack
                  tag="button"
                  role="button"
                  paddingHorizontal="$sm"
                  paddingVertical="$xs"
                  borderRadius="$sm"
                  hoverStyle={{ backgroundColor: "$surfaceGlassHover" }}
                  cursor="pointer"
                  onPress={() => {
                    setKebabOpen(false);
                    onDelete();
                  }}
                >
                  <BodySm color="$error">Delete</BodySm>
                </Stack>
              ) : null}
            </Stack>
          ) : null}
        </Stack>
      </XStack>
    </XStack>
  );
}
```

- [ ] **Step 2: Verify (typecheck only — ProviderForm doesn't exist yet, so expect one error)**

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker"
pnpm -F desktop typecheck 2>&1 | grep "ProviderForm"
```

Expected output: one error about `ProviderForm` not found. That's expected — it ships in Task 3. Do not commit yet.

---

## Task 3: `ProviderForm.tsx` — inline edit form

**Files:**
- Create: `apps/desktop/src/components/settings/ProviderForm.tsx`

### What `ProviderForm` renders

The expanded inline form for editing one provider. Fields:

1. **Name** — `TextInput`, always editable.
2. **Base URL / Endpoint** — `TextInput`, must look like `http://…` or `https://…`.
3. **API key** — either `"•••• key on file [Replace]"` (when `apiKeyMasked && !replacingThisKey`) or a `TextInput secureTextEntry` with a Show/Hide eye toggle. On Save, if the user has not replaced the key, send `"***"` to keep the saved key; if the field is non-empty, send the new value.
4. **Model** — `TextInput` free-text with a `↻` button that calls `apiClient.listTranslatorModels({ profileId, useSavedKey: true })` when the profile already has a saved key, or `{ provider: "openai", baseUrl, apiKey, model }` when editing ad-hoc (uses whatever the form currently has). Results populate a `Dropdown` overlay or prefill the text field.
5. **Test result inline** — after the user clicks `Test`, show either `"✓ <src> → <dst> · <ms>ms"` (green) or `"⚠ <error>"` (amber).
6. **Test button** — calls `apiClient.testTranslator({ provider: "openai", baseUrl, apiKey, model, targetLang: draft.defaultTargetLang })`.
7. **Save** + **Cancel** buttons.

```typescript
export interface ProviderFormProps {
  profileId: string;
  initialName: string;
  initialBaseUrl: string;
  initialModel: string;
  /** true when the profile currently has a non-empty saved apiKey (returned as "***" by GET). */
  apiKeyMasked: boolean;
  onSave: (patch: { name: string; baseUrl: string; apiKey: string; model: string }) => void;
  onCancel: () => void;
}
```

- [ ] **Step 1: Create `ProviderForm.tsx`**

Create `apps/desktop/src/components/settings/ProviderForm.tsx`:

```typescript
import * as React from "react";
import { Stack, XStack, YStack } from "tamagui";
import { Eye, EyeOff, RefreshCcw } from "@tamagui/lucide-icons";
import {
  TextInput,
  Dropdown,
  ButtonSecondary,
  ButtonGhost,
  IconButton,
  Caption,
  TitleSm,
  BodySm,
} from "@yt-subtitle-maker/ui";
import { apiClient } from "../../state/client";
import { useSettings } from "./SettingsContext";
import { buildModelOptions } from "./constants";

export interface ProviderFormSavePayload {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface ProviderFormProps {
  profileId: string;
  initialName: string;
  initialBaseUrl: string;
  initialModel: string;
  apiKeyMasked: boolean;
  onSave: (patch: ProviderFormSavePayload) => void;
  onCancel: () => void;
}

export function ProviderForm({
  profileId,
  initialName,
  initialBaseUrl,
  initialModel,
  apiKeyMasked,
  onSave,
  onCancel,
}: ProviderFormProps) {
  const { draft } = useSettings();

  const [name, setName] = React.useState(initialName);
  const [baseUrl, setBaseUrl] = React.useState(initialBaseUrl);
  const [model, setModel] = React.useState(initialModel);
  // API key replacement flow: start with empty string (= "use saved key").
  // replacingThisKey switches the display from the masked pill to a real input.
  const [apiKey, setApiKey] = React.useState("");
  const [replacingThisKey, setReplacingThisKey] = React.useState(!apiKeyMasked);
  const [showKey, setShowKey] = React.useState(false);

  // Model-fetch state
  const [fetchedModels, setFetchedModels] = React.useState<string[]>([]);
  const [modelsBusy, setModelsBusy] = React.useState(false);

  // Test state
  const [testResult, setTestResult] = React.useState<
    { ok: boolean; sample?: { src: string; dst: string }; latencyMs?: number; error?: string } | undefined
  >(undefined);
  const [testing, setTesting] = React.useState(false);

  // URL validation
  const urlValid =
    baseUrl === "" ||
    baseUrl.startsWith("http://") ||
    baseUrl.startsWith("https://");

  const handleFetchModels = async () => {
    setModelsBusy(true);
    try {
      // If the profile has a saved key and the user hasn't replaced it yet,
      // fetch models using the saved credentials server-side.
      const res =
        apiKeyMasked && !replacingThisKey
          ? await apiClient.listTranslatorModels({ profileId, useSavedKey: true })
          : await apiClient.listTranslatorModels({
              provider: "openai",
              baseUrl: baseUrl || undefined,
              apiKey: apiKey || undefined,
            });
      if (res.ok) setFetchedModels(res.models);
    } catch {
      /* surface nothing — the dropdown stays free-text */
    } finally {
      setModelsBusy(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(undefined);
    try {
      const res =
        apiKeyMasked && !replacingThisKey
          ? await apiClient.testTranslator({ profileId, useSavedKey: true, targetLang: draft?.defaultTargetLang })
          : await apiClient.testTranslator({
              provider: "openai",
              baseUrl: baseUrl || undefined,
              apiKey: apiKey || undefined,
              model: model || undefined,
              targetLang: draft?.defaultTargetLang,
            });
      setTestResult(res);
    } catch (err) {
      setTestResult({ ok: false, error: err instanceof Error ? err.message : String(err) });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    // If we haven't replaced the key, send "***" to keep it.
    const finalApiKey = replacingThisKey ? apiKey : "***";
    onSave({ name, baseUrl, apiKey: finalApiKey, model });
  };

  const modelDropdownOptions = buildModelOptions(fetchedModels, model);

  return (
    <YStack gap="$sm">
      {/* Name */}
      <YStack gap={2}>
        <TitleSm>Name</TitleSm>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. DeepSeek"
        />
      </YStack>

      {/* Endpoint */}
      <YStack gap={2}>
        <TitleSm>Endpoint</TitleSm>
        <TextInput
          value={baseUrl}
          onChangeText={setBaseUrl}
          placeholder="https://api.example.com/v1"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {!urlValid ? (
          <Caption color="$error">Must start with http:// or https://</Caption>
        ) : null}
      </YStack>

      {/* API key */}
      <YStack gap={2}>
        <TitleSm>API key</TitleSm>
        {apiKeyMasked && !replacingThisKey ? (
          <XStack gap="$sm" alignItems="center">
            <Stack
              flex={1}
              padding="$sm"
              borderRadius="$md"
              backgroundColor="$surfaceGlass"
              borderWidth={1}
              borderColor="$borderSubtle"
            >
              <BodySm color="$textSecondary">•••• key on file</BodySm>
            </Stack>
            <ButtonGhost
              onPress={() => {
                setReplacingThisKey(true);
                setApiKey("");
              }}
            >
              Replace
            </ButtonGhost>
          </XStack>
        ) : (
          <XStack alignItems="center" position="relative">
            <TextInput
              flex={1}
              value={apiKey}
              onChangeText={setApiKey}
              secureTextEntry={!showKey}
              placeholder="sk-…"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Stack position="absolute" right={8}>
              <IconButton
                icon={
                  showKey ? (
                    <EyeOff size={14} color="$textSecondary" />
                  ) : (
                    <Eye size={14} color="$textSecondary" />
                  )
                }
                aria-label="Toggle key visibility"
                size={32}
                onPress={() => setShowKey((v) => !v)}
              />
            </Stack>
          </XStack>
        )}
      </YStack>

      {/* Model */}
      <YStack gap={2}>
        <TitleSm>Model</TitleSm>
        <XStack gap="$sm" alignItems="center">
          <Stack flex={1}>
            {fetchedModels.length > 0 ? (
              <Dropdown
                value={model}
                onValueChange={setModel}
                options={modelDropdownOptions}
                placeholder="e.g. deepseek-chat"
                width="100%"
              />
            ) : (
              <TextInput
                value={model}
                onChangeText={setModel}
                placeholder="e.g. deepseek-chat"
                autoCapitalize="none"
                autoCorrect={false}
              />
            )}
          </Stack>
          <ButtonSecondary
            onPress={handleFetchModels}
            disabled={modelsBusy}
          >
            <RefreshCcw size={14} color="$textSecondary" />
          </ButtonSecondary>
        </XStack>
        {fetchedModels.length === 0 ? (
          <Caption color="$textSecondary">
            Click ↻ to fetch models from this endpoint.
          </Caption>
        ) : null}
      </YStack>

      {/* Test result inline */}
      {testResult ? (
        <Stack
          padding="$sm"
          borderRadius="$md"
          backgroundColor={testResult.ok ? "$surfaceGlass" : "$surfaceGlass"}
          borderWidth={1}
          borderColor={testResult.ok ? "$success" : "$warning"}
        >
          {testResult.ok && testResult.sample ? (
            <Caption color="$success">
              ✓ {testResult.sample.src} → {testResult.sample.dst}
              {testResult.latencyMs ? ` · ${testResult.latencyMs}ms` : ""}
            </Caption>
          ) : (
            <Caption color="$warning">⚠ {testResult.error ?? "Unknown error"}</Caption>
          )}
        </Stack>
      ) : null}

      {/* Test + Save + Cancel */}
      <XStack gap="$sm" alignItems="center" justifyContent="flex-end">
        <ButtonGhost onPress={handleTest} disabled={testing}>
          {testing ? "Testing…" : "Test"}
        </ButtonGhost>
        <ButtonGhost onPress={onCancel}>Cancel</ButtonGhost>
        <ButtonSecondary onPress={handleSave} disabled={!urlValid}>
          Save
        </ButtonSecondary>
      </XStack>
    </YStack>
  );
}
```

- [ ] **Step 2: Verify typecheck for Task 2 + Task 3 together**

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker"
pnpm -F desktop typecheck
```

Expected: clean (0 errors).

- [ ] **Step 3: Commit Tasks 2 + 3**

```bash
git add apps/desktop/src/components/settings/ProviderRow.tsx \
        apps/desktop/src/components/settings/ProviderForm.tsx
git commit -m "feat(settings): ProviderRow + ProviderForm components (4d-frontend tasks 2-3)"
```

---

## Task 4: `AddProviderModal.tsx` — "+ Add provider" flow

**Files:**
- Create: `apps/desktop/src/components/settings/AddProviderModal.tsx`

### What it does

When the user clicks "+ Add provider", we show a two-step UI:

1. **Preset picker** — a list of buttons for each preset in `PROVIDER_PRESETS`. Clicking one moves to step 2 with `name` + `baseUrl` prefilled.
2. **Form** — a `ProviderForm` with the preset values and an empty `apiKey` + `model`. On Save, the caller receives the completed profile and calls `addCustomTranslator`.

This is rendered **inline** (not a dialog/portal) as a `GlassCard` that appears below the provider list when `isOpen`. The parent (`TranslationTab`) owns `isOpen`.

```typescript
export interface AddProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (profile: TranslatorProfile) => void;
}
```

- [ ] **Step 1: Create `AddProviderModal.tsx`**

Create `apps/desktop/src/components/settings/AddProviderModal.tsx`:

```typescript
import * as React from "react";
import { Stack, XStack, YStack } from "tamagui";
import { X } from "@tamagui/lucide-icons";
import {
  GlassCard,
  ButtonGhost,
  IconButton,
  TitleSm,
  BodySm,
  Caption,
} from "@yt-subtitle-maker/ui";
import type { TranslatorProfile } from "@yt-subtitle-maker/api-client";
import { PROVIDER_PRESETS } from "./ProviderRow";
import { ProviderForm } from "./ProviderForm";

export interface AddProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (profile: TranslatorProfile) => void;
}

function generateProfileId(): string {
  return "custom-" + Date.now().toString(36);
}

export function AddProviderModal({ isOpen, onClose, onAdd }: AddProviderModalProps) {
  const [step, setStep] = React.useState<"pick" | "form">("pick");
  const [preset, setPreset] = React.useState<{ name: string; baseUrl: string } | null>(null);
  // A stable id for the new profile (generated once per open)
  const [newId, setNewId] = React.useState(() => generateProfileId());

  // Reset on open
  React.useEffect(() => {
    if (isOpen) {
      setStep("pick");
      setPreset(null);
      setNewId(generateProfileId());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePickPreset = (p: { name: string; baseUrl: string }) => {
    setPreset(p);
    setStep("form");
  };

  const handleSave = (patch: { name: string; baseUrl: string; apiKey: string; model: string }) => {
    const profile: TranslatorProfile = {
      id: newId,
      name: patch.name || preset?.name || "Custom",
      baseUrl: patch.baseUrl,
      apiKey: patch.apiKey,
      model: patch.model,
    };
    onAdd(profile);
    onClose();
  };

  return (
    <GlassCard variant="mid">
      <YStack gap="$md">
        {/* Header */}
        <XStack alignItems="center" justifyContent="space-between">
          <TitleSm>
            {step === "pick" ? "Choose a provider" : `Configure ${preset?.name || "provider"}`}
          </TitleSm>
          <IconButton
            icon={<X size={16} color="$textSecondary" />}
            size={32}
            aria-label="Close"
            onPress={onClose}
          />
        </XStack>

        {step === "pick" ? (
          <YStack gap="$xs">
            {PROVIDER_PRESETS.map((p) => (
              <Stack
                key={p.label}
                tag="button"
                role="button"
                paddingHorizontal="$md"
                paddingVertical="$sm"
                borderRadius="$md"
                backgroundColor="$surfaceGlass"
                borderWidth={1}
                borderColor="$borderSubtle"
                hoverStyle={{ backgroundColor: "$surfaceGlassHover" }}
                pressStyle={{ scale: 0.98 }}
                animation="quick"
                cursor="pointer"
                onPress={() => handlePickPreset({ name: p.name, baseUrl: p.baseUrl })}
              >
                <XStack alignItems="center" gap="$sm">
                  <YStack flex={1} gap={2}>
                    <BodySm>{p.label}</BodySm>
                    {p.baseUrl ? (
                      <Caption color="$textSecondary">{p.baseUrl}</Caption>
                    ) : (
                      <Caption color="$textMuted">Enter your own endpoint</Caption>
                    )}
                  </YStack>
                </XStack>
              </Stack>
            ))}
          </YStack>
        ) : (
          <ProviderForm
            profileId={newId}
            initialName={preset?.name ?? ""}
            initialBaseUrl={preset?.baseUrl ?? ""}
            initialModel=""
            apiKeyMasked={false}
            onSave={handleSave}
            onCancel={() => setStep("pick")}
          />
        )}
      </YStack>
    </GlassCard>
  );
}
```

- [ ] **Step 2: Verify**

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker"
pnpm -F desktop typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/components/settings/AddProviderModal.tsx
git commit -m "feat(settings): AddProviderModal with preset picker (4d-frontend task 4)"
```

---

## Task 5: Rewrite `TranslationTab.tsx`

**Files:**
- Modify: `apps/desktop/src/components/settings/TranslationTab.tsx`

### What the new tab renders

1. **Safety banner** (top, conditional) — when the active profile's last test failed.
2. **Provider list section** — a `Section` header "Translation provider", then:
   - Built-in row: Gemini (`profileId = "gemini"`), always present, not deletable.
   - Built-in row: Local AI / LM Studio (`profileId = "local_openai"`), always present, not deletable.
   - One `ProviderRow` per `customTranslators` entry.
   - `"+ Add provider"` button.
3. **`AddProviderModal`** — shown below the list when the user clicks "+ Add provider".
4. **Delete-active guard** — when user tries to delete the active translator, show a `BadgePill tone="warning"` nudge instead of deleting.
5. **The three unchanged setting rows** — target language, enable-by-default toggle, auto-translate-title toggle.

Built-in rows' `onSave` writes into the draft directly (`update("geminiApiKey", ...)` etc.) rather than the `customTranslators` array.

- [ ] **Step 1: Read the current file once more to identify exact existing imports to replace**

(Already read above — the current file uses `SegmentedControl`, `translatorProvider`, `replacingKey`, `setReplacingKey`, `testTranslator`, `geminiModels`, `localOpenaiModels`, `openaiModels`, `modelsBusy`, `refreshLocalOpenaiModels`, `refreshOpenaiModels`.)

- [ ] **Step 2: Write the new `TranslationTab.tsx`**

Replace the entire file with:

```typescript
import * as React from "react";
import { Stack, XStack, YStack } from "tamagui";
import { Plus } from "@tamagui/lucide-icons";
import {
  GlassCard,
  Dropdown,
  Toggle,
  ButtonGhost,
  BadgePill,
  Caption,
} from "@yt-subtitle-maker/ui";
import type { TranslatorProfile } from "@yt-subtitle-maker/api-client";
import { useSettings } from "./SettingsContext";
import { Section, SettingRow } from "./shared";
import { LANGS, isMasked } from "./constants";
import { ProviderRow } from "./ProviderRow";
import { AddProviderModal } from "./AddProviderModal";

// ─── Helper to get the short profile id for a given activeTranslator string ─

function activeProfileId(activeTranslator: string | undefined): string {
  if (!activeTranslator) return "gemini";
  if (activeTranslator.startsWith("custom:")) return activeTranslator.slice(7);
  return activeTranslator; // "gemini" | "local_openai"
}

function activeTranslatorKey(profileId: string, isBuiltIn: boolean): string {
  if (isBuiltIn) return profileId; // "gemini" | "local_openai"
  return `custom:${profileId}`;
}

// ─── Built-in profile shapes (derived from draft) ───────────────────────────

function geminiProfile(draft: NonNullable<ReturnType<typeof useSettings>["draft"]>) {
  return {
    profileId: "gemini",
    name: "Gemini",
    baseUrl: "https://generativelanguage.googleapis.com",
    model: draft.geminiModel ?? "",
    apiKeyMasked: isMasked(draft.geminiApiKey),
  };
}

function localOpenaiProfile(draft: NonNullable<ReturnType<typeof useSettings>["draft"]>) {
  return {
    profileId: "local_openai",
    name: "Local AI (LM Studio / Ollama)",
    baseUrl: draft.localOpenaiBaseUrl ?? "",
    model: draft.localOpenaiModel ?? "",
    apiKeyMasked: isMasked(draft.localOpenaiApiKey),
  };
}

// ─── Component ──────────────────────────────────────────────────────────────

export function TranslationTab() {
  const {
    draft,
    update,
    customTranslators,
    activeTranslator,
    lastTestResult,
    testProfile,
    testAdhoc,
    setActiveTranslator,
    addCustomTranslator,
    removeCustomTranslator,
    updateCustomTranslator,
    replacingKey,
    setReplacingKey,
  } = useSettings();

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  // Per-profile delete-guard: id of the profile the user tried to delete
  const [deleteGuardId, setDeleteGuardId] = React.useState<string | null>(null);

  if (!draft) return null;

  const currentProfileId = activeProfileId(activeTranslator);

  // Safety banner: active profile's last test failed
  const activeLastTest = lastTestResult[currentProfileId];
  const showBanner = activeLastTest && !activeLastTest.ok;

  // ── Built-in row handlers ──────────────────────────────────────────────

  const handleSaveGemini = (patch: { name: string; baseUrl: string; apiKey: string; model: string }) => {
    // Only apiKey + model are editable for Gemini built-in
    if (patch.apiKey !== "***") {
      if (patch.apiKey === "") {
        // clearing key
        update("geminiApiKey", "");
        setReplacingKey((r) => ({ ...r, gemini: false }));
      } else {
        update("geminiApiKey", patch.apiKey);
      }
    }
    update("geminiModel", patch.model);
    setEditingId(null);
  };

  const handleSaveLocalOpenai = (patch: { name: string; baseUrl: string; apiKey: string; model: string }) => {
    update("localOpenaiBaseUrl", patch.baseUrl);
    update("localOpenaiModel", patch.model);
    if (patch.apiKey !== "***") {
      update("localOpenaiApiKey", patch.apiKey);
    }
    setEditingId(null);
  };

  // ── Custom profile handlers ────────────────────────────────────────────

  const handleSaveCustom = (profileId: string) => (patch: { name: string; baseUrl: string; apiKey: string; model: string }) => {
    updateCustomTranslator(profileId, patch);
    setEditingId(null);
  };

  const handleDuplicate = (profile: TranslatorProfile) => {
    const newId = "custom-" + Date.now().toString(36);
    addCustomTranslator({
      ...profile,
      id: newId,
      name: profile.name + " (copy)",
    });
  };

  const handleDeleteCustom = (profileId: string) => {
    if (currentProfileId === profileId) {
      // Refuse + nudge
      setDeleteGuardId(profileId);
      return;
    }
    setDeleteGuardId(null);
    removeCustomTranslator(profileId);
  };

  const profiles = customTranslators ?? [];

  return (
    <GlassCard variant="mid">
      <YStack gap="$md">
        <Section title="Translation" />

        {/* Safety banner */}
        {showBanner ? (
          <BadgePill tone="warning">
            <Caption>
              Translation may fail — {draft.activeTranslator ?? "active provider"}&apos;s last test failed
              {activeLastTest.error ? `: ${activeLastTest.error}` : ""}
            </Caption>
          </BadgePill>
        ) : null}

        {/* Provider list */}
        <Section
          title="Translation provider"
          subtitle="Choose which service translates your subtitles. Built-in providers can't be deleted."
        />

        <YStack gap="$sm">
          {/* Gemini (built-in) */}
          <ProviderRow
            {...geminiProfile(draft)}
            isActive={currentProfileId === "gemini"}
            isBuiltIn
            isEditing={editingId === "gemini"}
            lastTest={lastTestResult["gemini"]}
            onActivate={() => setActiveTranslator("gemini")}
            onTest={async () => {
              await testAdhoc({
                provider: "gemini",
                apiKey: draft.geminiApiKey,
                model: draft.geminiModel,
                targetLang: draft.defaultTargetLang,
              });
            }}
            onEditToggle={() => setEditingId((v) => (v === "gemini" ? null : "gemini"))}
            onSave={handleSaveGemini}
            onCancelEdit={() => setEditingId(null)}
          />

          {/* Local AI (built-in) */}
          <ProviderRow
            {...localOpenaiProfile(draft)}
            isActive={currentProfileId === "local_openai"}
            isBuiltIn
            isEditing={editingId === "local_openai"}
            lastTest={lastTestResult["local_openai"]}
            onActivate={() => setActiveTranslator("local_openai")}
            onTest={async () => {
              await testAdhoc({
                provider: "local_openai",
                baseUrl: draft.localOpenaiBaseUrl,
                apiKey: draft.localOpenaiApiKey,
                model: draft.localOpenaiModel,
                targetLang: draft.defaultTargetLang,
              });
            }}
            onEditToggle={() =>
              setEditingId((v) => (v === "local_openai" ? null : "local_openai"))
            }
            onSave={handleSaveLocalOpenai}
            onCancelEdit={() => setEditingId(null)}
          />

          {/* Custom profiles */}
          {profiles.map((profile) => (
            <YStack key={profile.id} gap="$xs">
              {deleteGuardId === profile.id ? (
                <BadgePill tone="warning">
                  <Caption>
                    Make another provider active first, then delete this one.
                  </Caption>
                </BadgePill>
              ) : null}
              <ProviderRow
                profileId={profile.id}
                name={profile.name}
                baseUrl={profile.baseUrl}
                model={profile.model}
                apiKeyMasked={isMasked(profile.apiKey)}
                isActive={currentProfileId === profile.id}
                isBuiltIn={false}
                isEditing={editingId === profile.id}
                lastTest={lastTestResult[profile.id]}
                onActivate={() => setActiveTranslator(`custom:${profile.id}`)}
                onTest={async () => {
                  await testProfile(profile.id);
                }}
                onEditToggle={() =>
                  setEditingId((v) => (v === profile.id ? null : profile.id))
                }
                onDuplicate={() => handleDuplicate(profile)}
                onDelete={() => handleDeleteCustom(profile.id)}
                onSave={handleSaveCustom(profile.id)}
                onCancelEdit={() => {
                  setEditingId(null);
                  setDeleteGuardId(null);
                }}
              />
            </YStack>
          ))}

          {/* + Add provider */}
          {!addOpen ? (
            <Stack
              tag="button"
              role="button"
              paddingHorizontal="$md"
              paddingVertical="$sm"
              borderRadius="$lg"
              backgroundColor="transparent"
              borderWidth={1}
              borderColor="$borderSubtle"
              borderStyle="dashed"
              alignItems="center"
              justifyContent="center"
              hoverStyle={{ backgroundColor: "$surfaceGlass" }}
              cursor="pointer"
              onPress={() => setAddOpen(true)}
            >
              <XStack gap="$xs" alignItems="center">
                <Plus size={14} color="$textSecondary" />
                <Caption color="$textSecondary">Add provider</Caption>
              </XStack>
            </Stack>
          ) : null}
        </YStack>

        {/* Add provider modal (inline) */}
        <AddProviderModal
          isOpen={addOpen}
          onClose={() => setAddOpen(false)}
          onAdd={(profile) => {
            addCustomTranslator(profile);
            setActiveTranslator(`custom:${profile.id}`);
          }}
        />

        {/* Unchanged setting rows */}
        <SettingRow id="translation.target-lang" label="Default target language">
          <Dropdown
            value={draft.defaultTargetLang}
            onValueChange={(v) => update("defaultTargetLang", v)}
            options={LANGS}
            width="100%"
          />
        </SettingRow>

        <SettingRow
          layout="row"
          id="translation.enable-by-default"
          label="Enable translation by default"
          helper="Pre-checks the Translation toggle on the Generate screen for new jobs."
        >
          <Toggle
            value={draft.enableTranslation}
            onValueChange={(v) => update("enableTranslation", v)}
            aria-label="Enable translation default"
          />
        </SettingRow>

        <SettingRow
          layout="row"
          id="translation.auto-translate-title"
          label="Auto-translate the video title"
          helper="Also translates the YouTube title into the target language and stores it in the sidecar (titleTranslated)."
        >
          <Toggle
            value={draft.autoTranslateTitle}
            onValueChange={(v) => update("autoTranslateTitle", v)}
            aria-label="Auto-translate title"
          />
        </SettingRow>
      </YStack>
    </GlassCard>
  );
}
```

- [ ] **Step 3: Verify**

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker"
pnpm -F desktop typecheck
```

Expected: 0 errors. If `testAdhoc` is not typed to accept a `"local_openai"` provider (since `TranslatorProvider = "gemini" | "local_openai" | "openai"` from types.ts), confirm it passes. The `testAdhoc` signature accepts `provider: TranslatorProvider` so `"local_openai"` is valid.

- [ ] **Step 4: Manual smoke test**

Start the backend and open the web UI:

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker/backend"
../backend/.venv/bin/python -m uvicorn api.main:app --host 127.0.0.1 --port 8000 --reload &
cd ..
pnpm web
```

Open `http://localhost:8081`, navigate to Settings → Translation. Verify:
- Gemini row appears, `Local AI` row appears.
- Both show as non-deletable (no delete in kebab for built-ins).
- Clicking the Gemini row's radio button makes it active (border turns accent color).
- Clicking `Edit` on Gemini expands the form; clicking `Cancel` collapses it.
- Clicking `+ Add provider` shows the preset picker; clicking `DeepSeek` prefills the form.
- `Cancel` in the form returns to the preset picker; `Cancel` on the picker closes the modal.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/components/settings/TranslationTab.tsx
git commit -m "feat(settings): rewrite TranslationTab with named provider profile list (4d-frontend task 5)"
```

---

## Task 6: Generate-screen banner

**Files:**
- Modify: `apps/desktop/app/index.tsx`

### What changes

Near the translation toggle on the Generate screen, when `lastTestResult[currentProfileId]?.ok === false`, show a `<BadgePill tone="warning">` with the failure message. This is a small addition (~15 lines).

First, confirm `useSettings` is accessible from `apps/desktop/app/index.tsx`. The Generate screen currently doesn't import `useSettings` — we need to import it and the `SettingsProvider` must wrap the route. Check if `_layout.tsx` wraps all routes in `SettingsProvider`.

- [ ] **Step 1: Check the layout file**

```bash
grep -n "SettingsProvider\|SettingsContext" "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker/apps/desktop/app/_layout.tsx"
```

Expected: `SettingsProvider` wraps the route content. If it does not, we need to either wrap it or read config from a separate zustand store. Confirm before proceeding. If `SettingsProvider` is present in `_layout.tsx`, continue to Step 2. If not, add a note: the plan must expose `lastTestResult` via a separate zustand slice rather than `SettingsContext` — but given the architecture, `SettingsProvider` is very likely in the layout.

- [ ] **Step 2: Find the translation toggle on the Generate screen**

```bash
grep -n "enableTranslation\|translate\|Translation\|toggle\|Toggle" "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker/apps/desktop/app/index.tsx" | head -30
```

Identify the JSX block containing the translation toggle to know exactly where to insert the banner.

- [ ] **Step 3: Add the import**

At the top of `apps/desktop/app/index.tsx`, add:

```typescript
import { useSettings } from "../src/components/settings/SettingsContext";
```

(Adjust relative path if needed — from `apps/desktop/app/` to `apps/desktop/src/` is `../src/`.)

- [ ] **Step 4: Read `lastTestResult` and `activeTranslator` from context**

In the `GenerateScreen` function (or the top-level component), add:

```typescript
  const { lastTestResult, activeTranslator } = useSettings();

  // Derive active profile id (same helper as TranslationTab)
  const activeProfileId =
    activeTranslator?.startsWith("custom:")
      ? activeTranslator.slice(7)
      : (activeTranslator ?? "gemini");
  const activeLastTest = lastTestResult[activeProfileId];
  const translationMayFail = activeLastTest && !activeLastTest.ok;
```

- [ ] **Step 5: Insert the banner JSX**

Directly below (or above) the translation-enable toggle, add:

```tsx
{translationMayFail ? (
  <BadgePill tone="warning">
    <Caption>
      Translation may fail — last test failed
      {activeLastTest.error ? `: ${activeLastTest.error}` : ""}
    </Caption>
  </BadgePill>
) : null}
```

`BadgePill` and `Caption` are already imported in `index.tsx` (grep confirms they're in the import block). If not, add them to the `@yt-subtitle-maker/ui` import line.

- [ ] **Step 6: Verify**

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker"
pnpm -F desktop typecheck
```

Expected: 0 errors.

- [ ] **Step 7: Manual smoke test**

With the backend running, open the Generate screen. When a translator's last test has failed (visible in Settings → Translation), the banner appears near the translation toggle on the Generate screen. (To force this: go to Settings → Translation, click `Test` on a custom provider with a bad API key, verify the banner appears on both the Settings tab and the Generate screen.)

- [ ] **Step 8: Commit**

```bash
git add apps/desktop/app/index.tsx
git commit -m "feat(generate): show translation-may-fail banner when active provider's last test failed (4d-frontend task 6)"
```

---

## Task 7: Update `searchIndex.ts` and `constants.ts`

**Files:**
- Modify: `apps/desktop/src/components/settings/searchIndex.ts`
- Modify: `apps/desktop/src/components/settings/constants.ts`

### Changes

**`searchIndex.ts`:**
- Remove: `translation.provider` entry (the segmented control is gone).
- Add: `translation.active-provider` — keywords covering all provider names + "translator", "provider", "gemini", "deepseek", "groq", "openrouter", "openai", "local ai", "lm studio", "custom".
- Add: `translation.add-provider` — keywords "add provider", "new provider", "custom translator", "deepseek", "groq", "openrouter".
- Keep: `translation.target-lang`, `translation.enable-by-default`, `translation.auto-translate-title`.
- Remove (if present): any `translation.gemini-*`, `translation.local-*`, `translation.openai-*` entries (they were part of the old per-provider form — now replaced by the inline `ProviderForm` which is not separately searchable).

**`constants.ts`:**
- In `SETTING_FIELD`, remove `"translation.provider": "translatorProvider"` (this field no longer maps to a single `AppConfig` key — `activeTranslator` is set via `setActiveTranslator` which calls `update("activeTranslator", ...)`, but the row id is `translation.active-provider` which covers multiple keys; it should not have a `↺` affordance via the single-key map. Instead, omit it from `SETTING_FIELD`.).
- Keep `"translation.target-lang"`, `"translation.enable-by-default"`, `"translation.auto-translate-title"`.

- [ ] **Step 1: Edit `searchIndex.ts`**

Open `apps/desktop/src/components/settings/searchIndex.ts`. Replace the `// Translation (base only)` block (lines 29–32):

Old:
```typescript
  // Translation (base only)
  { id: "translation.provider", tab: "translation", label: "Provider", keywords: ["translate", "provider", "gemini", "openai", "local ai", "lm studio"] },
  { id: "translation.target-lang", tab: "translation", label: "Default target language", keywords: ["target", "language", "translate to"] },
  { id: "translation.enable-by-default", tab: "translation", label: "Enable translation by default", keywords: ["translate", "enable", "default"] },
  { id: "translation.auto-translate-title", tab: "translation", label: "Auto-translate the video title", keywords: ["title", "translate"] },
```

New:
```typescript
  // Translation
  {
    id: "translation.active-provider",
    tab: "translation",
    label: "Active translation provider",
    keywords: [
      "translate", "provider", "translator", "gemini", "deepseek", "groq",
      "openrouter", "together", "mistral", "xai", "fireworks", "openai",
      "local ai", "lm studio", "ollama", "custom", "api key", "endpoint",
    ],
  },
  {
    id: "translation.add-provider",
    tab: "translation",
    label: "Add translation provider",
    keywords: [
      "add provider", "new provider", "custom translator", "deepseek", "groq",
      "openrouter", "together", "mistral", "xai", "fireworks", "openai",
    ],
  },
  { id: "translation.target-lang", tab: "translation", label: "Default target language", keywords: ["target", "language", "translate to"] },
  { id: "translation.enable-by-default", tab: "translation", label: "Enable translation by default", keywords: ["translate", "enable", "default"] },
  { id: "translation.auto-translate-title", tab: "translation", label: "Auto-translate the video title", keywords: ["title", "translate"] },
```

- [ ] **Step 2: Edit `constants.ts`**

In `SETTING_FIELD`, remove the line:
```typescript
  "translation.provider": "translatorProvider",
```

The three remaining translation rows stay:
```typescript
  "translation.target-lang": "defaultTargetLang",
  "translation.enable-by-default": "enableTranslation",
  "translation.auto-translate-title": "autoTranslateTitle",
```

- [ ] **Step 3: Verify**

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker"
pnpm -F desktop typecheck
```

Expected: 0 errors.

- [ ] **Step 4: Manual smoke test — search**

Open `http://localhost:8081`, go to Settings. Type "deepseek" in the search box. Verify it highlights the Translation tab and jumps to the `translation.active-provider` row. Type "groq" — same. Type "target" — jumps to `translation.target-lang`. Type "gemini" — jumps to `translation.active-provider`.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/components/settings/searchIndex.ts \
        apps/desktop/src/components/settings/constants.ts
git commit -m "feat(settings): update search index + SETTING_FIELD for named provider profiles (4d-frontend task 7)"
```

---

## Task 8: Cleanup — retire dead code from `SettingsContext`

**Files:**
- Modify: `apps/desktop/src/components/settings/SettingsContext.tsx`

### What to remove

After Task 5 (the `TranslationTab` rewrite), the following are no longer used by any consumer:
- `refreshOpenaiModels` — fetched models for the old `openai` tab slot; no longer used.
- `openaiModels` state.
- `modelsBusy === "openai"` branch.
- The `"openai"` slot in `replacingKey` (`replacingKey.openai`) — the old OpenAI tab form is gone.

What to **keep**:
- `refreshLocalOpenaiModels` — still used by `ProviderForm` when editing the Local AI built-in. (Actually `ProviderForm` calls `apiClient.listTranslatorModels` directly, so check if `refreshLocalOpenaiModels` is called anywhere still. If not, remove it too.)
- `geminiModels` — still used by `ProviderForm` editing the Gemini built-in? No — `ProviderForm` fetches models itself. Check if `geminiModels` is used anywhere else.
- `replacingKey.gemini` and `replacingKey.localOpenai` — `TranslationTab` still passes `replacingKey` + `setReplacingKey` to the built-in `handleSaveGemini`/`handleSaveLocalOpenai` handlers. Wait: in Task 5's new `TranslationTab`, `replacingKey` is used only in `handleSaveGemini` to `setReplacingKey((r) => ({ ...r, gemini: false }))`. This is a vestigial call — the `ProviderForm` owns the replacing state locally now. Remove the call in `handleSaveGemini` and `handleSaveLocalOpenai`. Then `replacingKey`/`setReplacingKey` are fully unused in the new `TranslationTab`. Grep all other tabs for usages.

- [ ] **Step 1: Grep for usages of the potentially-dead items**

```bash
grep -rn "openaiModels\|refreshOpenaiModels\|replacingKey\|setReplacingKey\|geminiModels\|refreshLocalOpenaiModels\|localOpenaiModels\|modelsBusy" \
  "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker/apps/desktop/src/components/settings/" \
  "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker/apps/desktop/app/"
```

Read the output carefully. Items that appear only in `SettingsContext.tsx` itself (as state declarations or the `value` object) are safe to remove. Items that appear in other tab files must be kept.

- [ ] **Step 2: Remove confirmed-dead items**

Based on the grep output, remove:
- Any item that appears only in `SettingsContext.tsx` and is no longer in the `SettingsContextValue` interface (because the old `TranslationTab` was the sole consumer).

At minimum, if `refreshOpenaiModels` and `openaiModels` are only used by the old TranslationTab (now replaced), remove them from both the interface and the provider body.

If `replacingKey.openai` slot is unused after the rewrite, narrow the type:
```typescript
// Before
replacingKey: Record<"gemini" | "openai" | "localOpenai", boolean>
// After (if openai slot confirmed unused)
replacingKey: Record<"gemini" | "localOpenai", boolean>
```
And update the initial state and `setReplacingKey` type accordingly.

Similarly if `geminiModels`/`localOpenaiModels` are unused (since `ProviderForm` fetches models itself), remove them.

- [ ] **Step 3: Remove `replacingKey`/`setReplacingKey` calls from the new `TranslationTab`**

In `apps/desktop/src/components/settings/TranslationTab.tsx`, in `handleSaveGemini`, remove the `setReplacingKey` call — `ProviderForm` manages the "replacing key" state locally now:

```typescript
  const handleSaveGemini = (patch: { name: string; baseUrl: string; apiKey: string; model: string }) => {
    if (patch.apiKey !== "***") {
      update("geminiApiKey", patch.apiKey);
    }
    update("geminiModel", patch.model);
    setEditingId(null);
  };
```

Remove the `replacingKey` and `setReplacingKey` destructuring from `useSettings()` in `TranslationTab` if they're no longer needed.

- [ ] **Step 4: Verify**

```bash
cd "/Users/kelvinfong/Documents/Personal Project/yt-subtitle-maker"
pnpm -F desktop typecheck
```

Expected: 0 errors.

- [ ] **Step 5: Full manual smoke test**

With backend running on `:8000` and `pnpm web` on `:8081`:

1. Navigate to Settings → Translation.
2. Verify both built-in rows (Gemini, Local AI) render.
3. Click `Edit` on Gemini → form appears with name/endpoint/model fields + masked-key pill.
4. Click `Replace` on the key → text input appears. Type a fake key. Click `Test` → see a structured error (or success if key is real). Click `Cancel` → form closes, key not saved.
5. Enter a real/fake key and click `Save` → form closes, row shows the model.
6. Click `+ Add provider` → preset list appears.
7. Click `DeepSeek` → form with `https://api.deepseek.com/v1` prefilled.
8. Fill in a fake API key and model `deepseek-chat`. Click `Test` → see error "401" or similar. Click `Save` → DeepSeek row appears in the list.
9. Click DeepSeek's radio → it becomes active (accent border). Navigate to Generate screen → translation-may-fail banner appears (since last test failed).
10. Click DeepSeek's `⋮` → kebab opens. Click `Delete` → nudge appears ("Make another provider active first"). Click Gemini's radio → Gemini becomes active. Click DeepSeek's `⋮` → Delete → row disappears.
11. Search "groq" in the Settings search → Translation tab highlighted, `translation.active-provider` entry shown.
12. `pnpm -F desktop typecheck` → 0 errors.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/components/settings/SettingsContext.tsx \
        apps/desktop/src/components/settings/TranslationTab.tsx
git commit -m "chore(settings): remove dead openai-slot + legacy model state after 4d-frontend rewrite (task 8)"
```

---

## Self-Review

### Spec coverage

| Spec requirement | Task |
|---|---|
| Named provider profiles — radio = active, name, endpoint, model, last-test dot + timestamp, Test/Edit/Duplicate/Delete | Task 2 (`ProviderRow`), Task 5 (`TranslationTab`) |
| Built-ins can't be deleted | Task 2 (`ProviderRow` — `onDelete` absent for built-ins), Task 5 |
| "+ Add provider" → preset menu → form → Test → Save | Tasks 3 (`ProviderForm`), 4 (`AddProviderModal`), 5 (wired in `TranslationTab`) |
| `customTranslators` + `activeTranslator` round-trip | Task 1 (`SettingsContext`), Task 5 |
| `POST /api/translator/test` — profileId + useSavedKey form | Task 1 (`testProfile`), Task 3 (`ProviderForm.handleTest` for saved profile) |
| `POST /api/translator/test` — ad-hoc form | Task 1 (`testAdhoc`), Task 3 (`ProviderForm.handleTest`) |
| `POST /api/translator/list-models` — `↻` button | Task 3 (`ProviderForm.handleFetchModels`) |
| Safety banner on Translation tab when last test failed | Task 5 |
| Safety banner on Generate screen | Task 6 |
| Delete active translator → refuse + nudge | Task 5 (`handleDeleteCustom`) |
| PROVIDER_PRESETS (8 vendors + Custom) | Task 2 (`PROVIDER_PRESETS` const) |
| `lastTestResult` per-profile | Task 1 (`lastTestResult` state + `recordTestResult`) |
| `"***"` send-back keeps saved key | Task 3 (`ProviderForm.handleSave`) |
| Search index updated | Task 7 |
| `SETTING_FIELD` updated | Task 7 |
| Dead code removed | Task 8 |

All spec requirements are covered.

### Placeholder scan

No TBD / TODO / "implement later" / "add appropriate error handling" / "similar to Task N" patterns found in the tasks above. Every task has complete code, commands, and expected outputs.

### Type consistency

| Name in Task 1 | Used in later tasks | Match? |
|---|---|---|
| `recordTestResult(profileId, result)` | Task 3 (ProviderForm calls `apiClient.testTranslator` directly; context's `testProfile` + `testAdhoc` call `recordTestResult` internally) | ✓ |
| `testProfile(profileId): Promise<TranslatorTestResult>` | Task 5 (custom row's `onTest`) | ✓ |
| `testAdhoc(spec)` | Task 5 (built-in rows' `onTest`) | ✓ |
| `addCustomTranslator(profile: TranslatorProfile)` | Tasks 4 (`AddProviderModal.handleSave`), 5 (`TranslationTab`) | ✓ |
| `updateCustomTranslator(id, patch)` | Task 5 (`handleSaveCustom`) | ✓ |
| `removeCustomTranslator(id)` | Task 5 (`handleDeleteCustom`) | ✓ |
| `setActiveTranslator(id)` | Task 5 (radio click handlers; format `"custom:${profile.id}"` for custom) | ✓ |
| `ProviderRowSavePayload` (defined in `ProviderRow.tsx`) | Task 3 (`ProviderForm.onSave` return type), Task 5 (`handleSaveGemini`, `handleSaveCustom`) | ✓ — but `ProviderForm` defines its own `ProviderFormSavePayload`. Align: both have `{name, baseUrl, apiKey, model}` — identical shape. `ProviderRow.onSave` type is `ProviderRowSavePayload`; `ProviderForm.onSave` prop is `(patch: ProviderFormSavePayload) => void`. Since the shapes are identical, TypeScript will accept them structurally. To be explicit, re-export `ProviderRowSavePayload` from `ProviderRow.tsx` and use it in `ProviderForm.tsx` too. Fix: in `ProviderForm.tsx`, import `ProviderRowSavePayload` from `./ProviderRow` and alias `ProviderFormSavePayload = ProviderRowSavePayload`. |
| `PROVIDER_PRESETS` exported from `ProviderRow.tsx` | Task 4 (`AddProviderModal` imports `PROVIDER_PRESETS` from `./ProviderRow`) | ✓ |
| `lastTestResult: Record<string, TranslatorTestResult & { at: number }>` | Tasks 5, 6 | ✓ |

**Fix required:** In `ProviderForm.tsx`, replace the local `ProviderFormSavePayload` with an import from `ProviderRow.tsx`:

```typescript
// In ProviderForm.tsx — replace the local definition:
import type { ProviderRowSavePayload } from "./ProviderRow";
// Use ProviderRowSavePayload everywhere ProviderFormSavePayload was used.
```

This eliminates the parallel type and ensures structural compatibility is explicit.

**Fix required (Task 5):** `TranslationTab` destructures `replacingKey` and `setReplacingKey` from `useSettings()` for the built-in save handlers. After Task 8 removes `replacingKey.openai`, the type narrows — ensure the type annotation in `SettingsContext`'s `value` matches. The `handleSaveGemini` function in the final Task 8 cleanup no longer needs `replacingKey`/`setReplacingKey` at all — verify they're removed from the destructure.

All other type references are consistent.
