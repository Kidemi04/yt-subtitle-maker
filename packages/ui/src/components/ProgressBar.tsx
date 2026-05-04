import * as React from "react";
import { Stack, type StackProps } from "tamagui";
import { glassRecipes } from "../tokens";
import { ensureKeyframes } from "./keyframes";

/**
 * ProgressBar — determinate (0..1) or indeterminate barber-pole.
 *
 * Spec: docs/superpowers/design-handoff/README.md → Screen 4 + Component Inventory.
 *   height        : 6
 *   shape         : $pill radius
 *   track         : glassRecipes.glassLow.bg (0.04 alpha)
 *   fill          : linear-gradient(90deg, #fb923c, #f97316)
 *                   + box-shadow 0 0 8px rgba(251,146,60,0.4)
 *   determinate   : width = value * 100%, transitions on change
 *   indeterminate : a 33%-wide segment slides L→R via @keyframes
 *
 * Note on glassLow: Component Inventory says the track is "glassLow", which
 * is the recipe alpha (0.04) — NOT $surfaceGlass (0.05).
 */
export type ProgressBarProps = {
  value?: number;
  indeterminate?: boolean;
} & Omit<StackProps, "value">;

const FILL_GRADIENT = "linear-gradient(90deg, #fb923c, #f97316)";
const FILL_GLOW = "0 0 8px rgba(251,146,60,0.4)";
const TRANSITION = "width 250ms cubic-bezier(0.4, 0, 0.2, 1)";

export function ProgressBar({
  value = 0,
  indeterminate = false,
  ...rest
}: ProgressBarProps) {
  React.useEffect(() => {
    ensureKeyframes();
  }, []);

  const clamped = Math.max(0, Math.min(1, value));
  const pct = `${(clamped * 100).toFixed(2)}%`;

  return (
    <Stack
      width="100%"
      height={6}
      borderRadius="$pill"
      backgroundColor={glassRecipes.glassLow.bg}
      overflow="hidden"
      position="relative"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuenow={indeterminate ? undefined : clamped}
      {...rest}
    >
      <Stack
        position="absolute"
        top={0}
        bottom={0}
        left={0}
        width={indeterminate ? "25%" : pct}
        borderRadius="$pill"
        style={{
          background: FILL_GRADIENT,
          boxShadow: FILL_GLOW,
          transition: indeterminate ? undefined : TRANSITION,
          animation: indeterminate
            ? "yt-ui-indeterminate 1.4s cubic-bezier(0.4, 0, 0.2, 1) infinite"
            : undefined,
        }}
      />
    </Stack>
  );
}
