# Handoff: YT Subtitle Maker v2.0 — Frontend UI

## Overview

This package contains high-fidelity HTML design mockups for the v2.0 rewrite of `yt-subtitle-maker` — a desktop-first (Tauri + Expo + Tamagui) application that downloads YouTube audio, transcribes it via Whisper or YouTube auto-captions, and translates the result via Gemini or a local LLM.

The designs cover the full 5-screen app: Init, Generate, Library, History, Settings, About, plus supporting chrome (Logs drawer, collapsed sidebar, mobile bottom-nav reference).

---

## About the Design Files

The `.html` files in this bundle are **design references created as HTML prototypes** — they show the intended look, layout, and component states. They are **not production code to copy directly**.

Your task is to **recreate these designs in the existing Tamagui + Expo codebase** (`packages/ui/`, `apps/desktop/`) using Tamagui components, React Native primitives, and the token system defined in this spec. The HTML is the visual target; the implementation language is Tamagui/React Native.

Open the HTML files in a browser (they need `design-canvas.jsx` in the same folder — already included). Pan and zoom the canvas; click any artboard label to focus it fullscreen.

---

## Fidelity

**High-fidelity.** These are pixel-accurate mocks with final colors, typography, spacing, component states, copy, and interactions. Implement them precisely using Tamagui tokens — every hex value, spacing unit, and font style below maps directly to a token in the design system.

---

## Design Tokens (implement as Tamagui tokens)

### Colors
```ts
// tamagui.config.ts — colors
bgBase:        "#0a0a0c"   // page background
bgElevated:    "#111114"   // sidebar, elevated surfaces
surfaceGlass:  "rgba(255,255,255,0.05)"   // glass-low
surfaceGlassMid: "rgba(255,255,255,0.06)" // glass-mid (most cards)
surfaceGlassHigh: "rgba(255,255,255,0.08)"
borderSubtle:  "rgba(255,255,255,0.06)"
borderStrong:  "rgba(255,255,255,0.12)"
textPrimary:   "#f5f5f7"
textSecondary: "#a1a1a6"
textMuted:     "#6e6e73"
accent:        "#fb923c"   // LOCKED — Sunset Orange
accentSoft:    "rgba(251,146,60,0.15)"
accentDim:     "rgba(251,146,60,0.25)"
success:       "#5db872"
warning:       "#e8a55a"
error:         "#ff5a5f"
```

### Typography
```ts
// Font families
display: "Fraunces"       // serif, weight 400 ONLY, display headlines
body:    "Inter"          // all UI text, buttons, labels
mono:    "JetBrains Mono" // timestamps, SRT content, log lines, code

// Scale
displayXl:  { family: "Fraunces", size: 56, weight: 400, lineHeight: 1.05, letterSpacing: -1.5 }
displayLg:  { family: "Fraunces", size: 40, weight: 400, lineHeight: 1.1,  letterSpacing: -1 }
displayMd:  { family: "Fraunces", size: 28, weight: 400, lineHeight: 1.2,  letterSpacing: -0.5 }
displaySm:  { family: "Fraunces", size: 22, weight: 400, lineHeight: 1.3,  letterSpacing: -0.3 }
titleLg:    { family: "Inter",    size: 18, weight: 600, lineHeight: 1.4 }
titleMd:    { family: "Inter",    size: 15, weight: 600, lineHeight: 1.4 }
titleSm:    { family: "Inter",    size: 13, weight: 600, lineHeight: 1.4 }
bodyMd:     { family: "Inter",    size: 14, weight: 400, lineHeight: 1.55 }
bodySm:     { family: "Inter",    size: 13, weight: 400, lineHeight: 1.55 }
caption:    { family: "Inter",    size: 12, weight: 500, lineHeight: 1.4 }
captionUpper: { family: "Inter",  size: 11, weight: 600, letterSpacing: 1.5, textTransform: "uppercase" }
timestamp:  { family: "JetBrains Mono", size: 11, weight: 500, fontFeatureSettings: "'tnum'" }
code:       { family: "JetBrains Mono", size: 12, weight: 400, lineHeight: 1.6 }
```

### Spacing
```ts
xxs: 4,  xs: 8,  sm: 12,  md: 16,  lg: 24,  xl: 32,  xxl: 48,  section: 64
```

### Border Radius
```ts
xs: 4,  sm: 8,  md: 12,  lg: 20,  xl: 28,  pill: 9999
```

