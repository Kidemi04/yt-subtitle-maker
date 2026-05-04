import * as React from "react";
import { Sheet, Stack, Text, XStack, YStack } from "tamagui";

/**
 * ActionSheet — overflow-menu / action picker, built on Tamagui's Sheet
 * primitive.
 *
 * Spec: docs/superpowers/design-handoff/README.md → Component Inventory
 *       ("rgba(30,30,34,0.92) + heavy blur + borderRadius lg, width 260px").
 *
 *   surface : rgba(30,30,34,0.92) + blur(40px) saturate(180%)
 *   width   : 260
 *   radius  : $lg (20px)
 *   action  : 36h row, padding $xs $md, hover $surfaceGlass.
 *             destructive rows render in $error.
 *
 * Tamagui's Sheet primitive is bottom-anchored; the design-handoff calls for
 * a right-edge slide on desktop. V1 ships the Sheet as-is (bottom slide on
 * mobile, also acceptable on desktop) — a right-rail overlay variant is a
 * Phase 12+ refinement when we differentiate desktop/mobile portals.
 */
export type ActionSheetAction = {
  label: string;
  icon?: React.ReactNode;
  onPress: () => void;
  destructive?: boolean;
};

export type ActionSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: ReadonlyArray<ActionSheetAction>;
};

export function ActionSheet({ open, onOpenChange, actions }: ActionSheetProps) {
  return (
    <Sheet
      modal
      open={open}
      onOpenChange={onOpenChange}
      snapPointsMode="fit"
      dismissOnSnapToBottom
      animation="quick"
    >
      <Sheet.Overlay
        animation="quick"
        enterStyle={{ opacity: 0 }}
        exitStyle={{ opacity: 0 }}
        backgroundColor="rgba(10,10,12,0.5)"
      />
      <Sheet.Frame
        unstyled
        alignSelf="center"
        width={260}
        padding="$xs"
        borderRadius="$lg"
        borderWidth={1}
        borderColor="$borderStrong"
        backgroundColor="rgba(30,30,34,0.92)"
        style={{
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          boxShadow: "0 24px 48px rgba(0,0,0,0.5)",
        }}
      >
        <Sheet.Handle backgroundColor="$borderStrong" />
        <YStack paddingVertical="$xs">
          {actions.map((action, idx) => (
            <Stack
              key={`${action.label}-${idx}`}
              tag="button"
              role="button"
              height={36}
              paddingHorizontal="$md"
              paddingVertical="$xs"
              borderRadius="$sm"
              cursor="pointer"
              hoverStyle={{ backgroundColor: "$surfaceGlass" }}
              animation="quick"
              onPress={() => {
                action.onPress();
                onOpenChange(false);
              }}
            >
              <XStack alignItems="center" gap="$sm" flex={1}>
                {action.icon}
                <Text
                  fontFamily="$body"
                  fontSize={14}
                  fontWeight="500"
                  color={action.destructive ? "$error" : "$textPrimary"}
                >
                  {action.label}
                </Text>
              </XStack>
            </Stack>
          ))}
        </YStack>
      </Sheet.Frame>
    </Sheet>
  );
}
