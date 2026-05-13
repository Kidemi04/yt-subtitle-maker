---
name: yt-subtitle-maker
description: A privacy-first desktop tool that turns any YouTube video into a watchable, translated experience on your own machine.
colors:
  bgBase: "#0a0a0c"
  bgElevated: "#111114"
  surfaceGlass: "rgba(255,255,255,0.05)"
  surfaceGlassMid: "rgba(255,255,255,0.06)"
  surfaceGlassHigh: "rgba(255,255,255,0.08)"
  borderSubtle: "rgba(255,255,255,0.06)"
  borderStrong: "rgba(255,255,255,0.12)"
  textPrimary: "#f5f5f7"
  textSecondary: "#a1a1a6"
  textMuted: "#6e6e73"
  accent: "#fb923c"
  accentSoft: "rgba(251,146,60,0.15)"
  accentDim: "rgba(251,146,60,0.25)"
  success: "#5db872"
  warning: "#e8a55a"
  error: "#ff5a5f"
typography:
  display:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "28px"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "-0.5px"
  headline:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "40px"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "-1px"
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "1.5px"
    textTransform: "uppercase"
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "20px"
  xl: "28px"
  pill: "9999px"
spacing:
  xxs: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"
  section: "64px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.textPrimary}"
    typography: "{typography.title}"
    rounded: "{rounded.md}"
    padding: "0 24px"
    height: "56px"
  button-secondary:
    backgroundColor: "{colors.surfaceGlass}"
    textColor: "{colors.textSecondary}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    height: "44px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.textSecondary}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    height: "44px"
  text-input:
    backgroundColor: "{colors.surfaceGlass}"
    textColor: "{colors.textPrimary}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "44px"
  card-glass:
    backgroundColor: "{colors.surfaceGlassMid}"
    rounded: "{rounded.lg}"
    padding: "24px"
  card-hero:
    backgroundColor: "{colors.surfaceGlassMid}"
    rounded: "{rounded.xl}"
    padding: "32px"
  badge-pill:
    backgroundColor: "{colors.surfaceGlass}"
    textColor: "{colors.textSecondary}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  badge-accent:
    backgroundColor: "{colors.accentSoft}"
    textColor: "{colors.accent}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  filter-chip-active:
    backgroundColor: "{colors.accentSoft}"
    textColor: "{colors.accent}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
  filter-chip-inactive:
    backgroundColor: "{colors.surfaceGlass}"
    textColor: "{colors.textSecondary}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
  sidebar-item-active:
    backgroundColor: "{colors.accentSoft}"
    textColor: "{colors.textPrimary}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
    height: "44px"
---

# Design System: yt-subtitle-maker

## 1. Overview

**Creative North Star: "The Screening Room"**

