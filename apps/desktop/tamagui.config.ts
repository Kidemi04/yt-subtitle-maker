/**
 * yt-subtitle-maker v2.0 — Tamagui design token system
 *
 * Source of truth: docs/superpowers/design-handoff/README.md
 * (15 colors, 13 typography styles across 3 families, 8 spacing steps,
 *  6 radii, 4 animation durations + 4 easings, 3 glass elevation recipes.)
 *
 * Tamagui-vs-recipe split:
 *   Tamagui's `createTokens` only accepts SCALAR values (string / number),
 *   so the glass-elevation "recipes" (which combine bg + border + a CSS
 *   `backdrop-filter: blur(...) saturate(...)` string + optional shadow)
 *   are NOT encoded as tokens. Instead:
 *     - The bg + border colors that participate in those recipes ARE
 *       tokens (`surfaceGlass*`, `borderSubtle/Strong`).
 *     - The blur/saturate/shadow strings live in the exported
 *       `glassRecipes` constant below, which the future `<GlassCard>`
 *       component (Phase 3+) consumes directly.
 *
 * Animation note:
 *   The handoff spec lists 6 "presets" (fadeIn, slideUp, scaleIn, press,
 *   cardHover, stagger). Those are component-level recipes, not Tamagui
 *   `animations` keys. We register only the 4 base durations
 *   (quick/normal/slow/slowest) here; component code composes presets
 *   from these + the easing constants below.
 */
import { createAnimations } from "@tamagui/animations-css";
import { shorthands } from "@tamagui/shorthands/v2";
import {
  createFont,
  createTamagui,
  createTokens,
} from "tamagui";

// ─── Color tokens (15) ──────────────────────────────────────────────────────
const color = {
  bgBase: "#0a0a0c",
  bgElevated: "#111114",
  surfaceGlass: "rgba(255,255,255,0.05)",
  surfaceGlassMid: "rgba(255,255,255,0.06)",
  surfaceGlassHigh: "rgba(255,255,255,0.08)",
  borderSubtle: "rgba(255,255,255,0.06)",
  borderStrong: "rgba(255,255,255,0.12)",
  textPrimary: "#f5f5f7",
  textSecondary: "#a1a1a6",
  textMuted: "#6e6e73",
  accent: "#fb923c",
  accentSoft: "rgba(251,146,60,0.15)",
  accentDim: "rgba(251,146,60,0.25)",
  success: "#5db872",
  warning: "#e8a55a",
  error: "#ff5a5f",
} as const;

// ─── Spacing (8) — mirrored as size (Tamagui requires both) ────────────────
const spaceMap = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  section: 64,
} as const;

// `true` alias is what Tamagui falls back to when a `space` prop has no key.
const space = {
  ...spaceMap,
  true: spaceMap.md,
} as const;
const size = {
  ...spaceMap,
  true: spaceMap.md,
} as const;

// ─── Radius (6) ─────────────────────────────────────────────────────────────
const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 20,
  xl: 28,
  pill: 9999,
  true: 12, // default radius alias
} as const;

// ─── zIndex layers (basic) ──────────────────────────────────────────────────
// Tamagui validates that zIndex keys are a subset of size keys, so we mirror
// the spacing keyspace and pick a few semantically-named layers underneath.
// Component code uses `zIndex={...}` with raw numbers most of the time;
// these tokens just give us `$lg`, `$xl`, `$xxl` for stacking-context bumps.
const zIndex = {
  xxs: 0,
  xs: 0,
  sm: 0,
  md: 0,
  lg: 100, // overlay
  xl: 200, // modal
  xxl: 300,
  section: 400,
  true: 0,
} as const;

const tokens = createTokens({
  color,
  space,
  size,
  radius,
  zIndex,
});

// ─── Fonts ──────────────────────────────────────────────────────────────────
//
// `family` matches the key used by `useFonts()` in app/_layout.tsx — i.e. the
// alias under which expo-font registers the .ttf. `@expo-google-fonts/*`
// exposes them as `Fraunces_400Regular`, `Inter_400Regular`, etc.
//
// Each `size` key maps to a semantic style name from the handoff. The same
// keys must appear in `lineHeight`, `weight`, and `letterSpacing` (createFont
// fills missing keys forward).

