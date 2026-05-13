# Handoff to v2.1 — design pass artifacts

Self-contained drop-in: everything the next chat session needs to redo the
five-round design pass on top of `v2.1`. The first attempt was accidentally
based on `v2.0`, so the per-screen edits don't apply cleanly against
`v2.1`'s ~115-commit lead. This folder packs the **reusable** outputs
(strategic docs, critique snapshots, validated shared components) so the
next session doesn't start from zero.

The full design experiment lives on branch `v2.0-Experiment` (renamed from
`v2.2-Claude-Opus`) on the remote. This folder is the extract.

---

## Contents

```
handoff-to-v2.1/
├── README.md                ← you are here
├── docs/                    ← strategic + visual context
│   ├── PRODUCT.md           "Screening Room" North Star, anti-references, principles
│   ├── DESIGN.md            Stitch DESIGN.md visual system
│   ├── CLAUDE.md            Pointer for non-impeccable agents
│   └── HANDOFF.md           File-by-file recipe; the next chat's primary doc
├── impeccable/              ← critique priors (don't re-investigate baselines)
│   ├── design.json          Stitch sidecar (tonal ramps, motion, components)
│   └── critique/            4 Generate-screen snapshots: 26 → 28 → 30 → 33
└── drop-in/                 ← code: drop into v2.1, then verify per file
    ├── packages/ui/src/components/
    │   ├── ConfirmDialog.tsx        NEW   (replaces window.confirm)
    │   ├── MaskedInput.tsx          NEW   (API key field with eye toggle)
    │   ├── BadgePill.tsx            MOD   adds font: "body" | "mono"
    │   ├── ButtonPrimary.tsx        MOD   adds glow: "rest" | "ready" | "none"
    │   ├── HeroCard.tsx             MOD   adds shimmer prop + reduced-motion
    │   ├── StepPill.tsx             MOD   active dot brightened to solid accent
    │   ├── Toast.tsx                MOD   removed banned 3px borderLeft stripe
    │   └── keyframes.ts             MOD   added yt-ui-shimmer keyframe
    ├── packages/ui/src/index.ts     MOD   exports for new components
    └── apps/desktop/src/constants.ts NEW  ENGINE_LABELS, TRANSLATOR_LABELS,
                                            humanEngine(), humanTranslator(),
                                            platformModKey(), WHISPER_MODELS,
                                            WHISPER_DEVICES, LANGUAGES
```

`MOD` files were modified from v2.0's versions. Don't blindly overwrite v2.1's
copies — diff first; v2.1 may have its own edits. `NEW` files are safe to drop in.

---

## How to drop this into v2.1

```bash
# 1. Start from a clean v2.1.
git fetch origin
git checkout v2.1
git pull
git checkout -b v2.2-redesign-on-v2.1

# 2. Drop the strategic docs at the repo root.
cp handoff-to-v2.1/docs/PRODUCT.md   .
cp handoff-to-v2.1/docs/DESIGN.md    .
cp handoff-to-v2.1/docs/CLAUDE.md    .   # check first — v2.1 may already have one
cp handoff-to-v2.1/docs/HANDOFF.md   .
mkdir -p .impeccable/critique
cp handoff-to-v2.1/impeccable/design.json   .impeccable/
cp handoff-to-v2.1/impeccable/critique/*.md .impeccable/critique/

# 3. Drop NEW component files (safe — diff against nothing).
cp handoff-to-v2.1/drop-in/packages/ui/src/components/ConfirmDialog.tsx \
   packages/ui/src/components/
cp handoff-to-v2.1/drop-in/packages/ui/src/components/MaskedInput.tsx \
   packages/ui/src/components/

# 4. For each MOD file, diff against v2.1 BEFORE copying:
#    e.g.:
diff packages/ui/src/components/BadgePill.tsx \
     handoff-to-v2.1/drop-in/packages/ui/src/components/BadgePill.tsx
#    If v2.1's version is identical to v2.0's, copying is safe. If v2.1
#    has its own edits, merge by hand — the only change in each MOD file
#    is documented in this file's "What changed in each MOD file" section
#    below.

# 5. packages/ui/src/index.ts MOD: add the two new exports. The diff is
#    just these two blocks (next to the Modal export):
#       export { ConfirmDialog } from "./components/ConfirmDialog";
#       export type { ConfirmDialogProps } from "./components/ConfirmDialog";
#    and (next to the TextInput export):
#       export { MaskedInput } from "./components/MaskedInput";
#       export type { MaskedInputProps } from "./components/MaskedInput";

# 6. apps/desktop/src/constants.ts — NEW file. v2.1 may not have a
#    constants file under apps/desktop/src/; check first. If it does,
#    merge into it (don't overwrite).

# 7. Commit this baseline before any per-screen work:
git add PRODUCT.md DESIGN.md CLAUDE.md HANDOFF.md .impeccable/ \
        packages/ui/src/components/ConfirmDialog.tsx \
        packages/ui/src/components/MaskedInput.tsx \
        packages/ui/src/components/BadgePill.tsx \
        packages/ui/src/components/ButtonPrimary.tsx \
        packages/ui/src/components/HeroCard.tsx \
        packages/ui/src/components/StepPill.tsx \
        packages/ui/src/components/Toast.tsx \
        packages/ui/src/components/keyframes.ts \
        packages/ui/src/index.ts \
        apps/desktop/src/constants.ts
git commit -m "docs+ui(design): seed strategic context + shared components from v2.0 experiment"

# 8. Verify type-clean before starting per-screen work.
pnpm -F desktop typecheck
pnpm -F @yt-subtitle-maker/ui typecheck
```

After step 7 the new branch has all the safe baseline. The next chat then
does the per-screen passes per `HANDOFF.md`.

