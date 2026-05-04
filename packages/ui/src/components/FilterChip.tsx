import * as React from "react";
import { Stack, Text, type StackProps } from "tamagui";
import { glassRecipes } from "../tokens";

/**
 * FilterChip — single-select pill used in Library / History toolbars.
 *
 * Spec: docs/superpowers/design-handoff/README.md → Component Inventory.
 *   shape        : $pill radius
 *   padding      : $xs $md (8 vertical, 16 horizontal)
 *   text         : Inter 13px / 500
 *   active       : bg $accentSoft, border $accentDim, text $accent
 *   inactive     : bg glassRecipes.glassLow.bg (rgba 0.04), border $borderSubtle,
 *                  text $textSecondary
 *                  (Component Inventory says "glassLow" → recipe alpha 0.04,
 *                  NOT $surfaceGlass.)
 *   hover        : inactive → border → $borderStrong
 *   press        : scale 0.97
 */
export type FilterChipProps = {
  active: boolean;
  onPress?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
} & Omit<StackProps, "children" | "onPress" | "disabled">;

export function FilterChip({
  active,
  onPress,
  disabled,
  children,
  ...rest
}: FilterChipProps) {
  return (
    <Stack
      tag="button"
      role="button"
      aria-pressed={active}
      paddingVertical="$xs"
      paddingHorizontal="$md"
      borderRadius="$pill"
      borderWidth={1}
      backgroundColor={active ? "$accentSoft" : glassRecipes.glassLow.bg}
      borderColor={active ? "$accentDim" : "$borderSubtle"}
      alignItems="center"
      justifyContent="center"
      animation="quick"
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      opacity={disabled ? 0.4 : 1}
      cursor={disabled ? "not-allowed" : "pointer"}
      hoverStyle={
        disabled || active
          ? undefined
          : { borderColor: "$borderStrong" }
      }
      pressStyle={disabled ? undefined : { scale: 0.97 }}
      {...rest}
    >
      <Text
        fontFamily="$body"
        fontSize={13}
        fontWeight="500"
        color={active ? "$accent" : "$textSecondary"}
      >
        {children}
      </Text>
    </Stack>
  );
}
