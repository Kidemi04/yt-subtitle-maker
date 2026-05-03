---
version: 2.0-alpha
name: yt-subtitle-maker (v2.0 rewrite)
date: 2026-05-04
branch: v2.0
status: design-spec
description: |
  Complete rewrite of yt-subtitle-maker as a desktop-first, mobile-portable
  application using Tamagui + Expo + Tauri. Replaces the existing Flutter GUI
  and PySide6 legacy GUI. Backend is modularized with Protocol-based
  abstractions for STT engines, translators, and downloaders. V1 ships
  desktop-only via Tauri; V2 reuses the same React/Tamagui codebase to ship
  iOS/Android via Expo, connecting to the user's local backend over an
  ngrok tunnel.

stack:
  ui: Tamagui (universal React components)
  app-framework: Expo (web target for V1, mobile target for V2)
  desktop-shell: Tauri 2 (wraps Expo web build)
  state: Zustand or Jotai (final pick during implementation)
  data: TanStack Query for backend HTTP, EventSource/fetch streaming for /api/process
  backend: FastAPI (Python 3.11+), modularized into core/ + api/
  stt-default: faster-whisper (after V1 regression fix)
  translation: Google Gemini API

repo-structure:
  layout: monorepo (pnpm workspaces)
  tree: |
    yt-subtitle-maker/  (branch: v2.0)
    ├── apps/
    │   ├── desktop/              # Tauri shell + Expo web entry
    │   └── mobile/               # (V2 placeholder, empty in V1)
    ├── packages/
    │   ├── ui/                   # Tamagui components, shared between apps
    │   ├── api-client/           # TypeScript HTTP/streaming client
    │   └── shared/               # Types, hooks, constants
    ├── backend/
    │   ├── core/                 # Pure-Python logic (no FastAPI deps)
    │   │   ├── stt/              # STT provider Protocol + implementations
    │   │   ├── translator/       # Translator Protocol + Gemini impl
    │   │   ├── downloader/       # yt-dlp wrapper + cookies
    │   │   ├── pipeline.py       # Orchestrates download → STT → translate
    │   │   └── config.py
    │   ├── api/                  # FastAPI HTTP layer
    │   │   ├── main.py
    │   │   ├── routes/
    │   │   │   ├── metadata.py
    │   │   │   ├── process.py
    │   │   │   ├── download.py
    │   │   │   ├── library.py
    │   │   │   └── config.py
    │   │   └── schemas.py
    │   └── pyproject.toml
    ├── docs/
    └── pnpm-workspace.yaml

colors:
  bg-base: "#0a0a0c"
  bg-elevated: "#111114"
  surface-glass: "rgba(255,255,255,0.05)"
  surface-glass-hover: "rgba(255,255,255,0.08)"
  surface-glass-active: "rgba(255,255,255,0.12)"
  border-subtle: "rgba(255,255,255,0.06)"
  border-strong: "rgba(255,255,255,0.12)"
  text-primary: "#f5f5f7"
  text-secondary: "#a1a1a6"
  text-muted: "#6e6e73"
  accent: "#TBD-by-claude-design"        # See "Accent Color Decision" section
  accent-soft: "#TBD-by-claude-design"
  success: "#5db872"
  warning: "#e8a55a"
  error: "#ff5a5f"

typography:
  display-xl:
    fontFamily: "Fraunces, ui-serif, serif"
    fontSize: 56px
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "-1.5px"
    fontVariationSettings: "'opsz' 144, 'SOFT' 100, 'WONK' 0"
  display-lg:
    fontFamily: "Fraunces, ui-serif, serif"
    fontSize: 40px
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "-1px"
    fontVariationSettings: "'opsz' 96, 'SOFT' 50, 'WONK' 0"
  display-md:
    fontFamily: "Fraunces, ui-serif, serif"
    fontSize: 28px
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "-0.5px"
  display-sm:
    fontFamily: "Fraunces, ui-serif, serif"
    fontSize: 22px
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "-0.3px"
  title-lg:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.4
  title-md:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 15px
    fontWeight: 600
    lineHeight: 1.4
  title-sm:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 600
    lineHeight: 1.4
  body-md:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.55
  body-sm:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.55
  caption:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.4
  caption-uppercase:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 11px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "1.5px"
    textTransform: "uppercase"
  code:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.6
  timestamp:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: 11px
    fontWeight: 500
    lineHeight: 1.4
    fontFeatureSettings: "'tnum'"

rounded:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 20px
  xl: 28px
  pill: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  section: 64px

elevation:
  glass-low:
    background: "rgba(255,255,255,0.04)"
    backdropFilter: "blur(24px) saturate(180%)"
    border: "1px solid rgba(255,255,255,0.06)"
  glass-mid:
    background: "rgba(255,255,255,0.06)"
    backdropFilter: "blur(40px) saturate(180%)"
    border: "1px solid rgba(255,255,255,0.08)"
  glass-high:
    background: "rgba(255,255,255,0.08)"
    backdropFilter: "blur(60px) saturate(200%)"
    border: "1px solid rgba(255,255,255,0.12)"
    boxShadow: "0 24px 48px rgba(0,0,0,0.4)"

animation:
  duration:
    quick: 150ms
    normal: 250ms
    slow: 400ms
    slowest: 600ms
  easing:
    standard: "cubic-bezier(0.4, 0, 0.2, 1)"
    decelerate: "cubic-bezier(0, 0, 0.2, 1)"
    accelerate: "cubic-bezier(0.4, 0, 1, 1)"
    spring: "cubic-bezier(0.34, 1.56, 0.64, 1)"
  presets:
    fade-in: "opacity 0→1, duration normal, easing decelerate"
    slide-up: "translateY 16px→0 + fade-in, duration normal, easing decelerate"
    scale-in: "scale 0.96→1 + fade-in, duration quick, easing spring"
    press: "scale 1→0.97, duration quick"
    card-hover: "translateY 0→-2px + shadow-up, duration quick"
    stagger-list: "each child delayed by 40ms"
---

# yt-subtitle-maker v2.0 — Frontend Design Spec

This document is the **source of truth** for the v2.0 rewrite. It feeds two parallel work streams:

1. **Claude design** — generates visual mockups based on this spec.
2. **Backend rewrite (Claude Code)** — refactors `core/` and `api/` per the architecture below.

These two streams must produce compatible output, which is why this document defines:
- The full UX flow per screen
- The HTTP API contract (data shapes, event streams)
- The TypeScript and Python type signatures
- The visual token system (colors, typography, spacing, components)

---

## 0. Branch & Workflow

**Open a new branch named `v2.0`.** All v2.0 work happens on this branch. The `main` branch is preserved as a reference of the working pre-rewrite state.

```bash
git checkout -b v2.0
```

The existing `flutter_gui/`, `gui/`, `frontend-tauri/`, and `src-tauri/` (the empty stub) directories will be **deleted** on this branch. Their content lives in git history if needed.

---

## 1. Project Vision

A **desktop-first, mobile-portable** YouTube subtitle generator that:

1. Downloads YouTube audio
2. Tries YouTube auto-captions first (free, instant), falls back to Whisper if unavailable
3. Lets the user pick from 4 STT engines (openai-whisper, faster-whisper, WhisperX, insanely-fast-whisper) with educational tooltips
4. Translates segments via Google Gemini
5. Plays the result with MPV (desktop) or built-in player (V2 mobile)