const displayFont = createFont({
  family: "Fraunces_400Regular",
  size: {
    sm: 22,
    md: 28,
    lg: 40,
    xl: 56,
  },
  lineHeight: {
    sm: Math.round(22 * 1.3),
    md: Math.round(28 * 1.2),
    lg: Math.round(40 * 1.1),
    xl: Math.round(56 * 1.05),
  },
  weight: {
    sm: "400",
    md: "400",
    lg: "400",
    xl: "400",
  },
  letterSpacing: {
    sm: -0.3,
    md: -0.5,
    lg: -1.0,
    xl: -1.5,
  },
});

const bodyFont = createFont({
  family: "Inter_400Regular",
  size: {
    captionUpper: 11,
    caption: 12,
    bodySm: 13,
    titleSm: 13,
    bodyMd: 14,
    titleMd: 15,
    titleLg: 18,
  },
  lineHeight: {
    captionUpper: Math.round(11 * 1.4),
    caption: Math.round(12 * 1.4),
    bodySm: Math.round(13 * 1.55),
    titleSm: Math.round(13 * 1.4),
    bodyMd: Math.round(14 * 1.55),
    titleMd: Math.round(15 * 1.4),
    titleLg: Math.round(18 * 1.4),
  },
  weight: {
    captionUpper: "600",
    caption: "500",
    bodySm: "400",
    titleSm: "600",
    bodyMd: "400",
    titleMd: "600",
    titleLg: "600",
  },
  letterSpacing: {
    captionUpper: 1.5,
    caption: 0,
    bodySm: 0,
    titleSm: 0,
    bodyMd: 0,
    titleMd: 0,
    titleLg: 0,
  },
  transform: {
    captionUpper: "uppercase",
    caption: "none",
    bodySm: "none",
    titleSm: "none",
    bodyMd: "none",
    titleMd: "none",
    titleLg: "none",
  },
  // `face` lets Tamagui pick the right registered family per weight on native;
  // on web the weight prop combined with the variable family is sufficient,
  // but this keeps the generated CSS predictable.
  face: {
    400: { normal: "Inter_400Regular" },
    500: { normal: "Inter_500Medium" },
    600: { normal: "Inter_600SemiBold" },
  },
});

const monoFont = createFont({
  family: "JetBrainsMono_400Regular",
  size: {
    timestamp: 11,
    code: 12,
  },
  lineHeight: {
    timestamp: Math.round(11 * 1.4),
    code: Math.round(12 * 1.6),
  },
  weight: {
    timestamp: "500",
    code: "400",
  },
  letterSpacing: {
    timestamp: 0,
    code: 0,
  },
  face: {
    400: { normal: "JetBrainsMono_400Regular" },
    500: { normal: "JetBrainsMono_500Medium" },
  },
});

const fonts = {
  display: displayFont,
  body: bodyFont,
  mono: monoFont,
};

// ─── Animations (4 base durations) ──────────────────────────────────────────
//
// `@tamagui/animations-css` composes each entry into a CSS `transition`
// string of the form `<easing> <duration>`. We name the keys after their
// duration (quick/normal/slow/slowest) and bake the standard easing into
// each. Components that need a different easing (decelerate, accelerate,
// spring) compose a custom transition inline using the `EASING` map.

const animations = createAnimations({
  quick: "cubic-bezier(0.4, 0, 0.2, 1) 150ms",
  normal: "cubic-bezier(0.4, 0, 0.2, 1) 250ms",
  slow: "cubic-bezier(0.4, 0, 0.2, 1) 400ms",
  slowest: "cubic-bezier(0.4, 0, 0.2, 1) 600ms",
});