### Elevation (glass surfaces)
All glass cards use `backdropFilter: "blur(40px) saturate(180%)"` — use Tamagui's `unstyled` + style prop or a custom `GlassStack` component.
```ts
glassLow:  { bg: "rgba(255,255,255,0.04)", blur: "blur(24px) saturate(180%)", border: "1px solid rgba(255,255,255,0.06)" }
glassMid:  { bg: "rgba(255,255,255,0.06)", blur: "blur(40px) saturate(180%)", border: "1px solid rgba(255,255,255,0.08)" }
glassHigh: { bg: "rgba(255,255,255,0.08)", blur: "blur(60px) saturate(200%)", border: "1px solid rgba(255,255,255,0.12)", shadow: "0 24px 48px rgba(0,0,0,0.4)" }
```

### Animation
```ts
duration: { quick: 150, normal: 250, slow: 400, slowest: 600 }  // ms
easing: {
  standard:   "cubic-bezier(0.4, 0, 0.2, 1)",
  decelerate: "cubic-bezier(0, 0, 0.2, 1)",
  spring:     "cubic-bezier(0.34, 1.56, 0.64, 1)",
}
// Presets
fadeIn:    "opacity 0→1, 250ms, decelerate"
slideUp:   "translateY 16px→0 + fadeIn, 250ms, decelerate"
scaleIn:   "scale 0.96→1 + fadeIn, 150ms, spring"
press:     "scale 1→0.97, 150ms"
cardHover: "translateY 0→-2px, 150ms"
stagger:   "each child delayed by 40ms"
```

---

## Layout (Desktop — 1440px)

```
┌─────────────────────────────────────────────────────────┐
│  Sidebar (240px fixed)  │  Topbar (64px fixed)          │
│                         ├───────────────────────────────┤
│  • Nav items (44px h)   │  Main content area            │
│  • Active: accent left  │  max-width: 960px centered    │
│    bar 3px + accentSoft │  padding: 32px                │
│    background           │                               │
│                         │  Cards stack vertically       │
│  • Backend status dot   │  gap: 24px between cards      │
│    bottom of sidebar    │                               │
└─────────────────────────┴───────────────────────────────┘
```

**Breakpoints:**
- `< 768px` — bottom tab bar (5 tabs), sidebar hidden
- `768–1024px` — collapsed sidebar (64px, icons only)
- `≥ 1024px` — full 240px sidebar

---

## Screens

### Screen 1: Init (yt-subtitle-maker-mockups.html → Frame 01)

Shown once on first launch when Whisper model not downloaded.

**Layout:** Centered glass card, max-width 480px, vertically centered in viewport.

**Components:**
- Heading: `displayMd` (Fraunces 28px) "Setting up your studio"
- Subtitle: `bodyMd` (Inter 14px, textSecondary) "Choose a Whisper model to download. This only happens once."
- Divider: 1px, borderSubtle
- 5 model radio cards (tiny / base / small / medium / **turbo** selected):
  - Height: auto, padding 12px 16px, borderRadius `md` (12px)
  - Selected: `accentSoft` bg, `accentDim` border
  - Unselected: `glassLow` bg, `borderSubtle` border
  - Radio dot: 16×16, accent filled when selected
  - Model name: `titleMd` (Inter 14px 600)
  - Size badge: `timestamp` (JetBrains Mono 11px, textMuted)
  - "⭐ Default" badge: `accentSoft` bg, accent text, pill shape
  - Description: `bodySm` (Inter 12px, textMuted), marginTop 2px
- CTA button: height 56, full-width, `borderRadius md`, accent gradient (`#fb923c → #f97316`), `glow: 0 4px 16px rgba(251,146,60,0.35)`
- Footer note: Inter 12px textMuted, centered

**States:** connecting → checking → **picking-model** (shown) → downloading → ready

---

### Screen 2: Generate — Idle (Frame 02)

**Components:**
- Hero card: `glassMid`, `borderRadius xl` (28px), padding 32px
  - Heading: `displayMd` Fraunces 28px "What are we transcribing today?"
  - Subtitle: `bodyMd` Inter 14px textSecondary
  - URL input: height 52, `glassLow` bg, `borderSubtle` border, `borderRadius md`
    - Placeholder text: Inter 14px textMuted
    - Paste icon: 🔗 textMuted
  - Load button: height 52, padding 0 24px, accent gradient, `borderRadius md`
  - Helper chips below: pill shape, `glassLow`, Inter 11px
  - Shimmer sweep animation: 10s loop, very subtle (opacity ~0.018)
- Below hero: 3 collapsed placeholder rows (Video preview, Configure, Generate button) at 35% opacity — communicate the flow without showing content

---

### Screen 3: Generate — Metadata Loaded + Configure Expanded (Frame 03)

