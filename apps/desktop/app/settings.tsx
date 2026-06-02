import * as React from "react";
import { Stack, XStack, YStack } from "tamagui";
import { CheckCircle2, RotateCcw, TriangleAlert } from "@tamagui/lucide-icons";
import {
  GlassCard,
  BadgePill,
  ButtonGhost,
  BodySm,
  Caption,
  CaptionUpper,
  DisplaySm,
} from "@yt-subtitle-maker/ui";
import { useSettings } from "../src/components/settings/SettingsContext";
import { TABS, type TabId } from "../src/components/settings/constants";
import { SettingsRail } from "../src/components/settings/SettingsRail";
import { GeneralTab } from "../src/components/settings/GeneralTab";
import { YouTubeTab } from "../src/components/settings/YouTubeTab";
import { TranscriptionTab } from "../src/components/settings/TranscriptionTab";
import { TranslationTab } from "../src/components/settings/TranslationTab";
import { SubtitlesTab } from "../src/components/settings/SubtitlesTab";
import { AdvancedTab } from "../src/components/settings/AdvancedTab";
import { SettingsSearch } from "../src/components/settings/SettingsSearch";

const TAB_COMPONENTS: Record<TabId, React.ComponentType> = {
  general: GeneralTab,
  youtube: YouTubeTab,
  transcription: TranscriptionTab,
  translation: TranslationTab,
  subtitles: SubtitlesTab,
  advanced: AdvancedTab,
};

export default function Settings() {
  return <SettingsShell />;
}

function SettingsShell() {
  const {
    draft,
    loading,
    error,
    saveStatus,
    retrySave,
    activeTab,
    searchQuery,
    tabDiffersFromDefaults,
    resetTab,
  } = useSettings();

  if (loading || !draft) {
    return (
      <YStack gap="$lg">
        <YStack gap="$xs">
          <DisplaySm>Settings</DisplaySm>
          <BodySm color="$textSecondary">
            Load your backend configuration and local tool defaults.
          </BodySm>
        </YStack>
        <GlassCard variant="mid">
          <BodySm color="$textSecondary">
            {error ? `Failed to load config: ${error}` : "Loading config..."}
          </BodySm>
        </GlassCard>
      </YStack>
    );
  }

  const ActiveTab = TAB_COMPONENTS[activeTab];
  const activeLabel = TABS.find((t) => t.id === activeTab)?.label ?? "Settings";

  return (
    <YStack gap="$lg" paddingBottom={72}>
      <GlassCard variant="mid" padding="$lg">
        <YStack gap="$lg">
          <XStack alignItems="flex-start" justifyContent="space-between" gap="$lg">
            <YStack gap="$xs" flex={1}>
              <CaptionUpper>Control center</CaptionUpper>
              <DisplaySm>Settings</DisplaySm>
              <BodySm color="$textSecondary">
                Tune paths, transcription defaults, translation providers,
                subtitle styling, and backend behavior.
              </BodySm>
            </YStack>

            <YStack gap="$xs" alignItems="flex-end">
              {saveStatus === "saving" ? (
                <BadgePill>saving...</BadgePill>
              ) : saveStatus === "saved" ? (
                <BadgePill tone="success">
                  <XStack alignItems="center" gap="$xs">
                    <CheckCircle2 size={14} color="$success" />
                    <Caption color="$success">saved</Caption>
                  </XStack>
                </BadgePill>
              ) : saveStatus === "error" ? (
                <XStack gap="$sm" alignItems="center">
                  <BadgePill tone="error">
                    <XStack alignItems="center" gap="$xs">
                      <TriangleAlert size={14} color="$error" />
                      <Caption color="$error">save failed</Caption>
                    </XStack>
                  </BadgePill>
                  <ButtonGhost onPress={retrySave} height={42}>
                    retry
                  </ButtonGhost>
                </XStack>
              ) : (
                <BadgePill tone="neutral">autosave on</BadgePill>
              )}

              <ButtonGhost
                height={42}
                disabled={!tabDiffersFromDefaults(activeTab)}
                onPress={() => {
                  if (
                    typeof window !== "undefined" &&
                    !window.confirm(
                      `Reset every setting on the ${activeLabel} tab to its default?`,
                    )
                  )
                    return;
                  resetTab(activeTab);
                }}
              >
                <XStack alignItems="center" gap="$xs">
                  <RotateCcw size={14} color="$textSecondary" />
                  <Caption color="$textSecondary">Reset {activeLabel}</Caption>
                </XStack>
              </ButtonGhost>
            </YStack>
          </XStack>

          <SettingsRail />
          <SettingsSearch />
        </YStack>
      </GlassCard>

      {searchQuery.trim().length >= 2 ? null : (
        <YStack width="100%" maxWidth={980} alignSelf="center" gap="$md">
          <ActiveTab />
        </YStack>
      )}
    </YStack>
  );
}
