import * as React from "react";
import { Stack, Text, type StackProps } from "tamagui";

/**
 * BadgeAccent — accent-tinted captionUpper pill. Used for "RECOMMENDED",
 * "TRANSLATED TITLE" labels, etc.
 *
 * Spec: docs/superpowers/design-handoff/README.md → Component Inventory.
 *   shape   : $pill radius
 *   padding : $xs $sm  (8 vertical, 12 horizontal)
 *   bg      : $accentSoft
 *   text    : $accent, captionUpper style — Inter 11px / 600,
 *             letterSpacing 1.5, textTransform uppercase
 */
export type BadgeAccentProps = {
  children: React.ReactNode;
} & Omit<StackProps, "children">;

export function BadgeAccent({ children, ...rest }: BadgeAccentProps) {
  return (
    <Stack
      paddingVertical="$sm"
      paddingHorizontal="$md"
      borderRadius="$pill"
      backgroundColor="$accentSoft"
      alignItems="center"
      justifyContent="center"
      {...rest}
    >
      <Text
        fontFamily="$body"
        fontSize={14}
        fontWeight="600"
        letterSpacing={1.5}
        textTransform="uppercase"
        color="$accent"
      >
        {children}
      </Text>
    </Stack>
  );
}
