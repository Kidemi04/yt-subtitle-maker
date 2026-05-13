---
target: Generate screen (apps/desktop/app/index.tsx)
total_score: 26
p0_count: 1
p1_count: 3
timestamp: 2026-05-13T12-21-23Z
slug: apps-desktop-app-index-tsx
---
# Critique: Generate screen (`apps/desktop/app/index.tsx`)

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 4 | StepPills + ProgressBar + phaseMessage; mpv launch echoes ok/error back to the UI. |
| 2 | Match system / real world | 3 | "What are we transcribing today?" reads viewer-y; "Re-transcribe with…" is still operator-y. |
| 3 | User control & freedom | 3 | Cancel (✕) + AbortController wired; no Undo after `reset()`; no escape from `loading-meta`. |
| 4 | Consistency & standards | 2 | Action-row buttons use `BodySm` inside `ButtonSecondary` while spec calls for Title SM (Inter 13 / 600). |
| 5 | Error prevention | 3 | Installed-model filter prevents 422; Toggle disables target lang when translation is off. Solid. |
| 6 | Recognition over recall | 2 | Collapsed Configure summary leaks raw engine token (`openai-whisper`) to a non-technical viewer (`index.tsx:519`). |
| 7 | Flexibility & efficiency | 3 | ⌘L logs, per-job translator switch, segmented sub-picker. No keyboard shortcut for Generate. |
| 8 | Aesthetic & minimalist | 2 | Glow on all three primaries; Done card stacks 8 controls under the heading. |
| 9 | Error recovery | 2 | "Try again" wipes the URL via `reset()`. No "keep URL, retry" path. |
| 10 | Help & documentation | 2 | VAD is the only Advanced control with a tooltip. No first-run / empty-state coaching. |
| **Total** | | **26 / 40** | Mid-tier. Spec is solid; drift lives in restraint and Result-state density. |

## Anti-Patterns Verdict

**LLM review.** Mostly clean. Two real violations:

- **`Toast.tsx:73-74` ships `borderLeftWidth={3}` with `$success` / `$error` colors.** DESIGN.md §6 explicitly bans `border-left > 1px` as a colored-stripe accent (the sidebar active state is the one sanctioned exception). Toast doesn't appear on Generate today, but it ships in the same UI surface and will leak the anti-pattern into any screen that triggers a toast.
- **Always-on accent glow on every primary CTA.** `ButtonPrimary.tsx:49` bakes `boxShadow: "0 4px 20px rgba(251,146,60,0.4)"` into every primary. DESIGN.md §4 defines two glow strengths (0.35 idle, 0.40 ready) and the **Glow-As-Affordance Rule** ("If three buttons on a screen wear a glow, none of them do"). Right now Load (`index.tsx:432`), Generate Subtitles (`:764`), and Play with MPV (`:953`) all wear the louder 0.40 glow. The visual stress system flattens.

No `#ffffff` text, no gradient text, no Fraunces in body/buttons, no drop shadows on glass cards. Modal usage is reasonable, not first-reach.

**Deterministic scan.** `npx impeccable@2.1.9 detect --json --fast` over the Generate route, both modals, and the full `packages/ui/src/components` directory: **`[]` — zero findings.** The CLI's regex layer doesn't catch JSX-prop styling (`borderLeftWidth={3}`, gradient strings inside template literals), so this is "clean for what the detector can see," not a clean bill of health. The LLM review caught the two real violations the detector cannot.