**URL input focused state:**
- Border: 2px solid accent
- Box shadow: `0 0 0 3px accentSoft`

**Video preview card:** `glassMid`, `borderRadius lg` (20px), padding 24px
- Thumbnail: 192×108, `borderRadius md`, placeholder gradient
- Title: `titleLg` Inter 18px 600
- Channel + duration: `bodySm` Inter 13px textSecondary
- Badge pills: rounded pill, `glassLow` bg — file type, language
- "Auto-captions available": `success` colored pill

**Configure card (expanded):** `glassMid`, `borderRadius lg`
- Header: "Configure" `titleMd` + collapsed/expanded chevron
- **Subtitle Source** radio group (3 options):
  - Auto (recommended) — selected, with "Recommended" accent badge
  - YouTube only
  - Whisper only
- **Source / Target Language** — 2-column grid of dropdowns, height 44
- **Enable translation toggle** + "Using: Gemini ▾" pill (accentSoft bg, clickable)
- **"Just download" toggle**
- **▸ Advanced** collapsible sub-section:
  - 4 engine rows (JetBrains Mono name, Inter description, ⓘ icon)
  - `faster-whisper` row: accentSoft bg, accentDim border, selected radio
  - Whisper model / Device / VAD — 3-column dropdown grid

**Generate button:** height 56, full-width, accent gradient, `borderRadius md`, `boxShadow: 0 4px 20px rgba(251,146,60,0.4)`

---

### Screen 4: Generate — Processing (Frame 04)

Replaces generate button with processing card.

**Processing card:** `glassMid`, `borderRadius lg`, padding 24px
- Top row: "PROCESSING" label (`captionUpper`) + ✕ cancel icon button (28×28, `glassLow`, `borderRadius pill`)
- Waveform animation: 36 bars, 4px wide, pill-shaped
  - Active bars (center ~12): accent gradient top-to-bottom, animate scaleY 0.4→1.3, staggered delays
  - Inactive bars: `rgba(255,255,255,0.10)`
  - Container: `rgba(0,0,0,0.2)` bg, `borderRadius md`, padding 16px
- Status text: `titleMd` Inter 15px 600, centered — "Transcribing with faster-whisper…"
- Sub-status: `bodySm` Inter 13px textSecondary — "Step 2 / 4 · about 30s left"
- Progress bar: height 6, `borderRadius pill`, track `glassLow`, fill accent gradient + `boxShadow: 0 0 8px accentGlow`
- Step indicator pills (4): Download ✓ (success) / Transcribe ◉ (active, pulsing dot) / Translate ○ / Done ○

---

### Screen 5: Generate — Result + SRT Preview (Frame 05)

**Result card:** `glassMid`, `borderRadius lg`
- Done header: green checkmark circle (40×40, success-tinted), "Done · 1m 23s" `titleLg`, engine/language subtitle `bodySm` textSecondary
- Translated title box: `accentSoft` bg, `accentDim` border, `borderRadius md`
  - "TRANSLATED TITLE" label: `captionUpper` accent
  - Translated title: `titleMd` 600 textPrimary
  - Original: `bodySm` textSecondary below
- **SRT preview:** `rgba(0,0,0,0.25)` bg, `borderRadius md`, padding 0 16px
  - Each row: 2-column grid (timestamp col | text col)
  - Timestamp: `timestamp` style (JetBrains Mono 11px tnum) textMuted
  - Original text: `bodySm` textPrimary
  - Translated text: `bodySm` accent color
  - Row dividers: 1px borderSubtle
  - "View full SRT →" link: accent, `bodySm`
- Action button row: flex-wrap gap 8px
  - "▶ Play with MPV": accent gradient, height 44
  - "📁 Open folder", "⟳ Re-transcribe with…", "💾 Download SRT": `glassLow`, height 44

---

### Screen 6: Library — Grid (yt-subtitle-maker-session2.html → Frame 01)

**Header bar:** filter chips row (All / Video / Audio / SRT) + search input + Refresh button
- Active chip: `accentSoft` bg, `accentDim` border, accent text
- Inactive chip: `glassLow` bg, Inter 13px textSecondary

**Grid:** 4-up at desktop (1024px+), `gap: 24px`

**Media card:** `glassMid`, `borderRadius lg`, overflow hidden
- Thumbnail: 16:9 ratio, `borderRadius md` top corners
- Duration badge: bottom-right of thumb, `rgba(0,0,0,0.72)` bg, JetBrains Mono 11px
- Play icon overlay: centered, `rgba(0,0,0,0.55)` circle
- Body padding: 16px
- Title: `titleMd` Inter 13px 600, 2-line clamp
- Channel: `bodySm` textSecondary
- Tags: pill badges — file type, language
- Footer: size (JetBrains Mono 11px textMuted) + date (Inter 11px textMuted), separated by 1px borderSubtle

