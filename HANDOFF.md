# Design-pass handoff — redo on a `v2.1` base

A previous session ran a five-round impeccable design pass on `v2.2-Claude-Opus`. That branch was based off **`v2.0`**, not **`v2.1`**, which we only discovered at the end. The two diverge by **~115 commits** including a complete Settings rewrite (phases 4a–4e), the all-in-one Tauri-supervised launcher implementation, named translator profiles, an engine-driven Transcription tab, and more. So the per-screen edits on `v2.2-Claude-Opus` don't apply cleanly against `v2.1`.

This doc is the handoff: cherry-pick the safe stuff, then redo the per-screen passes against v2.1's real files. The strategic + visual context (`PRODUCT.md`, `DESIGN.md`, critique snapshots) is reusable as-is.

---

## How to start

```bash
# 1. Make sure you're on v2.1, freshly pulled.
git fetch origin
git checkout v2.1
git pull

# 2. New branch off v2.1.
git checkout -b v2.2-redesign-on-v2.1

# 3. Bring the strategic docs over (safe, all new files).
git checkout origin/v2.2-Claude-Opus -- PRODUCT.md DESIGN.md CLAUDE.md .impeccable/

# 4. Bring HANDOFF.md too if you want it on the new branch (optional).
git checkout origin/v2.2-Claude-Opus -- HANDOFF.md

# 5. Verify the strategic docs apply, then commit them as a first commit
#    on the new branch:
git add PRODUCT.md DESIGN.md CLAUDE.md .impeccable/ HANDOFF.md
git commit -m "docs(design): seed strategic + visual context from v2.0 experiment"
```

Then work through the per-screen recipes below. Type-check between steps:
- `pnpm -F desktop typecheck`
- `pnpm -F @yt-subtitle-maker/ui typecheck`

---

## What's safe to take as-is

These are either new files or low-risk component-level changes. Cherry-pick or `git checkout origin/v2.2-Claude-Opus -- <path>`, then read each file against v2.1's current version before keeping.

| Path | What it is | Risk |
|---|---|---|
| `PRODUCT.md` | Strategic doc — "The Screening Room" North Star, anti-references, principles | None (new file) |
| `DESIGN.md` | Stitch DESIGN.md visual system (colors / typography / elevation / components / do's & don'ts) | None |
| `.impeccable/design.json` | Sidecar — tonal ramps, motion tokens, breakpoints, component snippets | None |
| `.impeccable/critique/*.md` | Four iterative Generate-screen critiques + verification critiques for each other screen | None |
| `CLAUDE.md` | Pointer to PRODUCT/DESIGN/handoff for non-impeccable agents | Verify v2.1 doesn't already have one |
| `apps/desktop/src/constants.ts` | `ENGINE_LABELS`, `TRANSLATOR_LABELS`, `humanEngine()`, `humanTranslator()`, `platformModKey()`, `WHISPER_MODELS`, `WHISPER_DEVICES`, `LANGUAGES` | Verify v2.1 doesn't have a constants file; if it does, merge |
| `packages/ui/src/components/ConfirmDialog.tsx` | New destructive-confirm modal (replaces `window.confirm()`) | None |
| `packages/ui/src/components/MaskedInput.tsx` | API-key input with per-field show/hide state | None |
| `packages/ui/src/components/BadgePill.tsx` | Adds `font: "body" \| "mono"` prop | Low — verify against v2.1 |
| `packages/ui/src/components/ButtonPrimary.tsx` | Adds `glow: "rest" \| "ready" \| "none"` prop (default `rest`) | Low |
| `packages/ui/src/components/HeroCard.tsx` | Adds `shimmer` prop + `prefers-reduced-motion` gate | Low |
| `packages/ui/src/components/StepPill.tsx` | Brightens active dot to solid `$accent` (was `$accentSoft` puck) | Low |
| `packages/ui/src/components/Toast.tsx` | Removes banned 3px `borderLeft` stripe; uses full border + tone dot | Low |
| `packages/ui/src/components/keyframes.ts` | Adds `yt-ui-shimmer` keyframe | Low |
| `packages/ui/src/index.ts` | Exports for `ConfirmDialog` + `MaskedInput` | Medium — v2.1 likely has new exports; merge carefully |

