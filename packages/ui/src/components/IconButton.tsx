import * as React from "react";
import { Stack, type StackProps } from "tamagui";
import { glassRecipes } from "../tokens";

/**
 * IconButton — circular glass button for sidebar / chrome / modal-close.
 *
 * Spec: docs/superpowers/design-handoff/README.md → Component Inventory.
 *   size   : 32 or 36 (default 36)
 *   shape  : circle ($pill radius)
 *   bg     : glassRecipes.glassLow.bg (rgba 0.04) — Component Inventory says
 *            "glassLow"; that's the recipe alpha (0.04), NOT $surfaceGlass (0.05).
 *   border : 1px $borderSubtle
 *   hover  : bg → $surfaceGlassMid, border → $borderStrong
 *   press  : scale 0.95
 *
 * The caller passes a sized lucide icon as `icon`, e.g.
 *   <IconButton icon={<X size={16} color="$textSecondary" />} aria-label="Close" />
 *
 * `aria-label` is required (TS-enforced) — every IconButton speaks to a11y
 * users via this attribute since there's no visible text.
 */
export type IconButtonProps = {
  icon: React.ReactNode;
  size?: 36 | 44 | 52;
  onPress?: () => void;
  disabled?: boolean;
  "aria-label": string;
} & Omit<StackProps, "children" | "onPress" | "disabled" | "aria-label">;

export function IconButton({
  icon,
  size = 44,
  onPress,
  disabled,
  "aria-label": ariaLabel,
  ...rest
}: IconButtonProps) {
  return (
    <Stack
      tag="button"
      role="button"
      width={size}
      height={size}
      borderRadius="$pill"
      backgroundColor={glassRecipes.glassLow.bg}
      borderWidth={1}
      borderColor="$borderSubtle"
      alignItems="center"
      justifyContent="center"
      hoverStyle={
        disabled
          ? undefined
          : { backgroundColor: "$surfaceGlassMid", borderColor: "$borderStrong" }
      }
      pressStyle={disabled ? undefined : { scale: 0.95 }}
      animation="quick"
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      opacity={disabled ? 0.4 : 1}
      cursor={disabled ? "not-allowed" : "pointer"}
      aria-label={ariaLabel}
      {...rest}
    >
      {icon}
    </Stack>
  );
}
