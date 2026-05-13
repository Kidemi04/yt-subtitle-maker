---
target: Generate screen (apps/desktop/app/index.tsx) — post P0/P1/P2/P3 fixes
total_score: 28
p0_count: 1
p1_count: 2
timestamp: 2026-05-13T12-39-52Z
slug: apps-desktop-app-index-tsx
---
# Re-critique: Generate screen (`apps/desktop/app/index.tsx`)

After P0 / P1 / P2 / P3 fixes from the prior critique snapshot. Score moved **26 → 28**.

## Anti-Patterns Verdict

**LLM review.** Clean of hard bans. The two violations from the prior snapshot are resolved:

- The **always-on accent glow** is gone. `ButtonPrimary.tsx` now ships a `glow` prop with three levels (`rest` = 0.35, `ready` = 0.40, `none` = no shadow). On the Generate flow: Load wears `rest`, Generate wears `ready`, Play with MPV wears `none`. Stress hierarchy restored. (One borderline observation: the idle Hero now hums both with the 10s shimmer and the resting Load-button glow at the same time, which makes the screen feel busier at idle than the spec implies. Worth watching.)
- The **Toast border-left stripe** is fixed. `Toast.tsx:74` now uses a 1px full-edge tinted border plus an 8px tone-filled status dot. The sole sanctioned exception (sidebar active state, 3px left bar inside `accentSoft`) is intact.

No `#ffffff`, no Fraunces in body / buttons, no `background-clip: text`, no drop shadows on glass cards, no other >1px colored border stripes.

**Deterministic scan.** `npx impeccable@2.1.9 detect --json --fast` over the same Generate-screen + UI-package surface: **`[]` — zero findings.** Regex limits unchanged; the LLM review is doing the load-bearing detection.

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 4 | Phase pills + waveform + ProgressBar + ETA. Unchanged, strong. |
| 2 | Match system / real world | 3 | Engine token (`openai-whisper`) still leaks in Result subtitle and Processing status — see P0 below. |
| 3 | User control & freedom | 3 | Cancel ✕ wired; "New transcription" is now behind ⋯ (one click further than before). |
| 4 | Consistency & standards | 3 | Two Whisper-model arrays (`index.tsx:194`, `NewTranscribeModal.tsx:39`) drift on the ⭐ default badge. |
| 5 | Error prevention | 3 | Installed-model probe still works. No URL validation before Load. |
| 6 | Recognition over recall | 2 | Configure summary now reads "Auto · EN" (fixed!) but the engine token still leaks elsewhere. |
| 7 | Flexibility & efficiency | 3 | No Enter-to-Generate after metadata. No recently-used URLs. ⌘L still nice. |
| 8 | Aesthetic & minimalist | 3 | Result card is calmer post-distill. Configure expanded still shows ~10 controls. |
| 9 | Error recovery | 2 | `errorMessage` lands in a tiny card with "Try again". Still no category, no log link. |
| 10 | Help & documentation | 2 | One VAD tooltip. No "what's a Whisper model?" affordance for first-timers. |
| **Total** | | **28 / 40** | Up from 26. Wins on consistency (border-stripe ban), aesthetic (glow restraint, Result distill), and recognition (summary line). |

## Cognitive Load

Fail count: **3 / 8 — moderate** (same count as before, different items now).

- ❌ #4 — Configure auto-expands on desktop, so first sight after Load is ~10 controls. The fix from the prior run flipped this from "discoverable-only" to "loud-by-default." Borderline; reviewer would prefer a split: language visible, Translation + Advanced collapsed.
- ❌ #5 — "Advanced" is collapsed, but the unfolded Configure surface above it still carries Subtitle source + Source/Target Lang + Translate toggle + provider segmented + Test + Download-only.
- ❌ #8 — Result has DisplaySm hero title + Done meta + 5 SRT rows + Play + segmented control + ⋯ + (when present) MPV status banner. Primary action is *findable* but competes with the translated-title Fraunces line for visual weight.

Passes: #1 primary action, #2 ≤4 idle options, #3 URL input loudest, #6 processing oriented, #7 Generate CTA unambiguous.

## Spec Drift (post-fix)

- **Wins.** Toast tone is now compliant (`Toast.tsx:74`). ButtonPrimary glow obeys the Glow-As-Affordance Rule. Idle Hero shimmer is implemented at `HeroCard.tsx:55-79` with reduced-motion gating. Configure summary line no longer leaks "faster-whisper". Result card distillation reduces the action region from ~8 controls to 3 (Play + sub-picker + ⋯) and leads with the translated title at hero size.
- **Drift — Engine token still leaks at two surfaces.** `index.tsx:810` renders `Transcribing with ${sttEngine}…` and `index.tsx:908` renders `Whisper · ${sttEngine}`. Both produce `openai-whisper` / `faster-whisper` kebab-case to the user. The prior P3 fix only touched the Configure summary; the other two call sites were missed.
- **Drift — Auto-captions success pill still missing.** Spec Screen 3 calls for a `success`-toned pill on the Video preview card when YouTube has captions. Backend doesn't expose `autoCaptionsAvailable` on `VideoMetadata` yet, so the frontend has nothing to gate on. Backend probe + types change required.
- **Drift — Translated title eyebrow.** The distill drops the spec's `accentSoft` box and `CaptionUpper` "TRANSLATED TITLE" eyebrow; the title now sits in plain Fraunces 22 (`index.tsx:881-886`). This is an intentional editorial call (the typeface IS the eyebrow); not a regression, but the spec contract no longer matches.
- **Drift — SRT preview structure.** Spec calls for a 2-column grid (timestamp col | text col). Implementation stacks Timestamp above text (`index.tsx:935-944`). Less scannable.
- **Drift — Re-transcribe is now 3 layers deep.** Re-transcribe lives at ⋯ overflow → ActionSheet → Modal. Power-user core action consequently requires three clicks (was two before the distill). Trade-off of the Result-card distillation; arguably too aggressive.
- **Drift — Step indicator pulse dot.** `StepPill` renders the active dot as `accentSoft` fill with `accentDim` border. Spec wants a brighter, pulsing accent dot. The current fill reads as a soft puck. Out of this critique's scope but worth a follow-up.

