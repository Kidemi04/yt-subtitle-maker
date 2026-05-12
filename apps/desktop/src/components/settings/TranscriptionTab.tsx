import * as React from "react";
import { XStack, YStack } from "tamagui";
import { GlassCard, Dropdown, Toggle } from "@yt-subtitle-maker/ui";
import { useSettings } from "./SettingsContext";
import { Section, SettingRow } from "./shared";
import { DEVICES, LANGS } from "./constants";

export function TranscriptionTab() {
  const { draft, update, sttEngineOptions, whisperModelOptions } = useSettings();
  if (!draft) return null;
  return (
    <GlassCard variant="mid">
      <YStack gap="$md">
        <Section
          title="Transcription"
          subtitle="Defaults are overridable per-job in Generate."
        />
        <XStack gap="$md" flexWrap="wrap">
          <YStack flex={1} minWidth={220}>
            <SettingRow id="transcription.engine" label="Default engine">
              <Dropdown
                value={draft.defaultSttEngine}
                onValueChange={(v) => update("defaultSttEngine", v)}
                options={sttEngineOptions}
                width="100%"
              />
            </SettingRow>
          </YStack>
          <YStack flex={1} minWidth={220}>
            <SettingRow id="transcription.model" label="Default model">
              <Dropdown
                value={draft.defaultWhisperModel}
                onValueChange={(v) => update("defaultWhisperModel", v)}
                options={whisperModelOptions}
                width="100%"
              />
            </SettingRow>
          </YStack>
        </XStack>
        <XStack gap="$md" flexWrap="wrap">
          <YStack flex={1} minWidth={220}>
            <SettingRow id="transcription.device" label="Default device">
              <Dropdown
                value={draft.defaultWhisperDevice}
                onValueChange={(v) => update("defaultWhisperDevice", v)}
                options={DEVICES}
                width="100%"
              />
            </SettingRow>
          </YStack>
          <YStack flex={1} minWidth={220}>
            <SettingRow
              id="transcription.source-lang"
              label="Default source language"
              helper="Setting a default prevents Whisper misdetection on intros / music."
            >
              <Dropdown
                value={draft.defaultSourceLang}
                onValueChange={(v) => update("defaultSourceLang", v)}
                options={LANGS}
                width="100%"
              />
            </SettingRow>
          </YStack>
        </XStack>
        <SettingRow
          layout="row"
          id="transcription.yt-captions-first"
          label="Try YouTube auto-captions first"
          helper="Master switch for Auto mode. When off, Whisper always runs."
        >
          <Toggle
            value={draft.ytCaptionsFirst}
            onValueChange={(v) => update("ytCaptionsFirst", v)}
            aria-label="YT captions first"
          />
        </SettingRow>
        <SettingRow
          layout="row"
          id="transcription.vad"
          label="Voice-Activity Detection (VAD) by default"
          helper="Skips silent regions before Whisper — faster on long videos. Per-job override stays on the Generate screen."
        >
          <Toggle
            value={draft.vadEnabled}
            onValueChange={(v) => update("vadEnabled", v)}
            aria-label="VAD default"
          />
        </SettingRow>
        <SettingRow
          layout="row"
          id="transcription.ffmpeg-resample-16k"
          label="FFmpeg 16 kHz pre-resample"
          helper="Pre-resamples to 16 kHz mono before Whisper for timestamp accuracy."
        >
          <Toggle
            value={draft.ffmpegResample16k}
            onValueChange={(v) => update("ffmpegResample16k", v)}
            aria-label="FFmpeg pre-resample"
          />
        </SettingRow>
      </YStack>
    </GlassCard>
  );
}
