// apps/desktop/src/components/settings/TranscriptionTab.tsx
import * as React from "react";
import { XStack, YStack } from "tamagui";
import { GlassCard, Dropdown, Toggle, Caption } from "@yt-subtitle-maker/ui";
import { LanguagePicker } from "./LanguagePicker";
import { useSettings } from "./SettingsContext";
import { Section, SettingRow } from "./shared";
import { DEVICES } from "./constants";
import { SourceModeControl } from "./SourceModeControl";
import { EnginePicker } from "./EnginePicker";

export function TranscriptionTab() {
  const {
    draft,
    update,
    engines,
    system,
    // fallback: keep these in scope in case engines/system fail to load
    sttEngineOptions,
    whisperModelOptions,
  } = useSettings();

  // Track the last Whisper engine id so SourceModeControl can restore it
  // when the user switches away from "YouTube captions only".
  // Hooks must run before any conditional return.
  const prevWhisperEngineRef = React.useRef<string>(
    draft && draft.defaultSttEngine !== "yt_captions" ? draft.defaultSttEngine : "openai-whisper",
  );
  React.useEffect(() => {
    if (draft && draft.defaultSttEngine !== "yt_captions") {
      prevWhisperEngineRef.current = draft.defaultSttEngine;
    }
  }, [draft?.defaultSttEngine]);

  if (!draft) return null;

  const isYtCaptionsMode = draft.defaultSttEngine === "yt_captions";

  return (
    <GlassCard variant="mid">
      <YStack gap="$md">
        <Section
          title="Transcription"
          subtitle="Defaults are overridable per-job in Generate."
        />

        {/* Source mode — the three-way toggle */}
        <SourceModeControl
          draft={draft}
          update={update}
          prevWhisperEngine={prevWhisperEngineRef.current}
        />

        {/* Engine picker — shown only when a Whisper engine is relevant */}
        {!isYtCaptionsMode ? (
          engines && system ? (
            <SettingRow id="transcription.engine-picker" label="Transcription engine">
              <EnginePicker
                engines={engines}
                system={system}
                selectedEngineId={draft.defaultSttEngine}
                onSelectEngine={(id) => update("defaultSttEngine", id)}
                draft={draft}
                update={update}
              />
            </SettingRow>
          ) : engines === undefined && system === undefined ? (
            /* Still loading */
            <Caption color="$textSecondary">Loading engine info…</Caption>
          ) : (
            /* Fallback: engines/system failed to load — show the old dropdowns */
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
          )
        ) : null}

        {/* General settings — always visible */}
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
              <LanguagePicker
                value={draft.defaultSourceLang}
                onValueChange={(v) => update("defaultSourceLang", v)}
                width="100%"
                aria-label="Default source language"
              />
            </SettingRow>
          </YStack>
        </XStack>
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