**V1 scope (this rewrite):** Desktop-only via Tauri.
**V2 scope (future):** Same React/Tamagui codebase compiled for iOS/Android via Expo, connecting to the user's local backend through an ngrok tunnel. **No backend changes required for V2.**

---

## 2. Information Architecture

The app uses a **persistent left sidebar** (240px) on desktop, collapsing to a **bottom tab bar** on mobile. The sidebar contains 5 destinations:

| Item | Icon | Purpose |
|---|---|---|
| Generate | 🎬 | Main subtitle creation flow (default landing) |
| Library | 📚 | All downloaded files: videos, audio, SRT (unified browser) |
| History | 🕘 | Past processing sessions, can be reloaded into Generate |
| Settings | ⚙ | Configuration: backend URL, cookies, STT, translation, advanced |
| About | ⓘ | Version, links, credits |

A **frosted-glass topbar** (64px) sits above the main content, showing breadcrumb / page title on the left and global controls (notifications, settings shortcut, ⌘L logs toggle) on the right.

The **main content area** is a tinted dark surface (`{colors.bg-base}`) holding floating glass cards.

### Layout grid

- Sidebar: `240px` fixed
- Topbar: `64px` fixed
- Main content max-width: none (fills available); inner cards max ~`960px` centered for readability on wide screens
- Cards: `{rounded.lg}` (20px) corners, `{elevation.glass-mid}` surface

---

## 3. Screen Specifications

### 3.1 Init Screen (desktop only)

Shown once on first launch when the Whisper model isn't downloaded.

**State machine:**
1. `connecting` — Backend reachability check (5 retries, 2s apart)
2. `checking` — Backend reports if Whisper model exists locally
3. `picking-model` — User picks model size from a list (5 cards)
4. `downloading` — Progress bar with speed + ETA
5. `ready` — Auto-navigate to Generate

**Layout:**
- Centered glass card, max-width `480px`
- Animated mark/logo at top (Lottie or Rive)
- `{typography.display-md}` heading: "Setting up your studio"
- `{typography.body-md}` subtitle explaining the download
- Progress bar OR model-picker list (mutually exclusive based on state)

**Model picker entries (5 radio cards):**

| Model | Size | Description | Recommended |
|---|---|---|---|
| tiny | ~75MB | Fastest, lowest accuracy. Good for quick previews. | — |
| base | ~150MB | Fast, decent accuracy. ~1GB RAM. | — |
| small | ~500MB | Balanced. ~2GB RAM. | — |
| medium | ~1.5GB | Accurate, slower. ~5GB RAM. | — |
| **turbo** | ~1.5GB | Fast + accurate. ~6GB VRAM/RAM. | ⭐ Default |

After download completes, fade transition into Generate.

---

### 3.2 Generate (main flow)

The default landing screen. The flow is **single-page progressive disclosure**:

1. **Idle** — Just the URL input hero, all other cards collapsed/hidden
2. **Metadata loaded** — Video preview card appears (animated slide-up)
3. **Configured** — Settings card (collapsible) + Generate button
4. **Processing** — Glass card with waveform/Lottie + step indicator
5. **Done** — Result card with mini SRT preview + actions

**Card sequence (top to bottom):**

#### 3.2.1 URL Input (Hero)

- `{component.hero-card}` — full-width glass-mid surface
- `{typography.display-md}` headline: rotating between phrases like
  - "What are we transcribing today?"
  - "Drop a YouTube link to begin."
  - "Let's make some subtitles."
  - (Pick one and stick — rotation is optional polish, not required.)
- `{component.text-input}` URL field with paste icon (📋) + Load button (→)
- After URL is entered + valid → fetches metadata, transitions to next card with `{animation.presets.slide-up}`

**Validation:** Accept any youtube.com / youtu.be URL. Show inline error on invalid format.

#### 3.2.2 Video Preview Card

- `{component.glass-card}`
- Layout: thumbnail left (16:9, ~`192px` wide), text right
- Shows:
  - Original title in `{typography.title-lg}`
  - Channel + duration in `{typography.body-sm}` with `{colors.text-secondary}`
  - After translation: translated title in primary text, original demoted to secondary
- Replace cleanly when URL changes

#### 3.2.3 Configure Card (collapsible, default collapsed)

Header: `▾ Configure` clickable to expand/collapse with smooth height animation.

**Inside (when expanded):**

- **Subtitle Source** (radio group):
  - ● `Auto (recommended)` — Tries YT auto-caption first, falls back to Whisper
  - ○ `YouTube auto-captions only`
  - ○ `Whisper only`

- **Source Language** dropdown (Whisper detection language)
  - Options: Auto Detect / English / Chinese / Japanese / Korean / Spanish / French / German / Italian / Portuguese / Russian / Vietnamese / Thai / Indonesian / Malay / Hindi / Arabic
  - **Default: NOT "Auto"** — pick from `Settings > Default source language` or fall back to "English". This is part of the regression-prevention against bad language detection.

- **Translation toggle** + **Target Language** dropdown (when on)
  - When translation is on, a small `Using: Gemini` chip appears, clickable to override the translator for this run only (opens a popover with the same 3 options as Settings → Translation, pre-filled from current Settings defaults). Useful for "this video I want to use my local Gemma instead of cloud Gemini".

- **"Just download, no subtitles" toggle** — replaces the legacy Downloader tab; when on, hides Settings irrelevant to transcription and the Generate button label changes to "Download only".

- **▸ Advanced** sub-section (collapsible):
  - **STT Engine** picker (when "Whisper only" or "Auto + fallback" is selected; hidden if "YT only"):
    - ○ `openai-whisper` — Stable · Slow · Reference impl   ⓘ
    - ● `faster-whisper` — ⭐ Recommended · 4× faster · built-in VAD   ⓘ
    - ○ `WhisperX` — Most accurate timestamps · adds wav2vec2 alignment   ⓘ
    - ○ `insanely-fast-whisper` — GPU only · 30× faster on CUDA   ⓘ
    - The ⓘ tooltip text is in **§ 7. STT Engine Reference** below.
  - **Whisper model**: tiny / base / small / medium / **turbo** (default) / large-v3
  - **Device**: Auto / CPU / GPU
  - **VAD enabled** toggle (default ON when engine supports it)

#### 3.2.4 Generate Button

- `{component.button-primary}` full-width, height `56px`, `{rounded.md}`
- Label: "✨ Generate Subtitles" (or "Download only" when subtitle generation is off)
- Disabled when no URL loaded or while processing
- On press: scales 0.97, then triggers state change to Processing
- After completion: re-enables for re-runs

#### 3.2.5 Processing State

Replaces the Generate button with a **processing card**:

- `{component.glass-card}` full-width, taller (~`240px`)
- Centerpiece animation:
  - **Lottie waveform** OR **Rive scrubbing visualizer** (Claude design picks the exact asset)
  - The animation should reflect actual progress (loop slower at start, faster as percentage grows)
- Below animation:
  - `{typography.title-md}` status: "Transcribing with faster-whisper..." (live text)
  - Progress bar `{component.progress-bar}` showing percentage (or indeterminate barber-pole when unknown)
  - `{typography.body-sm}` substatus: "Step 2 / 4 · about 30s left"
