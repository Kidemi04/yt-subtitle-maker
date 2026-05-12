import * as React from "react";
import { YStack } from "tamagui";
import { GlassCard, Dropdown, TextInput } from "@yt-subtitle-maker/ui";
import { useSettings } from "./SettingsContext";
import { Section, SettingRow, VERBOSITY } from "./shared";

export function GeneralTab() {
  const { draft, update, defaults } = useSettings();
  if (!draft) return null;
  return (
    <GlassCard variant="mid">
      <YStack gap="$md">
        <Section title="General" />
        <SettingRow id="general.output-dir" label="Output folder" helper="Where finished .srt files are written. Leave blank to use the default location.">
          <TextInput value={draft.outputDir} onChangeText={(v: string) => update("outputDir", v)} placeholder={defaults?.outputDir || ""} />
        </SettingRow>
        <SettingRow id="general.download-dir" label="Download folder" helper="Where downloaded audio is kept. Leave blank to use the default location.">
          <TextInput value={draft.downloadDir} onChangeText={(v: string) => update("downloadDir", v)} placeholder={defaults?.downloadDir || ""} />
        </SettingRow>
        <SettingRow id="general.whisper-cache-dir" label="Whisper cache directory" helper="Where Whisper model weights are cached. Leave blank for the default.">
          <TextInput value={draft.whisperCacheDir} onChangeText={(v: string) => update("whisperCacheDir", v)} placeholder={defaults?.whisperCacheDir || ""} />
        </SettingRow>
        <SettingRow id="general.logs-verbosity" label="Logs verbosity">
          <Dropdown
            value={draft.logsVerbosity}
            onValueChange={(v) => update("logsVerbosity", v as typeof draft.logsVerbosity)}
            options={VERBOSITY}
            width={240}
          />
        </SettingRow>
      </YStack>
    </GlassCard>
  );
}