export const EASING = {
  standard: "cubic-bezier(0.4, 0, 0.2, 1)",
  decelerate: "cubic-bezier(0, 0, 0.2, 1)",
  accelerate: "cubic-bezier(0.4, 0, 1, 1)",
  spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
} as const;

export const DURATION = {
  quick: 150,
  normal: 250,
  slow: 400,
  slowest: 600,
} as const;

// ─── Themes ────────────────────────────────────────────────────────────────
//
// Single `dark` theme. We expose:
//   1. Semantic Tamagui aliases (`background`, `color`, `borderColor`, …)
//      so built-in components default sensibly.
//   2. The full token set under its original name so app code can write
//      `<Stack bg="$accent" />` instead of `bg={tokens.color.accent.val}`.
//
// Tamagui resolves theme values that exactly equal a token reference; passing
// the variable instances from `tokens.color.*` keeps that link.

const dark = {
  // Semantic aliases used by Tamagui's built-in components.
  background: tokens.color.bgBase,
  backgroundHover: tokens.color.bgElevated,
  backgroundPress: tokens.color.bgElevated,
  backgroundFocus: tokens.color.bgElevated,
  color: tokens.color.textPrimary,
  colorHover: tokens.color.textPrimary,
  colorPress: tokens.color.textPrimary,
  colorFocus: tokens.color.textPrimary,
  borderColor: tokens.color.borderSubtle,
  borderColorHover: tokens.color.borderStrong,
  borderColorPress: tokens.color.borderStrong,
  borderColorFocus: tokens.color.borderStrong,
  placeholderColor: tokens.color.textMuted,
  shadowColor: "rgba(0,0,0,0.4)",
  shadowColorHover: "rgba(0,0,0,0.5)",

  // Full token set re-exposed by name so `$accent`, `$textPrimary`, etc work.
  bgBase: tokens.color.bgBase,
  bgElevated: tokens.color.bgElevated,
  surfaceGlass: tokens.color.surfaceGlass,
  surfaceGlassMid: tokens.color.surfaceGlassMid,
  surfaceGlassHigh: tokens.color.surfaceGlassHigh,
  borderSubtle: tokens.color.borderSubtle,
  borderStrong: tokens.color.borderStrong,
  textPrimary: tokens.color.textPrimary,
  textSecondary: tokens.color.textSecondary,
  textMuted: tokens.color.textMuted,
  accent: tokens.color.accent,
  accentSoft: tokens.color.accentSoft,
  accentDim: tokens.color.accentDim,
  success: tokens.color.success,
  warning: tokens.color.warning,
  error: tokens.color.error,
};

const themes = {
  dark,
};

// ─── Glass elevation recipes (NOT tokens — see header comment) ──────────────
//
// Each recipe is consumed directly by the future `<GlassCard>` component.
// `bg` and `border` are also available as Tamagui tokens so simple use cases
// can skip the recipe and just style with `$surfaceGlassMid` + `$borderSubtle`.

export const glassRecipes = {
  glassLow: {
    bg: "rgba(255,255,255,0.04)",
    border: "rgba(255,255,255,0.06)",
    backdropFilter: "blur(24px) saturate(180%)",
  },
  glassMid: {
    bg: "rgba(255,255,255,0.06)",
    border: "rgba(255,255,255,0.08)",
    backdropFilter: "blur(40px) saturate(180%)",
  },
  glassHigh: {
    bg: "rgba(255,255,255,0.08)",
    border: "rgba(255,255,255,0.12)",
    backdropFilter: "blur(60px) saturate(200%)",
    boxShadow: "0 24px 48px rgba(0,0,0,0.4)",
  },
} as const;

// ─── Tamagui config ─────────────────────────────────────────────────────────
export const config = createTamagui({
  animations,
  tokens,
  themes,
  fonts,
  shorthands,
  defaultFont: "body",
  settings: {
    defaultFont: "body",
    fastSchemeChange: true,
    themeClassNameOnRoot: true,
  },
});

export type AppConfig = typeof config;

declare module "tamagui" {
  interface TamaguiCustomConfig extends AppConfig {}
}
