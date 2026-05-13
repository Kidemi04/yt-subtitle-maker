# Bilingual Language List — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 4 hardcoded 10-entry language lists with one shared 100-language bilingual list + custom BCP-47 input.

**Architecture:** New `languages.ts` exports `ALL_LANGUAGES` built from Whisper's tokenizer dict. New `LanguagePicker.tsx` wraps Dropdown + custom TextInput toggle. All 4 usage sites swap inline lists for `<LanguagePicker>`.

**Tech Stack:** TypeScript, Tamagui Select/TextInput, React useState

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `apps/desktop/src/components/settings/languages.ts` | **Create** | `ALL_LANGUAGES` constant (100 entries, bilingual) |
| `apps/desktop/src/components/settings/LanguagePicker.tsx` | **Create** | `LanguagePicker` wrapper: Dropdown + custom TextInput toggle |
| `apps/desktop/src/components/settings/constants.ts` | Modify | Remove `LANGS`, re-export `ALL_LANGUAGES` |
| `apps/desktop/app/index.tsx` | Modify | Replace `LANGUAGE_OPTIONS` + Dropdown with `<LanguagePicker>` |
| `apps/desktop/src/components/NewTranscribeModal.tsx` | Modify | Replace `LANGUAGES` + Dropdown with `<LanguagePicker>` |
| `apps/desktop/src/components/NewTranslationModal.tsx` | Modify | Replace `TARGET_LANGUAGES` + Dropdown with `<LanguagePicker>` |
| `apps/desktop/src/components/settings/TranscriptionTab.tsx` | Modify | Replace `LANGS` + Dropdown with `<LanguagePicker>` |
| `apps/desktop/src/components/settings/TranslationTab.tsx` | Modify | Replace `LANGS` + Dropdown with `<LanguagePicker>` |

---

### Task 1: Create shared `ALL_LANGUAGES` list

**Files:**
- Create: `apps/desktop/src/components/settings/languages.ts`

- [ ] **Step 1: Create `languages.ts` with full Whisper 100-language list**

```bash
cd backend && ../backend/.venv/bin/python -c "
from whisper.tokenizer import LANGUAGES
for code, name in sorted(LANGUAGES.items(), key=lambda x: x[1]):
    print(f'  {code}: {name}')
"
```

Paste the complete output into the new file. Write `apps/desktop/src/components/settings/languages.ts`:

```typescript
/**
 * Shared bilingual language list — covers all Whisper-supported languages.
 * Labels are bilingual for CJK (native + English in parens), English-only otherwise.
 * Generated from `whisper.tokenizer.LANGUAGES` (100 entries).
 */
const NATIVE_NAMES: Record<string, string> = {
  zh: "中文",
  yue: "粤语",
  ja: "日本語",
  ko: "한국어",
};

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatLabel(code: string, englishName: string): string {
  const native = NATIVE_NAMES[code];
  if (native) return `${native} (${capitalize(englishName)})`;
  return capitalize(englishName);
}

// Generated from whisper.tokenizer.LANGUAGES — { code: english_name } dict.
const RAW: Record<string, string> = {
  // <-- paste the python output here, formatted as `code: "english_name",`
};

export const ALL_LANGUAGES: { label: string; value: string }[] =
  Object.entries(RAW)
    .map(([code, name]) => ({ label: formatLabel(code, name), value: code }))
    .sort((a, b) => a.label.localeCompare(b.label));
```

- [ ] **Step 2: Verify the file compiles**

Run: `pnpm -F desktop typecheck`
Expected: No new errors from `languages.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/components/settings/languages.ts
git commit -m "feat: add shared bilingual 100-language list from Whisper"
```

---

### Task 2: Create `LanguagePicker` component

**Files:**
- Create: `apps/desktop/src/components/settings/LanguagePicker.tsx`

- [ ] **Step 1: Write the component**

