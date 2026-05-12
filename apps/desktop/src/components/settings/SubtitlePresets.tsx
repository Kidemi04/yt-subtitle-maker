import * as React from "react";
import { XStack } from "tamagui";
import { ButtonSecondary, ButtonGhost, BodySm, Caption } from "@yt-subtitle-maker/ui";
import type { AppConfig } from "@yt-subtitle-maker/api-client";

// The subtitle-style fields a preset touches. Keep these keys in sync with SubtitlesTab.
export type StyleFields = Pick<
  AppConfig,
  "subFont" | "subFontSize" | "subBorderSize" | "subMarginY" | "subColor" | "subBorderColor" | "subBackColor" | "subBold"
>;

const PRESETS: { label: string; ghost?: boolean; values: StyleFields }[] = [
  {
    label: "Clean white",
    values: { subFont: "", subFontSize: 60, subBorderSize: -1, subMarginY: 0, subColor: "#ffffff", subBorderColor: "#000000", subBackColor: "", subBold: false },
  },
  {
    label: "YouTube-style box",
    values: { subFont: "", subFontSize: 0, subBorderSize: 0, subMarginY: 24, subColor: "#ffffff", subBorderColor: "#000000", subBackColor: "#000000b3", subBold: false },
  },
  {
    label: "Big & bold",
    values: { subFont: "", subFontSize: 72, subBorderSize: 4, subMarginY: 0, subColor: "#ffffff", subBorderColor: "#000000", subBackColor: "", subBold: true },
  },
  {
    label: "Reset to mpv defaults",
    ghost: true,
    values: { subFont: "", subFontSize: 0, subBorderSize: -1, subMarginY: 0, subColor: "#ffffff", subBorderColor: "#000000", subBackColor: "", subBold: false },
  },
];

export function SubtitlePresets({ apply }: { apply: (values: StyleFields) => void }) {
  return (
    <XStack gap="$sm" flexWrap="wrap" alignItems="center">
      <Caption color="$textMuted">Presets:</Caption>
      {PRESETS.map((p) =>
        p.ghost ? (
          <ButtonGhost key={p.label} onPress={() => apply(p.values)}>
            <BodySm color="$textSecondary">{p.label}</BodySm>
          </ButtonGhost>
        ) : (
          <ButtonSecondary key={p.label} onPress={() => apply(p.values)}>
            {p.label}
          </ButtonSecondary>
        ),
      )}
    </XStack>
  );
}
