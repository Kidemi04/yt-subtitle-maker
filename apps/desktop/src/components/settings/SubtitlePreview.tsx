import * as React from "react";
import { Stack, YStack } from "tamagui";
import { Caption } from "@yt-subtitle-maker/ui";
import type { AppConfig } from "@yt-subtitle-maker/api-client";

// How big the preview pretends mpv's "default" is, and how much we scale everything
// down to fit the small preview box. Not pixel-exact — just enough to dial in the look.
const MPV_DEFAULT_FONT = 55;
const MPV_DEFAULT_BORDER = 3;
const PREVIEW_SCALE = 0.42;

const SAMPLE_LATIN = "The quick brown fox jumps over the lazy dog";
const SAMPLE_CJK = "敏捷的棕色狐狸跳过了那只懒狗";

/** Approximates how mpv will burn the subtitles in, using `-webkit-text-stroke` for the outline. */
export function SubtitlePreview({ cfg }: { cfg: AppConfig }) {
  const fontPx = (cfg.subFontSize && cfg.subFontSize > 0 ? cfg.subFontSize : MPV_DEFAULT_FONT) * PREVIEW_SCALE;
  const borderPx = (cfg.subBorderSize >= 0 ? cfg.subBorderSize : MPV_DEFAULT_BORDER) * PREVIEW_SCALE;
  const marginPx = (cfg.subMarginY && cfg.subMarginY > 0 ? cfg.subMarginY : 0) * PREVIEW_SCALE;
  const textColor = /^#?[0-9a-fA-F]{6}$/.test(cfg.subColor || "") ? (cfg.subColor.startsWith("#") ? cfg.subColor : `#${cfg.subColor}`) : "#ffffff";
  const outlineColor = /^#?[0-9a-fA-F]{6}$/.test(cfg.subBorderColor || "") ? (cfg.subBorderColor.startsWith("#") ? cfg.subBorderColor : `#${cfg.subBorderColor}`) : "#000000";
  const backColor = /^#?[0-9a-fA-F]{8}$/.test(cfg.subBackColor || "")
    ? (cfg.subBackColor.startsWith("#") ? cfg.subBackColor : `#${cfg.subBackColor}`)
    : "transparent";
  const fontFamily = cfg.subFont?.trim() ? `"${cfg.subFont.trim()}", "Heiti SC", "Noto Sans CJK SC", sans-serif` : `"Heiti SC", "Noto Sans CJK SC", sans-serif`;
  const fontWeight = cfg.subBold ? 700 : 400;

  const lineStyle: React.CSSProperties = {
    fontFamily,
    fontWeight,
    fontSize: `${fontPx}px`,
    lineHeight: 1.25,
    color: textColor,
    WebkitTextStroke: borderPx > 0 ? `${borderPx}px ${outlineColor}` : undefined,
    backgroundColor: backColor,
    padding: backColor === "transparent" ? 0 : `${Math.max(2, fontPx * 0.12)}px ${Math.max(4, fontPx * 0.3)}px`,
    borderRadius: backColor === "transparent" ? 0 : 4,
    display: "inline-block",
    textAlign: "center",
    maxWidth: "92%",
    overflowWrap: "anywhere",
  };
  const innerStyle: React.CSSProperties = {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: `${12 + marginPx}px`,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: `${Math.max(2, fontPx * 0.18)}px`,
  };

  return (
    <YStack gap="$xs">
      <Stack
        height={200}
        borderRadius="$md"
        overflow="hidden"
        position="relative"
        // a flat-ish "video still" backdrop; a gradient via CSS keeps it from looking like a UI panel
        // (Tamagui passes `style` through on web)
        style={{ background: "linear-gradient(160deg, #2a2733 0%, #14131a 55%, #0c0b10 100%)" }}
      >
        {React.createElement("div", { style: innerStyle },
          React.createElement("span", { style: lineStyle, key: "latin" }, SAMPLE_LATIN),
          React.createElement("span", { style: lineStyle, key: "cjk" }, SAMPLE_CJK),
        )}
      </Stack>
      <Caption color="$textMuted">Approximate preview — mpv's real output may differ slightly. The CJK line catches fonts that lack Chinese/Japanese/Korean glyphs.</Caption>
    </YStack>
  );
}
