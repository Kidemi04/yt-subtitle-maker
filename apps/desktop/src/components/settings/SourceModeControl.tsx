// apps/desktop/src/components/settings/SourceModeControl.tsx
// "Source mode" segmented control — the three-way setting that maps onto
// ytCaptionsFirst + defaultSttEngine in AppConfig.
//
// Config mapping (documented in the 4c-frontend plan, judgment call #1):
//   Auto             → ytCaptionsFirst = true   (defaultSttEngine unchanged)
//   Local transcription → ytCaptionsFirst = false  (defaultSttEngine unchanged)
//   YouTube captions → defaultSttEngine = "yt_captions" (ytCaptionsFirst unchanged)
//
// Reading the current value:
//   defaultSttEngine === "yt_captions" → "yt_captions"
//   ytCaptionsFirst === true           → "auto"
//   else                               → "whisper"
import * as React from "react";
import { YStack } from "tamagui";
import { SegmentedControl } from "@yt-subtitle-maker/ui";
import type { SegmentedControlOption } from "@yt-subtitle-maker/ui";
import type { AppConfig } from "@yt-subtitle-maker/api-client";
import { deriveSourceModeFromConfig } from "../../state/generateSelection";
import { SettingRow } from "./shared";

type SourceMode = "auto" | "whisper" | "yt_captions";

const SOURCE_OPTIONS: ReadonlyArray<SegmentedControlOption<SourceMode>> = [
  { label: "Local transcription", value: "whisper" },
  { label: "Auto fallback", value: "auto" },
  { label: "YouTube captions only", value: "yt_captions" },
];

interface Props {
  draft: AppConfig;
  update: <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => void;
  /** The previously-selected Whisper engine id (used to restore when leaving yt_captions mode). */
  prevWhisperEngine: string;
}

export function SourceModeControl({ draft, update, prevWhisperEngine }: Props) {
  const current = deriveSourceModeFromConfig(draft);

  const handleChange = (mode: SourceMode) => {
    if (mode === "auto") {
      update("ytCaptionsFirst", true);
      // If we were in yt_captions mode, restore the previous Whisper engine
      if (draft.defaultSttEngine === "yt_captions") {
        update("defaultSttEngine", prevWhisperEngine || "openai-whisper");
      }
    } else if (mode === "whisper") {
      update("ytCaptionsFirst", false);
      // Same restore logic
      if (draft.defaultSttEngine === "yt_captions") {
        update("defaultSttEngine", prevWhisperEngine || "openai-whisper");
      }
    } else {
      // yt_captions — just set the engine; ytCaptionsFirst is irrelevant when
      // defaultSttEngine is "yt_captions" (pipeline checks the engine first)
      update("defaultSttEngine", "yt_captions");
    }
  };

  return (
    <SettingRow
      id="transcription.source-mode"
      label="Source"
      helper="Local transcription is the default. Auto fallback tries YouTube captions first; YouTube captions only is explicit opt-in."
    >
      <SegmentedControl
        options={SOURCE_OPTIONS}
        value={current}
        onValueChange={handleChange}
      />
    </SettingRow>
  );
}