- Below the card: **Step indicator** strip showing 4 pills:
  - ① ✓ Download
  - ② ◉ Transcribe (active = pulsing accent dot)
  - ③ ○ Translate (skipped if translation off)
  - ④ ○ Done

**Cancel button** in topright of the processing card (X icon). Aborts the backend request.

#### 3.2.6 Result Card (after processing succeeds)

- `{component.glass-card}` full-width
- Top row: ✓ checkmark + `{typography.title-lg}` "Done · 1m 23s" (elapsed time)
- **Mini SRT preview** — first 5 segments shown:
  ```
  00:00:01 → 00:00:04   Hey everyone, welcome back...
  00:00:04 → 00:00:08   今天我们来聊聊...
  ```
  Uses `{typography.timestamp}` for time codes and `{typography.body-sm}` for text.
- "View full SRT" link expands to show all (or opens in modal).
- **Action button row:**
  - `[▶ Play with MPV]` — desktop only; hidden if backend reports `mpv_available: false`
  - `[📁 Open folder]` — desktop only
  - `[⟳ Re-transcribe with…]` — opens a small picker for trying a different engine/model (e.g., re-run the same audio with faster-whisper instead of turbo)
  - `[💾 Download SRT]` — saves to user-chosen path (mobile primary action)

---

### 3.3 Library

A unified grid of all locally stored media + SRT files.

**Header bar:**
- Filter chips: `[All]` `[Video]` `[Audio]` `[SRT]`
- Search box (filters by filename / title)
- "Refresh" icon button (pulls latest from backend)

**Grid:**
- `4-up` at desktop, `3-up` at tablet, `2-up` at mobile
- Each card (`{component.media-card}`):
  - Thumbnail (16:9) with rounded `{rounded.md}` corners
  - Title `{typography.title-md}`
  - Tag pills `{component.badge-pill}`: file type, language, size
  - Hover: lift up `2px` with shadow

**Card actions:**
- Click → opens detail modal with all related files (video + audio + SRTs grouped by `video_id`)
- Right-click (desktop) / long-press (mobile) → action sheet:
  - Play with MPV / system player
  - Show in folder (desktop) / Share (mobile)
  - Delete

**Empty state:** Centered cream illustration + `{typography.body-md}` "No files yet. Generate some subtitles to get started!" + button to navigate back to Generate.

---

### 3.4 History

A chronological list of past processing sessions.

**Header bar:**
- Time filter: `[All time ▼]` / `[Today]` / `[This week]` / `[This month]`
- Sort: `[Recent ▼]` / `[Oldest]` / `[Title A-Z]`
- "Scan output folder" hidden in the `⋯` menu

**List:**
- Each row (`{component.history-card}`):
  - Thumbnail left (`80×48`)
  - Right column:
    - Translated title in `{typography.title-md}` (or original if no translation)
    - Original title in `{typography.body-sm}` `{colors.text-secondary}` (only when translated)
    - Tag pills: language, STT engine used, processed date
  - Right edge: `[▶ Play]` `[⟳ Reload]` `[⋯]` icon row
- Click row → loads into Generate (URL pre-filled, settings restored)
- Right-click / long-press → action sheet:
  - Load in Generate
  - Open file location
  - Open YouTube video
  - Play with MPV
  - ─────
  - Delete (red)

**Empty state:** "No history yet" + icon.

---

### 3.5 Settings

Sectioned form, each section is a `{component.glass-card}`.

**Sections (in order):**

#### General
- **Backend URL** — text input with `[Test]` button to verify reachability
  - Default: `http://127.0.0.1:8000`
  - Used for V2 ngrok scenarios
  - Show 🟢/🟡/🔴 status dot beside it after Test
- **Download folder** — path input with `[📁 Browse]` button (desktop only)

#### Cookies (YouTube)
- **Cookie source** dropdown: None / Chrome / Firefox / Edge / Opera / Brave
  - Beside "Firefox": badge `Recommended`
  - Beside Chrome/Edge/Brave/Opera: badge `⚠ may fail`
- **Browser profile** text input (visible when source ≠ None)
- **Cookies.txt fallback path** text input
- **Status indicator** — automated test, shows:
  - 🟢 `Working` — passed test download
  - 🟡 `Untested`
  - 🔴 `Failed: <reason>` — with explanation
- Conditional warning panel when Chrome/Edge/Brave/Opera selected (Chrome 127+ App-Bound Encryption advisory)

#### STT Engine (defaults, overridable per-job in Generate)
- **Default engine** dropdown with same 4 options + "Auto"
- **Default model** dropdown
- **Default device** dropdown
- **Default source language** dropdown — explicitly NOT "Auto" by default; **must be set**. Helper text: "Setting a default language prevents Whisper from misdetecting on intros/music."
- **Try YouTube auto-captions first** toggle (master switch for "Auto" mode)

#### Translation
The user picks a translation provider; the form below adapts to which one is selected.

- **Provider** segmented control (3 options):
  - ● **Gemini** (cloud, Google) — fast, accurate, needs API key + internet
  - ○ **Local AI (LM Studio / Ollama)** — runs on your own machine, private, free, slower
  - ○ **OpenAI-compatible** (real OpenAI, Groq, Together, etc.) — flexible, needs API key + internet

- **Default target language** dropdown (provider-agnostic)
- **Auto-translate title** toggle (replaces the manual button from Flutter version)

##### When `Gemini` selected
- **API key** input (masked with `[👁]` reveal) + `[Test]` button + status indicator
- **Model** dropdown: `gemini-2.5-flash-lite` (default) / `gemini-2.5-flash` / `gemini-2.0-flash` / etc.

##### When `Local AI` selected
- **Base URL** input — default `http://127.0.0.1:1234/v1` (LM Studio default)
  - Helper text: "LM Studio's default port is 1234. Ollama uses 11434 — change to `http://127.0.0.1:11434/v1` if you use Ollama."
- **Model name** input — user types the model identifier (e.g. `gemma-3-27b-it`, `qwen2.5-72b-instruct`, `llama-3.3-70b-instruct`)
  - Beside the field: `[Refresh]` button — calls `/api/translator/list-models` which queries the LM Studio endpoint's `/v1/models` and populates a dropdown of currently-loaded models. If the local server is unreachable, show error.
- **API key** input — optional, accepts `lm-studio` or any string for LM Studio (left blank works too)
- **`[Test connection]`** button — sends a tiny "translate hello to chinese" request and shows result + latency
- **Status indicator** — 🟢 working / 🟡 untested / 🔴 unreachable

###### Setup help (collapsible callout, expanded by default if status is 🟡 or 🔴)