---

## What changed in each MOD file (for hand-merging if v2.1 diverges)

### `packages/ui/src/components/BadgePill.tsx`
Added a `font?: "body" | "mono"` prop (default `"body"`). The render branch
switches `fontFamily` between `"$body"` and `"$mono"`. Everything else unchanged.

### `packages/ui/src/components/ButtonPrimary.tsx`
Added a `glow?: "rest" | "ready" | "none"` prop (default `"rest"`). A
`GLOW: Record<GlowLevel, string>` const maps each level to the right
`boxShadow` value. The hard-coded `boxShadow: "0 4px 20px rgba(...0.4)"`
became `boxShadow: GLOW[glow]`. Comment updated to document the rule.

### `packages/ui/src/components/HeroCard.tsx`
Added a `shimmer?: boolean` prop. When true, overlays an absolutely-positioned
linear-gradient (115° sweep at low opacity, accent hue) animated via the new
`yt-ui-shimmer` keyframe over 10s. Uses a `usePrefersReducedMotion()` hook
to skip the animation when the user has reduced-motion preference. Wraps
children in an `overflow="hidden"` parent so the sweep stays inside the card.

### `packages/ui/src/components/StepPill.tsx`
Active-state dot is now solid `$accent` (was `$accentSoft` fill + `$accentDim`
border — a soft puck against the `$accentSoft` pill background, indistinguishable).
Pulse animation (`yt-ui-pulse`) unchanged.

### `packages/ui/src/components/Toast.tsx`
Removed the banned 3px `borderLeftWidth` colored stripe. Replaced with:
- Full-edge 1px `borderColor` in `rgba(tone, 0.30)`
- Leading 8px tone-filled status dot inside the XStack
Tone map (`success` / `error` / `neutral`) keeps semantic meaning without the
banned stripe pattern. DESIGN.md §6 lists the stripe explicitly as banned.

### `packages/ui/src/components/keyframes.ts`
Added `@keyframes yt-ui-shimmer` (translateX -100% → 200%, opacity in/out via
two stops at 35% and 65%). The HeroCard consumes it.

---

## Opening prompt for the next chat

Paste this into a fresh Claude Code session (after dropping the folder into
your new v2.1-based branch):

> We're redoing a design pass that was accidentally based on v2.0 instead of v2.1.
>
> The baseline is already committed — strategic docs (`PRODUCT.md`,
> `DESIGN.md`), critique priors (`.impeccable/critique/`), shared components
> (`ConfirmDialog`, `MaskedInput`, `BadgePill mono`, `ButtonPrimary glow`,
> `HeroCard shimmer`, `Toast` fix, `StepPill` brightening, `humanEngine` helper).
>
> Read `HANDOFF.md` first — it's the file-by-file recipe. Then `PRODUCT.md`
> and `DESIGN.md` for context.
>
> Per-screen passes in this order, type-checking between each:
> Generate → VideoDetailModal → About → History → Init → Library → Layout →
> Settings (Settings LAST — v2.1 rewrote it with tabs + autosave; adapt,
> don't copy).
>
> Don't re-debate validated patterns: glow ladder, Result-card editorial
> inversion, Configure split, error categorize. Reviewers confirmed these
> across 4+ rounds.
>
> Don't redo backend-blocked items: auto-captions pill, language pill on
> video-preview card, duration badge, ETA, live status dot.
>
> Score targets: Generate ≥33, Settings ≥25 (most divergent), others ≥25.
>
> Use the impeccable critique skill between rounds. Snapshots in
> `.impeccable/critique/` show the previous trend (Generate: 26 → 28 → 30 → 33).

---

## What's NOT in this folder (and where to find it)

- **Per-screen JSX edits** to `index.tsx`, `_layout.tsx`, `about.tsx`,
  `history.tsx`, `init.tsx`, `library.tsx`, `settings.tsx`,
  `VideoDetailModal.tsx`, `NewTranscribeModal.tsx`, `NewTranslationModal.tsx`,
  and `generate.ts`. These are too divergent from v2.1's versions to drop
  in safely. `HANDOFF.md` describes each change in prose so the next chat
  can re-apply them against v2.1's real files. The actual v2.0-based source
  is on the `v2.0-Experiment` branch at:
  ```
  origin/v2.0-Experiment
  ```
  Read individual files for reference with `git show`:
  ```
  git show origin/v2.0-Experiment:apps/desktop/app/index.tsx
  ```

- **`scripts/dev.sh`** — restored on `v2.0-Experiment` from v2.1; v2.1 already
  has its canonical version.

---

## File listing

| File | Size | Purpose |
|---|---:|---|
| `docs/PRODUCT.md` | ~6 KB | Strategic context — register, users, brand, anti-refs, principles |
| `docs/DESIGN.md` | ~17 KB | Visual system in Stitch format |
| `docs/CLAUDE.md` | ~1.5 KB | Pointer to PRODUCT/DESIGN for agents |
| `docs/HANDOFF.md` | ~20 KB | Full recipe — what to keep, what to redo, gotchas |
| `impeccable/design.json` | ~8 KB | Sidecar — tonal ramps, motion, components, narrative |
| `impeccable/critique/*.md` | ~32 KB | Four Generate-screen snapshots |
| `drop-in/packages/ui/src/components/*.tsx` | ~12 KB | 8 component files (2 NEW + 6 MOD) |
| `drop-in/packages/ui/src/index.ts` | ~3 KB | Full v2.0-Experiment exports (diff against v2.1) |
| `drop-in/apps/desktop/src/constants.ts` | ~3 KB | Shared labels + helpers + form options |

Total: ~100 KB. Self-contained, drop-in.
