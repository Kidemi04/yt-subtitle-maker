import * as React from "react";
import { Stack, Text, type StackProps } from "tamagui";

/**
 * ButtonPrimary — the canonical CTA.
 *
 * Spec: docs/superpowers/design-handoff/README.md → Component Inventory.
 *   height       : 56
 *   borderRadius : $md (12px)
 *   background   : warm coral from the Stitch design system
 *   text         : Inter 14px / 500 / $onAccent
 *   shadow       : soft warm editorial lift
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
      height={68}
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
      backgroundColor="$accent"
      hoverStyle={disabled ? undefined : { backgroundColor: "#924a31" }}
      style={{
        boxShadow: "0 8px 18px rgba(146,74,49,0.18)",
        border: "none",
        ...(style as object | null | undefined),
      }}
      {...rest}
    >
      <Text
        fontFamily="$body"
        fontSize={18}
        fontWeight="500"
        color="$onAccent"
      >
        {children}
      </Text>
    </Stack>
  );
}
