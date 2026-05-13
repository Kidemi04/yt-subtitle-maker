---
target: Generate screen (apps/desktop/app/index.tsx) — post R2 fixes
total_score: 30
p0_count: 1
p1_count: 1
timestamp: 2026-05-13T12-49-24Z
slug: apps-desktop-app-index-tsx
---
# R3 critique: Generate screen (`apps/desktop/app/index.tsx`)

After R2 fixes (Configure split, Re-transcribe re-promotion, SRT preview grid, StepPill brightening, Whisper-model array consolidation). Score moved **28 → 30**. Trend across runs: 26 → 28 → 30.

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 4 | Phases, %, step pills, MPV ok/error inline. Strong. |
| 2 | Match system / real world | 3 | "VAD" label and the `videoId` pill leak operator vocabulary to a viewer surface. |
| 3 | User control & freedom | 3 | Cancel ✕ exists; no undo on `New transcription` (destructive). |
| 4 | Consistency & standards | 4 | Tokens flow through `glassRecipes`; Whisper-model array is now one constant. |
| 5 | Error prevention | 3 | URL is `disabled` until non-empty, but no shape validation. |
| 6 | Recognition over recall | 3 | "Auto-captions available" pill from spec still missing on preview card. |
| 7 | Flexibility & efficiency | 2 | No Cmd+Enter to submit; URL paste requires click. ⌘L is the only shortcut. |
| 8 | Aesthetic & minimalist | 4 | Hero is calm; idle placeholders telegraph the flow without noise. |
| 9 | Error recovery | 2 | Errors render as a plain card with "Try again" — no diagnostic hint, no retry-with-different-engine. |
| 10 | Help & documentation | 2 | Only the VAD tooltip exists; engines, source, model sizes have no in-context help. |
| **Total** | | **30 / 40** | Up from 28. Gains in consistency (constants consolidation), aesthetic (Configure split), cognitive load. |

## Anti-Patterns Verdict

**LLM review.** **No banned-list violations found.** Verified:
- `#ffffff` — never used in Generate; the one occurrence in `settings.tsx:865` is a legitimate hex-input placeholder string, not visual output.
- Fraunces — confined to `DisplayMd`/`DisplaySm` at `index.tsx:407` (hero) and `:878`,`:882` (Result translated title). Never in buttons, body, labels.
- gradient text — no `backgroundClip: "text"` anywhere in `apps/desktop` or `packages/ui`.
- drop-shadows on cards — `GlassCard.tsx:48-50` gates `boxShadow` to `glassHigh` only.
- thick colored side borders — none (Toast border-stripe was fixed in R1; sidebar active state remains the sanctioned exception).
- Modal-as-first-thought — Configure expands inline. Modals are reserved for Re-transcribe and the overflow ActionSheet on Result.
- Glow-As-Affordance — `Load` (rest), `Generate` (ready), `Play with MPV` (none). One loud CTA per state. Compliant.

**Deterministic scan.** `npx impeccable@2.1.9 detect --json --fast` over the Generate surface + UI package: **`[]` — zero findings.** Consistent with the LLM review.

## Cognitive Load

Fail count: **1 / 8 — low** (down from 3/8 in R2 and 3/8 in R1).

- ✅ #1 primary action obvious within 3s
- ✅ #2 ≤4 visible options (idle hero + 3 inert placeholders)
- ✅ #3 URL input is loudest on first load
- ✅ #4 Configure hidden until metadata
- ✅ #5 Advanced behind a chevron (the R2 split lands the "spirit" — Translation+advanced collapsed; the visible Configure surface is 3 radios + 2 dropdowns)
- ✅ #6 Processing keeps the user oriented
- ❌ #7 "Generate Subtitles" CTA sits *outside* the Configure card and reads as a fifth flow item rather than the commit slot of Configure
- ✅ #8 Play with MPV is the only accent button in Result; sub-picker and overflow are quieter

## Spec Drift

**Idle.**
- URL input height 52 + Load button height 52: match (`index.tsx:421`, `:432`).
- Spec calls for helper chips below the URL input (file types, paste hint) — **missing**.
- Shimmer sweep on HeroCard when no preview / not loading: matches spec intent (`HeroCard.tsx:55-79`).

**Metadata loaded.**
- Spec preview card: thumb / title / channel+duration / file-type pill / language pill / success "Auto-captions available" pill. Implementation: thumb / title / channel+duration / `videoId` neutral pill / optional "translated title ready" accent pill. **Drift**: language pill, file-type pill, "Auto-captions available" pill all absent. `videoId` as a pill is engineer-language.

**Processing.**
- Waveform: 36 bars + accent gradient on center bars: matches (`index.tsx:127-186`).
- Step pill row: spec is 4 fixed pills; implementation conditionally hides Translate when translation is off. Sensible behavior, drifts from the mock.
- Spec sub-status `"Step 2 / 4 · about 30s left"`: **missing**. Only `phaseMessage` (free text). ETA and step counter absent.