```typescript
import * as React from "react";
import { Dropdown, TextInput, ButtonGhost, BodySm } from "@yt-subtitle-maker/ui";
import { XStack } from "tamagui";
import { ALL_LANGUAGES } from "./languages";
import { X } from "@tamagui/lucide-icons";

const CUSTOM_SENTINEL = "__custom__";

const optionsWithCustom = [
  ...ALL_LANGUAGES,
  { label: "Custom…", value: CUSTOM_SENTINEL },
];

type LanguagePickerProps = {
  value: string;
  onValueChange: (v: string) => void;
  disabled?: boolean;
  "aria-label"?: string;
  width?: number | string;
};

export function LanguagePicker({
  value,
  onValueChange,
  disabled,
  "aria-label": ariaLabel,
  width,
}: LanguagePickerProps) {
  const [customText, setCustomText] = React.useState("");
  const isBuiltIn = ALL_LANGUAGES.some((o) => o.value === value);
  const [showingCustom, setShowingCustom] = React.useState(!isBuiltIn && value !== "");

  const handleDropdownChange = (v: string) => {
    if (v === CUSTOM_SENTINEL) {
      setShowingCustom(true);
      setCustomText("");
    } else {
      onValueChange(v);
    }
  };

  const handleCustomConfirm = () => {
    const trimmed = customText.trim();
    if (trimmed) {
      onValueChange(trimmed);
    }
  };

  const handleCustomDismiss = () => {
    setShowingCustom(false);
    setCustomText("");
  };

  if (showingCustom) {
    return (
      <XStack gap="$xs" alignItems="center" width={width}>
        <TextInput
          value={customText}
          onChangeText={setCustomText}
          placeholder="zh-CN, pt-BR…"
          onSubmitEditing={handleCustomConfirm}
          aria-label={ariaLabel ? `${ariaLabel} custom` : "Custom language code"}
          disabled={disabled}
          width="100%"
        />
        <ButtonGhost size="$sm" onPress={handleCustomDismiss} aria-label="Back to language list">
          <X size={16} />
        </ButtonGhost>
      </XStack>
    );
  }

  return (
    <Dropdown
      value={value}
      onValueChange={handleDropdownChange}
      options={optionsWithCustom}
      disabled={disabled}
      aria-label={ariaLabel}
      width={width}
    />
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm -F desktop typecheck`
Expected: No errors from `LanguagePicker.tsx`.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/components/settings/LanguagePicker.tsx
git commit -m "feat: add LanguagePicker component with custom BCP-47 input"
```

---

### Task 3: Replace usage in `constants.ts`

**Files:**
- Modify: `apps/desktop/src/components/settings/constants.ts`

- [ ] **Step 1: Replace `LANGS` with re-export**

Remove lines 64-74 (the `LANGS` constant):

```typescript
export const LANGS = [
  { label: "English", value: "en" },
  // ... 9 entries ...
];
```

Add at top of file:

```typescript
export { ALL_LANGUAGES as LANGS } from "./languages";
```

Keep `LANGS` export name for backward compatibility with existing imports.

- [ ] **Step 2: Verify typecheck**

Run: `pnpm -F desktop typecheck`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/components/settings/constants.ts
git commit -m "refactor: replace hardcoded LANGS with ALL_LANGUAGES re-export"
```

---

### Task 4: Replace usage in `index.tsx` (Generate screen)

**Files:**
- Modify: `apps/desktop/app/index.tsx`

- [ ] **Step 1: Remove `LANGUAGE_OPTIONS` constant**

Remove lines 171-182:

```typescript
const LANGUAGE_OPTIONS = [
  { label: "English", value: "en" },
  // ... 10 entries ...
];
```

- [ ] **Step 2: Replace Dropdown with LanguagePicker**

Replace the source language dropdown (lines 646-653):

```tsx
// Before:
<Dropdown
  value={sourceLang}
  onValueChange={setSourceLang}
  options={LANGUAGE_OPTIONS}
  width="100%"
  aria-label="Source language"
/>

// After:
<LanguagePicker
  value={sourceLang}
  onValueChange={setSourceLang}
  width="100%"
  aria-label="Source language"
/>
```

Replace the target language dropdown (lines 657-664):

```tsx
// Before:
<Dropdown
  value={targetLang}
  onValueChange={setTargetLang}
  options={LANGUAGE_OPTIONS}
  width="100%"
  disabled={!enableTranslation || downloadOnly}
  aria-label="Target language"
/>

// After:
<LanguagePicker
  value={targetLang}
  onValueChange={setTargetLang}
  width="100%"
  disabled={!enableTranslation || downloadOnly}
  aria-label="Target language"
/>
```

- [ ] **Step 3: Add import**

At top of file, add:

```typescript
import { LanguagePicker } from "@/components/settings/LanguagePicker";
```

- [ ] **Step 4: Verify typecheck**

Run: `pnpm -F desktop typecheck`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/app/index.tsx
git commit -m "refactor: use LanguagePicker on Generate screen"
```

---

### Task 5: Replace usage in `NewTranscribeModal.tsx`

**Files:**
- Modify: `apps/desktop/src/components/NewTranscribeModal.tsx`

- [ ] **Step 1: Remove `LANGUAGES` constant**

Remove lines 54-65:

```typescript
const LANGUAGES = [
  // ... 10 entries ...
];
```

- [ ] **Step 2: Replace Dropdown with LanguagePicker**

Find the source language dropdown usage (around line 268-270). Replace:

```tsx
// Before:
<Dropdown
  value={sourceLang}
  onValueChange={setSourceLang}
  options={LANGUAGES}
  ...
/>

// After:
<LanguagePicker
  value={sourceLang}
  onValueChange={setSourceLang}
  ...
