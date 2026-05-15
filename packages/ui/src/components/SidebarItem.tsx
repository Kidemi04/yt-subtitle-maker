import * as React from "react";
import { Stack, Text, XStack, type StackProps } from "tamagui";

/**
 * SidebarItem — primary nav row for the left sidebar.
 *
 *   height       : 40
 *   borderRadius : $sm (8px)
 *   padding      : $xs $sm (8 / 12)
 *   icon         : caller-supplied lucide icon, left
 *   label        : Inter 13 / 500
 *
 *   active   : accent text + accent icon, 3px x 16px pill indicator at the
 *              left edge (vertically centered), faint accent tint bg
 *              ($accentSoft at 4% opacity — far lighter than the 15% slab
 *              that read as a "glow"). Text weight bumps to 600.
 *   inactive : transparent bg, $textSecondary text, hover lifts the row with
 *              a $surfaceGlass tint and text → $textPrimary.
 *
 * Button reset: `tag="button"` renders a native <button>, which inherits the
 * UA grey border by default. Setting borderWidth=0 + outlineWidth=0 strips
 * that so the row is visually owned by Tamagui props only.
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
      height={40}
      borderRadius="$sm"
      paddingLeft={14}
      paddingRight="$sm"
      paddingVertical="$xs"
      borderWidth={0}
      outlineWidth={0}
      backgroundColor={active ? "rgba(251,146,60,0.06)" : "transparent"}
      hoverStyle={
        active
          ? { backgroundColor: "rgba(251,146,60,0.09)" }
          : { backgroundColor: "rgba(255,255,255,0.035)" }
      }
      pressStyle={{ backgroundColor: "rgba(251,146,60,0.12)" }}
      animation="quick"
      cursor="pointer"
      onPress={onPress}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      style={{
        WebkitTapHighlightColor: "transparent",
        appearance: "none",
        textAlign: "left",
      }}
      {...rest}
    >
      {/* Active indicator — short 3×16 accent pill, vertically centered. */}
      {active ? (
        <Stack
          position="absolute"
          left={0}
          top="50%"
          width={3}
          height={16}
          marginTop={-8}
          borderTopRightRadius={2}
          borderBottomRightRadius={2}
          backgroundColor="$accent"
          style={{ boxShadow: "0 0 12px rgba(251,146,60,0.45)" }}
        />
      ) : null}

      <XStack flex={1} alignItems="center" gap={10}>
        {icon}
        <Text
          fontFamily="$body"
          fontSize={13}
          fontWeight={active ? "600" : "500"}
          letterSpacing={0.1}
          color={active ? "$accent" : "$textSecondary"}
        >
          {label}
        </Text>
      </XStack>
    </Stack>
  );
}
