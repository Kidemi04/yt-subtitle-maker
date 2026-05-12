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
import { Section } from "../src/components/settings/shared";
import { GeneralTab } from "../src/components/settings/GeneralTab";
import { YouTubeTab } from "../src/components/settings/YouTubeTab";
import { TranscriptionTab } from "../src/components/settings/TranscriptionTab";
import { TranslationTab } from "../src/components/settings/TranslationTab";
import { SubtitlesTab } from "../src/components/settings/SubtitlesTab";
import { AdvancedTab } from "../src/components/settings/AdvancedTab";

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

  return (
    <YStack gap="$lg" paddingBottom={120}>
      <Section
        title="Settings"
        subtitle="Backend, cookies, transcription, translation, subtitles, advanced."
      />

      <GeneralTab />
      <YouTubeTab />
      <TranscriptionTab />
      <TranslationTab />
      <SubtitlesTab />
      <AdvancedTab />

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
