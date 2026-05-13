---
target: Generate screen (apps/desktop/app/index.tsx) — post R3 fixes
total_score: 33
p0_count: 0
p1_count: 2
timestamp: 2026-05-13T12-58-48Z
slug: apps-desktop-app-index-tsx
---
# R4 critique: Generate screen (`apps/desktop/app/index.tsx`)

After R3 fixes (error recovery hardening, step counter, Generate CTA dock, videoId pill removal, icon coherence, ⌘Enter). Score moved **30 → 33**. Trend across runs: 26 → 28 → 30 → 33.

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | System status visibility | 4 | phaseMessage + step counter + ProgressBar + waveform overcommunicate state. Strong. |
| 2 | Match real world | 3 | `yt_captions` slug leaks if user opens Re-transcribe (`NewTranscribeModal.tsx:122`). |
| 3 | User control & freedom | 4 | Cancel ✕, ESC, ⌘L all wired; abort propagates cleanly through store. |
| 4 | Consistency & standards | 3 | ButtonGhost wraps Caption inside Configure (line 749); inconsistent with adjacent BodySm row labels. |
| 5 | Error prevention | 3 | Installed-models filter prevents 422; URL still unvalidated client-side. |
| 6 | Recognition over recall | 3 | Configure summary works; "Translation & advanced" lumps two concerns — user has to remember it holds VAD/device. |
| 7 | Flexibility / efficiency | 4 | ⌘Enter, ⌘L, segmented sub-picker, per-job translator override. Strong power-user surface. |
| 8 | Aesthetic / minimalist | 3 | Idle is calm; expanded Configure with Advanced opened still lands at ~11 controls. |
| 9 | Error recovery | 4 | Six error categories, contextual fix buttons, URL/metadata preserved via `dismissError`. |
| 10 | Help & docs | 2 | Single VAD tooltip; no inline help for engine slugs or "Local AI". |
| **Total** | | **33 / 40** | Up from 30. Wins on error recovery (+2), user control (+1), flexibility (+2). Outperforms the typical 20–32 band. |

## Anti-Patterns Verdict

**LLM review.** **No violations found.** Verified explicitly:
- `#ffffff` — never in product surfaces (one occurrence in `settings.tsx:865` is a legitimate placeholder string in a hex-input field).
- Fraunces — confined to Display roles; buttons and body use Inter.
- gradient text — no `background-clip: text` anywhere.
- drop-shadows on cards — only `glassHigh` carries one, by recipe.
- thick colored side borders — 1px hairlines only; the 3px sidebar accent bar is the sanctioned exception.
- Glow-As-Affordance — three levels (`rest` / `ready` / `none`); `Play with MPV` in Done state uses `none`; the error state's Try again uses `none`. Respects the rule.
- modal-as-first-thought — modals are reserved for Re-transcribe / Re-translate. Inline expansion is the norm.

**Deterministic scan.** `[]` — zero findings. Consistent with the LLM review.

## Cognitive Load

Fail count: **1 / 8 — low** (held steady from R3; the failing item shifted).

- ✅ #1 Primary action obvious in 3s
- ✅ #2 ≤4 visible options on idle
- ✅ #3 URL input loudest on first load
- ✅ #4 Configure hidden until metadata
- ❌ #5 "Translation & advanced" is mislabeled. The inner chevron contains Whisper model / Device / VAD (genuinely advanced) and Translation toggle / provider / Test / Download-only (the user's primary intent). Hiding Translation behind "advanced" buries the most-likely-toggled option.
- ✅ #6 Error and processing states orient cleanly
- ✅ #7 Generate CTA copy + icon now agree on both branches (Sparkles + "Generate Subtitles" / Download + "Download only")
- ✅ #8 Play with MPV unmistakable

## Spec Drift

- **Idle hero copy** is informationally thin: `"Drop a YouTube link to get started."` (`index.tsx:504`). Acceptable, but the body line could carry more weight.
- **Hero URL input height 52** matches spec (`index.tsx:516,527`).
- **Helper chips below the URL input** spec'd at Screen 2 are still **missing**. No language/file-type/format chips beneath the URL row.
- **Video preview** shows `BadgePill tone="accent"` "translated title ready" only. Spec calls for `tone="success"` "Auto-captions available" pill — backend-blocked (`metadata.hasAutoCaptions` not yet exposed).
- **CTA dock in Configure** (`index.tsx:862-879`) — opinionated improvement over spec's bottom-card layout. Flagged as intentional drift.
- **"Translation & advanced" single chevron** (`index.tsx:705`) collapses two spec sections. The R2 fix that solved "Configure too loud" introduced this trade-off.
- **Engine picker missing on Generate.** Spec Screen 3 calls for 4 engine radios inside Advanced. Generate auto-selects the first installed engine (`index.tsx:307-323`). Power users can't override on the main screen — only via Re-transcribe after the fact.
- **Processing waveform** matches spec (36 bars).
- **Processing card cancel ✕** is `size={32}`; spec calls for 28×28. Minor.
- **Result Done meta layout** intentionally drifts — translated title leads in Fraunces, Done meta is a quiet sub-line. Earned editorial moment.

## Persona Red Flags