/>
```

- [ ] **Step 3: Add import**

```typescript
import { LanguagePicker } from "@/components/settings/LanguagePicker";
```

- [ ] **Step 4: Verify typecheck**

Run: `pnpm -F desktop typecheck`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/components/NewTranscribeModal.tsx
git commit -m "refactor: use LanguagePicker in NewTranscribeModal"
```

---

### Task 6: Replace usage in `NewTranslationModal.tsx`

**Files:**
- Modify: `apps/desktop/src/components/NewTranslationModal.tsx`

- [ ] **Step 1: Remove `TARGET_LANGUAGES` constant**

Remove lines 37-48:

```typescript
const TARGET_LANGUAGES = [
  // ... 11 entries ...
];
```

- [ ] **Step 2: Replace Dropdown with LanguagePicker**

Replace the target language dropdown (lines 198-200):

```tsx
// Before:
<Dropdown
  value={targetLang}
  onValueChange={setTargetLang}
  options={TARGET_LANGUAGES}
  ...
/>

// After:
<LanguagePicker
  value={targetLang}
  onValueChange={setTargetLang}
  ...
/>
```

- [ ] **Step 3: Add import**

```typescript
import { LanguagePicker } from "@/components/settings/LanguagePicker";
```

- [ ] **Step 4: Verify typecheck**

Run: `pnpm -F desktop typecheck`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/components/NewTranslationModal.tsx
git commit -m "refactor: use LanguagePicker in NewTranslationModal"
```

---

### Task 7: Replace usage in `TranscriptionTab.tsx` and `TranslationTab.tsx`

**Files:**
- Modify: `apps/desktop/src/components/settings/TranscriptionTab.tsx`
- Modify: `apps/desktop/src/components/settings/TranslationTab.tsx`

Both already import `LANGS` from `constants.ts`, which now re-exports `ALL_LANGUAGES`. We just need to swap `<Dropdown>` for `<LanguagePicker>`.

- [ ] **Step 1: Update `TranscriptionTab.tsx`**

Replace the source language Dropdown (lines 114-118):

```tsx
// Before:
<Dropdown
  value={draft.defaultSourceLang}
  onValueChange={(v) => update("defaultSourceLang", v)}
  options={LANGS}
  width="100%"
/>

// After:
<LanguagePicker
  value={draft.defaultSourceLang}
  onValueChange={(v) => update("defaultSourceLang", v)}
  width="100%"
  aria-label="Default source language"
/>
```

Add import:
```typescript
import { LanguagePicker } from "./LanguagePicker";
```

Remove `LANGS` import from constants (it's now unused in this file since LanguagePicker bundles its own list).

- [ ] **Step 2: Update `TranslationTab.tsx`**

Replace the target language Dropdown (lines 311-316):

```tsx
// Before:
<Dropdown
  value={draft.defaultTargetLang}
  onValueChange={(v) => update("defaultTargetLang", v)}
  options={LANGS}
  width="100%"
/>

// After:
<LanguagePicker
  value={draft.defaultTargetLang}
  onValueChange={(v) => update("defaultTargetLang", v)}
  width="100%"
  aria-label="Default target language"
/>
```

Add import:
```typescript
import { LanguagePicker } from "./LanguagePicker";
```

Remove `LANGS` import from constants if unused.

- [ ] **Step 3: Verify typecheck**

Run: `pnpm -F desktop typecheck`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/components/settings/TranscriptionTab.tsx apps/desktop/src/components/settings/TranslationTab.tsx
git commit -m "refactor: use LanguagePicker in settings tabs"
```

---

### Task 8: Final verification

- [ ] **Step 1: Run full typecheck**

```bash
pnpm -F desktop typecheck
```

Expected: Zero errors.

- [ ] **Step 2: Verify no remaining hardcoded lists**

```bash
rg "LANGS\s*=\s*\[" apps/desktop/ || echo "No hardcoded LANGS found"
rg "TARGET_LANGUAGES\s*=\s*\[" apps/desktop/ || echo "No hardcoded TARGET_LANGUAGES found"
rg "LANGUAGE_OPTIONS\s*=\s*\[" apps/desktop/ || echo "No hardcoded LANGUAGE_OPTIONS found"
```

Expected: All three report "No ... found".

- [ ] **Step 3: Verify ALL_LANGUAGES is used everywhere**

```bash
rg "from.*languages.*import|from.*LanguagePicker" apps/desktop/
```

Expected: 6 import sites (index.tsx, NewTranscribeModal, NewTranslationModal, TranscriptionTab, TranslationTab, constants.ts).

- [ ] **Step 4: Commit**

```bash
git commit -m "verify: no remaining hardcoded language lists" --allow-empty
```

(Use `--allow-empty` only if there are no staged changes — this is a verification-only task.)
