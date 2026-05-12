import * as React from "react";
import { Stack, XStack, YStack } from "tamagui";
import {
  GlassCard,
  ButtonPrimary,
  ButtonGhost,
  BadgePill,
  BadgeAccent,
  BodySm,
  Caption,
} from "@yt-subtitle-maker/ui";
import { SettingsProvider, useSettings } from "../src/components/settings/SettingsContext";
import { Section, type TabId } from "../src/components/settings/shared";
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
    saving, dirty, onSave, onDiscard,
    activeTab, searchQuery,
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
          position prop doesn't accept it on web targets). The left-aligned
          status sentence anchors the bar so it doesn't read as floating. */}
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
        <Caption color="$textMuted">
          Click Save settings to apply changes.
        </Caption>
        <Stack flex={1} />
        {dirty ? (
          <BadgeAccent>unsaved changes</BadgeAccent>
        ) : (
          <BadgePill tone="success">all saved</BadgePill>
        )}
        <ButtonGhost onPress={onDiscard} disabled={!dirty || saving}>
          Discard
        </ButtonGhost>
        <ButtonPrimary onPress={onSave} disabled={!dirty || saving}>
          {saving ? "Saving…" : "Save settings"}
        </ButtonPrimary>
      </XStack>
    </YStack>
  );
}