> **First time using LM Studio?**
> 1. Download LM Studio from [lmstudio.ai](https://lmstudio.ai) and install
> 2. In LM Studio, go to **My Models** → search and download a translation-capable model. Recommended:
>    - `gemma-3-27b-it` (Google, balanced) — needs ~16 GB VRAM
>    - `qwen2.5-7b-instruct` (Alibaba, lightweight) — needs ~6 GB VRAM
>    - `llama-3.3-70b-instruct` (Meta, top quality) — needs ~40 GB VRAM
> 3. Click **Local Server** in LM Studio, load your model, click **Start Server**
> 4. Come back here, click **Test connection**, you should see 🟢
>
> Larger models = better translation but more memory needed. If you can't load a 27B model, drop to 7B.

##### When `OpenAI-compatible` selected
- **Base URL** input — default `https://api.openai.com/v1`. Common alternatives:
  - Groq: `https://api.groq.com/openai/v1`
  - Together: `https://api.together.xyz/v1`
  - Anthropic (via OpenAI-compat proxy): user enters proxy URL
- **API key** input (masked) + `[Test]`
- **Model name** input — e.g. `gpt-4o-mini`, `gpt-4o`, `llama-3.3-70b-versatile` (Groq), etc.

#### Advanced (collapsible)
- **MPV executable path** (optional, defaults to PATH lookup)
- **Whisper cache directory**
- **Backend output folder**
- **Logs verbosity** dropdown (Error / Warning / Info / Debug)
- **Enable FFmpeg 16kHz pre-resample** toggle (default ON, helps timestamp accuracy)
- **Reset to defaults** button (red, with confirm)

**Footer of Settings:**
- `[Save]` button (sticky bottom-right)
- Show "Saved ✓" toast on success

---

### 3.6 About

Small section.

- App version
- Backend version (fetched from `/api/version`)
- Links: GitHub, Documentation, Report issue
- Credits / acknowledgements
- License

---

### 3.7 Logs Drawer (overlay, ⌘L)

Triggered by ⌘L (Mac) / Ctrl+L (Windows) or topbar icon.

- Slides in from right edge, occupies right `400px` of viewport
- Glass-high surface
- Header: "Logs" title + filter dropdown (All / Errors / Warnings / Info / Debug) + clear button
- Body: monospace lines, `{typography.code}`, auto-scroll to bottom on new entries
- Each line: `[12:34:01] Fetching meta...` — time in muted color, message in primary
- Color-coded by level: error rows tinted red, warnings amber

---

## 4. Component Library

Define each component once here; reference by name throughout the spec.

| Component | Purpose | Key tokens |
|---|---|---|
| `{component.glass-card}` | Default content card | `{elevation.glass-mid}`, `{rounded.lg}`, padding `{spacing.lg}` |
| `{component.hero-card}` | Larger glass card on Generate top | `{elevation.glass-mid}`, `{rounded.xl}`, padding `{spacing.xl}` |
| `{component.button-primary}` | Main CTA | accent bg, `{rounded.md}`, height 56, `{typography.title-md}` |
| `{component.button-secondary}` | Secondary action | glass-low bg, hairline border, `{rounded.md}`, height 44 |
| `{component.button-ghost}` | Tertiary | transparent, hover glass-low |
| `{component.icon-button}` | 36×36 circle, icon only | glass-low |
| `{component.text-input}` | Standard text input | glass-low bg, `{rounded.md}`, height 44 |
| `{component.text-input-focused}` | Focus state | accent border, `{spacing.xxs}` accent ring |
| `{component.dropdown}` | Select | glass-low, downchevron icon |
| `{component.toggle}` | Switch | track 36×20, thumb 16, accent when on |
| `{component.checkbox}` | Checkbox | 18×18, `{rounded.xs}` |
| `{component.radio-card}` | Radio button styled as card | larger touchable, accent border when selected |
| `{component.progress-bar}` | Linear progress | track glass-low, fill accent gradient, height 6 |
| `{component.step-indicator}` | Pill row showing pipeline steps | each pill 32 height, active pill brighter |
| `{component.media-card}` | Library grid item | glass-mid, hover lift, thumb top + meta below |
| `{component.history-card}` | History list row | glass-mid, horizontal layout, action icons right |
| `{component.action-sheet}` | Bottom sheet on mobile / popover on desktop | glass-high |
| `{component.tooltip}` | Inline ⓘ explainer | glass-high, max-width 320, body-sm text |
| `{component.toast}` | Transient notification | bottom-center, glass-high, slide-up entrance |
| `{component.badge-pill}` | Tag label | glass-low, `{rounded.pill}`, `{typography.caption}` |
| `{component.badge-accent}` | "Recommended" / "New" tag | accent bg, `{typography.caption-uppercase}` |
| `{component.sidebar-item}` | Nav row | 44 height, `{rounded.md}`, accent left bar when active |
| `{component.topbar}` | Sticky top bar | `{elevation.glass-high}`, height 64 |

---

## 5. Animation Specifications

The app uses **Reanimated 3** + **Moti** for animations. All durations come from `{animation.duration.*}` and easings from `{animation.easing.*}`.

### Page transitions
- Sidebar nav change: cross-fade content area, `{animation.duration.normal}` `{animation.easing.standard}`
- New screen entry: child cards stagger in with `{animation.presets.stagger-list}`

### Card transitions
- New card appears: `{animation.presets.slide-up}` (translateY 16→0 + fade)
- Card collapses: height animation `{animation.duration.normal}`
- Card hover (desktop): `{animation.presets.card-hover}` (lift 2px + shadow up)

### Button interactions
- Press: `{animation.presets.press}` (scale 0.97)
- Hover (desktop): subtle brightness increase, no movement

### Processing animation
- Waveform/Lottie loops continuously; speed scales with progress (slow at start, faster nearing 100%)
- Step indicator pills: active pill has pulsing accent dot (`opacity 0.4 → 1.0`, 1s loop, ease-in-out)

### Glass shimmer (subtle, on idle Hero)
- Very gentle gradient sweep across the hero card every ~10s — barely noticeable but adds life

### Don't-overdo list
- ❌ Bouncy / overshoot springs everywhere — use spring easing only on press feedback and toast entrances
- ❌ Page-wide parallax
- ❌ Animated backgrounds (particle systems, etc.)
- ❌ Auto-rotating carousels

---

## 6. Data Models & API Contract

This is the **contract between frontend and backend**. Both teams must implement to these exact shapes.

### 6.1 TypeScript types (frontend)

```typescript
// Used in apps/desktop and apps/mobile
export interface VideoMetadata {
  ok: boolean;
  videoId?: string;
  titleOriginal?: string;
  titleTranslated?: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  channel?: string;
  error?: string;
}

export type TranslatorProvider = 'gemini' | 'local_openai' | 'openai';

export interface ProcessRequest {
  url: string;
  sttSource: 'auto' | 'yt_captions' | 'whisper';
  sttEngine?: 'openai-whisper' | 'faster-whisper' | 'whisperx' | 'insanely-fast-whisper';
  whisperModel: 'tiny' | 'base' | 'small' | 'medium' | 'turbo' | 'large-v3';
  whisperDevice: 'auto' | 'cpu' | 'gpu';
  vadEnabled: boolean;
  sourceLang: string;        // BCP-47, never 'auto' from UI
  enableTranslation: boolean;
  targetLang?: string;

  // Translator selection (default: 'gemini')
  translatorProvider?: TranslatorProvider;
  // Provider-specific overrides (fall back to AppConfig when omitted)
  translatorBaseUrl?: string;   // e.g. 'http://127.0.0.1:1234/v1' for LM Studio
  translatorModel?: string;     // e.g. 'gemini-2.5-flash-lite' or 'gemma-3-27b-it'
  translatorApiKey?: string;    // optional for local_openai

  downloadOnly?: boolean;       // skip transcription
}

export type ProcessEvent =
  | { status: 'starting'; message: string }
  | { status: 'downloading'; message: string; percent?: number; speed?: number; eta?: number }
  | { status: 'transcribing'; message: string; progress?: number; engine: string }
  | { status: 'translating'; message: string; progress?: number }
  | { status: 'done';
      videoId: string;
      originalSrtPath: string;
      translatedSrtPath?: string;
      audioPath?: string;
      durationMs: number;       // total processing time
      sttSourceUsed: 'yt_captions' | 'whisper';
      previewSegments: TranscriptionSegment[];   // first 5 for UI
    }
  | { status: 'error'; error: string; recoverable: boolean };

export interface TranscriptionSegment {
  id: number;
  start: number;     // seconds
  end: number;
  text: string;
  translated?: string;
}

export interface HistoryItem {
  videoId: string;
  url: string;
  titleOriginal: string;
  titleTranslated?: string;
  targetLang?: string;
  sttEngineUsed: string;       // for re-run reference
  subtitlePath?: string;
  audioPath?: string;
  videoPath?: string;
  thumbnailUrl?: string;
  createdAt: string;            // ISO
  processingDurationMs: number;
}

export interface AppConfig {
  backendUrl: string;
  downloadDir: string;
  outputDir: string;
  cookieBrowser: 'chrome' | 'firefox' | 'edge' | 'opera' | 'brave' | '';
  cookieProfile: string;
  cookiesTxtPath: string;
  defaultSttEngine: string;
  defaultWhisperModel: string;
  defaultWhisperDevice: string;
  defaultSourceLang: string;
  defaultTargetLang: string;
  ytCaptionsFirst: boolean;

  // Translation
  enableTranslation: boolean;
  autoTranslateTitle: boolean;
  translatorProvider: TranslatorProvider;     // default 'gemini'
  // Gemini-specific:
  geminiApiKey: string;
  geminiModel: string;
  // Local OpenAI / LM Studio specific:
  localOpenaiBaseUrl: string;     // default 'http://127.0.0.1:1234/v1'
  localOpenaiModel: string;        // user enters their loaded model (e.g. 'gemma-3-27b-it')
  localOpenaiApiKey: string;       // optional, mostly placeholder for LM Studio
  // OpenAI-compatible (real OpenAI, Together, Groq, etc.):
  openaiBaseUrl: string;           // default 'https://api.openai.com/v1'
  openaiApiKey: string;
  openaiModel: string;             // e.g. 'gpt-4o-mini'
  mpvPath: string;
  whisperCacheDir: string;
  ffmpegResample16k: boolean;
  logsVerbosity: 'error' | 'warning' | 'info' | 'debug';
}

export interface BackendCapabilities {
  mpvAvailable: boolean;
  cudaAvailable: boolean;
  installedSttEngines: string[];   // e.g. ['openai-whisper', 'faster-whisper']
  whisperModelsAvailable: string[];
  version: string;
}
```

### 6.2 HTTP endpoints

All endpoints prefixed with `{config.backendUrl}` (default `http://127.0.0.1:8000`).

| Method | Path | Purpose | Streams |
|---|---|---|---|
| GET | `/api/version` | Server version + capabilities | No |
| POST | `/api/metadata` | Fetch video info from URL | No |
| POST | `/api/process` | Run pipeline (download → STT → translate) | **Yes (NDJSON)** |
| POST | `/api/process/cancel` | Cancel an in-flight job | No |
| POST | `/api/translate-title` | Translate just the title | No |
| POST | `/api/translator/test` | Verify any translator (Gemini, LM Studio, OpenAI) | No |
| POST | `/api/translator/list-models` | List available models from a local OpenAI endpoint (LM Studio) | No |
| POST | `/api/test-cookies` | Try a small download to verify cookies | No |
| POST | `/api/download` | Download video/audio without subtitles | **Yes (NDJSON)** |
| GET | `/api/library` | List all stored media + SRT files | No |
| POST | `/api/library/delete` | Delete a video_id's files | No |
| POST | `/api/library/open-folder` | Open folder in OS file manager (desktop only) | No |
| GET | `/api/config` | Get current config | No |
| POST | `/api/config` | Update config (partial) | No |
| GET | `/api/dependencies` | Check Whisper model existence | No |
| POST | `/api/dependencies/install` | Download Whisper model | **Yes (NDJSON)** |

### 6.3 Streaming format (NDJSON)

For streaming endpoints, each line is a single `ProcessEvent` JSON object terminated by `\n`. Frontend parses incrementally; backend flushes after every event.

Example stream from `/api/process`:
```
{"status":"starting","message":"Fetching info..."}
{"status":"downloading","message":"Downloading audio...","percent":45.2,"speed":1234567}
{"status":"transcribing","message":"Step 1/3 chunks","progress":0.33,"engine":"faster-whisper"}
{"status":"transcribing","progress":0.66,"engine":"faster-whisper"}
{"status":"translating","progress":0.5}
{"status":"done","videoId":"abc123","originalSrtPath":"...","previewSegments":[...]}
```

### 6.4 Frontend `api-client` package

Located at `packages/api-client/`:

```typescript
// packages/api-client/src/index.ts
export class ApiClient {
  constructor(private baseUrl: string) {}

  async fetchMetadata(url: string): Promise<VideoMetadata> { /* ... */ }

  async *processVideo(req: ProcessRequest): AsyncIterable<ProcessEvent> {
    const response = await fetch(`${this.baseUrl}/api/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (line.trim()) yield JSON.parse(line);
      }
    }
  }

  // ... other methods
}
```

---

## 7. STT Engine Reference (used in tooltips and Settings)

This is the text shown to users on hover of each ⓘ icon. **Written for non-technical users** — jargon is explained inline.

### Quick glossary (referenced by all engines)

- **VRAM** = the dedicated memory on your graphics card (GPU). Whisper loads the model into VRAM; if you don't have enough, it falls back to RAM and runs much slower.
- **VAD** (Voice Activity Detection) = automatic skip of silent or non-speech parts of the audio. Without it, Whisper sometimes invents text in silent sections (the famous "thanks for watching" hallucination).
- **Quantization** = compressing the model so it uses less memory. Slight quality loss, big memory savings.
- **Word-level timestamps** = knowing exactly when each individual word starts/ends, instead of just full sentences.
- **Speaker diarization** = labeling who's speaking ("Person 1", "Person 2") in multi-person audio.

### Whisper model size reference (rule of thumb)

These numbers apply to the **base** `openai-whisper` engine. Other engines may use significantly less or slightly more — see the per-engine notes.

| Model | Disk | VRAM/RAM needed (FP16) | Relative speed | Quality |
|---|---|---|---|---|
| tiny | 39 MB | ~1 GB | very fast | low |
| base | 74 MB | ~1 GB | fast | OK |
| small | 244 MB | ~2 GB | medium | good |
| medium | 769 MB | ~5 GB | slow | high |
| **turbo** | 809 MB | ~6 GB | fast | high ⭐ |
| large-v3 | 1.5 GB | ~10 GB | slow | highest |

> **Don't have a GPU?** All engines fall back to CPU. Whisper runs ~10× slower on CPU than on a recent GPU, but it works. `faster-whisper` is the most CPU-friendly option.

---

### `openai-whisper`
The **original Python version** released by OpenAI. Stable, well-documented, but **not optimized for speed** — it runs the model as-is without any tricks to make it faster. Like a reference car: works correctly, just not built for performance.

- **Speed**: 1× (this is the baseline — every other engine is measured against this)
- **VRAM**: standard, no compression. Turbo needs ~6 GB.
- **Silent-section handling (VAD)**: ❌ none built in — can hallucinate phrases in quiet parts
- **Best for**: comparing against other engines, reproducing reference behavior exactly
- **Avoid if**: you care about speed or have noticed hallucinations on long videos

### `faster-whisper` ⭐ Recommended
**Same Whisper model, much faster.** Uses a special C++ inference engine called CTranslate2 under the hood. Output text is **identical** to openai-whisper (same model weights), but ~4× faster and uses about half the memory. Has **built-in VAD** — automatically skips silent sections, which fixes the "hallucination on silence" problem.

- **Speed**: 4× (works on both CPU and GPU)
- **VRAM**: ~50% less than openai-whisper. Turbo runs in ~3 GB instead of ~6 GB.
- **Silent-section handling (VAD)**: ✅ built-in (Silero VAD)
- **Optional**: int8 quantization (further halves memory, tiny quality drop)
- **Best for**: ~99% of users — the right default
- **Avoid if**: you specifically need to match openai-whisper output exactly for testing

### `WhisperX`
Built **on top of faster-whisper** (so it's already fast), and adds two extras:

1. **Word-level timestamps** — knows exactly when each word starts/ends. Useful for karaoke-style or precisely synced subtitles. Works by running a second AI model called `wav2vec2` to align Whisper's text against the audio waveform.
2. **Speaker diarization** — labels who's speaking ("Speaker 1: ..." / "Speaker 2: ...") in multi-person audio. Great for podcasts and interviews.

The trade-off: the second `wav2vec2` model needs roughly **+1 GB of VRAM** on top of whatever Whisper is using.

- **Speed**: ~3.5× (slightly slower than faster-whisper because of the alignment step)
- **VRAM**: faster-whisper's needs + ~1 GB for wav2vec2. Turbo total ≈ 4 GB.
- **Silent-section handling (VAD)**: ✅
- **Word-level timestamps**: ✅
- **Speaker diarization**: ✅ (optional)
- **Best for**: precise subtitle timing, podcasts, interviews
- **Avoid if**: you don't care about per-word timing — faster-whisper is simpler and faster

### `insanely-fast-whisper`
A version that's **only fast if you have a modern NVIDIA GPU** (RTX 30/40-series, A100, etc.). It uses a technique called Flash Attention 2 to make the GPU's matrix math more efficient — up to **30× faster** on the right hardware. On CPU it has no benefit and just runs like the slow original.

- **Speed**: up to 30× on a strong GPU; 1× (no improvement) on CPU
- **VRAM**: **higher than other engines** because Flash Attention trades memory for speed. Turbo needs ~10 GB VRAM.
- **Silent-section handling (VAD)**: ❌ not included
- **Best for**: power users with a strong NVIDIA GPU running long videos in batches
- **Avoid if**: you're on CPU, integrated graphics, or AMD/Apple Silicon — pick faster-whisper instead

---

### Side-by-side cheat sheet (for the tooltip dropdown)

| Engine | Speed | VRAM (turbo) | Has VAD? | Word timestamps | Recommended? |
|---|---|---|---|---|---|
| openai-whisper | 1× | ~6 GB | ❌ | no | reference only |
| **faster-whisper** | **4×** | **~3 GB** | ✅ | optional | ⭐ default |
| WhisperX | ~3.5× | ~4 GB | ✅ | ✅ + diarization | for precise timing |
| insanely-fast-whisper | up to 30× (GPU only) | ~10 GB | ❌ | no | for strong GPUs |

---

## 8. Backend Architecture (modularization)

The backend is reorganized into a clean two-layer structure.

### 8.1 `core/` — Pure logic (no FastAPI deps)

```
backend/core/
├── stt/
│   ├── __init__.py            # Provider registry
│   ├── base.py                # TranscriptionProvider Protocol + dataclasses
│   ├── whisper_local.py       # openai-whisper wrapper (V1)
│   ├── faster_whisper.py      # faster-whisper wrapper (V1.1)
│   ├── whisperx.py            # WhisperX wrapper (V1.1)
│   ├── insanely_fast.py       # insanely-fast-whisper wrapper (V1.1)
│   └── yt_captions.py         # yt-dlp --write-auto-sub
├── translator/
│   ├── __init__.py            # Provider registry (gemini / local_openai / openai)
│   ├── base.py                # TranslationProvider Protocol
│   ├── gemini.py              # Google Gemini API
│   └── openai_compat.py       # OpenAI-compatible: serves LM Studio, Ollama, OpenAI, Groq, Together — same shape
├── downloader/
│   ├── __init__.py
│   ├── youtube.py             # yt-dlp wrapper (refactored from audio_downloader.py)
│   └── cookies.py             # browser cookie selection + cookies.txt fallback
├── pipeline.py                # The orchestrator — picks STT source, chains stages
├── config.py
└── dependency_manager.py
```

#### `core/stt/base.py`

```python
from typing import Protocol, Callable
from dataclasses import dataclass

