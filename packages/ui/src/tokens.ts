/**
 * Glass-elevation recipes + animation primitives shared between
 * apps/desktop's tamagui.config and the @yt-subtitle-maker/ui components.
 *
 * These are intentionally NOT registered as Tamagui tokens because
 * `createTokens` only accepts scalar values. The component code consumes
 * the literal blur / saturate / shadow CSS strings here and applies them
 * via React Native Web's `style` prop.
 *
 * On RN native the `backdropFilter` CSS property is a no-op — V1 ships
 * web/Tauri only, so divergence is acceptable for now.
 */

export const glassRecipes = {
  glassLow: {
    bg: "#fff8f6",
    border: "#e6dfd8",
    backdropFilter: "none",
  },
  glassMid: {
    bg: "#fff8f6",
    border: "#e6dfd8",
    backdropFilter: "none",
  },
  glassHigh: {
    bg: "#fff8f6",
    border: "#dac1ba",
    backdropFilter: "none",
    boxShadow: "0 24px 48px rgba(33,26,24,0.10)",
  },
} as const;

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