The app is a private screening room: dark walls, a single warm light, a serif title card before the picture rolls. Surfaces are matte-black at the base, lifted only by frosted glass panels. The single accent, a sunset orange, lives on the things you actually press. Everything else recedes into the dark. The viewer (someone curious about a video in a language they don't speak) reaches for the app the way they would reach for a remote.

The system rejects four neighboring registers. It is not a SaaS dashboard (no hero-metric grids, no Linear-clone chrome, no gradient text). It is not a crypto / AI-startup interface (no cyan neon, no glowing sci-fi edges, no "this is an LLM, therefore glow"). It is not enterprise software (no dense checkbox forms, no beige FFmpeg-GUI energy). It is not a toy consumer app (no rainbow gradients, no cartoon roundness). It is editorial, restrained, and cinematic in feel.

The depth model is **backdrop blur, not shadow**. Cards lift through a 40px saturated blur, not through dropped shadows. Type carries the personality: a Fraunces serif voice for screen titles, Inter for everything that operates the machine, JetBrains Mono whenever a technical surface (timestamp, SRT, log line, engine name) earns the right to read as code.

**Key Characteristics:**
- Single locked accent: sunset orange `#fb923c`, used on ≤10% of any screen.
- Serif display moments (Fraunces 400), sans operating type (Inter), mono for time and code (JetBrains Mono).
- Three glass elevation steps; no drop shadows on cards.
- Dark theme only. Never `#ffffff`, never pure black on the foreground.
- Animations ease out exponentially. No bounce, no elastic, no sparkle.

## 2. Colors

The palette is a near-monochrome dark stage warmed by a single sunset accent. Neutrals are tinted slightly toward warm; glass surfaces are tinted whites at low alpha; status colors are functional, never decorative.

### Primary
- **Sunset Orange** (`#fb923c`): the locked accent. Marks the active sidebar item, the primary CTA, the selected radio option, the progress fill, the focus ring, the "Recommended" badge. Never substituted, never paired with a second accent hue.

### Neutral
- **Theater Black** (`#0a0a0c`): the page surface. Tinted just barely warm so glass surfaces read as panels lit from within.
- **Stage Black** (`#111114`): elevated chrome (sidebar background, hover background, focus background).
- **Picture White** (`#f5f5f7`): primary text. Reads as paper, not as bulb. **`#ffffff` is forbidden.**
- **Foyer Grey** (`#a1a1a6`): secondary text, channel names, helper copy, dropdown chevrons.
- **Aisle Grey** (`#6e6e73`): muted text, placeholders, "muted" badge body.

### Surface (glass layer, three steps)
- **Glass Low** (`rgba(255,255,255,0.05)`): inputs, secondary buttons, badge fills, dropdown rests, sub-rows inside cards.
- **Glass Mid** (`rgba(255,255,255,0.06)`): the workhorse. All standard cards (Hero, Configure, Result, Library tile, History row, Settings group).
- **Glass High** (`rgba(255,255,255,0.08)`): floating chrome only. Modals, action sheets, the logs drawer, toasts.

### Border
- **Subtle** (`rgba(255,255,255,0.06)`): default glass border, divider rules inside cards, secondary input rests.
- **Strong** (`rgba(255,255,255,0.12)`): the standard card frame, hover-state borders, accent-adjacent borders.

### Accent Tints (derived from Sunset Orange)
- **Accent Soft** (`rgba(251,146,60,0.15)`): background of the active sidebar item, the "Recommended" badge, the active filter chip, the focus ring glow, the radio-card selected fill.
- **Accent Dim** (`rgba(251,146,60,0.25)`): the border of any surface filled with Accent Soft, plus the resting accent border on accent-adjacent badges.

### Status
- **Success Green** (`#5db872`): completed run, "auto-captions available" pill, working backend status dot, success callout in cookie settings.
- **Warning Amber** (`#e8a55a`): retryable issues, untested cookies, advisories, warn-level log lines.
- **Error Red** (`#ff5a5f`): irrecoverable failures, error callouts, "Reset to defaults" CTA, error log lines.

### Named Rules

**The One Voice Rule.** Sunset Orange is used on ≤10% of any given screen. Its rarity is the point. If two items on a screen need accent, only one is actually load-bearing; the other should be glass-low or text-secondary.

**The Never-White Rule.** `#ffffff` is forbidden anywhere in the product. Text uses `#f5f5f7` (Picture White); pure white jars against the dark glass surfaces and reads as a bare bulb instead of paper.

**The Locked-Accent Rule.** `#fb923c` is the only accent. Do not introduce a second hue for novelty (no "blue for info", no "purple for premium"). Status colors (success, warning, error) are functional, not brand.

## 3. Typography

**Display Font:** Fraunces (with Georgia, serif fallback)
**Body Font:** Inter (with system-ui, sans-serif fallback)
**Mono Font:** JetBrains Mono (with ui-monospace, monospace fallback)

**Character:** A serif title-card before the picture rolls. Fraunces speaks for the brand; Inter operates the machine; JetBrains Mono surfaces the technical layer when (and only when) the user asks for it.

### Hierarchy
- **Display XL / Fraunces 400, 56/1.05, letterSpacing -1.5px**: top-of-screen headline on Init and About hero.
- **Display LG / Fraunces 400, 40/1.1, letterSpacing -1px**: large section title moments (About hero, Library empty state).
- **Display MD / Fraunces 400, 28/1.2, letterSpacing -0.5px**: per-screen headlines ("What are we transcribing today?", "Setting up your studio").
- **Display SM / Fraunces 400, 22/1.3, letterSpacing -0.3px**: card-level emphasis where a serif moment is earned but smaller in scale.
- **Title LG / Inter 600, 18/1.4**: card titles inside detail modals and result cards.
- **Title MD / Inter 600, 15/1.4**: standard control labels, configure headers, settings group titles.
- **Title SM / Inter 600, 13/1.4**: smaller controls, row metadata, action button text.
- **Body MD / Inter 400, 14/1.55** (cap at 65–75ch): paragraph copy, subtitles, helper text.
- **Body SM / Inter 400, 13/1.55**: card descriptions, secondary metadata.
- **Caption / Inter 500, 12/1.4**: small metadata, date stamps, count labels.
- **Caption Upper / Inter 600, 11/1.4, letterSpacing 1.5px, uppercase**: section eyebrow labels ("TRANSLATED TITLE", "PROCESSING").
- **Timestamp / JetBrains Mono 500, 11/1.4** (tabular numbers): subtitle timestamps, log timestamps.
- **Code / JetBrains Mono 400, 12/1.6**: SRT body, file paths, log lines, engine names.

### Named Rules

**The Fraunces-Only-For-Moments Rule.** Fraunces appears in screen titles, hero copy, and the About page. It never appears inside buttons, table rows, settings labels, or body paragraphs. Weight is always 400 (one Fraunces voice; no bolded display type).

**The Tabular Numbers Rule.** Any monospace number that lives in a column (timestamps, durations, file sizes) must carry `font-feature-settings: 'tnum'`. Columns must align without the eye fighting the type.

**The 75ch Body Rule.** Body paragraph lines cap at 65–75ch. Anything wider becomes unreadable on the 1440px desktop layout; the dark surface punishes long lines harder than light surfaces do.

## 4. Elevation

The app's depth model is **backdrop blur, not drop shadow**. Glass surfaces sit over the Theater Black base; their lift comes from `backdrop-filter: blur(...) saturate(...)` plus a 1px translucent border, not from cast shadows. Drop shadows appear only on floating UI that needs to read as detached from the surface beneath (modals, action sheets, toasts, the logs drawer) and as a soft glow under accent CTAs.

### Glass Vocabulary
- **Glass Low** (`bg rgba(255,255,255,0.04), blur(24px) saturate(180%), border 1px rgba(255,255,255,0.06)`): inputs, secondary buttons, badges, dropdown rests, helper rows. The least-lifted glass.
- **Glass Mid** (`bg rgba(255,255,255,0.06), blur(40px) saturate(180%), border 1px rgba(255,255,255,0.08)`): the workhorse. All standard cards.
- **Glass High** (`bg rgba(255,255,255,0.08), blur(60px) saturate(200%), border 1px rgba(255,255,255,0.12), shadow 0 24px 48px rgba(0,0,0,0.4)`): floating chrome only.

### Shadow Vocabulary (functional only)
- **Accent Glow** (`box-shadow: 0 4px 16px rgba(251,146,60,0.35)`): under the primary CTA on Init and idle Generate states.
- **Accent Glow Strong** (`box-shadow: 0 4px 20px rgba(251,146,60,0.40)`): the "Generate" button when the form is ready (one step louder than the standard glow).
- **Floating Surface** (`box-shadow: 0 24px 48px rgba(0,0,0,0.4)`, hover `rgba(0,0,0,0.5)`): modal, action sheet, toast, logs drawer.

### Named Rules

**The No-Shadow-On-Cards Rule.** Glass cards never carry drop shadows. The `backdrop-filter` IS the elevation system. Shadows on cards turn the dark theme heavy and break the screening-room atmosphere.

**The Glow-As-Affordance Rule.** Accent glow appears only on actionable CTAs at rest. It is a "this is the next button you'll press" signal, not decoration. If three buttons on a screen wear a glow, none of them do.

## 5. Components

### Buttons
- **Shape:** `rounded.md` (12px) on every button. No pills, no square corners.
- **Primary** (`button-primary`): 56px tall, accent gradient (`linear-gradient(180deg, #fb923c, #f97316)`) on `accent` background, Picture White text, Inter 15px 600. Carries the Accent Glow at rest. Press: `scale(0.97)`, 150ms spring (`cubic-bezier(0.34, 1.56, 0.64, 1)`).
- **Secondary** (`button-secondary`): 44px tall, Glass Low background, Foyer Grey Inter 13px text.
- **Ghost** (`button-ghost`): transparent background, 1px Subtle border, otherwise mirrors Secondary. Used for "Discard changes" in settings footers and other stage-2 actions.
- **Icon Button**: 32 to 36px circle, Glass Low background. Hosts a 16px stroke icon (close ✕, more ⋯, reload ⟳, play ▶).

### Chips
- **Filter chips** (`filter-chip-active` / `filter-chip-inactive`): pill, Inter 13px. Active: `accentSoft` background, `accentDim` 1px border, `accent` text. Inactive: Glass Low background, Foyer Grey text.
- **Badge pills** (`badge-pill`, `badge-accent`): Inter 11px 600. `badge-pill` carries Glass Low background and Foyer Grey text. `badge-accent` carries `accentSoft` background and `accent` uppercase text with 1.5px letterspacing.

### Cards / Containers
- **Corner Style:** `rounded.lg` (20px) for standard cards; `rounded.xl` (28px) for Hero card and Modal surfaces.
- **Background:** Glass Mid for cards, Glass High for floating chrome.
- **Shadow Strategy:** none on cards (see Elevation). Modals, action sheets, toasts, and the logs drawer carry the Floating Surface shadow.
- **Border:** 1px Strong border for the standard card frame.
- **Internal Padding:** `lg` (24px) for cards, `xl` (32px) for hero. Hover (`card-hover`): `translateY(-2px)` over 150ms.

### Inputs / Fields
- **Style** (`text-input`): 44px tall, Glass Low background, 1px Subtle border, `rounded.md`. Inter 14px Picture White text. Placeholders in Aisle Grey.
- **Focus:** 2px solid `accent` border + `0 0 0 3px accentSoft` ring. The ring survives the glass blur; a 1px hairline would not.
- **Error:** swap the border to `error` color and append an Inter 12px error helper line below.
- **Disabled:** Aisle Grey value text on `rgba(255,255,255,0.02)` background.

### Dropdowns
- 44px tall, Glass Low, chevron ▾ right in Aisle Grey. Open menu surface uses Glass High plus the Floating Surface shadow.

### Toggles
- 36 × 20 track, 14 × 14 thumb. Off: Glass Low track, Aisle Grey thumb. On: `accent` track, Picture White thumb. Spring transition (150ms).

### Radio Cards
- Padded card (12 × 16px), `rounded.md`. Selected: `accentSoft` background, `accentDim` 1px border, 16px accent-filled radio dot. Unselected: Glass Low background, Subtle border, hollow radio.

### Progress
- **Progress bar**: 6px tall, `rounded.pill`. Track: Glass Low. Fill: accent gradient with `0 0 8px` accent glow.
- **Step pill**: rounded pill carrying a status dot. Done = `success`, active = `accent` with pulse, pending = Aisle Grey.

### Navigation
- **Sidebar**: 240px on desktop, 64px on tablet. Items: 44px tall, `rounded.md`. Active state: `accentSoft` background + 3px `accent` left bar. Status dot at the foot of the sidebar (8px circle, `success`, pulse animation).
- **Mobile bottom tab bar**: 80px tall (with safe-area), Glass High + blur. Active tab: 100% opacity icon + `accent` label + 20×3 `accent` bar above icon. Inactive: 40% opacity icon, Aisle Grey label.

### Glass Card (signature)
The glass card is the project's signature surface. Three preset recipes (`glassRecipes.low / mid / high` in `@yt-subtitle-maker/ui`) carry the background, blur, border, and optional shadow as a unit. Components consume the recipe; they don't roll their own blur. This keeps the three elevation steps consistent across every screen.

## 6. Do's and Don'ts

### Do:
- **Do** use `#fb923c` (Sunset Orange) as the only accent. Status colors (success, warning, error) are functional, not brand.
- **Do** use Fraunces at weight 400 only, for screen titles and hero moments. Set negative letterspacing at display sizes (-0.5 to -1.5px).
- **Do** use `backdrop-filter: blur(...) saturate(...)` plus a 1px translucent border on glass surfaces. The blur IS the elevation.
- **Do** apply `font-feature-settings: 'tnum'` to every monospace number that lives in a column.
- **Do** give every focusable element a visible 2px `accent` border and `0 0 0 3px accentSoft` ring on focus. The ring must survive the glass blur.
- **Do** cap body lines at 65–75ch.
- **Do** keep accent coverage on any screen at ≤10%. Restraint defines the register.
- **Do** consume `glassRecipes.low / mid / high` from `@yt-subtitle-maker/ui` instead of recreating the blur values inline.

### Don't:
- **Don't** use `#ffffff` anywhere. Text is `#f5f5f7` (Picture White).
- **Don't** use Fraunces for body, buttons, table cells, or filler. Fraunces is for moments only.
- **Don't** use `border-left` or `border-right` greater than 1px as a colored stripe accent on cards, list items, callouts, or alerts. The sidebar active state is the one sanctioned exception (a 3px accent bar inside an `accentSoft` background; this is an edge marker, not a "left-stripe alert card").
- **Don't** apply `background-clip: text` with a gradient to headlines. Headlines are solid Picture White. Emphasis is weight or scale, never gradient text.
- **Don't** add drop shadows to glass cards. The blur is the elevation.
- **Don't** introduce a second accent hue (no "blue for info", no "purple for premium").
- **Don't** reach for a modal as the first thought. Exhaust inline expansion and progressive disclosure first.
- **Don't** ship the **generic SaaS dashboard** look (hero-metric templates, identical icon-heading-text card grids, Linear-clone chrome, gradient text). PRODUCT.md anti-reference #1.
- **Don't** ship the **crypto / AI-startup neon** look (cyan-on-black, glowing gradient edges, sci-fi grid backgrounds). PRODUCT.md anti-reference #2.
- **Don't** ship the **heavy enterprise software** look (dense checkbox forms, native OS chrome leaking through, beige FFmpeg-GUI energy). PRODUCT.md anti-reference #3.
- **Don't** ship the **toy / playful consumer app** look (rainbow gradients, oversized cartoon roundness, Duolingo-doodle warmth). PRODUCT.md anti-reference #4.
- **Don't** animate CSS layout properties. Use `transform` and `opacity`. Ease out with exponential curves (`cubic-bezier(0.4, 0, 0.2, 1)` or steeper). No bounce, no elastic.