**Hover state:** `transform: translateY(-2px)`, subtle shadow increase

---

### Screen 7: Library — Empty State (Frame 02)

Centered in content area, min-height 480px:
- Icon placeholder: 120×120, `glassLow`, `borderRadius xl`, 50% opacity
- Heading: `displayMd` Fraunces 28px
- Body: `bodyMd` Inter 14px textSecondary, max-width 360px, centered
- CTA: height 48, accent gradient, padding 0 32px

---

### Screen 8: Library — Detail Modal (Frame 03)

Overlay: `rgba(10,10,12,0.75)` backdrop + `blur(8px)`

**Modal:** width 640, `glassMid` + extra opacity, `borderRadius xl`, `boxShadow: 0 24px 48px rgba(0,0,0,0.5)`

**Header:** thumb 128×72 + title/meta/badges + ✕ close

**File rows:** each row: icon (36×36 tile) + filename (JetBrains Mono 12px) + language label + size + action icons (▶ ↓ ⋯)
- Primary file (translated SRT): `accentSoft` bg, `accentDim` border

**Processing info grid:** 2-col × 3-row, label (`captionUpper`) + value (JetBrains Mono 12px)

**Footer:** "Reload in Generate" + "Open folder" + "Delete" (error-colored)

---

### Screen 9: History — List View (yt-subtitle-maker-session2.html → Frame 04)

**Header:** time filter chips + sort dropdown + ⋯ overflow

**History rows:** `glassMid`, `borderRadius lg`, padding 16px 24px, flex row
- Thumbnail: 80×48, `borderRadius sm`
- Translated title: `titleMd` Inter 14px 600, ellipsis overflow
- Original title (if translated): `bodySm` textSecondary below
- Badge pills: language, engine (JetBrains Mono), date (Inter 12px textMuted)
- Elapsed time: JetBrains Mono 12px textMuted, right-aligned
- Action icons: ▶ ⟳ ⋯ (32×32 circle, `glassLow`)

---

### Screen 10: Settings (yt-subtitle-maker-session3.html → Frames 01–02)

5 sections, each a `glassMid` card with `borderRadius lg`:
1. **General** — Backend URL (+ Test button + status dot) + Download folder
2. **Cookies** — source dropdown, profile input, cookies.txt input, status callout (see Frame 02 for all 3 states)
3. **STT Engine** — 2×2 dropdown grid + 2 toggles + warning advisory
4. **Translation** — segmented provider control (Gemini / Local AI / OpenAI-compatible), provider-specific fields, masked API key input
5. **Advanced** — misc inputs + Reset to defaults (error-colored)

**Sticky footer:** "Discard changes" (ghost) + "Save settings" (accent) — `position: sticky, bottom: 0`

**Cookie states (Frame 02):**
- Working: green pulse dot, green callout box
- Failed: red dot, red error callout + amber advisory
- Untested: amber dot, neutral form

---

### Screen 11: About (Frame 03)

- No logo mark — heading only
- Fraunces 40px display heading "YT Subtitle Maker"
- Version card: 2×2 grid (JetBrains Mono values)
- Resource links: icon + label (accent) + sub + ↗ arrow
- Tech credit pills: JetBrains Mono 11px, pill shape
- MIT license footer

---

### Screen 12: Logs Drawer (Frame 04)

Right-edge overlay, width 400px, `glassHigh` surface, slides in from right.

- Header: "Logs" + filter dropdown + Clear button + ✕
- Log lines: 2-column grid (64px timestamp col | message col)
  - Timestamp: JetBrains Mono 11px textMuted, `font-feature-settings: 'tnum'`
  - Message: JetBrains Mono 12px, color by level:
    - `info` → textSecondary
    - `debug` → textMuted
    - `warn` → warning, amber row tint `rgba(232,165,90,0.06)`
    - `error` → error, red row tint `rgba(255,90,95,0.06)`
  - Row dividers: `rgba(255,255,255,0.03)`
- Blinking cursor at bottom: 8×13px accent block, `step-end` blink 1s
- Footer: entry count + "⌘L to close" hint

---

### Screen 13: Collapsed Sidebar — Tablet (Frame 05)

Width: 64px. Icons only (no labels).

- Logo removed — nav icons centered
- Active item: `accentSoft` bg, `accentDim` border, 3px accent left bar
- Status dot: bottom-center, 8×8, success green, pulse animation
- Expand button in topbar: "⇤ Expand" (`glassLow`)
- Content grid: 3-up (vs 4-up at desktop)

