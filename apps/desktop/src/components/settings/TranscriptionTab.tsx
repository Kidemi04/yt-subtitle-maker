import * as React from "react";
import { XStack, YStack } from "tamagui";
import {
  Caption,
  CaptionUpper,
  Dropdown,
  TitleMd,
  Toggle,
} from "@yt-subtitle-maker/ui";
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
    refreshEngines,
    sttEngineOptions,
    whisperModelOptions,
  } = useSettings();

  const prevWhisperEngineRef = React.useRef<string>(
    draft && draft.defaultSttEngine !== "yt_captions"
      ? draft.defaultSttEngine
      : "openai-whisper",
  );

  React.useEffect(() => {
    if (draft && draft.defaultSttEngine !== "yt_captions") {
      prevWhisperEngineRef.current = draft.defaultSttEngine;
    }
  }, [draft?.defaultSttEngine]);

  if (!draft) return null;

  const isYtCaptionsMode = draft.defaultSttEngine === "yt_captions";
  const vadSupported = false;

  return (
    <YStack gap="$md">
      <Section
        title="Transcription"
        subtitle="Defaults are overridable per-job in Generate."
      />

      <SourceModeControl
        draft={draft}
        update={update}
        prevWhisperEngine={prevWhisperEngineRef.current}
      />

      {!isYtCaptionsMode ? (
        engines && system ? (
          <YStack nativeID="transcription.engine-picker" gap="$sm">
            <YStack gap={2}>
              <CaptionUpper>Transcription engine</CaptionUpper>
              <TitleMd>Engine, model, and optional add-ons</TitleMd>
            </YStack>
            <EnginePicker
              engines={engines}
              system={system}
              selectedEngineId={draft.defaultSttEngine}
              onSelectEngine={(id) => update("defaultSttEngine", id)}
              draft={draft}
              update={update}
              refreshEngines={refreshEngines}
            />
          </YStack>
        ) : engines === undefined && system === undefined ? (
          <Caption color="$textSecondary">Loading engine info...</Caption>
        ) : (
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
        label="Voice-Activity Detection (VAD)"
        helper="Not active with the current OpenAI Whisper adapter. This is reserved for future add-on engines that expose real VAD."
      >
        <Toggle
          value={vadSupported && draft.vadEnabled}
          onValueChange={(v) => update("vadEnabled", v)}
          disabled={!vadSupported}
          aria-label="VAD default"
        />
      </SettingRow>

      <SettingRow
        layout="row"
        id="transcription.ffmpeg-resample-16k"
        label="FFmpeg 16 kHz pre-resample"
        helper="Applies to new downloads. When on, yt-dlp/FFmpeg writes 16 kHz mono WAV before transcription."
      >
        <Toggle
          value={draft.ffmpegResample16k}
          onValueChange={(v) => update("ffmpegResample16k", v)}
          aria-label="FFmpeg pre-resample"
        />
      </SettingRow>
    </YStack>
  );
}
