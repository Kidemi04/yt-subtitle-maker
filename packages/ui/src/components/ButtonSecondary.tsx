import * as React from "react";
import { Stack, Text, type StackProps } from "tamagui";
import { glassRecipes } from "../tokens";

/**
 * ButtonSecondary — the calm-companion CTA next to ButtonPrimary.
 *
 * Spec: docs/superpowers/design-handoff/README.md → Component Inventory.
 *   height       : 44
 *   borderRadius : $md (12px)
 *   surface      : glassRecipes.glassLow.bg (rgba 0.04) + $borderSubtle border
 *                  — Component Inventory says "glassLow", which is the
 *                  recipe alpha (0.04), NOT the $surfaceGlass token (0.05).
 *   text         : Inter 13px / 500 / $textSecondary
 *   hover        : bg → $surfaceGlassMid, border → $borderStrong
 *   press        : scale 0.97
 */
export type ButtonSecondaryProps = {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
} & Omit<StackProps, "children" | "onPress" | "disabled">;

export function ButtonSecondary({
  children,
  onPress,
  disabled,
  ...rest
}: ButtonSecondaryProps) {
  return (
    <Stack
      tag="button"
      role="button"
      height={58}
      borderRadius="$md"
      paddingHorizontal="$md"
      alignItems="center"
      justifyContent="center"
      backgroundColor={glassRecipes.glassLow.bg}
      borderWidth={1}
      borderColor="$borderSubtle"
      hoverStyle={
        disabled
          ? undefined
          : { backgroundColor: "$surfaceGlassMid", borderColor: "$borderStrong" }
      }
      pressStyle={disabled ? undefined : { scale: 0.97 }}
      animation="quick"
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      opacity={disabled ? 0.4 : 1}
      cursor={disabled ? "not-allowed" : "pointer"}
      {...rest}
    >
      <Text
        fontFamily="$body"
        fontSize={18}
        fontWeight="500"
        color="$textSecondary"
      >
        {children}
      </Text>
    </Stack>
  );
}
