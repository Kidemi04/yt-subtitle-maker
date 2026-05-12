import * as React from "react";
import { Stack, YStack, XStack, Text } from "tamagui";
import { useSettings } from "./SettingsContext";
import { TABS } from "./constants";

/**
 * SettingsRail — narrow left column of six clickable sub-tab buttons.
 * The active item gets a background tint + border; clicking any item calls
 * setActiveTab from the SettingsContext, which reflects into the URL via
 * router.setParams so the active tab survives navigation.
 */
export function SettingsRail() {
  const { activeTab, setActiveTab } = useSettings();
  return (
    <YStack
      gap="$xxs"
      width={184}
      paddingRight="$sm"
      borderRightWidth={1}
      borderRightColor="$borderSubtle"
    >
      {TABS.map((t) => {
        const active = t.id === activeTab;
        return (
          <Stack
            key={t.id}
            tag="button"
            role="button"
            position="relative"
            borderRadius="$md"
            paddingVertical="$sm"
            paddingHorizontal="$sm"
            backgroundColor={active ? "$surfaceGlass" : "transparent"}
            borderWidth={1}
            borderColor={active ? "$borderSubtle" : "transparent"}
            overflow="hidden"
            hoverStyle={active ? undefined : { backgroundColor: "$surfaceGlass" }}
            animation="quick"
            cursor="pointer"
            onPress={() => setActiveTab(t.id)}
            aria-label={t.label}
            aria-current={active ? "page" : undefined}
          >
            {/* Active left bar — mirrors the SidebarItem convention */}
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
            <XStack alignItems="center" paddingLeft="$xs">
              <Text
                fontFamily="$body"
                fontSize={14}
                fontWeight={active ? "600" : "400"}
                color={active ? "$text" : "$textSecondary"}
              >
                {t.label}
              </Text>
            </XStack>
          </Stack>
        );
      })}
    </YStack>
  );
}