---

### Screen 14: Mobile Bottom-Nav (Frame 06)

Phone bezel: 390×760 content area, `borderRadius 44px`, dark border.

**Status bar:** 44px, Inter 13px 600
**Bottom tab bar:** height 80px (with safe area), `glassHigh` + blur
- 5 tabs: Generate / Library / History / Settings / About
- Active tab: icon 100% opacity + accent label (Inter 10px 600) + accent 20×3 bar above icon
- Inactive: icon 40% opacity + textMuted label

**Generate content on mobile:** full-width stack, no sidebar, `borderRadius xl` hero card.

---

## Component Inventory

| Component | Token recipe |
|---|---|
| `GlassCard` | `glassMid` bg + `blur(40px) saturate(180%)` + `borderStrong` + `borderRadius lg` + padding `lg` |
| `HeroCard` | Same as GlassCard but `borderRadius xl` + padding `xl` |
| `ButtonPrimary` | height 56, accent gradient, `borderRadius md`, Inter 15px 600 white, glow shadow |
| `ButtonSecondary` | height 44, `glassLow`, `borderRadius md`, Inter 13px textSecondary |
| `ButtonGhost` | transparent bg, `borderSubtle` border |
| `IconButton` | 32–36px circle, `glassLow` |
| `TextInput` | height 44, `glassLow`, `borderSubtle` border, `borderRadius md` |
| `TextInputFocused` | 2px accent border + `0 0 0 3px accentSoft` ring |
| `Dropdown` | height 44, `glassLow`, chevron ▾ right |
| `Toggle` | 36×20 track, 14×14 thumb, accent when on, spring transition |
| `RadioCard` | Padded card with radio dot, accent border when selected |
| `ProgressBar` | height 6, `glassLow` track, accent gradient fill, glow |
| `StepPill` | Pill with status (done=success / active=accent+pulse / pending=muted) |
| `BadgePill` | Pill, `glassLow`, Inter 11px 600, optional accent/success/warning/error tint |
| `BadgeAccent` | `accentSoft` bg, accent text, `captionUpper` style |
| `SidebarItem` | 44px row, `borderRadius md`, accent left bar + `accentSoft` bg when active |
| `FilterChip` | Pill, active=`accentSoft`+accent text, inactive=`glassLow` |
| `SegmentedControl` | Row of options in `glassLow` container, active option gets `accentSoft` bg |
| `StatusDot` | 6–8px circle, pulse animation when green |
| `ActionSheet` | `rgba(30,30,34,0.92)` + heavy blur + `borderRadius lg`, width 260px |
| `Modal` | Centered overlay, `glassMid`+extra, `borderRadius xl`, `boxShadow` |
| `Toast` | Bottom-center, `glassHigh`, slide-up entrance |

---

## Key Interactions

- **URL load:** input focus → accent border ring → metadata card slides up (`slideUp` animation, 250ms)
- **Configure expand/collapse:** smooth height animation, 250ms standard easing
- **Card hover (desktop):** `translateY(-2px)`, 150ms
- **Button press:** `scale(0.97)`, 150ms spring
- **Processing → Done:** processing card fades out, result card slides up
- **Stagger list:** each child card delayed 40ms

---

## Files in this Package

| File | Contents |
|---|---|
| `yt-subtitle-maker-mockups.html` | Session 1: Init, Generate ×4 states |
| `yt-subtitle-maker-session2.html` | Session 2: Library ×3, History ×2, Action Sheet |
| `yt-subtitle-maker-session3.html` | Session 3: Settings ×2, About, Logs, Collapsed sidebar, Mobile |
| `design-canvas.jsx` | Pan/zoom canvas dependency (required to open HTMLs) |
| `README.md` | This file |

Open all HTML files from the same folder so `design-canvas.jsx` resolves correctly.

---

## Notes for Claude Code

- The spec file `2026-05-04-tamagui-rewrite-design.md` contains the full API contract (TypeScript types, HTTP endpoints, NDJSON streaming format) — the designs here are the visual layer on top of that contract.
- Accent color `#fb923c` is locked. Do not substitute.
- **Never use `#ffffff`** — use `#f5f5f7` (textPrimary) for warmth.
- **Fraunces is display-only** — never use it for body text or buttons.
- **No box shadows on glass cards** — the `backdropFilter` blur is the elevation system.
- `MPV` / `Open folder` buttons must be hidden when `BackendCapabilities.mpvAvailable === false`.
- `language: 'auto'` must never reach the API — always send a concrete BCP-47 code.
