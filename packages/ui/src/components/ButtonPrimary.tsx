import * as React from "react";
import { Stack, Text, type StackProps } from "tamagui";

/**
 * ButtonPrimary — the canonical CTA.
 *
 * Spec: docs/superpowers/design-handoff/README.md → Component Inventory,
 * plus DESIGN.md §4 "Glow-As-Affordance Rule" — accent glow encodes
 * affordance, not decoration. Three strengths only:
 *
 *   rest   (default) — idle CTAs: Load, Init Download, empty-state CTAs.
 *                      Shadow: 0 4px 16px rgba(251,146,60,0.35).
 *   ready            — the form is valid and one click commits the run.
 *                      Used on Generate Subtitles when metadata loaded.
 *                      Shadow: 0 4px 20px rgba(251,146,60,0.40).
 *   none             — success / Done state. The moment speaks quietly.
 *                      Used on Play with MPV after a run completes.
 *
 * `tag="button"` makes Tamagui render a real <button> on web for keyboard
 * + a11y. On native the prop is ignored.
 */

type GlowLevel = "rest" | "ready" | "none";

const GLOW: Record<GlowLevel, string> = {
  rest: "0 4px 16px rgba(251,146,60,0.35)",
  ready: "0 4px 20px rgba(251,146,60,0.40)",
  none: "none",
};

export type ButtonPrimaryProps = {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  glow?: GlowLevel;
} & Omit<StackProps, "children" | "onPress" | "disabled">;

export function ButtonPrimary({
  children,
  onPress,
  disabled,
  glow = "rest",
  style,
  ...rest
}: ButtonPrimaryProps) {
  return (
    <Stack
      tag="button"
      role="button"
      height={56}
      borderRadius="$md"
      paddingHorizontal="$lg"
      alignItems="center"
      justifyContent="center"
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      opacity={disabled ? 0.4 : 1}
      pressStyle={disabled ? undefined : { scale: 0.97 }}
      animation="quick"
      cursor={disabled ? "not-allowed" : "pointer"}
      style={{
        backgroundImage: "linear-gradient(180deg, #fb923c 0%, #f97316 100%)",
        boxShadow: GLOW[glow],
        border: "none",
        ...(style as object | null | undefined),
      }}
      {...rest}
    >
      <Text
        fontFamily="$body"
        fontSize={15}
        fontWeight="600"
        color="$textPrimary"
      >
        {children}
      </Text>
    </Stack>
  );
}
