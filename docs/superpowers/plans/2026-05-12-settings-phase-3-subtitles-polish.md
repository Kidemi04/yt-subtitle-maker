# Settings Tab — Phase 3: Subtitles Tab Polish (real controls + live preview + presets) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Subtitles tab's eight raw hex/pixel text inputs into proper controls — color swatches, ±-stepper numbers, a font combobox, style presets — sitting next to a **live preview frame** that renders sample subtitle text the way mpv roughly will, so a non-technical user can dial in the look by eye instead of typing hex codes.

**Architecture:** Pure frontend, no backend changes, **no Rust / no Tauri**. All work is in `apps/desktop/` — five small new components under `apps/desktop/src/components/settings/` (`NumberStepper.tsx`, `ColorField.tsx`, `FontPicker.tsx`, `SubtitlePreview.tsx`, `SubtitlePresets.tsx`) plus incremental edits to `apps/desktop/src/components/settings/SubtitlesTab.tsx`. The underlying `AppConfig` subtitle fields (`subFont`, `subFontSize`, `subBorderSize`, `subMarginY`, `subColor`, `subBorderColor`, `subBackColor`, `subBold`) and their "blank/0/-1 = mpv default" semantics are **unchanged** — only the controls and the preview are new, so anyone who's already tuned this loses nothing. The preview uses raw DOM elements (`React.createElement("input"/"div", …)`) for the native color picker (`<input type="color">`) and the CSS `-webkit-text-stroke` outline — fine here because the app always runs in a WebKit-based runtime (WKWebView in the packaged app, a browser in `pnpm web`).

**Tech Stack:** Expo Router + React + React Native Web + Tamagui; `@yt-subtitle-maker/ui` (which provides `TextInput`, `Dropdown`, `Toggle`, `IconButton`, `ButtonGhost`, `ButtonSecondary`, `GlassCard`, the `Caption`/`BodySm` typography — **no slider, no color, no stepper component**, so those get built locally); `@tamagui/lucide-icons` (`Plus`, `Minus`, etc.); the existing settings context (`useSettings()` → `{ draft, update }`); the `SettingRow` wrapper from Phase 2. No JS test framework — every task's verification is `pnpm -F desktop typecheck` + a concrete manual check against `pnpm web` (http://localhost:8081/settings?tab=subtitles).

**Spec:** `docs/superpowers/specs/2026-05-12-settings-tab-production-ready-design.md` — section **"Subtitles tab — live preview + real controls"**. Phases 1 & 2 shipped (commits up to `c19976c` on `v2.1`).