---

## What MUST be redone against v2.1's actual files

Heavily divergent. Read v2.1's current code first, then apply the design changes manually.

### `apps/desktop/app/settings.tsx` — LANDMINE
v2.1 has a **completely rewritten** Settings: two-pane tabs layout with sub-tab rail (`refactor(settings): two-pane layout`), search box across all settings (`feat(settings): search box`), autosave with `✓ saved` pill (no more Save/Discard footer — `feat(settings): replace Save/Discard footer with autosave`), named translator profiles in `TranslationTab.tsx` (`feat(settings): rewrite TranslationTab with named provider profile list`), engine-driven `TranscriptionTab.tsx` (`feat(settings): TranscriptionTab rewrite — SourceModeControl + EnginePicker`), `ArmedField` pattern, `MaskedInput`-shaped API key fields, native Browse pickers, etc.

**Do not touch the file that exists on `v2.2-Claude-Opus` — it's the old single-card layout.**

Design-pass changes to re-apply on v2.1 (adapt to the tabs architecture):
- Wire `MaskedInput` for API-key fields in `TranslationTab`'s provider forms — replace the existing `TextInput + secureTextEntry + Eye toggle` pattern with `<MaskedInput>`.
- Replace any remaining `window.confirm()` calls with `<ConfirmDialog>`.
- Fraunces `DisplayMd` for the page title (one earned serif moment); section headings = `TitleMd` (Inter 15/600). Verify this isn't already the case.
- Drop any decorative `⚠` emoji in advisory copy — the warning color + tone callout container already encode meaning.
- The autosave architecture means Save glow tier is moot; verify there's no leftover banner / pill that competes with the `✓ saved` indicator.

Reviewer baseline before R5: 23/40. Adapt rather than copy.

### `apps/desktop/app/index.tsx` (Generate)
Divergent on v2.1: translator-profile work (`c116d66 feat(generate): align with Phase 4d Settings`), Configure-panel-mirrors-Settings treatment (`2a291ee feat(generate): Configure panel mirrors Settings`), mpv multi-track support (`86d5012 feat(mpv)`), preferred-sub ordering fix (`ecd4109 fix(mpv)`).