@dataclass
class TranscriptionSegment:
    id: int
    start: float
    end: float
    text: str

@dataclass
class TranscriptionResult:
    segments: list[TranscriptionSegment]
    language: str
    source: str           # 'whisper-local' | 'faster-whisper' | 'whisperx' | 'yt_captions' | etc.

class TranscriptionProvider(Protocol):
    name: str
    needs_audio: bool        # False for yt_captions

    def is_available(self, url: str | None = None) -> bool:
        """Whether this provider can handle the given input right now."""
        ...

    def transcribe(
        self,
        audio_path: str | None,
        url: str | None,
        language: str | None,
        progress: Callable[[float], None] | None = None,
    ) -> TranscriptionResult:
        ...
```

All four engine implementations + `yt_captions` satisfy this Protocol.

#### `core/translator/base.py`

```python
class TranslationProvider(Protocol):
    name: str

    def is_available(self) -> bool:
        """Quick reachability check — for local_openai, pings the base_url."""
        ...

    def list_models(self) -> list[str]:
        """Return available models. For Gemini, hardcoded list. For local_openai, GET /v1/models."""
        ...

    def translate_segments(
        self,
        segments: list[TranscriptionSegment],
        target_lang: str,
        progress: Callable[[float], None] | None = None,
    ) -> None:
        """Mutates segments in place, adding `.translated` field."""
        ...

    def translate_title(self, title: str, target_lang: str) -> str: ...