**Curious viewer.**
- "Whisper" appears as an unexplained term in the source-radio descriptions (`index.tsx:644,654`). No inline hint about what it is or why "YouTube-only" is "free + instant".
- "VAD (Voice Activity Detection)" (`index.tsx:837`) is jargon. The tooltip helps, but the label itself is operator language.
- "Local AI" in the translator SegmentedControl (`index.tsx:81`) is opaque — no hint that this means a self-hosted Llama/Ollama endpoint.

**Power user.**
- **No engine picker on Generate.** They're forced into Re-transcribe modal after the fact to try `whisperx` or `insanely-fast-whisper`. Spec called for explicit user choice on the main screen.
- **⌘Enter shortcut undiscoverable.** Wired but no UI hint (no keycap next to Generate, no tooltip).

## What's Working

- **Error state hardening** (`index.tsx:1172-1262`). Six error categories, viewer-readable hints, primary "Try again" with preserved URL/metadata, contextual fix buttons that auto-open the right Configure section, Open logs (⌘L), Start over. The R4 reviewer called it "the best moment on the screen" and "genuinely thoughtful recovery design."
- **Glow ladder.** Three explicit levels honor the Glow-As-Affordance Rule precisely. Generate = ready, Play (Done state) = none, error retry = none. Stress hierarchy reads correctly.
- **Result card editorial moment.** Leading with `DisplaySm` Fraunces translated title and demoting Done meta to a quiet line earns the serif voice PRODUCT.md asks for.

## Priority Issues

**[P1] "Translation & advanced" chevron lumps unrelated concerns.**
What: `index.tsx:705` collapses Translation (provider, target lang, test) with Advanced (model, device, VAD) under one chevron labeled "Translation & advanced."
Why it matters: Translation is the user's primary intent — hiding it behind "advanced" buries the most-likely-toggled option. The R2 split solved one problem (Configure too loud) and introduced this one. Cognitive load fail #5 is now this single mislabel.
Fix: split into two chevrons (Translation / Advanced), OR keep Translation toggle + provider always-visible above the Advanced chevron. Mobile remains fully collapsed via the outer chevron.
Suggested command: **`/impeccable distill`** on Configure body.

**[P1] Engine picker missing on Generate.**
What: Spec Screen 3 calls for 4 engine radio cards inside Advanced with `faster-whisper` highlighted. Generate auto-selects `installedSttEngines[0]` with no user override.
Why it matters: Power users can't try alternatives without finishing a job and using Re-transcribe modal. Persistent spec drift across all four critique runs.
Fix: add an engine radio block at the top of Advanced, gated to installed engines. Pre-select `faster-whisper` when present per spec.
Suggested command: **`/impeccable shape`** (component design call).

**[P2] Operator slugs leak in NewTranscribeModal.**
What: `NewTranscribeModal.tsx:119,122` shows raw engine slugs (`"openai-whisper"`, `"yt_captions"`) as Dropdown labels. The `ENGINE_LABELS` map exists in `index.tsx:71` but isn't reused.
Why it matters: viewer-language was fixed on the main Generate surface in R1; the same kebab-case leak persists in the Re-transcribe modal.
Fix: export `ENGINE_LABELS` from `apps/desktop/src/constants.ts` (or a new `apps/desktop/src/labels.ts`); import in both index.tsx and NewTranscribeModal.tsx.
Suggested command: **`/impeccable clarify`**.

**[P2] Helper chips below URL input missing.**
What: Spec Screen 2 calls for pill chips below the URL input on idle (file types, format hints). Idle hero shows the input + button + 3 inert flow placeholders only.
Why it matters: hero feels thin on first load; the chips set expectations about output formats before paste.
Fix: add 3 BadgePill rows below the URL input ("Audio · SRT · MPV" or similar).
Suggested command: **`/impeccable typeset`**.

**[P3] ⌘Enter shortcut undiscoverable.**
What: ⌘Enter / Ctrl+Enter wired in R3 (`index.tsx:480-494`), but no UI hint.
Why it matters: power-user feature with zero discovery. Heuristic #7 (Flexibility) reads as a hidden gem.
Fix: render a `Caption` next to the Generate button label: `"⌘ + ↵"` on Mac, `"Ctrl + ↵"` on Win/Linux. Use the platform-detection pattern from `_layout.tsx:366`.
Suggested command: **`/impeccable onboard`** (or trivial inline edit).

## Questions to Consider

1. **Why does Generate need a Configure card at all?** A viewer pastes a URL and wants subtitles in their language. Auto + EN → ZH (or a one-line "Translate to ___" selector) covers 90% of cases. What would the screen feel like if Configure were a `ButtonGhost "Adjust defaults →"` link opening a side-sheet, and the default flow were paste-URL → target-language dropdown → Generate?
2. **The Fraunces Done title is gorgeous editorial — but is the user looking at it for 0.3 seconds before clicking Play?** The success card is the moment of completion; the user's eye is already on the action row. Is the screening-room moment the wrong place to put a serif moment, or right because it IS the brand's earned moment?
3. **Two parallel system-status affordances compete during processing** (waveform + ProgressBar + step pills + status text + sub-status counter). Is one of these doing nothing — and if so, which one would the screening-room metaphor sacrifice first?