**Deviation from the spec's phasing:** the spec's "Phase 3 — Native polish" also lists `tauri-plugin-dialog` + the folder "Browse…" buttons and the optional "Test playback" button. **This plan moves all the Tauri/native pieces to a later plan** (they belong with Phase 4's other native/backend work — `GET /api/system`, `GET /api/engines`, arming the folder fields with exists/writable validation, etc.). Rationale: keeping Phase 3 pure-frontend means it's fast, has no Rust-toolchain verification loop, and is fully testable in the `pnpm web` flow the user actually uses day-to-day; the Tauri-dialog work is a self-contained native-integration task that's cheaper to do once, batched with the other native bits. So **Phase 3 = the Subtitles-tab polish only** (the items in this plan); `tauri-plugin-dialog` / "Browse…" / "Test playback" are explicitly out of scope here.

**Also out of scope for Phase 3 (do not pull in):** Hybrid autosave / per-field `↺` / per-tab reset — Phase 4 (the existing Save/Discard footer stays); the engine-driven Transcription tab, `GET /api/system`, `GET /api/engines` — Phase 4; the Translation named-provider-profiles rewrite — Phase 4; Advanced's Open-config-folder / Export / Import — Phase 4; arming the folder/path fields (Output/Download/Whisper-cache/JS-runtime/mpv) — they stay plain `TextInput`s (the mpv-path one too); changing any `AppConfig` field name, the camelCase mapping, or the backend.

**Prerequisites on the machine:** `pnpm install` already done. For the manual checks: backend in one terminal (`cd backend && ../backend/.venv/bin/python -m uvicorn api.main:app --host 127.0.0.1 --port 8000 --reload`) + `pnpm web` (→ http://localhost:8081) in another. Rust / the Tauri window are **not** needed for any Phase-3 task. (Backend pytest is untouched by this plan; it should stay green — run it once at the end as a regression check.)

---

## File structure

| File | Change |
|---|---|
| `apps/desktop/src/components/settings/NumberStepper.tsx` | **New (Task 1).** A numeric field: hex-free `TextInput` flanked by −/+ `IconButton`s; understands a "default sentinel" so a cleared field maps to `0` (or `-1`) and the steppers start from a sensible base. |
| `apps/desktop/src/components/settings/ColorField.tsx` | **New (Task 2).** A native color swatch (`<input type="color">`) + a hex `TextInput`; optional alpha control for `#RRGGBBAA` fields; "blank = transparent/default" preserved. |
| `apps/desktop/src/components/settings/FontPicker.tsx` | **New (Task 3).** A `Dropdown` of curated safe fonts (+ "(mpv default sans)" + a "Custom…" path) that flips to a plain `TextInput` when the value isn't in the list / "Custom…" is chosen. |
| `apps/desktop/src/components/settings/SubtitlePreview.tsx` | **New (Task 4).** A dark preview frame with two lines of sample text (Latin + CJK) rendered with the current font/size/colors/outline/bold/bottom-margin, approximating mpv's burned-in look (uses `-webkit-text-stroke` for the outline). |
| `apps/desktop/src/components/settings/SubtitlePresets.tsx` | **New (Task 5).** A row of preset buttons (Clean white · YouTube-style box · Big & bold · Reset to mpv defaults), each applying a bundle of `update(...)` calls. |
| `apps/desktop/src/components/settings/SubtitlesTab.tsx` | **Edited in Tasks 1–5** — swap each raw `TextInput` for the new control; add the preview + presets. Ends as: preview at the top, presets row, then mpv-path (still plain) + font picker + the stepper/color rows + bold toggle. |

---

## Note on testing

No JS test framework. Each task's verification is:
1. `pnpm -F desktop typecheck` (from the repo root) → must exit clean (no output).
2. The named manual check against a running backend + `pnpm web` (http://localhost:8081/settings?tab=subtitles). A headless Playwright check (start backend + `pnpm web`, drive the page) is a nice extra but the typecheck + an eyeball is the gate.

Backend pytest is untouched by this plan; Task 5's last step runs `backend/.venv/bin/python -m pytest -q` once to confirm no regression (expect the current count).

Reminder about the field semantics that **must** be preserved through every new control:
- `subFontSize` (number): `0` = "use mpv's default (≈55px)". Today's input shows `""` when `0`, and `parseInt(v,10)||0` on change.
- `subMarginY` (number): `0` = "default". Same display/parse pattern as `subFontSize`.
- `subBorderSize` (number): `-1` = "use mpv's default (≈3px)"; `0` = "no outline"; today's input shows `""` when `< 0` (i.e. when `-1`) and `String(v)` when `>= 0`; on change, blank → `-1`, else `Number(v)` (falling back to `-1` if not finite).
- `subColor` / `subBorderColor` (string): a `#RRGGBB` hex; blank = mpv default (white text / black outline).
- `subBackColor` (string): a `#RRGGBBAA` hex; **blank = transparent** (no box behind the text).
- `subFont` (string): a font family name; blank = mpv's default sans.
- `subBold` (boolean): unchanged — it's already a `Toggle`, leave it.

---

### Task 1: `NumberStepper` component + wire it into the three numeric subtitle fields

**Files:**
- Create: `apps/desktop/src/components/settings/NumberStepper.tsx`
- Modify: `apps/desktop/src/components/settings/SubtitlesTab.tsx`

- [ ] **Step 1: Create `NumberStepper.tsx`**

```tsx
import * as React from "react";
import { XStack } from "tamagui";
import { Minus, Plus } from "@tamagui/lucide-icons";
import { TextInput, IconButton } from "@yt-subtitle-maker/ui";

/**
 * A numeric field with −/+ steppers. The value is a plain number; `defaultSentinel`
 * is the value that means "use the default" (0 for font-size/margin, -1 for outline
 * width) — when the value equals it, the text box shows empty and the steppers start
 * from `stepperBase` instead of the sentinel. Clearing the text box emits the sentinel;
 * the value is clamped to `>= min`.
 */
export function NumberStepper({
  value,
  onValueChange,
  min = 0,
  step = 1,
  defaultSentinel = 0,
  stepperBase,
  placeholder,
  ariaLabel,
}: {
  value: number;
  onValueChange: (n: number) => void;
  min?: number;
  step?: number;
  defaultSentinel?: number;
  stepperBase?: number; // where ± start when the value is currently the sentinel; defaults to `min` (clamped) — pass e.g. 55 / 18 / 3
  placeholder?: string;
  ariaLabel?: string;
}) {
  const isDefault = value === defaultSentinel;
  const base = stepperBase ?? Math.max(min, 0);
  const text = isDefault ? "" : String(value);

  const emit = (n: number) => onValueChange(Math.max(min, Math.round(n)));
  const bump = (delta: number) => emit((isDefault ? base : value) + delta);

  return (
    <XStack gap="$sm" alignItems="center">
      <IconButton
        icon={<Minus size={14} color="$textSecondary" />}
        aria-label={`${ariaLabel ?? "value"} minus`}
        size={32}
        onPress={() => bump(-step)}
      />
      <TextInput
        flex={1}
        value={text}
        onChangeText={(v: string) => {
          if (v.trim() === "") {
            onValueChange(defaultSentinel);
            return;
          }
          const n = Number(v);
          onValueChange(Number.isFinite(n) ? Math.max(min, Math.round(n)) : defaultSentinel);
        }}
        placeholder={placeholder}
        keyboardType="numeric"
        aria-label={ariaLabel}
      />
      <IconButton
        icon={<Plus size={14} color="$textSecondary" />}
        aria-label={`${ariaLabel ?? "value"} plus`}
        size={32}
        onPress={() => bump(step)}
      />
    </XStack>
  );
}
```

(If `IconButton`'s prop is `aria-label` vs `ariaLabel` — it's `aria-label` everywhere else in this codebase, so use that. If `Minus`/`Plus` aren't exported by `@tamagui/lucide-icons` under those names, use the nearest available — they're cosmetic.)

- [ ] **Step 2: Use `NumberStepper` for `subFontSize`, `subMarginY`, `subBorderSize` in `SubtitlesTab.tsx`**

Replace the three numeric `<TextInput>`s inside their `SettingRow`s. The `SettingRow`s and their `id`s/`label`s/`helper`s stay exactly as they are; only the control inside changes:

- `subtitles.font-size` → `<NumberStepper value={draft.subFontSize} onValueChange={(n) => update("subFontSize", n)} min={0} defaultSentinel={0} stepperBase={55} placeholder="0" ariaLabel="Subtitle font size" />`
- `subtitles.margin-y` → `<NumberStepper value={draft.subMarginY} onValueChange={(n) => update("subMarginY", n)} min={0} defaultSentinel={0} stepperBase={18} placeholder="0" ariaLabel="Subtitle bottom margin" />`
- `subtitles.border-size` → `<NumberStepper value={draft.subBorderSize} onValueChange={(n) => update("subBorderSize", n)} min={0} defaultSentinel={-1} stepperBase={3} placeholder="(mpv default)" ariaLabel="Subtitle outline width" />`

Import `NumberStepper` from `./NumberStepper`; remove the now-unused inline parse logic for those three fields (the `parseInt(v,10)||0` and the `subBorderSize` blank/`-1` handling) — `NumberStepper` owns it now. The two-column `<XStack gap="$md"><YStack flex={1}>` wrappers around `font-size`+`margin-y` and around `border-size`+`back-color` stay.

- [ ] **Step 3: Verify**

Run: `pnpm -F desktop typecheck` — Expected: no errors.

Manual: open http://localhost:8081/settings?tab=subtitles — "Font size" / "Bottom margin" / "Outline width" each now have −/+ buttons either side of the input. Default state: the boxes are empty (font-size shows placeholder "0", outline-width shows "(mpv default)"). Click "+" on Font size → it jumps to 56 (stepperBase 55 + 1); click "−" four times → 52; clear it → empty again (i.e. `subFontSize` is `0`); the footer shows "unsaved changes" when you change a value, "all saved" after Save. Click "+" on Outline width while it's empty → it becomes 4 (base 3 + 1); clear → empty (i.e. `-1`). Save → reload → values stick. Type a garbage string like "abc" into Font size → it should not crash; it resolves to `0` (empty).

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/components/settings/NumberStepper.tsx apps/desktop/src/components/settings/SubtitlesTab.tsx
git commit -m "feat(settings): NumberStepper control for the subtitle font-size / margin / outline-width fields"
```

---

### Task 2: `ColorField` component + wire it into the three color fields

**Files:**
- Create: `apps/desktop/src/components/settings/ColorField.tsx`
- Modify: `apps/desktop/src/components/settings/SubtitlesTab.tsx`

- [ ] **Step 1: Create `ColorField.tsx`**

```tsx
import * as React from "react";
import { XStack } from "tamagui";
import { TextInput } from "@yt-subtitle-maker/ui";
import { NumberStepper } from "./NumberStepper";

const HEX6 = /^#?[0-9a-fA-F]{6}$/;
const HEX8 = /^#?[0-9a-fA-F]{8}$/;
const norm6 = (s: string): string => {
  const m = s.trim().replace(/^#/, "");
  return /^[0-9a-fA-F]{6}$/.test(m) ? `#${m.toLowerCase()}` : "";
};
const clamp255 = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
const toHex2 = (n: number) => clamp255(n).toString(16).padStart(2, "0");
const pctToHex = (pct: number) => toHex2(Math.round((Math.max(0, Math.min(100, pct)) / 100) * 255));
const hexToPct = (hex2: string) => Math.round((parseInt(hex2, 16) / 255) * 100);

/**
 * Color picker (native `<input type=color>` swatch + a hex text field). When
 * `allowAlpha`, the value is a `#RRGGBBAA` string (blank ⇒ transparent) and an
 * alpha % stepper is shown; otherwise the value is `#RRGGBB` (blank ⇒ `fallback`,
 * which is what the picker shows when the value is empty/invalid — e.g. "#ffffff"
 * for text, "#000000" for outline). The hex `TextInput` stays editable either way
 * (so the user can still type a raw value, or clear it to go back to "default").
 */
export function ColorField({
  value,
  onChangeText,
  allowAlpha = false,
  fallback = "#ffffff",
  ariaLabel,
}: {
  value: string;
  onChangeText: (v: string) => void;
  allowAlpha?: boolean;
  fallback?: string; // the picker's shown color when `value` is empty/invalid
  ariaLabel?: string;
}) {
  // RGB part shown in the native picker:
  const rgb = allowAlpha
    ? (HEX8.test(value) || HEX6.test(value) ? `#${value.replace(/^#/, "").slice(0, 6).toLowerCase()}` : fallback)
    : (norm6(value) || fallback);
  const alphaPct = allowAlpha
    ? (HEX8.test(value) ? hexToPct(value.replace(/^#/, "").slice(6, 8)) : 0)
    : 100;

  const swatch = React.createElement("input", {
    type: "color",
    value: rgb,
    "aria-label": ariaLabel ? `${ariaLabel} swatch` : "color swatch",
    onChange: (e: any) => {
      const picked: string = e.target.value; // "#rrggbb"
      if (!allowAlpha) {
        onChangeText(picked);
      } else {
        // keep the current alpha; if alpha was 0/blank, default to fully opaque
        const a = HEX8.test(value) ? value.replace(/^#/, "").slice(6, 8) : "ff";
        onChangeText(`${picked}${a.toLowerCase()}`);
      }
    },
    style: { width: 32, height: 32, padding: 0, border: "none", background: "transparent", cursor: "pointer", borderRadius: 6 },
  });

  return (
    <XStack gap="$sm" alignItems="center">
      {swatch}
      <TextInput
        flex={1}
        value={value}
        onChangeText={onChangeText}
        placeholder={allowAlpha ? "(transparent)" : fallback}
        aria-label={ariaLabel}
      />
      {allowAlpha ? (
        <XStack gap="$xs" alignItems="center" width={150}>
          <NumberStepper
            value={alphaPct}
            onValueChange={(pct) => {
              if (pct <= 0) {
                onChangeText(""); // alpha 0 ⇒ transparent ⇒ blank, per the field's "blank = transparent"
                return;
              }
              const base = (HEX8.test(value) || HEX6.test(value)) ? value.replace(/^#/, "").slice(0, 6).toLowerCase() : fallback.replace(/^#/, "");
              onChangeText(`#${base}${pctToHex(pct)}`);
            }}
            min={0}
            step={10}
            defaultSentinel={-9999} // never matches a real %, so 0 stays "0"
            stepperBase={50}
            placeholder="α%"
            ariaLabel={ariaLabel ? `${ariaLabel} alpha` : "alpha"}
          />
        </XStack>
      ) : null}
    </XStack>
  );
}
```

Notes for the implementer:
- `React.createElement("input", …)` renders a real DOM `<input>` (this is an Expo-web / react-native-web app — React DOM handles intrinsic elements directly; RNW doesn't intercept them). If `pnpm -F desktop typecheck` complains about the props type on `React.createElement("input", …)`, cast: `React.createElement("input" as any, { … } as any)` — it's a DOM element, TS's JSX types for it are fine, but the spread style may need a nudge; keep it minimal.
- The `defaultSentinel={-9999}` trick on the alpha `NumberStepper` is so that an alpha of `0` displays as `"0"` (not blank) — for the alpha field, "blank" isn't a meaningful state (we map alpha 0 → the *parent* field becomes blank). If you'd rather, replace the alpha `NumberStepper` with a plain `TextInput` that parses a 0–100 number; either is fine, but `NumberStepper` gives the ± buttons for consistency.
- If `<input type="color">` turns out not to render in this RNW setup (it should), fall back to: a display-only colored `Stack` (`backgroundColor={rgb}`, ~32×32, rounded) instead of the `<input>` — the hex `TextInput` then carries all the editing. Note which one you went with.

- [ ] **Step 2: Use `ColorField` for `subColor`, `subBorderColor`, `subBackColor` in `SubtitlesTab.tsx`**

Replace the three color `<TextInput>`s inside their `SettingRow`s (ids/labels/helpers unchanged):
- `subtitles.color` → `<ColorField value={draft.subColor} onChangeText={(v) => update("subColor", v)} fallback="#ffffff" ariaLabel="Subtitle text color" />`
- `subtitles.border-color` → `<ColorField value={draft.subBorderColor} onChangeText={(v) => update("subBorderColor", v)} fallback="#000000" ariaLabel="Subtitle outline color" />`
- `subtitles.back-color` → `<ColorField value={draft.subBackColor} onChangeText={(v) => update("subBackColor", v)} allowAlpha fallback="#000000" ariaLabel="Subtitle background" />`

Import `ColorField` from `./ColorField`. (Update the `subtitles.color`/`subtitles.border-color` helpers if you like — e.g. "Pick a color or type a #hex." — but keep them short; the existing "Hex like #ffffff." is also fine. Leave the `subtitles.back-color` helper as is — "Box behind text. Hex with alpha #RRGGBBAA. Blank = transparent." — it's still accurate.)

- [ ] **Step 3: Verify**

Run: `pnpm -F desktop typecheck` — Expected: no errors.

Manual: open http://localhost:8081/settings?tab=subtitles — "Text color" / "Outline color" each show a small color swatch next to the hex input; clicking the swatch opens the OS color picker; picking a color updates the hex field. "Background" shows a swatch + hex + an "α%" stepper; with the field blank the alpha shows 0 and the swatch shows black (the fallback); set alpha to 50 → the field becomes `#00000080`; set alpha back to 0 → the field clears (back to transparent). Type `#ff0000` into the Text color hex field → the swatch turns red. Save → reload → values stick. (If you chose the display-only-swatch fallback because `<input type="color">` didn't render, note it — the hex fields still work and that's acceptable for now.)

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/components/settings/ColorField.tsx apps/desktop/src/components/settings/SubtitlesTab.tsx
git commit -m "feat(settings): ColorField (swatch + hex + alpha) for the subtitle color fields"
```

---

### Task 3: `FontPicker` component + wire it into the font field

**Files:**
- Create: `apps/desktop/src/components/settings/FontPicker.tsx`
- Modify: `apps/desktop/src/components/settings/SubtitlesTab.tsx`

- [ ] **Step 1: Create `FontPicker.tsx`**

```tsx
import * as React from "react";
import { YStack, XStack } from "tamagui";
import { Dropdown, TextInput, ButtonGhost, BodySm } from "@yt-subtitle-maker/ui";

// Curated "probably installed somewhere / commonly bundled" font names. "" = mpv's default sans.
const CURATED_FONTS = [
  "",
  "Inter",
  "Arial",
  "Helvetica",
  "Helvetica Neue",
  "Verdana",
  "Tahoma",
  "Trebuchet MS",
  "Times New Roman",
  "Georgia",
  "Courier New",
  "Noto Sans",
  "Noto Sans CJK SC",
  "Noto Sans CJK TC",
  "Noto Sans CJK JP",
  "Noto Sans CJK KR",
  "Noto Serif CJK SC",
  "Source Han Sans SC",
  "PingFang SC",
  "Microsoft YaHei",
  "DejaVu Sans",
  "Liberation Sans",
];
const CUSTOM = "__custom__";

/**
 * Font family picker: a curated dropdown ("(mpv default sans)" + safe names + "Custom…"),
 * which flips to a plain text input when the current value isn't in the curated list or
 * the user picks "Custom…". Either control writes the same `subFont` string. mpv won't
 * download fonts — the name must be installed on the OS (warning lives on the SettingRow).
 */
export function FontPicker({
  value,
  onChangeText,
}: {
  value: string;
  onChangeText: (v: string) => void;
}) {
  const inCurated = CURATED_FONTS.includes(value);
  const [customMode, setCustomMode] = React.useState(!inCurated && value !== "");

  // If the value changes to something curated (e.g. via a preset), drop out of custom mode.
  React.useEffect(() => {
    if (inCurated) setCustomMode(false);
  }, [inCurated]);

  const options = [
    ...CURATED_FONTS.map((f) => ({ label: f === "" ? "(mpv default sans)" : f, value: f })),
    { label: "Custom…", value: CUSTOM },
  ];

  if (customMode) {
    return (
      <YStack gap="$xs">
        <XStack gap="$sm" alignItems="center">
          <TextInput
            flex={1}
            value={value}
            onChangeText={onChangeText}
            placeholder="e.g. My Custom Font"
            aria-label="Custom font family name"
          />
          <ButtonGhost
            onPress={() => {
              onChangeText("");
              setCustomMode(false);
            }}
          >
            <BodySm color="$textSecondary">↩ pick from list</BodySm>
          </ButtonGhost>
        </XStack>
      </YStack>
    );
  }

  return (
    <Dropdown
      value={inCurated ? value : ""}
      onValueChange={(v) => {
        if (v === CUSTOM) {
          setCustomMode(true);
          // keep the current value if it was already custom; otherwise leave it for the user to type
          return;
        }
        onChangeText(v);
      }}
      options={options}
      width="100%"
      aria-label="Font family"
    />
  );
}
```

(If `Dropdown`'s value-not-in-options behavior is awkward, the `inCurated ? value : ""` guard handles it — when the value is custom but we're not yet in custom mode on first render, `customMode` is initialised `true` anyway, so the dropdown branch only renders for curated/empty values. Double-check `Dropdown`'s `aria-label` prop name matches the rest of the codebase.)

- [ ] **Step 2: Use `FontPicker` for `subFont` in `SubtitlesTab.tsx`**

Replace the `subtitles.font` `SettingRow`'s `<TextInput>` body with `<FontPicker value={draft.subFont} onChangeText={(v) => update("subFont", v)} />`. Keep the `SettingRow`'s `id`/`label`/`helper` (the helper — `'e.g. "Noto Sans CJK SC", "Inter", "Arial". Must be installed on the OS — mpv does not download fonts.'` — is still the right warning copy). Import `FontPicker` from `./FontPicker`.

- [ ] **Step 3: Verify**

Run: `pnpm -F desktop typecheck` — Expected: no errors.

Manual: open http://localhost:8081/settings?tab=subtitles — "Font family" is now a dropdown defaulting to "(mpv default sans)"; pick "Inter" → `subFont` becomes "Inter"; pick "Custom…" → the row swaps to a text input + a "↩ pick from list" button; type "My Weird Font" → `subFont` becomes that; click "↩ pick from list" → back to the dropdown showing "(mpv default sans)" (and `subFont` cleared). If you reload a config that has a non-curated `subFont` saved, the row should open in custom-text mode showing that value. Save → reload → sticks. Footer reflects dirty/saved correctly.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/components/settings/FontPicker.tsx apps/desktop/src/components/settings/SubtitlesTab.tsx
git commit -m "feat(settings): FontPicker (curated dropdown + custom-name fallback) for the subtitle font field"
```

---

### Task 4: `SubtitlePreview` component + add it to the Subtitles tab

**Files:**
- Create: `apps/desktop/src/components/settings/SubtitlePreview.tsx`
- Modify: `apps/desktop/src/components/settings/SubtitlesTab.tsx`

- [ ] **Step 1: Create `SubtitlePreview.tsx`**

```tsx
import * as React from "react";
import { Stack, YStack } from "tamagui";
import { Caption } from "@yt-subtitle-maker/ui";
import type { AppConfig } from "@yt-subtitle-maker/api-client";

// How big the preview pretends mpv's "default" is, and how much we scale everything
// down to fit the small preview box. Not pixel-exact — just enough to dial in the look.
const MPV_DEFAULT_FONT = 55;
const MPV_DEFAULT_BORDER = 3;
const PREVIEW_SCALE = 0.42;

const SAMPLE_LATIN = "The quick brown fox jumps over the lazy dog";
const SAMPLE_CJK = "敏捷的棕色狐狸跳过了那只懒狗";

/** Approximates how mpv will burn the subtitles in, using `-webkit-text-stroke` for the outline. */
export function SubtitlePreview({ cfg }: { cfg: AppConfig }) {
  const fontPx = (cfg.subFontSize && cfg.subFontSize > 0 ? cfg.subFontSize : MPV_DEFAULT_FONT) * PREVIEW_SCALE;
  const borderPx = (cfg.subBorderSize >= 0 ? cfg.subBorderSize : MPV_DEFAULT_BORDER) * PREVIEW_SCALE;
  const marginPx = (cfg.subMarginY && cfg.subMarginY > 0 ? cfg.subMarginY : 0) * PREVIEW_SCALE;
  const textColor = /^#?[0-9a-fA-F]{6}$/.test(cfg.subColor || "") ? (cfg.subColor.startsWith("#") ? cfg.subColor : `#${cfg.subColor}`) : "#ffffff";
  const outlineColor = /^#?[0-9a-fA-F]{6}$/.test(cfg.subBorderColor || "") ? (cfg.subBorderColor.startsWith("#") ? cfg.subBorderColor : `#${cfg.subBorderColor}`) : "#000000";
  const backColor = /^#?[0-9a-fA-F]{8}$/.test(cfg.subBackColor || "")
    ? (cfg.subBackColor.startsWith("#") ? cfg.subBackColor : `#${cfg.subBackColor}`)
    : "transparent";
  const fontFamily = cfg.subFont?.trim() ? `"${cfg.subFont.trim()}", "Noto Sans CJK SC", sans-serif` : `"Noto Sans CJK SC", sans-serif`;
  const fontWeight = cfg.subBold ? 700 : 400;

  const lineStyle: React.CSSProperties = {
    fontFamily,
    fontWeight,
    fontSize: `${fontPx}px`,
    lineHeight: 1.25,
    color: textColor,
    WebkitTextStroke: borderPx > 0 ? `${borderPx}px ${outlineColor}` : undefined,
    backgroundColor: backColor,
    padding: backColor === "transparent" ? 0 : `${Math.max(2, fontPx * 0.12)}px ${Math.max(4, fontPx * 0.3)}px`,
    borderRadius: backColor === "transparent" ? 0 : 4,
    display: "inline-block",
    textAlign: "center",
    maxWidth: "92%",
    overflowWrap: "anywhere",
  };
  const innerStyle: React.CSSProperties = {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: `${12 + marginPx}px`,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: `${Math.max(2, fontPx * 0.18)}px`,
  };

  return (
    <YStack gap="$xs">
      <Stack
        height={200}
        borderRadius="$md"
        overflow="hidden"
        position="relative"
        // a flat-ish "video still" backdrop; a gradient via CSS keeps it from looking like a UI panel
        // (Tamagui passes `style` through on web)
        style={{ background: "linear-gradient(160deg, #2a2733 0%, #14131a 55%, #0c0b10 100%)" }}
      >
        {React.createElement("div", { style: innerStyle },
          React.createElement("span", { style: lineStyle, key: "latin" }, SAMPLE_LATIN),
          React.createElement("span", { style: lineStyle, key: "cjk" }, SAMPLE_CJK),
        )}
      </Stack>
      <Caption color="$textMuted">Approximate preview — mpv's real output may differ slightly. The CJK line catches fonts that lack Chinese/Japanese/Korean glyphs.</Caption>
    </YStack>
  );
}
```

Notes:
- `React.createElement("div"/"span", …)` for the text so we can use `WebkitTextStroke` (a CSS property RNW's style system may not pass through reliably) and a real CSS `text-shadow`-free outline. If `WebkitTextStroke` produces a too-heavy look at small sizes, an acceptable alternative is a multi-offset `textShadow` (e.g. `${b}px ${b}px 0 ${c}, -${b}px -${b}px 0 ${c}, ${b}px -${b}px 0 ${c}, -${b}px ${b}px 0 ${c}` plus the cardinal offsets) — either is fine; the goal is "looks roughly like an outlined subtitle".
- If TS complains about `React.CSSProperties` not having `WebkitTextStroke`, it does (React's CSS types include vendor-prefixed `Webkit*` properties) — but if it doesn't in this TS version, `(lineStyle as any).WebkitTextStroke = …` or just `style={{ ...lineStyle, WebkitTextStroke: … } as React.CSSProperties}`. Keep it minimal.
- The `cfg` prop is the full `AppConfig` (the live `draft`) — so the preview updates as the user edits, no extra wiring.

- [ ] **Step 2: Add the preview to the top of `SubtitlesTab.tsx`**

Inside the tab's `<YStack gap="$md">`, right after the `<Section title="Subtitles" …/>` and **before** the "MPV executable path" `SettingRow`, add `<SubtitlePreview cfg={draft} />`. Import `SubtitlePreview` from `./SubtitlePreview`. Nothing else changes.

- [ ] **Step 3: Verify**

Run: `pnpm -F desktop typecheck` — Expected: no errors.

Manual: open http://localhost:8081/settings?tab=subtitles — there's a dark preview box near the top with two lines of sample text (Latin + CJK). Change "Text color" to red → both lines turn red in the preview. Bump "Font size" → the preview text grows. Bump "Outline width" → a visible stroke appears around the glyphs. Set a "Background" color with alpha 60 → a translucent box appears behind each line. Toggle "Bold" → the preview goes bold. Increase "Bottom margin" → the text moves up from the bottom of the box. Set "Font family" to a font you don't have installed (e.g. "Comic Sans MS") → the Latin line falls back to a system font (and the CJK line still renders via the appended `"Noto Sans CJK SC", sans-serif` fallback) — that's the expected "missing-glyph" demonstration. (None of these need a Save — the preview reflects the live draft.)

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/components/settings/SubtitlePreview.tsx apps/desktop/src/components/settings/SubtitlesTab.tsx
git commit -m "feat(settings): live SubtitlePreview frame on the Subtitles tab"
```

---

### Task 5: Style presets row + final tab layout pass

**Files:**
- Create: `apps/desktop/src/components/settings/SubtitlePresets.tsx`
- Modify: `apps/desktop/src/components/settings/SubtitlesTab.tsx`

- [ ] **Step 1: Create `SubtitlePresets.tsx`**

```tsx
import * as React from "react";
import { XStack } from "tamagui";
import { ButtonSecondary, ButtonGhost, BodySm, Caption } from "@yt-subtitle-maker/ui";
import type { AppConfig } from "@yt-subtitle-maker/api-client";

// The subtitle-style fields a preset touches. Keep these keys in sync with SubtitlesTab.
type StyleFields = Pick<
  AppConfig,
  "subFont" | "subFontSize" | "subBorderSize" | "subMarginY" | "subColor" | "subBorderColor" | "subBackColor" | "subBold"
>;

const PRESETS: { label: string; ghost?: boolean; values: StyleFields }[] = [
  {
    label: "Clean white",
    values: { subFont: "", subFontSize: 0, subBorderSize: -1, subMarginY: 0, subColor: "#ffffff", subBorderColor: "#000000", subBackColor: "", subBold: false },
  },
  {
    label: "YouTube-style box",
    values: { subFont: "", subFontSize: 0, subBorderSize: 0, subMarginY: 24, subColor: "#ffffff", subBorderColor: "#000000", subBackColor: "#000000b3", subBold: false },
  },
  {
    label: "Big & bold",
    values: { subFont: "", subFontSize: 72, subBorderSize: 4, subMarginY: 0, subColor: "#ffffff", subBorderColor: "#000000", subBackColor: "", subBold: true },
  },
  {
    label: "Reset to mpv defaults",
    ghost: true,
    values: { subFont: "", subFontSize: 0, subBorderSize: -1, subMarginY: 0, subColor: "#ffffff", subBorderColor: "#000000", subBackColor: "", subBold: false },
  },
];

export function SubtitlePresets({ apply }: { apply: (values: StyleFields) => void }) {
  return (
    <XStack gap="$sm" flexWrap="wrap" alignItems="center">
      <Caption color="$textMuted">Presets:</Caption>
      {PRESETS.map((p) =>
        p.ghost ? (
          <ButtonGhost key={p.label} onPress={() => apply(p.values)}>
            <BodySm color="$textSecondary">{p.label}</BodySm>
          </ButtonGhost>
        ) : (
          <ButtonSecondary key={p.label} onPress={() => apply(p.values)}>
            {p.label}
          </ButtonSecondary>
        ),
      )}
    </XStack>
  );
}
```

(Tune the preset values to taste — the above are reasonable starting points. "Clean white" and "Reset to mpv defaults" are intentionally near-identical: "Clean white" pins white-on-black-outline explicitly, "Reset" is the pure mpv-default state — having both is fine; if you'd rather they differ more, make "Clean white" use a slightly larger font, e.g. `subFontSize: 60`. Don't add a "Test playback" button — that's out of scope for Phase 3.)

- [ ] **Step 2: Wire `SubtitlePresets` into `SubtitlesTab.tsx`**

In `SubtitlesTab()`, add an `applyPreset` handler that writes each field via the existing `update`:

```tsx
  const applyPreset = (v: {
    subFont: string; subFontSize: number; subBorderSize: number; subMarginY: number;
    subColor: string; subBorderColor: string; subBackColor: string; subBold: boolean;
  }) => {
    update("subFont", v.subFont);
    update("subFontSize", v.subFontSize);
    update("subBorderSize", v.subBorderSize);
    update("subMarginY", v.subMarginY);
    update("subColor", v.subColor);
    update("subBorderColor", v.subBorderColor);
    update("subBackColor", v.subBackColor);
    update("subBold", v.subBold);
  };
```

(Each `update` does `setDraft((d) => ({ ...d, [k]: val }))`, so applying eight in a row is fine — React batches the state updates within the event handler. If you'd rather do it in one shot and the context exposes a way to merge several keys at once, use that; otherwise eight `update` calls is correct and simple.)

Place `<SubtitlePresets apply={applyPreset} />` in the tab's `<YStack gap="$md">` **between `<SubtitlePreview cfg={draft} />` and the "MPV executable path" `SettingRow`** — so the layout top-to-bottom is: Section header → live preview → presets row → mpv path → font picker → (font-size | margin) → (text color | outline color) → (outline width | background) → bold toggle. Import `SubtitlePresets` from `./SubtitlePresets`.

(Optional layout polish while you're here: the preview + presets read better grouped — you may wrap them in their own un-bordered `<YStack gap="$sm">` or leave them as direct children of the `$md`-gap stack; not required. Don't restructure the `SettingRow`s.)

- [ ] **Step 3: Verify**

Run: `pnpm -F desktop typecheck` — Expected: no errors.
Run: `backend/.venv/bin/python -m pytest -q` — Expected: still green (this plan touches no backend code; this is a regression check).

Manual: open http://localhost:8081/settings?tab=subtitles — there's a "Presets:" row of buttons under the preview. Click "YouTube-style box" → the preview gains a translucent black box, the bottom-margin increases, and the form controls below all reflect the new values (the "Background" hex field shows `#000000b3` and its α stepper shows ~70, "Bottom margin" shows 24, etc.); footer shows "unsaved changes". Click "Big & bold" → preview goes large + bold + outlined; controls update. Click "Reset to mpv defaults" → everything goes back to blank/0/-1/false (font-size box empty, outline-width empty, colors back to `#ffffff`/`#000000`, background blank, bold off, font dropdown shows "(mpv default sans)"). Save → reload → whichever preset you left it on persisted. Then change something manually and Save again to confirm normal editing still works.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/components/settings/SubtitlePresets.tsx apps/desktop/src/components/settings/SubtitlesTab.tsx
git commit -m "feat(settings): subtitle style presets (Clean white / YouTube box / Big & bold / Reset to mpv defaults)"
```

---

## Self-review (done by plan author)

- **Spec coverage (Phase 3 / "Subtitles tab" slice):**
  - "Live preview frame — a mock video still … with sample subtitle text … Two lines (shows wrapping) including a CJK line" → Task 4 (`SubtitlePreview`: gradient backdrop, Latin + CJK lines, `overflowWrap`) ✓
  - "native color pickers (swatch + hex; background gets an alpha control) for text/outline/background" → Task 2 (`ColorField`, `allowAlpha` for `subBackColor`) ✓
  - "`NumberStepper` for size / outline-width / bottom-margin" → Task 1 ✓
  - "a font `Combobox` (curated list of safe fonts + 'type a custom name', with a 'must be installed' warning)" → Task 3 (`FontPicker`: curated `Dropdown` + "Custom…" → text input; warning kept on the `SettingRow` helper) ✓
  - "a bold toggle" → already a `Toggle` (Phase 2); left as is ✓
  - "A few style presets (Clean white · YouTube-style box · Big & bold · Reset to mpv defaults)" → Task 5 ✓
  - "Underlying config fields and 'blank = mpv default' semantics are unchanged" → preserved everywhere (the "field semantics" reminder block + Task 1's sentinel handling + Task 2's "blank = transparent" mapping + Task 3's `""` = "(mpv default sans)") ✓
  - "`mpv executable path` is an armed field. Optional 'Test playback' button … — flagged as polish-phase." → **out of scope for this plan** (the `ArmedField` arming of `mpv executable path` goes with the other folder/path-field arming in Phase 4; "Test playback" is deferred per the header) — stated in the header.
  - The spec's broader "Phase 3 — Native polish" also includes `tauri-plugin-dialog` + folder "Browse…" → **deliberately moved to a later plan (Phase 4-adjacent)** per the header's deviation note; this keeps Phase 3 pure-frontend / Rust-free / `pnpm web`-verifiable.
- **Placeholder scan:** none — every step has the literal code/command. The "if `<input type=color>` doesn't render, fall back to a display-only swatch" and "if `WebkitTextStroke` looks heavy, use a multi-offset `textShadow`" notes are concrete fallbacks (with the code described), not deferred work. The "tune the preset values to taste" note ships with a complete working default set.
- **Type/name consistency:** the five new components are imported by `SubtitlesTab.tsx` from their own files (`./NumberStepper`, `./ColorField`, `./FontPicker`, `./SubtitlePreview`, `./SubtitlePresets`). `ColorField` (Task 2) reuses `NumberStepper` (Task 1) for its alpha control — Task 1 lands first, so it exists. `SubtitlePreview` and `SubtitlePresets` take the full `AppConfig` (`draft`) — the same shape `useSettings()` already provides. The `update("subX", …)` calls in Task 5's `applyPreset` use the exact `AppConfig` keys (`subFont`/`subFontSize`/`subBorderSize`/`subMarginY`/`subColor`/`subBorderColor`/`subBackColor`/`subBold`) — same keys the existing `SettingRow`s already write. The `SettingRow` `id`s (`subtitles.font`, `subtitles.font-size`, `subtitles.margin-y`, `subtitles.color`, `subtitles.border-color`, `subtitles.border-size`, `subtitles.back-color`, `subtitles.bold`, `subtitles.mpv-path`) are untouched — the search index from Phase 2 still matches. Sentinel values are consistent: `0` for `subFontSize`/`subMarginY`, `-1` for `subBorderSize` — matching today's `SubtitlesTab.tsx` parse logic.
- **Risk notes for the executor:** the `<input type="color">` and the `React.createElement("div"/"span"/"input", …)` DOM-element usage is the only "unusual" technique — it works in Expo-web/RNW (React DOM renders intrinsic elements; RNW doesn't intercept them), but if the typecheck or runtime fights it, the documented fallbacks (display-only swatch; `textShadow` outline) keep the feature functional. Everything else is ordinary Tamagui + the existing `@yt-subtitle-maker/ui` components. No backend, no Rust, no `AppConfig` changes — so the blast radius is the Subtitles tab and the five new files only.