**Visual overlays.** Skipped (no live browser target; Tauri desktop shell isn't a URL the live panel can attach to without `pnpm web` running).

## Overall Impression

The bones are good. The state machine reads as a tool, not a workflow: idle → metadata → processing → done flows through one Zustand store with proper abort handling, and the dropdowns probe the backend on mount so the form only offers what will actually run. Where the screen drifts from spec, it drifts toward **uniformity** — every primary CTA wears the same loud glow, every screen state lands at the same visual stress level, and the Result card stacks eight controls equally underneath the headline. The single biggest opportunity is to reintroduce the **stress hierarchy** the spec implies: idle is quiet, ready is loud, done is calm.

## What's Working

- **Honest state machine.** `state/generate.ts` + the AbortController handed to the Cancel button at `index.tsx:783` give the four states the integrity the spec asks for. No fake progress, no stuck UI.
- **Server-truth dropdowns.** `installedWhisperModels` (`index.tsx:267-292`) and `installedSttEngines` (`:238-254`) probe the backend so the user can't pick something that will 422 mid-pipeline. Aligns directly with PRODUCT.md's principle "the viewer is the customer."
- **Tabular numbers on `Timestamp`** (`Typography.tsx:175-184`). `font-feature-settings: 'tnum'` is set on the mono timestamp role, so the SRT preview at `index.tsx:922` will column-align without the eye fighting the type.

## Priority Issues

**[P0] Generate-button glow is global, not earned.**
What: every `ButtonPrimary` instance carries `0 4px 20px rgba(251,146,60,0.4)` permanently (`ButtonPrimary.tsx:49`).
Why it matters: violates the Glow-As-Affordance rule, flattens stress signal across idle/ready/done, and drifts toward generic SaaS-CTA aesthetic — PRODUCT.md anti-reference #1.
Fix: replace the hard-coded shadow with a `glow="rest" | "ready" | "none"` prop. Default to `"rest"` (0.35). Only the Generate CTA on Frame 03 uses `"ready"` (0.40). Play-with-MPV on the Done state uses `"none"` — success speaks quietly.
Suggested command: **`/impeccable quieter`** on `ButtonPrimary` + Result card primaries.

**[P1] Result card is overloaded; primary action loses dominance.**
What: subtitle segmented picker → ButtonPrimary → mpv-status pill → 4 secondaries → 1 ghost = 8 controls under the Done heading (`index.tsx:870–970`).
Why it matters: "Play with MPV" no longer reads as the next thing to press. The screen's most emotional moment (success) lands with a UI committee instead of a single act.
Fix: collapse Open folder / Re-transcribe / Download SRT into an overflow `⋯` IconButton or an inline "More actions" disclosure. Move the sub-picker into a chevron next to Play ("Play with translated subtitles ▾"). Lead the card with the translated title at hero size.
Suggested command: **`/impeccable distill`** on the Result state.

**[P1] "Configure" lands collapsed.**
What: metadata loads, the Configure card appears at `configureOpen: false` (`index.tsx:231`); user must click a chevron to see source/target language.
Why it matters: forces a discoverable-only interaction for the universal customisation step ("what language do you want subs in?"). For the first-time viewer this reads as withheld.
Fix: default `configureOpen` to `true` on the `gtSm` breakpoint; let mobile collapse. The chevron remains so a user can fold it.
Suggested command: **`/impeccable shape`** on the metadata-loaded state.

**[P1] Missing idle shimmer + auto-captions success pill.**
What: idle hero is static (no 10s opacity shimmer); video-preview card omits the `success`-tinted "Auto-captions available" pill from Frame 03.
Why it matters: idle screen reads dead under the hero; metadata card omits the success cue that justifies the "Auto (recommended)" radio default. Two missing pieces of breathing/feedback.
Fix: add an opacity-only shimmer overlay on `HeroCard` (10s loop, opacity ≤0.02, gate on `prefers-reduced-motion`); render `BadgePill tone="success"` when `metadata.autoCaptionsAvailable === true`.
Suggested command: **`/impeccable delight`** for the shimmer; tiny inline edit for the badge.

**[P2] `Toast.tsx` `border-left: 3px` violates the one-stripe ban.**
What: `Toast.tsx:73-74` uses a 3px colored left border to encode tone (success / error / etc.).
Why it matters: explicitly banned in DESIGN.md §6 Don'ts — the sidebar active state is the sole sanctioned exception. Will surface the anti-pattern on any toast the app shows.
Fix: swap to a full-edge `borderColor` at 1px in tone-soft, plus a 6px tone-filled status dot leading the message. Tone stays readable; the stripe is gone.
Suggested command: **`/impeccable critique`** focused on `Toast.tsx` (or just patch inline).

**[P3] Collapsed Configure summary leaks engine token.**
What: `index.tsx:516-519` renders `openai-whisper` / `faster-whisper` literal in the summary line a viewer reads first.
Why it matters: confuses a non-technical viewer with implementation detail.
Fix: map the engine value back to the radio label ("Auto" / "YouTube only" / "Whisper only") before printing.
Suggested command: **`/impeccable clarify`** on Generate's summary copy.

## Persona Red Flags

**Curious Viewer (PRODUCT.md primary user).**
- Lands on Generate, pastes a URL, sees Configure appear **collapsed** with a cryptic line "Auto + faster-whisper · EN → ZH". They didn't ask for `faster-whisper` and don't know what it is.
- On Result, the **segmented sub-picker** ("Translated / Original / None") competes with "Play with MPV" for attention. Most viewers will never realise the picker exists; the obvious behaviour (translated subs on) is correct, but the picker shouts before the play button.
- Sidebar wordmark prints "v2.0 · alpha" — an operator self-flag a viewer didn't ask for. Reads as "this might be broken."

**Power User.**
- Engine picker is silently single-option. Backend only ships `openai-whisper` today, but the spec promises four engine rows with descriptions and ⓘ tooltips. The Advanced section drops the row UI entirely (`index.tsx:702-755` is model + device + VAD only).
- VAD is the only Advanced control with a tooltip. Model and Device get no explanation; "turbo · 1.5 GB" tells them the size but not why to pick it over `medium`.
- Translator test result reads "Reachable" / "unreachable" with no model echo and no latency. A power user wants "Gemini 1.5 Pro · 240ms" — they got "ok."

## Minor / Spec drift

- **Hero card radius** `xl` (28px): matches (`HeroCard.tsx:16`).
- **URL input focus ring** 2px accent + 3px accentSoft: matches (`TextInput.tsx:42-51`).
- **URL input height 52** on Screen 2: matches (`index.tsx:425`); base `TextInput` height is 44.
- **Waveform "12 active center bars"**: implementation uses `distFromCenter < 6` which selects 11 indices (off-by-one; perceptually fine).
- **"TRANSLATED TITLE" box** (`accentSoft` bg + `accentDim` border + `captionUpper` eyebrow + `titleMd 600` translated + `bodySm textSecondary` original): matches (`index.tsx:885-901`).
- **Action-row 8px gap, MPV height 44**: `index.tsx:953` ships MPV as a full `ButtonPrimary` at height 56, not 44; the row is also split across a `YStack` + `XStack` rather than a single 8px-gap row.
- **Sidebar "alpha" wordmark**: `_layout.tsx` prints `v2.0 · alpha` next to the brand — operator detail in a viewer surface.
- **`Topbar` title at `TitleLg fontSize={20}`** (`_layout.tsx:171`): Inter 600, not Fraunces. Spec-aligned.

## Questions to Consider

1. **Does this screen need a "Configure" card at all on first run?** What if the only visible control on idle is target-language, and everything else (subtitle source, engine, model, device, VAD, translation toggle) hides behind a single `⋯ More options` row? The viewer-persona currently reads through three cards before pressing one button.
2. **The "TRANSLATED TITLE" box is the one earned editorial moment on this screen.** Why is it ranked equal-weight with the SRT preview and 8 buttons below it? Could the Result state lead with the translated title at hero size and demote SRT preview to a `View first segments →` link?
3. **If the spec's glow strength carries meaning (0.35 idle, 0.40 ready), what's the meaning of the same glow on `Play with MPV` after the run is done?** Is Play really the same stress level as Generate, or should success pull the glow off entirely — let Done speak quietly?
