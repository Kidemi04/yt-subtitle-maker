import * as React from "react";
import { Stack, Text, type StackProps } from "tamagui";

/**
 * ButtonPrimary — the canonical CTA.
 *
 * Spec: docs/superpowers/design-handoff/README.md → Component Inventory.
 *   height       : 56
 *   borderRadius : $md (12px)
 *   background   : sunset-orange gradient (#fb923c → #f97316, vertical)
 *   text         : Inter 15px / 600 / $textPrimary
 *   shadow       : 0 4px 20px rgba(251,146,60,0.4) (accent glow)
 *   press        : scale 0.97, 150ms (Tamagui `quick` animation)
 *   disabled     : opacity 0.4, cursor not-allowed
 *
 * `tag="button"` makes Tamagui render a real <button> on web for keyboard
 * + a11y. On native the prop is ignored.
 */
export type ButtonPrimaryProps = {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
} & Omit<StackProps, "children" | "onPress" | "disabled">;

export function ButtonPrimary({
  children,
  onPress,
  disabled,
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
        boxShadow: "0 4px 20px rgba(251,146,60,0.4)",
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
