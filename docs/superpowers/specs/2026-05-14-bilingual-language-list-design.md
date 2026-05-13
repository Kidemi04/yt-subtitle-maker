# Bilingual Language List — Spec

**Date:** 2026-05-14
**Branch:** v2.1

## Problem

The app has four separate hardcoded language lists (each 9–11 entries) spread across
different components, with inconsistent label formats:

| Location | Variable | Entries | Label format |
|---|---|---|---|
| `app/index.tsx:171` | `LANGUAGE_OPTIONS` | 10 | `"中文 (Chinese)"` |
| `constants.ts:64` | `LANGS` | 9 | `"中文"` (monolingual) |
| `NewTranscribeModal.tsx:54` | `LANGUAGES` | 10 | mixed |
| `NewTranslationModal.tsx:37` | `TARGET_LANGUAGES` | 11 | `"中文 (Chinese)"` |

Whisper supports ~100 languages. The current lists only cover 10 of them. For
target-language translation, LLMs support far more. Users have no way to type an
arbitrary BCP-47 code.

## Goal

One shared bilingual language list covering all Whisper-supported languages, used
everywhere. Users can also input custom BCP-47 codes.

## Design

### 1. Shared list — `languages.ts`

New file `apps/desktop/src/components/settings/languages.ts`:

```ts
// Bilingual label helper: CJK → native (English), others → English
function formatBilingual(code: string, englishName: string): string {
  const NATIVE: Record<string, string> = {
    zh: "中文", ja: "日本語", ko: "한국어", yue: "粤语",
  };
  const native = NATIVE[code];
  if (native) return `${native} (${capitalize(englishName)})`;
  return capitalize(englishName);
}

export const ALL_LANGUAGES: { label: string; value: string }[] = [
  // Generated from Whisper's internal LANGUAGES dict (100 entries),
  // inlined at build time. Sorted alphabetically by English name.
  { label: "English", value: "en" },
  { label: "中文 (Chinese)", value: "zh" },
  // ... remaining 98 entries
];
```

The 100-language mapping is derived from `whisper.tokenizer.LANGUAGES` — a dict of
`{ code: english_name }` — and inlined as a static constant.  No runtime Whisper
import needed.

### 2. Custom input

Each `<Dropdown>` that uses `ALL_LANGUAGES` gets a `"Custom…"` entry as the last
option.  Selecting it hides the dropdown and shows a free-form `<TextInput>` for an
arbitrary BCP-47 code.  `"Custom…"` carries a sentinel value `"__custom__"` (never
a real language code) so the parent component knows when to switch mode.

Implementation: add an `allowCustom` prop to the `Dropdown` component.  When `true`:
- Append `{ label: "Custom…", value: "__custom__" }` to options.
- On `onValueChange("__custom__")`, toggle the parent to show `<TextInput>`.
- Parent state: `lang: string` + `isCustom: boolean`.

### 3. Replace all inlined lists

| File | Old constant | Replace with |
|---|---|---|
| `app/index.tsx:171` | `LANGUAGE_OPTIONS` | `ALL_LANGUAGES` from `languages.ts` |
| `constants.ts:64` | `LANGS` | `ALL_LANGUAGES` from `languages.ts` |
| `NewTranscribeModal.tsx:54` | `LANGUAGES` | `ALL_LANGUAGES` from `languages.ts` |
| `NewTranslationModal.tsx:37` | `TARGET_LANGUAGES` | `ALL_LANGUAGES` from `languages.ts` |

No backend changes needed — language codes are passed through as plain strings.

### 4. Scope boundaries

- **In scope:** frontend language lists, `Dropdown` `allowCustom` prop, "Custom…" UI.
- **Out of scope:** backend validation, pipeline prompts, Whisper auto-detect logic.

## States & Edge Cases

| State | Behavior |
|---|---|
| User picks from built-in list | Language code saved to config/state as before |
| User picks "Custom…" | Dropdown hides, TextInput appears. Typed value saved. |
| Custom value matches a built-in entry | UI switches back to dropdown (pre-selects the match) |
| Backend receives unknown language code | Whisper/Gemini handles it (their own validation) |
| Config migration (old `"zh"` string) | No migration needed — values unchanged |

## Verification

- All 100 entries render correctly in dropdowns with bilingual labels.
- "Custom…" toggles TextInput in all 4 locations.
- Custom value survives page navigation (stored in state/config).
- No regression on existing language-dependent features (pipeline, history display, play-mpv language detection).