**Result.**
- Spec leads with green check + "Done · 1m 23s" `titleLg`. Implementation inverts: translated title in Fraunces leads, Done meta demoted to BodySm. **Principled drift** ("the earned moment"); strictly off-spec but better than the mock.
- Spec action row is 4 visible 44h buttons (Play / Open folder / Re-transcribe / Download SRT). Implementation: Play (primary) + sub-picker + Re-transcribe (secondary) + ⋯ overflow → Open folder / Download SRT / New transcription. Cleaner, principled drift.
- Spec SRT preview is a 2-column grid (timestamp | text): now matches (`index.tsx:911-944`).
- Spec "Translated title box" (`accentSoft` bg + `accentDim` border + `captionUpper` label): **removed** in favor of the bare Fraunces hero. Largest legitimate drift; intentional editorial choice.

## Persona Red Flags

**Curious viewer.**
- "VAD (Voice Activity Detection)" appears in plain text inside Configure (`index.tsx:743`). The tooltip explains it, but the label itself is opaque.
- "Whisper model" / "Device" sit in Translation & advanced — discoverable but their labels assume the viewer knows what they are.
- The Generate button label flips to "Download only" with a `Sparkles` icon when `downloadOnly` is on. Subtle icon/label mismatch.

**Power user.**
- No Cmd+Enter to submit URL. URL `onSubmitEditing` covers Enter only.
- No auto-detect of YouTube URL on paste.
- `NewTranscribeModal` duplicates engine/model probing (`NewTranscribeModal.tsx:71-98`) instead of inheriting Generate's state. Power users hit `/api/version` twice per session.

## What's Working

- **HeroCard `shimmer` + FlowPlaceholder rows.** Quiet, principled idle state. Tells the user the shape of the flow without showing content. Reduced-motion handled.
- **Three-tier `glow` prop on ButtonPrimary.** The Glow-As-Affordance Rule operationalized. Three CTAs across Generate, one glow level each. Disciplined.
- **Result editorial inversion.** Translated title in Fraunces, Done meta demoted, small green check disc. Earns the serif moment the brand asks for. Better than the spec mock.

## Priority Issues (next round)

**[P0] Video preview card under-informs.**
What: `videoId` is rendered as a neutral pill (`index.tsx:482`); the spec's language pill + file-type pill + success "Auto-captions available" pill are missing.
Why it matters: `videoId` is engineer-language and breaks the brand voice rule. The "Auto-captions available" pill is the single most important signal justifying the "Auto (recommended)" radio default — without it, the recommendation has no evidence.
Fix: replace the `videoId` pill with a language pill (from `metadata.language` once backend exposes it), add a file-type pill (`mp4`/`audio`), add `tone="success"` pill when `metadata.hasAutoCaptions === true` (also backend-blocked).
Suggested command: **`/impeccable shape`** (cross-stack — backend needs to expose `language` and `hasAutoCaptions`).

**[P1] Errors lack actionable recovery.**
What: `status === "error"` renders a plain GlassCard with raw message + "Try again" (`index.tsx:1052-1062`).
Why it matters: heuristic #9 hard fail. When a transcribe fails on `openai-whisper`, the viewer has no path forward except retry with the same settings.
Fix: detect engine/model keywords in `errorMessage`; offer a `Try a different engine →` ButtonSecondary that opens Configure; add an "Open logs (⌘L)" link; promote the panel header to `tone="error"` BadgePill + a 2-line plain-English recovery hint.
Suggested command: **`/impeccable harden`**.

**[P2] Processing card missing ETA + step counter.**
What: Spec sub-status `"Step 2 / 4 · about 30s left"` is absent. Only `phaseMessage` shown.
Why it matters: transcription is a 30s-to-3min wait. Without an ETA the user wonders if it's hung; the step counter is also the only place that confirms whether Translate is in the plan.
Fix: derive `step N of M` from the StepPill array; render `phaseMessage · Step N / M` as the sub-status. ETA needs backend support; the step counter is a small inline change.
Suggested command: **`/impeccable clarify`**.

**[P3] Generate button is structurally orphaned.**
What: the `Generate Subtitles` CTA is a sibling of the Configure GlassCard rather than inside its footer (`index.tsx:768-781`). Reads as a fifth flow item.
Why it matters: visual disconnect between "I'm configuring" and "I commit". The eye scans Hero → Preview → Configure (heavy) → … → Generate.
Fix: dock the CTA inside Configure as a sticky footer when Configure is expanded. Alternatively, drop it just below the preview when Configure is collapsed.
Suggested command: **`/impeccable layout`**.

## Questions to Consider

1. **The Result card replaces the spec's "Translated title box" with a bare Fraunces DisplaySm.** The serif moment is earned, but how does the viewer distinguish "translated title" from "video title" on a Result for a video whose original title was already in the target language?
2. **`videoId` is rendered as a viewer-facing BadgePill** (`index.tsx:482`). PRODUCT.md says "speaks to viewers, not operators." Is the videoId pill ever useful, or is it residual debug furniture that should move to overflow?
3. **The "Translation & advanced" inner chevron now groups translation toggle + provider + Test + download-only + Whisper model + Device + VAD under one disclosure.** That's a 4-5 row reveal. Is the right model two chevrons (Translation / Engine), or has this card grown past the threshold where progressive disclosure stops helping?
