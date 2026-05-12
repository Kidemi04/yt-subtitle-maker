import * as React from "react";
import { XStack, YStack } from "tamagui";
import { GlassCard, TextInput, Toggle } from "@yt-subtitle-maker/ui";
import { useSettings } from "./SettingsContext";
import { Section, SettingRow } from "./shared";

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
          <TextInput
            value={draft.subFont}
            onChangeText={(v: string) => update("subFont", v)}
            placeholder="(mpv default sans)"
          />
        </SettingRow>
        <XStack gap="$md">
          <YStack flex={1}>
            <SettingRow
              id="subtitles.font-size"
              label="Font size"
              helper="Pixels. 0 = default (≈55)."
            >
              <TextInput
                value={draft.subFontSize ? String(draft.subFontSize) : ""}
                onChangeText={(v: string) =>
                  update("subFontSize", parseInt(v, 10) || 0)
                }
                placeholder="0"
                keyboardType="numeric"
              />
            </SettingRow>
          </YStack>
          <YStack flex={1}>
            <SettingRow
              id="subtitles.margin-y"
              label="Bottom margin"
              helper="Distance from bottom edge (px)."
            >
              <TextInput
                value={draft.subMarginY ? String(draft.subMarginY) : ""}
                onChangeText={(v: string) =>
                  update("subMarginY", parseInt(v, 10) || 0)
                }
                placeholder="0"
                keyboardType="numeric"
              />
            </SettingRow>
          </YStack>
        </XStack>
        <XStack gap="$md">
          <YStack flex={1}>
            <SettingRow
              id="subtitles.color"
              label="Text color"
              helper="Hex like #ffffff."
            >
              <TextInput
                value={draft.subColor}
                onChangeText={(v: string) => update("subColor", v)}
                placeholder="#ffffff"
              />
            </SettingRow>
          </YStack>
          <YStack flex={1}>
            <SettingRow
              id="subtitles.border-color"
              label="Outline color"
              helper="Hex like #000000."
            >
              <TextInput
                value={draft.subBorderColor}
                onChangeText={(v: string) => update("subBorderColor", v)}
                placeholder="#000000"
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
              <TextInput
                value={
                  draft.subBorderSize >= 0 ? String(draft.subBorderSize) : ""
                }
                onChangeText={(v: string) => {
                  if (v.trim() === "") {
                    update("subBorderSize", -1);
                    return;
                  }
                  const parsed = Number(v);
                  update("subBorderSize", Number.isFinite(parsed) ? parsed : -1);
                }}
                placeholder="(mpv default)"
                keyboardType="numeric"
              />
            </SettingRow>
          </YStack>
          <YStack flex={1}>
            <SettingRow
              id="subtitles.back-color"
              label="Background"
              helper="Box behind text. Hex with alpha #RRGGBBAA. Blank = transparent."
            >
              <TextInput
                value={draft.subBackColor}
                onChangeText={(v: string) => update("subBackColor", v)}
                placeholder="(transparent)"
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
