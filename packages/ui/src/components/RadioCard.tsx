import * as React from "react";
import { Stack, XStack, type StackProps } from "tamagui";
import { glassRecipes } from "../tokens";

/**
 * RadioCard — a selectable card row with a radio dot + arbitrary children.
 *
 * Spec: docs/superpowers/design-handoff/README.md → Component Inventory.
 *   padding      : $sm $md  (12 vertical, 16 horizontal)
 *   borderRadius : $md (12px)
 *   selected     : bg $accentSoft, border $accentDim
 *   unselected   : bg glassRecipes.glassLow.bg (rgba 0.04), border $borderSubtle
 *                  (Component Inventory says "glassLow" → recipe alpha 0.04,
 *                  NOT $surfaceGlass.)
 *   dot          : 16 × 16 circle to the LEFT of children
 *                  selected   = filled $accent, no border
 *                  unselected = hollow with $borderStrong border
 *   gap          : $sm between dot and children
 */
export type RadioCardProps = {
  selected: boolean;
  onPress?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
} & Omit<StackProps, "children" | "onPress" | "disabled">;

export function RadioCard({
  selected,
  onPress,
  disabled,
  children,
  ...rest
}: RadioCardProps) {
  return (
    <XStack
      tag="button"
      role="radio"
      aria-checked={selected}
      paddingVertical="$sm"
      paddingHorizontal="$md"
      borderRadius="$md"
      borderWidth={1}
      backgroundColor={selected ? "$accentSoft" : glassRecipes.glassLow.bg}
      borderColor={selected ? "$accentDim" : "$borderSubtle"}
      alignItems="center"
      gap="$sm"
      animation="quick"
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      opacity={disabled ? 0.4 : 1}
      cursor={disabled ? "not-allowed" : "pointer"}
      hoverStyle={
        disabled || selected
          ? undefined
          : { borderColor: "$borderStrong" }
      }
      pressStyle={disabled ? undefined : { scale: 0.99 }}
      {...rest}
    >
      <Stack
        width={16}
        height={16}
        borderRadius="$pill"
        backgroundColor={selected ? "$accent" : "transparent"}
        borderWidth={selected ? 0 : 2}
        borderColor="$borderStrong"
        flexShrink={0}
        animation="quick"
      />
      <Stack flex={1} alignItems="flex-start">
        {children}
      </Stack>
    </XStack>
  );
}
