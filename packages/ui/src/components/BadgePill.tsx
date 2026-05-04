import * as React from "react";
import { Stack, Text, type StackProps } from "tamagui";
import { glassRecipes } from "../tokens";

/**
 * BadgePill — small label pill used in cards / list rows.
 *
 * Spec: docs/superpowers/design-handoff/README.md → Component Inventory.
 *   shape   : $pill radius
 *   padding : $xs $sm  (8 vertical, 12 horizontal)
 *   text    : Inter 11px / 600
 *   default : bg glassRecipes.glassLow.bg, border $borderSubtle, text $textSecondary
 *   tones   : non-neutral tones tint the bg with a soft alpha mix and recolor
 *             the text + border to match the semantic token. Only `accent`
 *             has matching `$accentSoft/$accentDim` tokens; success/warning/error
 *             use rgba mixes derived from the base token below.
 *
 * "glassLow" is the recipe alpha (0.04), NOT `$surfaceGlass` (0.05) — the
 * Component Inventory is explicit on this distinction.
 */
export type BadgePillTone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "error";

export type BadgePillProps = {
  tone?: BadgePillTone;
  children: React.ReactNode;
} & Omit<StackProps, "children">;

// Soft (~0.15 alpha) + dim (~0.25 alpha) mixes for tones that don't already
// have $tokenSoft/$tokenDim variants in tamagui.config.
const TONE_MIXES: Record<
  Exclude<BadgePillTone, "neutral" | "accent">,
  { soft: string; dim: string }
> = {
  success: { soft: "rgba(93,184,114,0.15)", dim: "rgba(93,184,114,0.30)" },
  warning: { soft: "rgba(232,165,90,0.15)", dim: "rgba(232,165,90,0.30)" },
  error: { soft: "rgba(255,90,95,0.15)", dim: "rgba(255,90,95,0.30)" },
};

export function BadgePill({
  tone = "neutral",
  children,
  ...rest
}: BadgePillProps) {
  const visual = (() => {
    if (tone === "neutral") {
      return {
        bg: glassRecipes.glassLow.bg as string,
        border: "$borderSubtle" as const,
        color: "$textSecondary" as const,
      };
    }
    if (tone === "accent") {
      return {
        bg: "$accentSoft" as const,
        border: "$accentDim" as const,
        color: "$accent" as const,
      };
    }
    const mix = TONE_MIXES[tone];
    return {
      bg: mix.soft,
      border: mix.dim,
      color: `$${tone}` as `$${typeof tone}`,
    };
  })();

  return (
    <Stack
      paddingVertical="$xs"
      paddingHorizontal="$sm"
      borderRadius="$pill"
      borderWidth={1}
      backgroundColor={visual.bg}
      borderColor={visual.border}
      alignItems="center"
      justifyContent="center"
      {...rest}
    >
      <Text
        fontFamily="$body"
        fontSize={11}
        fontWeight="600"
        color={visual.color}
      >
        {children}
      </Text>
    </Stack>
  );
}
