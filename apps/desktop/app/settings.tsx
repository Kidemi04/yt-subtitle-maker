import * as React from "react";
import { Stack, XStack, YStack } from "tamagui";
import {
  GlassCard,
  BadgePill,
  ButtonGhost,
  BodySm,
  Caption,
} from "@yt-subtitle-maker/ui";
import { SettingsProvider, useSettings } from "../src/components/settings/SettingsContext";
import { Section } from "../src/components/settings/shared";
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
  return (
    <SettingsProvider>
      <SettingsShell />
    </SettingsProvider>
  );
}

function SettingsShell() {
  const {
    draft, loading, error,
    saveStatus, retrySave,
    activeTab, searchQuery,
    tabDiffersFromDefaults, resetTab,
  } = useSettings();

  if (loading || !draft) {
    return (
      <YStack gap="$lg">
        <Section title="Settings" />
        <GlassCard variant="mid">
          <BodySm color="$textSecondary">
            {error ? `Failed to load config: ${error}` : "Loading config…"}
          </BodySm>
        </GlassCard>
      </YStack>
    );
  }

  const ActiveTab = TAB_COMPONENTS[activeTab];

  return (
    <YStack gap="$lg" paddingBottom={120}>
      <Section
        title="Settings"
        subtitle="Backend, cookies, transcription, translation, subtitles, advanced."
      />

      <XStack gap="$lg" alignItems="flex-start">
        <SettingsRail />
        <YStack flex={1} gap="$lg">
          <SettingsSearch />
          {searchQuery.trim().length >= 2 ? null : <ActiveTab />}
        </YStack>
      </XStack>

      {/* Sticky footer (position: sticky lives in inline style — Tamagui's
          position prop doesn't accept it on web targets). Autosave model:
          a quiet `saveStatus`-driven pill on the left + a per-tab
          "Reset this tab" ghost button on the right. The "Reset all to
          defaults" affordance lives on the Advanced tab, not here. */}
      <XStack
        marginTop="$lg"
        padding="$md"
        backgroundColor="$bgElevated"
        borderTopWidth={1}
        borderTopColor="$borderSubtle"
        alignItems="center"
        gap="$sm"
        style={{ position: "sticky", bottom: 0, zIndex: 50 }}
      >
        {/* status, left-anchored */}
        {saveStatus === "saving" ? (
          <BadgePill>saving…</BadgePill>
        ) : saveStatus === "saved" ? (
          <BadgePill tone="success">✓ saved</BadgePill>
        ) : saveStatus === "error" ? (
          <XStack gap="$sm" alignItems="center">
            <BadgePill tone="error">couldn't save</BadgePill>
            <ButtonGhost onPress={retrySave}>retry</ButtonGhost>
          </XStack>
        ) : (
          <Caption color="$textMuted">Changes save automatically.</Caption>
        )}
        <Stack flex={1} />
        <ButtonGhost
          disabled={!tabDiffersFromDefaults(activeTab)}
          onPress={() => {
            if (
              typeof window !== "undefined" &&
              !window.confirm(
                `Reset every setting on the ${TABS.find((t) => t.id === activeTab)?.label} tab to its default?`,
              )
            )
              return;
            resetTab(activeTab);
          }}
        >
          Reset this tab
        </ButtonGhost>
      </XStack>
    </YStack>
  );
}
