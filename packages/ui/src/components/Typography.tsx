/**
 * Typography primitives — one component per named style from the design
 * handoff (13 styles across 3 families). Replaces the duplicated inline
 * `CaptionUpper`/`SectionTitle`/`FieldLabel` helpers that were copy-pasted
 * across screens.
 *
 * Each component wraps Tamagui's `<Text>` with the canonical scale + family
 * + color default for that style. All Text props are forwarded so callers
 * can override anything per-instance (e.g. `<Caption color="$accent">`).
 *
 * Font-family detail (important):
 *   `@expo-google-fonts/inter` loads each Inter weight as its OWN font
 *   family — `Inter_400Regular`, `Inter_500Medium`, `Inter_600SemiBold` —
 *   not as a single `Inter` family with multiple weight files. So setting
 *   `fontFamily="$body"` (which Tamagui resolves to `Inter_400Regular`)
 *   together with `fontWeight="600"` produces the wrong rendering: the
 *   browser sees Inter_400Regular at weight 600, can't find it, and either
 *   synthesizes a faux-bold or falls back to a system serif (which is why
 *   the Topbar title looked Fraunces-y).
 *
 *   Fix: weight≠400 components reference the loaded family name DIRECTLY
 *   (e.g. `fontFamily="Inter_600SemiBold"`), bypassing Tamagui's `face`
 *   resolution which doesn't kick in on web for this asset shape.
 *
 * Reference: docs/superpowers/design-handoff/README.md "Typography".
 */
import * as React from "react";
import { Text, type TextProps } from "tamagui";

// Forward every Tamagui Text prop so callers can override the canonical
// scale per-instance (e.g. `<Caption fontSize={11}>` for a footer use,
// `<BodyMd fontWeight="500">` for emphasis between body and title).
type Props = TextProps;

// Per-weight Inter family names — the actual identifiers loaded by
// `@expo-google-fonts/inter`. Use these directly when weight ≠ 400.
const INTER_500 = "Inter_500Medium" as const;
const INTER_600 = "Inter_600SemiBold" as const;

// ─── Display (Fraunces 400) ─────────────────────────────────────────────────

export const DisplayXl = (p: Props) => (
  <Text
    fontFamily="$display"
    fontSize={72}
    lineHeight={76}
    letterSpacing={-1.5}
    color="$textPrimary"
    {...p}
  />
);

export const DisplayLg = (p: Props) => (
  <Text
    fontFamily="$display"
    fontSize={56}
    lineHeight={63}
    letterSpacing={-1}
    color="$textPrimary"
    {...p}
  />
);

export const DisplayMd = (p: Props) => (
  <Text
    fontFamily="$display"
    fontSize={44}
    lineHeight={51}
    letterSpacing={-0.5}
    color="$textPrimary"
    {...p}
  />
);

export const DisplaySm = (p: Props) => (
  <Text
    fontFamily="$display"
    fontSize={34}
    lineHeight={41}
    letterSpacing={-0.3}
    color="$textPrimary"
    {...p}
  />
);

// ─── Title (Inter 600) ──────────────────────────────────────────────────────

export const TitleLg = (p: Props) => (
  <Text
    fontFamily={INTER_600}
    fontSize={26}
    lineHeight={34}
    fontWeight="600"
    color="$textPrimary"
    {...p}
  />
);

export const TitleMd = (p: Props) => (
  <Text
    fontFamily={INTER_600}
    fontSize={22}
    lineHeight={30}
    fontWeight="600"
    color="$textPrimary"
    {...p}
  />
);

export const TitleSm = (p: Props) => (
  <Text
    fontFamily={INTER_600}
    fontSize={18}
    lineHeight={25}
    fontWeight="600"
    color="$textPrimary"
    {...p}
  />
);

// ─── Body (Inter 400) ───────────────────────────────────────────────────────

export const BodyMd = (p: Props) => (
  <Text
    fontFamily="$body"
    fontSize={19}
    lineHeight={29}
    color="$textPrimary"
    {...p}
  />
);

export const BodySm = (p: Props) => (
  <Text
    fontFamily="$body"
    fontSize={17}
    lineHeight={26}
    color="$textPrimary"
    {...p}
  />
);

// ─── Captions ───────────────────────────────────────────────────────────────

export const Caption = (p: Props) => (
  <Text
    fontFamily={INTER_500}
    fontSize={15}
    lineHeight={22}
    fontWeight="500"
    color="$textMuted"
    {...p}
  />
);

export const CaptionUpper = (p: Props) => (
  <Text
    fontFamily={INTER_600}
    fontSize={14}
    lineHeight={20}
    fontWeight="600"
    letterSpacing={1.5}
    textTransform="uppercase"
    color="$textMuted"
    {...p}
  />
);

// ─── Mono (JetBrains Mono) ──────────────────────────────────────────────────
//
// `tnum` font feature locks digits to monospace widths so timestamps don't
// shimmy when a `1` follows a `0`. `style` is forwarded after spread so
// callers can opt in to additional features.

const TNUM_STYLE = { fontFeatureSettings: "'tnum'" } as const;

export const Timestamp = ({ style, ...rest }: Props) => (
  <Text
    fontFamily="JetBrainsMono_500Medium"
    fontSize={14}
    lineHeight={20}
    fontWeight="500"
    color="$textMuted"
    style={{ ...TNUM_STYLE, ...(style as object) }}
    {...rest}
  />
);

export const Code = (p: Props) => (
  <Text
    fontFamily="$mono"
    fontSize={16}
    lineHeight={25}
    color="$textPrimary"
    {...p}
  />
);
