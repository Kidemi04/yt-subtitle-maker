import * as React from "react";
import { Stack, Text, XStack, type StackProps } from "tamagui";

/**
 * SidebarItem — primary nav row for the left sidebar.
 *
 * Spec: docs/superpowers/design-handoff/README.md → Screen 13 +
 *       Component Inventory ("44px row, borderRadius md, accent left bar +
 *       accentSoft bg when active").
 *
 *   height       : 44
 *   borderRadius : $md (12px)
 *   padding      : $xs $md (8 / 16)
 *   icon         : caller-supplied lucide icon, left
 *   label        : Inter 14 / 500
 *
 *   active   : $accentSoft bg, $accent text, 3px-wide $accent left bar
 *              (absolute-positioned full-height Stack — keeps the bar flush
 *              against the row's left radius).
 *   inactive : transparent bg, $textSecondary text, hover bg → $surfaceGlass.
 *
 * The active left-bar uses `position: absolute` with `left=0 top=0 bottom=0`
 * + width 3 + the row's own borderRadius. Tamagui's absolute children inherit
 * the parent's radius via `overflow: hidden` on the parent.
 */
export type SidebarItemProps = {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onPress?: () => void;
} & Omit<StackProps, "children" | "onPress">;

export function SidebarItem({
  icon,
  label,
  active,
  onPress,
  ...rest
}: SidebarItemProps) {
  return (
    <Stack
      tag="button"
      role="button"
      position="relative"
      height={44}
      borderRadius="$md"
      paddingHorizontal="$md"
      paddingVertical="$xs"
      backgroundColor={active ? "$accentSoft" : "transparent"}
      overflow="hidden"
      hoverStyle={
        active
          ? undefined
          : { backgroundColor: "$surfaceGlass" }
      }
      animation="quick"
      cursor="pointer"
      onPress={onPress}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      {...rest}
    >
      {/* Active left bar — 3px wide, full-height, accent-colored. */}
      {active ? (
        <Stack
          position="absolute"
          left={0}
          top={0}
          bottom={0}
          width={3}
          backgroundColor="$accent"
        />
      ) : null}

      <XStack flex={1} alignItems="center" gap="$sm">
        {icon}
        <Text
          fontFamily="$body"
          fontSize={14}
          fontWeight="500"
          color={active ? "$accent" : "$textSecondary"}
        >
          {label}
        </Text>
      </XStack>
    </Stack>
  );
}