## Persona Red Flags

**Curious viewer.**
- After paste → Load, Configure auto-expands and immediately exposes nine controls (Subtitle source + Source/Target Lang + Translate toggle + provider segmented + Test + Download-only + Advanced ▸).
- Error path is a single line of text + "Try again". A failed metadata fetch leaves the user with no idea whether to fix the URL, check VPN, or try later.
- "Using Gemini · configure credentials" link appears even when Gemini is the default and nothing's wrong.

**Power user.**
- Two Whisper-model arrays drift (`index.tsx:194` vs `NewTranscribeModal.tsx:39`). `turbo` shows ⭐ in one, not the other.
- Re-transcribe lives behind ⋯ → ActionSheet → Modal. Three clicks to change an engine.
- No keyboard shortcut for Generate (Enter only submits URL via `onSubmitEditing`).

## What's Working

- **Result card editorial moment.** Leading with Fraunces translated title (`index.tsx:884`) is the most cinematic moment in the app and matches the screening-room brief better than the spec contract does.
- **ButtonPrimary glow tier.** `glow="none"` on the success-state Play (`index.tsx:957`) is exactly the Glow-As-Affordance restraint DESIGN.md §4 calls for.
- **Idle flow placeholders + shimmer.** The 35%-opacity rows + 10s decorative shimmer telegraph the flow without filler decoration. On-brief.

## Priority Issues (carried over + new)

**[P0] Engine token still leaks in Processing + Result copy.**
What: `index.tsx:810` renders `Transcribing with ${sttEngine}…`; `index.tsx:908` renders `Whisper · ${sttEngine}`. Both produce `openai-whisper` to the user.
Why it matters: violates PRODUCT.md voice rule ("speaks to viewers, not to operators"); the prior P3 fix only patched the summary line.
Fix: introduce an `ENGINE_LABELS: Record<SttEngine, string>` const and replace `${sttEngine}` at both call sites.
Suggested command: **`/impeccable clarify`** (small, scoped).

**[P1] Configure auto-expand drowns the first-time viewer.**
What: `configureOpen` defaults true on desktop, exposing ~10 controls within 250ms of Load.
Why it matters: collides with PRODUCT.md "Power-user controls are reachable, never primary." The prior fix solved one problem (discoverable-only language picker) and introduced another (control wall).
Fix: split the Configure body. Keep Source/Target Lang visible by default (the actual customization decision). Tuck Translation toggle + provider + Test + Download-only + Advanced behind a single inner chevron. Mobile stays fully collapsed.
Suggested command: **`/impeccable distill`** on Configure.

**[P1] Auto-captions pill missing (backend-blocked).**
What: Spec Screen 3 calls for a `success`-toned "Auto-captions available" pill on the Video preview card.
Why it matters: the user can't tell whether their video has captions before kicking off a Whisper run that might take minutes. Justifies the "Auto (recommended)" radio default.
Fix: add `autoCaptionsAvailable: bool` to backend's `VideoMetadata`. Probe `yt_dlp.extract_info(...).get("subtitles")` server-side. Frontend renders `BadgePill tone="success"` when true.
Suggested command: **`/impeccable shape`** (cross-stack, needs spec).

**[P2] Error state is uninformative.**
What: errorMessage shown in a glass card with only "Try again".
Why it matters: Heuristic #9 hard fail. Backend errors (mpv-not-found, missing model, cookie expiry) need actionable next steps.
Fix: categorize errors → show category badge + remediation hint + "Open logs (⌘L)" link.
Suggested command: **`/impeccable harden`**.

**[P3] Re-transcribe is now 3 layers deep.**
What: ⋯ overflow → ActionSheet → Modal (power-user core action, three clicks).
Why it matters: the distill in this round was aggressive enough that a frequently-used action is now harder to reach than it was before.
Fix: re-promote "Re-transcribe with…" to a visible secondary button alongside Play; keep Open folder / Download SRT / New transcription in the overflow.
Suggested command: **`/impeccable layout`** on the Result action row.

## Questions to Consider

1. **If Fraunces is "earn every serif moment," is the idle hero question ("What are we transcribing today?") earning Fraunces, or coasting?** It runs every session, on every paste. Should the hero copy degrade (Fraunces → Inter) after first use, with the serif moment moving to the Result title only?
2. **Why does the Result card show both `translatedSrtPath` AND a `subtitle preference` segmented control inline?** Would folding sub-preference into the Play button (split-button: "Play with MPV ▾") collapse two thoughts into one?
3. **The waveform animates decoratively during processing.** What if the active-bar count scaled with transcription progress (bar height = current confidence) instead of being purely decorative? Right now it's animation-for-the-sake-of-animation, which DESIGN.md's "no decoration" voice quietly disapproves of.