```

#### `core/translator/openai_compat.py` (covers LM Studio, Ollama, OpenAI, Groq, Together)

```python
from openai import OpenAI

class OpenAICompatTranslator:
    """
    Works with any OpenAI-compatible /v1/chat/completions endpoint.
    Handles LM Studio (port 1234), Ollama (port 11434 with /v1 suffix),
    OpenAI proper, Groq, Together AI, etc.
    """
    name = "openai_compat"

    def __init__(self, base_url: str, model: str, api_key: str = "not-needed"):
        # api_key can be empty/dummy for local servers
        self.client = OpenAI(base_url=base_url, api_key=api_key or "lm-studio")
        self.model = model

    def is_available(self) -> bool:
        try:
            self.client.models.list()
            return True
        except Exception:
            return False

    def list_models(self) -> list[str]:
        return [m.id for m in self.client.models.list().data]

    def translate_segments(self, segments, target_lang, progress=None):
        # Batch segments into chunks to fit context window
        # Send chunked prompt: "Translate these subtitle lines to {target_lang}, one per line, preserve order"
        # Parse response, attach to each segment.translated
        ...

    def translate_title(self, title: str, target_lang: str) -> str:
        resp = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": f"Translate this to {target_lang}, output only the translation: {title}"}],
            temperature=0.3,
        )
        return resp.choices[0].message.content.strip()
