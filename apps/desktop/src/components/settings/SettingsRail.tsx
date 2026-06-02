import * as React from "react";
import { Stack, XStack, YStack } from "tamagui";
import {
  Captions,
  Cookie,
  FolderCog,
  Languages,
  Mic,
  Settings2,
  Wrench,
} from "@tamagui/lucide-icons";
import { BodySm, Caption, CaptionUpper } from "@yt-subtitle-maker/ui";
import { useSettings } from "./SettingsContext";
import { TABS, type TabId } from "./constants";

const TAB_META: Record<
  TabId,
  {
    description: string;
    icon: React.ComponentType<{ size?: number; color?: string }>;
  }
> = {
  general: {
    description: "Folders and app behavior",
    icon: FolderCog,
  },
  youtube: {
    description: "Cookies and JS runtime",
    icon: Cookie,
  },
  transcription: {
    description: "Whisper, captions, languages",
    icon: Mic,
  },
  translation: {
    description: "Providers and defaults",
    icon: Languages,
  },
  subtitles: {
    description: "Playback and subtitle style",
    icon: Captions,
  },
  advanced: {
    description: "Backend and reset tools",
    icon: Wrench,
  },
};

export function SettingsRail() {
  const { activeTab, setActiveTab } = useSettings();

  return (
    <YStack gap="$sm">
      <XStack alignItems="center" justifyContent="space-between">
        <CaptionUpper>Sections</CaptionUpper>
        <Settings2 size={16} color="$textMuted" />
      </XStack>

      <XStack gap="$sm" flexWrap="wrap">
        {TABS.map((t) => {
          const active = t.id === activeTab;
          const meta = TAB_META[t.id];
          const Icon = meta.icon;

          return (
            <Stack
              key={t.id}
              tag="button"
              role="button"
              position="relative"
              minWidth={184}
              flex={1}
              borderRadius="$md"
              padding="$sm"
              backgroundColor={active ? "$accentSoft" : "$bgBase"}
              borderWidth={1}
              borderColor={active ? "$accentDim" : "$borderSubtle"}
              overflow="hidden"
              hoverStyle={active ? undefined : { backgroundColor: "$surfaceGlass" }}
              animation="quick"
              cursor="pointer"
              onPress={() => setActiveTab(t.id)}
              aria-label={t.label}
              aria-current={active ? "page" : undefined}
            >
              {active ? (
                <Stack
                  position="absolute"
                  left={0}
                  right={0}
                  bottom={0}
                  height={3}
                  backgroundColor="$accent"
                />
              ) : null}

              <XStack alignItems="flex-start" gap="$sm">
                <Stack
                  width={38}
                  height={38}
                  borderRadius="$sm"
                  alignItems="center"
                  justifyContent="center"
                  backgroundColor={active ? "$bgBase" : "$surfaceGlass"}
                  borderWidth={1}
                  borderColor={active ? "$accentDim" : "$borderSubtle"}
                >
                  <Icon size={18} color={active ? "$accent" : "$textSecondary"} />
                </Stack>
                <YStack flex={1} gap={2}>
                  <BodySm
                    fontWeight={active ? "600" : "500"}
                    color={active ? "$accent" : "$textPrimary"}
                  >
                    {t.label}
                  </BodySm>
                  <Caption color="$textMuted">{meta.description}</Caption>
                </YStack>
              </XStack>
            </Stack>
          );
        })}
      </XStack>
    </YStack>
  );
}
