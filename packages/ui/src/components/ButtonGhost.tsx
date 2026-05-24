import * as React from "react";
import { Stack, Text, type StackProps } from "tamagui";

/**
 * ButtonGhost — a quiet, transparent action.
 *
 * Spec: docs/superpowers/design-handoff/README.md → Component Inventory.
 *   height       : 44
 *   borderRadius : $md (12px)
 *   bg           : transparent
 *   border       : 1px $borderSubtle
 *   text         : Inter 13px / 500 / $textSecondary
 *   hover        : bg → $surfaceGlass (faint glass tint)
 *   press        : scale 0.97
 */
export type ButtonGhostProps = {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
} & Omit<StackProps, "children" | "onPress" | "disabled">;

export function ButtonGhost({
  children,
  onPress,
  disabled,
  ...rest
}: ButtonGhostProps) {
  return (
    <Stack
      tag="button"
      role="button"
      height={58}
      borderRadius="$md"
      paddingHorizontal="$md"
      alignItems="center"
      justifyContent="center"
      backgroundColor="transparent"
      borderWidth={1}
      borderColor="$borderSubtle"
      hoverStyle={disabled ? undefined : { backgroundColor: "$surfaceGlass" }}
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
