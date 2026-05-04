import * as React from "react";
import { Stack, type StackProps } from "tamagui";

/**
 * Toggle — controlled on/off switch.
 *
 * Spec: docs/superpowers/design-handoff/README.md → Component Inventory.
 *   track  : 36 × 20
 *   thumb  : 14 × 14, 3px inset from track edge
 *   off    : track $surfaceGlass + $borderSubtle, thumb $textMuted
 *   on     : track $accent (no border tint needed), thumb $textPrimary
 *   anim   : 150ms quick spring on thumb translate + bg colour
 *
 * Renders a real <button> for keyboard / a11y; `aria-checked` reflects state.
 * Thumb position is animated with Tamagui's `animation="quick"` — the only
 * value that changes is `left`, which Tamagui transitions via the registered
 * 150ms cubic-bezier(0.4,0,0.2,1) preset.
 */
export type ToggleProps = {
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
  "aria-label"?: string;
} & Omit<StackProps, "value" | "onValueChange" | "disabled" | "aria-label">;

const TRACK_WIDTH = 36;
const TRACK_HEIGHT = 20;
const THUMB_SIZE = 14;
const THUMB_INSET = 3;

export function Toggle({
  value,
  onValueChange,
  disabled,
  "aria-label": ariaLabel,
  ...rest
}: ToggleProps) {
  return (
    <Stack
      tag="button"
      role="switch"
      aria-checked={value}
      aria-label={ariaLabel}
      width={TRACK_WIDTH}
      height={TRACK_HEIGHT}
      borderRadius="$pill"
      backgroundColor={value ? "$accent" : "$surfaceGlass"}
      borderWidth={1}
      borderColor={value ? "$accent" : "$borderSubtle"}
      animation="quick"
      onPress={disabled ? undefined : () => onValueChange(!value)}
      disabled={disabled}
      opacity={disabled ? 0.4 : 1}
      cursor={disabled ? "not-allowed" : "pointer"}
      position="relative"
      justifyContent="center"
      {...rest}
    >
      <Stack
        position="absolute"
        top={THUMB_INSET - 1}
        left={value ? TRACK_WIDTH - THUMB_SIZE - THUMB_INSET : THUMB_INSET}
        width={THUMB_SIZE}
        height={THUMB_SIZE}
        borderRadius="$pill"
        backgroundColor={value ? "$textPrimary" : "$textMuted"}
        animation="quick"
      />
    </Stack>
  );
}