Changes to re-apply:
1. **Glow ladder** — `ButtonPrimary glow="ready"` on Generate when metadata loaded; `glow="none"` on Play with MPV (Done state); default `rest` everywhere else.
2. **Result-card editorial inversion** — Translated title in Fraunces `DisplaySm` leads; Done meta demoted to `BodySm` with a small 28px `success`-tinted check disc to the left. (Reviewers across multiple rounds called this "the best moment on the screen" — earns the Fraunces voice.)
3. **Error-state hardening** — categorize `errorMessage` into 6 buckets (network / youtube / cookies / engine / translator / generic) via a `categorizeError()` helper; show a viewer-readable hint + the raw error in a `rgba(255,90,95,0.06)` callout box + an action row: `Try again` (primary `glow="none"`) + (conditional) `Configure differently →` + (conditional) `Open cookie settings →` + `Open logs (⌘L)` ghost + `Start over` ghost. The retry path needs a new `dismissError()` store action (see below).
4. **Step counter** — derive `step N of M` from the active step-pill array (4 steps if translation enabled, 3 if not). Render as a `BodySm` sub-status beneath the `TitleMd` phase line.
5. **CTA dock** — move the Generate `ButtonPrimary` from a sibling slot to **inside** the Configure GlassCard as its commit slot. Stays visible even when Configure is collapsed. Gate same as before: `!isProcessing && !isDone`.
6. **Cmd+Enter** — window-level `keydown` listener that fires `onGenerate` on `Enter + (metaKey || ctrlKey)` when `canGenerate` is true. Render `${platformModKey()} + ↵` as a faded `Caption` (color `rgba(245,245,247,0.55)`) next to the CTA label.
7. **Configure split** — source radios + lang dropdowns ALWAYS visible. Translation toggle + provider segmented + Test + Download-only ALWAYS visible. Only `Advanced ▸` chevron (Whisper model + Device + VAD) collapsed. Default Configure open on desktop (`viewportWidth >= 768`) using `useWindowDimensions()` from `react-native` (NOT Tamagui's `useMedia()` — `gtSm` is not configured in this project).
8. **HeroCard shimmer** on idle (`!showVideoPreview && status !== "loading-meta"`). Reduced-motion-safe.
9. **SRT preview** as 2-col grid: `XStack` with 88px fixed-width `Timestamp` column + flex text column.
10. **Drop the `videoId` BadgePill** from the metadata preview card — operator-language leak. Keep only the conditional `translated title ready` accent pill.
11. **Generate CTA icon coherence** — `Download` icon when `downloadOnly` is true, `Sparkles` otherwise. Label flips to "Download only" / "Generate Subtitles".

Score trend on the old branch: 26 → 28 → 30 → 33.

### `apps/desktop/src/state/generate.ts`
Added `dismissError()` action:
```ts
dismissError() {
  const { metadata } = get();
  set({
    status: metadata?.ok ? "meta-loaded" : "idle",
    errorMessage: undefined,
    phase: undefined,
    phaseMessage: undefined,
    phaseProgress: undefined,
    result: undefined,
    abort: undefined,
  });
}
```
Should apply cleanly unless the store was significantly rewritten on v2.1.

### `apps/desktop/src/components/VideoDetailModal.tsx`
- Modal `width=640` (was 720; spec Screen 8 = 640).
- TranslateRow primary affordance: `accentSoft` bg + `accentDim` border + accent play icon (was uniform `surfaceGlass`).
- Engine + translator slug humanization via `humanEngine()` / `humanTranslator()` from `apps/desktop/src/constants.ts`. Replaces local helpers if they exist.
- "from {t.id}" section group label → `from · {humanEngine(t.engine)} · {t.model} · {t.language}`.
- All three `window.confirm()` calls replaced with a single `<ConfirmDialog>` driven by a `pendingDelete: { kind: "video" | "transcript" | "translation"; id?: string } | null` state. One ConfirmDialog mount at the bottom of the JSX.

### `apps/desktop/src/components/NewTranscribeModal.tsx`
- Use shared `humanEngine` from constants for engine dropdown labels.
- ButtonPrimary Run: `glow="ready"` when form valid + not running/done, `glow="none"` otherwise.

### `apps/desktop/src/components/NewTranslationModal.tsx`
- Source transcript dropdown shows `{humanEngine(t.engine)} · {t.model} · {t.language} · {formatRelative(t.createdAt)}` instead of raw UUID.
- Run button glow tier mirror of NewTranscribeModal.

### `apps/desktop/app/about.tsx`
- Drop the pre-heading `BadgeAccent v2.0 · alpha` (no chrome above the heading; "no logo mark, heading only").
- Hero centered with `paddingVertical $xl`.
- 2×2 version grid: App version / Backend version / Build date / Platform via `<Code>` (JetBrains Mono).
- Tech credit pills use `BadgePill font="mono"`. Expand the list (Tauri, Expo, Tamagui, FastAPI, yt-dlp, OpenAI Whisper, faster-whisper, Google Gemini, FFmpeg, MPV).
- Footer copy: "MIT License · © 2026".
- Reviewer note: the v2.2-Claude-Opus version dropped accent on resource labels (zero-accent screen — failed the "screen needs a signal" test). On v2.1 keep the resource labels at `$accent` per spec; the icon tiles can be `accentSoft` or `surfaceGlass`. Don't repeat the "demote everything" mistake.

### `apps/desktop/app/init.tsx`
- Remove the 420px blurred `$accent` halo absolute-positioned behind the card. Violated Glow-As-Affordance Rule.
- Drop the eyebrow `<BadgeAccent>setup · one time</BadgeAccent>`.
- Drop the `Sparkles` icon inside the Download CTA.
- `StatusDot status="untested"` on the `connecting` state (was `warning` — alarmist on first paint).

### `apps/desktop/app/history.tsx`
- Use shared `humanEngine` from constants.
- Engine pill `font="mono"` + always rendered (was conditional fallback).
- Add a language `BadgePill` when `targetLang` is set (was missing).
- Drop the manual Refresh `IconButton` in the header (`useFocusEffect` already refetches on tab return).
- Drop the `Info` IconButton from each row (row click already opens detail).
- Subtitle copy: "X session{s} · click a row for details, ⟳ to reload into Generate."
- Error state gets a `Try again` `ButtonSecondary` calling `refresh()`.
- Reviewer note: `MoreHorizontal` icon labelled "Open folder" is still semantically wrong. Either swap to a `Folder` icon (single-action) or wire to a real overflow `ActionSheet` containing Open folder / Copy URL / Delete.

### `apps/desktop/app/library.tsx`
- Empty state: drop the absolute-positioned `accentSoft` blur halo behind the icon. Set the icon placeholder `opacity={0.5}` per spec.
- Empty-state CTA: `height={48}` (spec Screen 7), not the ButtonPrimary default 56.
- Reviewer notes for future rounds: duration badge + play overlay + footer divider are still missing (duration requires backend exposing `durationSeconds` in `LibraryItem`).

### `apps/desktop/app/_layout.tsx`
- Remove the unwired `Bell` IconButton from the topbar.
- ⌘L hint platform-aware: aria-label = `Toggle logs (${platformModKey()}+L)`, drawer footer caption = `${platformModKey()}+L to close`.

---

## Score trend (Generate-screen rounds, for reference)

| Round | Score | Key wins |
|---|---:|---|
| R1 baseline | 26 / 40 | — |
| R2 (P0+P1+P2+P3) | 28 / 40 | Glow ladder, Configure default open, Result distill, HeroCard shimmer, Toast border-left fix, engine-label maps |
| R3 (R2 polish) | 30 / 40 | Configure split (Translation visible / Advanced collapsed), SRT 2-col grid, StepPill brightening, Whisper-model array consolidation |
| R4 (R3 polish) | 33 / 40 | Error-recovery hardening (6 categories), step counter, Generate CTA dock, ⌘+↵ shortcut |

Cognitive-load fails: 3 → 1.

End-of-session per-screen scores (after the R5 cross-screen pass):
- Generate **33**, Settings **33**, About **31**, Init **29**, Library+modals **26**, History **25**, Layout **22**.

Critique snapshots live at `.impeccable/critique/`.

---

## Validated patterns — do not re-debate

1. **Glow-As-Affordance ladder.** `rest` (idle CTAs), `ready` (one-click commit moment), `none` (success / done / error retry). Default `rest`. Verified across 4+ reviewer passes.
2. **Result-card editorial inversion.** Fraunces translated title leads; Done meta demoted. Reviewers were enthusiastic. Drifts from spec Screen 5 intentionally.
3. **Configure split.** Translation block always visible; only Whisper model / Device / VAD behind `Advanced ▸`. Reviewers consistently rejected bundling Translation under "advanced."
4. **Error categorize() with 6 buckets.** Lives in `index.tsx`. Reviewers called the result the best moment on the screen.
5. **Shared `humanEngine` / `humanTranslator`.** No duplicates; one helper in `constants.ts`.
6. **`ConfirmDialog` replaces `window.confirm()`** (PRODUCT.md anti-ref #3: no native OS chrome).
7. **`MaskedInput` for credentials** with per-field show/hide state.
8. **3px `borderLeft` tone stripe is banned** (DESIGN.md §6). Use 1px full-edge tinted border + 8px tone-filled status dot.
9. **`#ffffff` is banned.** Text is `$textPrimary` (`#f5f5f7`).
10. **Fraunces is for moments only.** Screen title, hero copy, About page. Never buttons / table cells / body / labels. Weight 400 only.

---

## Backend-blocked items (skip)

These reviewers kept flagging, but they require backend changes — wait until those land:
- `metadata.hasAutoCaptions` for the green "Auto-captions available" pill on the video-preview card.
- `metadata.language` for the language pill on the same card.
- `LibraryItem.durationSeconds` for the duration badge on Library cards.
- Live backend health (`apiClient.health()` polling) for the sidebar status dot.
- ETA in processing sub-status (the step counter is the doable half).

---

## Known gotchas

- **Tamagui `useMedia()` returns no `gtSm`** in this project's config. Use `useWindowDimensions()` from `react-native` with a 768px threshold.
- **`Modal.tsx` requires `<Theme name="dark">` wrap** around `Dialog.Portal` children — without it, `$textPrimary` text inside the modal renders BLACK on the dark backdrop because Tamagui token resolution falls back to bare browser defaults in the portal subtree.
- **`Modal.tsx` must NOT pass `unstyled` to `Dialog.Content`** — Tamagui v1's `unstyled` strips `position: fixed` + center transform and the modal renders as a zero-sized block somewhere in the portal.
- **`TextInput` requires inline `style.color`** when used with `unstyled` Tamagui Input — RN-Web's underlying `<input>` falls back to browser default (black on dark = invisible).
- **`prefers-reduced-motion` detection** must polyfill Safari < 14's `addListener`/`removeListener`. See `HeroCard.tsx`.
- **`humanTranslator()` in `constants.ts` is defined BEFORE `TRANSLATOR_LABELS`** in source order (it forward-references). Works because function body is evaluated at call-time, not module-init-time. Don't "fix" the ordering.

---

## Suggested opening prompt for the next chat

Paste this into a fresh Claude Code session:

```
We're redoing a design pass that was accidentally based on v2.0 instead of v2.1.

Strategic + visual context lives on the experiment branch:
  git show origin/v2.2-Claude-Opus:PRODUCT.md
  git show origin/v2.2-Claude-Opus:DESIGN.md
  git show origin/v2.2-Claude-Opus:HANDOFF.md   ← read this first; it
      has the file-by-file recipe, the patterns to keep, the gotchas,
      and the safe vs must-redo split.

Confirm you're on a fresh branch off v2.1 (not v2.0). Then:
1. Cherry-pick the safe shared components from origin/v2.2-Claude-Opus 
   per the handoff's "What's safe to take as-is" table. Read each 
   against v2.1's version before keeping.
2. Cherry-pick the strategic docs (PRODUCT.md, DESIGN.md, CLAUDE.md, 
   .impeccable/).
3. Redo the per-screen passes in this order, type-checking after each:
   Generate → VideoDetailModal → About → History → Init → Library → 
   Layout → Settings (Settings is LAST because v2.1's Settings is 
   completely rewritten with tabs + autosave; adapt, don't copy).
4. Don't re-debate the validated patterns (glow ladder, Result-card 
   editorial inversion, Configure split, error categorize). Reviewers 
   confirmed these across 4+ rounds.
5. Don't redo backend-blocked items (auto-captions pill, language pill, 
   duration badge, ETA, live dot).

Score targets: Generate ≥33, Settings ≥25 (most divergent), others ≥25.

Use the impeccable skill's critique command between rounds. Snapshots 
from the previous session are in .impeccable/critique/ as priors — they 
quantify what "good" looks like for each screen.
```

---

## What `v2.2-Claude-Opus` is now

A v2.0-based design experiment. Useful as a **reference**: read its files, copy ideas, cherry-pick the safe pieces. **Don't** merge it into `v2.1` — the merge conflicts on `settings.tsx` and `index.tsx` would be catastrophic.

When the next branch lands cleanly on `v2.1`, this experiment branch can be deleted.