```

This single file handles all 3 user-facing options (`local_openai`, `openai`) — they only differ in `base_url` and `api_key`. Gemini gets its own file because it's a different SDK.

#### `core/pipeline.py`

```python
def run_pipeline(
    url: str,
    request: ProcessRequest,
    config: AppConfig,
    on_event: Callable[[dict], None],
) -> None:
    """The single entry point. Emits events via on_event callback."""
    on_event({"status": "starting", "message": "Fetching info..."})

    meta = fetch_metadata(url, ...)
    on_event({"status": "downloading", "message": "..."})

    # Pick STT provider based on request.sttSource
    if request.sttSource == "auto":
        provider = YtCaptionsProvider() if YtCaptionsProvider().is_available(url) \
                   else _make_whisper(request)
    elif request.sttSource == "yt_captions":
        provider = YtCaptionsProvider()
    else:
        provider = _make_whisper(request)

    audio_path = None
    if provider.needs_audio:
        audio_path, duration = download_audio(url, ...)

    on_event({"status": "transcribing", "engine": provider.name, "progress": None})
    result = provider.transcribe(
        audio_path, url, request.sourceLang,
        progress=lambda p: on_event({"status": "transcribing", "progress": p, "engine": provider.name})
    )

    if request.enableTranslation:
        on_event({"status": "translating", "progress": None})
        translator = _make_translator(request, config)
        translator.translate_segments(
            result.segments, request.targetLang,
            progress=lambda p: on_event({"status": "translating", "progress": p})
        )

# ... and the helper:

def _make_translator(request, config) -> TranslationProvider:
    """Pick translator based on request override or config default."""
    provider = request.translatorProvider or config.translatorProvider  # 'gemini' | 'local_openai' | 'openai'

    if provider == "gemini":
        from core.translator.gemini import GeminiTranslator
        return GeminiTranslator(
            api_key=request.translatorApiKey or config.geminiApiKey,
            model=request.translatorModel or config.geminiModel,
        )

    if provider == "local_openai":
        from core.translator.openai_compat import OpenAICompatTranslator
        return OpenAICompatTranslator(
            base_url=request.translatorBaseUrl or config.localOpenaiBaseUrl,
            model=request.translatorModel or config.localOpenaiModel,
            api_key=request.translatorApiKey or config.localOpenaiApiKey or "lm-studio",
        )

    if provider == "openai":
        from core.translator.openai_compat import OpenAICompatTranslator
        return OpenAICompatTranslator(
            base_url=request.translatorBaseUrl or config.openaiBaseUrl,
            model=request.translatorModel or config.openaiModel,
            api_key=request.translatorApiKey or config.openaiApiKey,
        )

    raise ValueError(f"Unknown translator provider: {provider}")

    # Write SRTs, return paths
    on_event({"status": "done", ...})
```

### 8.2 `api/` — FastAPI HTTP layer

```
backend/api/
├── __init__.py
├── main.py                # FastAPI app
├── routes/
│   ├── metadata.py
│   ├── process.py         # streaming, calls core.pipeline
│   ├── download.py
│   ├── library.py
│   ├── config.py
│   └── version.py
└── schemas.py             # Pydantic mirrors of TypeScript types
```

Each route is **thin** — purely translates HTTP to/from `core/` calls. No business logic in `api/`.

### 8.3 V1 backend regression fix (urgent, sequential before everything else)

The current v1.5 branch has uncommitted changes that broke transcription quality. **Before adding faster-whisper or any new engine**, fix the regression:

1. **Sanitize folder names harder**: the current regex `isalpha() or isdigit() or ' ' or '_'` lets Chinese characters through, but `isalpha()` for non-Latin chars combined with Windows path encoding can cause ffmpeg/yt-dlp to fail silently. Replace with `re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', title)[:100]` and ASCII-fall-back for path components.
2. **Fix stdout capture in threaded mode**: the streaming version wraps `transcribe_audio` in a thread but `StdoutCapture` swaps process-level `sys.stdout` — race conditions corrupt progress parsing. Replace with a queue-based logger or use Whisper's official progress callback (faster-whisper has one natively, eliminating this entire problem).
3. **Force language pinning at API level**: reject `language='auto'` in `ProcessRequest` validation. The frontend should always send a concrete language code.
4. **FFmpeg 16kHz pre-resample**: in `download_audio`, add a post-process step `ffmpeg -i in.m4a -ar 16000 -ac 1 out.wav` so Whisper gets exactly the sample rate it expects. (Optional toggle in Advanced settings.)

These four fixes likely resolve the A/B/C/D/E quality problems reported on v1.5 without needing to swap to faster-whisper.

### 8.4 V1.1 upgrade path

After V1 is stable:

1. Add `core/stt/faster_whisper.py` (~80 lines, Protocol-compliant)
2. Add it to the registry in `core/stt/__init__.py`
3. Add it as an option in Settings → Default STT Engine
4. **Default switch** from openai-whisper to faster-whisper (free upgrade for users)

The frontend Settings UI is already designed to expose all 4 engines; only the backend implementations are V1.1+ work.

---

## 9. Responsive Behavior (V1 desktop, designed mobile-aware)

### Breakpoints

| Name | Width | Sidebar | Card grids | Hero |
|---|---|---|---|---|
| Mobile | < 768px | Bottom tab bar (5 tabs, icons + label) | 1-up (Library), full-width rows (History) | Stacks; URL input full-width |
| Tablet | 768–1024px | Collapsed (icons only, 64px wide) | 2-up Library | Same as desktop |
| Desktop | 1024–1440px | Full 240px | 4-up Library, full History rows | 6-6 split (text left, preview right) — but for our app the hero is single-column, full-width |
| Wide | > 1440px | Full 240px | 4-up max | Centered, max-width 960px |

### Touch targets
- All buttons ≥ 44×44px on mobile
- Sidebar nav rows ≥ 44px tall
- Hover-only behaviors gracefully degrade on touch (no critical info hidden behind hover)

### Mobile-specific changes (V2)
- Logs drawer slides up from bottom instead of right
- Right-click menus → long-press action sheet
- "Open folder" / "Play with MPV" replaced with "Share SRT" / native player
- Init screen skipped (mobile uses cloud backend, no model download needed)

---

## 10. Accent Color Decision (for Claude design)

The visual system locks dark backgrounds, glass surfaces, Fraunces+Inter+JetBrains Mono fonts, and most spacing/sizing. **One key choice is left to Claude design**: the accent color.

The accent is used on:
- Primary CTA backgrounds
- Active sidebar item indicator
- Progress bar fill
- Focused input rings
- Selected radio/checkbox marks
- "Recommended" `{component.badge-accent}` badges

**Constraints:**
- Must be vibrant enough to read on `{colors.bg-base}` dark surface
- Must complement Fraunces serif (warm, organic accent better than cool/synthetic)
- Should not clash with YouTube thumbnail colors (which are inherently varied)
- Single accent only — no secondary brand color

