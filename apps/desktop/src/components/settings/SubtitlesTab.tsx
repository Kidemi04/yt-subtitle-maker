import * as React from "react";
import { XStack, YStack } from "tamagui";
import { GlassCard, TextInput, Toggle } from "@yt-subtitle-maker/ui";
import { useSettings } from "./SettingsContext";
import { Section, SettingRow } from "./shared";
import { NumberStepper } from "./NumberStepper";
import { ColorField } from "./ColorField";
import { FontPicker } from "./FontPicker";
import { SubtitlePreview } from "./SubtitlePreview";

export function SubtitlesTab() {
  const { draft, update } = useSettings();
  if (!draft) return null;
  return (
    <GlassCard variant="mid">
      <YStack gap="$md">
        <Section
          title="Subtitles"
          subtitle="How burned-in subtitles look when you Play with mpv. Leave a field blank to use mpv's default."
        />
        <SubtitlePreview cfg={draft} />
        <SettingRow
          id="subtitles.mpv-path"
          label="MPV executable path"
          helper="Path to the mpv binary. Leave blank to use mpv on your PATH."
        >
          <TextInput
            value={draft.mpvPath}
            onChangeText={(v: string) => update("mpvPath", v)}
            placeholder=""
          />
        </SettingRow>
        <SettingRow
          id="subtitles.font"
          label="Font family"
          helper={'e.g. "Noto Sans CJK SC", "Inter", "Arial". Must be installed on the OS — mpv does not download fonts.'}
        >
          <FontPicker value={draft.subFont} onChangeText={(v) => update("subFont", v)} />
        </SettingRow>
        <XStack gap="$md">
          <YStack flex={1}>
            <SettingRow
              id="subtitles.font-size"
              label="Font size"
              helper="Pixels. 0 = default (≈55)."
            >
              <NumberStepper
                value={draft.subFontSize}
                onValueChange={(n) => update("subFontSize", n)}
                min={0}
                defaultSentinel={0}
                stepperBase={55}
                placeholder="0"
                ariaLabel="Subtitle font size"
              />
            </SettingRow>
          </YStack>
          <YStack flex={1}>
            <SettingRow
              id="subtitles.margin-y"
              label="Bottom margin"
              helper="Distance from bottom edge (px)."
            >
              <NumberStepper
                value={draft.subMarginY}
                onValueChange={(n) => update("subMarginY", n)}
                min={0}
                defaultSentinel={0}
                stepperBase={18}
                placeholder="0"
                ariaLabel="Subtitle bottom margin"
              />
            </SettingRow>
          </YStack>
        </XStack>
        <XStack gap="$md">
          <YStack flex={1}>
            <SettingRow
              id="subtitles.color"
              label="Text color"
              helper="Pick a color or type a #hex."
            >
              <ColorField
                value={draft.subColor}
                onChangeText={(v) => update("subColor", v)}
                fallback="#ffffff"
                ariaLabel="Subtitle text color"
              />
            </SettingRow>
          </YStack>
          <YStack flex={1}>
            <SettingRow
              id="subtitles.border-color"
              label="Outline color"
              helper="Pick a color or type a #hex."
            >
              <ColorField
                value={draft.subBorderColor}
                onChangeText={(v) => update("subBorderColor", v)}
                fallback="#000000"
                ariaLabel="Subtitle outline color"
              />
            </SettingRow>
          </YStack>
        </XStack>
        <XStack gap="$md">
          <YStack flex={1}>
            <SettingRow
              id="subtitles.border-size"
              label="Outline width"
              helper="Pixels. 0 = no outline; blank = mpv default (≈3)."
            >
              <NumberStepper
                value={draft.subBorderSize}
                onValueChange={(n) => update("subBorderSize", n)}
                min={0}
                defaultSentinel={-1}
                stepperBase={3}
                placeholder="(mpv default)"
                ariaLabel="Subtitle outline width"
              />
            </SettingRow>
          </YStack>
          <YStack flex={1}>
            <SettingRow
              id="subtitles.back-color"
              label="Background"
              helper="Box behind text. Hex with alpha #RRGGBBAA. Blank = transparent."
            >
              <ColorField
                value={draft.subBackColor}
                onChangeText={(v) => update("subBackColor", v)}
                allowAlpha
                fallback="#000000"
                ariaLabel="Subtitle background"
              />
            </SettingRow>
          </YStack>
        </XStack>
        <SettingRow
          layout="row"
          id="subtitles.bold"
          label="Bold"
          helper="Render the subtitle font bold."
        >
          <Toggle
            value={draft.subBold}
            onValueChange={(v) => update("subBold", v)}
            aria-label="Subtitle bold"
          />
        </SettingRow>
      </YStack>
    </GlassCard>
  );
}