**Suggested directions** (Claude design picks one or proposes alternative):
- (a) **Warm coral / amber** — `#ff8a65` / `#ffa726` — friendly, entertainment-feeling
- (b) **Soft lavender** — `#b794f6` — sophisticated, slightly futuristic
- (c) **Electric teal** — `#5eead4` — modern, contrasts well with thumbnail colors
- (d) **Sunset orange** — `#fb923c` — cinematic, evokes "playback"

The `{colors.accent}` and `{colors.accent-soft}` tokens in the YAML header are placeholders — Claude design fills them in.

---

## 11. Do's and Don'ts

### Do
- Anchor every screen on `{colors.bg-base}` dark surface with floating glass cards.
- Use Fraunces serif for display headlines (Generate Hero title, screen titles, result counts) — never bold (weight 400 only).
- Use Inter for all body, button, label text.
- Use JetBrains Mono for all timestamps, SRT content, log lines.
- Use `{spacing.section}` (64px) between major page sections.
- Animate card entrances with `{animation.presets.slide-up}` and stagger lists.
- Show real product chrome (actual SRT preview, actual thumbnails) — don't mock with placeholders.
- Make the accent color scarce — it's a flag, not a fill.

### Don't
- Don't use pure white text (`#ffffff`). Use `{colors.text-primary}` (`#f5f5f7`) for warmth.
- Don't add box shadows in addition to glass blur — pick one elevation system.
- Don't tween between backdrop-filter values (browsers stutter). Animate opacity / transform instead.
- Don't use Fraunces for body text or buttons. The serif is display-only.
- Don't put MPV-related buttons on mobile (V2). Use capability flags from `/api/version`.
- Don't show the backend port number to users in production UI. Hide behind Settings → Advanced.
- Don't auto-rotate hero phrases; pick one and commit.
- Don't add hover state styling beyond `{animation.presets.card-hover}` lift and accent brightening.

---

## 12. Claude Design Usage Guide

This spec is **large** by design — it must define the entire system in one place to keep parallel work streams in sync. To use it efficiently with Claude design:

### Recommended prompt batches (3 sessions)

**Session 1 — Foundation + main flow** (~40% of spec)
> "Using the visual tokens defined in `docs/superpowers/specs/2026-05-04-tamagui-rewrite-design.md` (sections 0-2, 4, 10-11), generate visual mockups for: (1) Init Screen, (2) Generate — idle state, (3) Generate — metadata loaded + configure expanded, (4) Generate — processing state with waveform animation moment, (5) Generate — result state with SRT preview. Pick the accent color from section 10 and lock it. Output Figma-style frames at desktop (1440×900) breakpoint."

**Session 2 — Library + History** (~25%)
> "Continuing from the locked design system (use the same accent color), generate mockups for: (1) Library — populated grid view, (2) Library — empty state, (3) Library — detail modal showing all files for a video, (4) History — list view, (5) History — empty state, (6) Action sheet (right-click / long-press menu)."

**Session 3 — Settings + chrome** (~25%)
> "Generate mockups for: (1) Settings — full page with all 5 sections expanded, (2) Settings — Cookies section in 'Working' state and 'Failed' state, (3) About page, (4) Logs drawer (right-edge overlay with sample log lines), (5) Sidebar in collapsed (icon-only) tablet state, (6) Mobile bottom-nav layout for V2 reference (one screen — Generate)."

### Things to NOT ask Claude design for
- Backend architecture diagrams (out of scope, in section 8)
- Code implementation (Claude Code does this)
- Animation video / motion specs (covered in section 5)
- Marketing pages, landing pages, app store screenshots (this is a tool, not a marketing site)

---

## 13. V1 → V2 Roadmap

### V1 (this rewrite)
- Desktop only, Tauri-wrapped Expo web build
- 4 STT engines surfaced in UI; only `openai-whisper` actually implemented (post-regression fix)
- YT auto-captions via `yt_captions` provider
- All 5 sidebar destinations functional
- **Goal**: working, beautiful desktop app with no transcription regressions

### V1.1 (immediately after V1)
- Add `faster-whisper` provider — make it default, recommend via UI badge
- Add VAD toggle, FFmpeg pre-resample (if not in V1)

### V1.2
- Add `WhisperX` and `insanely-fast-whisper` providers
- Add Groq Whisper API option

### V2 (mobile)
- Build `apps/mobile` Expo target for iOS + Android
- No backend changes — uses ngrok tunnel to user's desktop backend
- Hide MPV / Open Folder via capability flags
- Replace right-click with long-press → action sheet
- Add "Backend URL" onboarding screen on first mobile launch
- Add native sharing (share SRT to Files / Mail / etc.)

### V3 (optional, only if there's actual user demand)
- Built-in subtitle editor (timeline + text editing)
- Speaker diarization UI (driven by WhisperX output)
- Batch processing queue
- AI summary of video content (Gemini-generated)
- Channel subscription / auto-process new uploads
- Cloud-hosted backend mode (Modal/Replicate) for users who don't want local install

---

## 14. Implementation Constraints (binding)

These are non-negotiable — they protect against painting V2 into a corner:

1. **Backend URL must be configurable** in Settings. Default `http://127.0.0.1:8000`.
2. **API client must support `Authorization` header** even though V1 sends none. Reserve the slot.
3. **No local file paths in API responses** for `/api/library` — use `download_url` (HTTP) instead. (V2 mobile cannot consume `C:\Users\...` paths.)
4. **MPV / Open Folder buttons hidden** unless `BackendCapabilities.mpvAvailable === true`.
5. **All segment timestamps use `seconds: float`** internally — never strings, never milliseconds. Convert to SRT format at write time only.
6. **No `language: 'auto'` reaches the API.** Frontend always sends a concrete code.
7. **`video_id` is the canonical identifier**, not file paths. All cross-referencing in History / Library uses `video_id`.

---

## 15. Glossary

- **`video_id`**: 11-char YouTube video identifier (e.g., `dQw4w9WgXcQ`)
- **STT**: Speech-to-Text. Used interchangeably with "transcription" in this doc.
- **VAD**: Voice Activity Detection. Skips silent segments to prevent Whisper hallucinations.
- **VRAM**: Memory on a graphics card. Whisper / wav2vec2 / Gemma all load into VRAM if available.
- **Quantization**: Compressing AI model weights to use less memory at small quality cost.
- **NDJSON**: Newline-Delimited JSON. The streaming format for `/api/process`.
- **Glass card**: Surface with `backdrop-filter: blur()` and translucent background.
- **Capability flag**: Boolean in `/api/version` response telling frontend whether a feature is available.
- **LM Studio**: A free desktop app ([lmstudio.ai](https://lmstudio.ai)) that runs LLMs locally on your machine and exposes them via an OpenAI-compatible HTTP API on port 1234. Used in this app as the **Local AI** translator option.
- **Ollama**: Similar to LM Studio (open-source, command-line). Runs on port 11434, also OpenAI-compatible. Same code path as LM Studio in this app.
- **OpenAI-compatible API**: Any HTTP API that mimics OpenAI's `/v1/chat/completions` endpoint shape. LM Studio, Ollama, Groq, Together, Anthropic-via-proxy all expose this — letting one client library cover them all.

---

*End of design spec. Total length covers visual system, 6 screens, component library, animation specs, full TS+Python data contracts, backend architecture, STT engine reference, responsive rules, do/don't list, Claude design usage guide, and V1→V3 roadmap.*

*Ready for Claude design (visual mockups) and Claude Code (backend modularization + frontend implementation).*
