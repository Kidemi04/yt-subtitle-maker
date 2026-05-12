import * as React from "react";
import { YStack, XStack } from "tamagui";
import { DisplaySm, TitleSm, BodySm, Caption } from "@yt-subtitle-maker/ui";
import { useSettings } from "./SettingsContext";

export const MASK = "***";
export const isMasked = (v: string | undefined): boolean => v === MASK;

export const COOKIE_BROWSERS = [
  { label: "None", value: "" },
  { label: "Firefox (recommended)", value: "firefox" },
  { label: "Chrome (may fail)", value: "chrome" },
  { label: "Edge (may fail)", value: "edge" },
  { label: "Brave (may fail)", value: "brave" },
  { label: "Opera (may fail)", value: "opera" },
];

export const VERBOSITY = [
  { label: "Error", value: "error" },
  { label: "Warning", value: "warning" },
  { label: "Info", value: "info" },
  { label: "Debug", value: "debug" },
];

// Human labels for STT engine ids the backend may report as installed.
// Only ids that actually exist in core/stt/__init__.py's registry will ever
// appear (plus the synthetic "auto" mode). Adding a real engine later = add
// its label here; it shows up automatically once /api/version lists it.
export const STT_ENGINE_LABELS: Record<string, string> = {
  auto: "Auto — use YouTube's captions if present, else Whisper",
  "openai-whisper": "openai-whisper (the reference engine)",
  yt_captions: "YouTube captions only",
};

// base id list — keep this in sync with the backend's MODELS_URLS keys.
export const WHISPER_MODEL_IDS = ["tiny", "base", "small", "medium", "turbo", "large-v3"];

export const DEVICES = [
  { label: "Auto", value: "auto" },
  { label: "CPU", value: "cpu" },
  { label: "GPU", value: "gpu" },
];

export const LANGS = [
  { label: "English", value: "en" },
  { label: "中文", value: "zh" },
  { label: "日本語", value: "ja" },
  { label: "한국어", value: "ko" },
  { label: "Español", value: "es" },
  { label: "Français", value: "fr" },
  { label: "Deutsch", value: "de" },
  { label: "Português", value: "pt" },
  { label: "Tiếng Việt", value: "vi" },
];

/** Section header — DisplaySm title plus optional BodySm subtitle. */
export function Section({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <YStack gap={2}>
      <DisplaySm>{title}</DisplaySm>
      {subtitle ? <BodySm color="$textSecondary">{subtitle}</BodySm> : null}
    </YStack>
  );
}

/** Field label — TitleSm primary line + optional Caption helper. */
export function Field({
  label,
  helper,
}: {
  label: string;
  helper?: string;
}) {
  return (
    <YStack gap={2} marginBottom="$xxs">
      <TitleSm>{label}</TitleSm>
      {helper ? <Caption>{helper}</Caption> : null}
    </YStack>
  );
}

/** Build dropdown option lists. If the saved value isn't in the fetched
 * list (e.g. user edited config.json by hand, or we haven't fetched yet),
 * include it as a "current" option so the dropdown can render the value
 * without showing a stale placeholder.
 */
export const buildModelOptions = (
  fetched: string[],
  current: string | undefined,
): { label: string; value: string }[] => {
  const set = new Set(fetched);
  const out = fetched.map((m) => ({ label: m, value: m }));
  if (current && !set.has(current)) {
    out.unshift({ label: `${current} (current)`, value: current });
  }
  return out;
};

export type TabId =
  | "general"
  | "youtube"
  | "transcription"
  | "translation"
  | "subtitles"
  | "advanced";

export const TABS: { id: TabId; label: string }[] = [
  { id: "general", label: "General" },
  { id: "youtube", label: "YouTube" },
  { id: "transcription", label: "Transcription" },
  { id: "translation", label: "Translation" },
  { id: "subtitles", label: "Subtitles" },
  { id: "advanced", label: "Advanced" },
];

/**
 * One configurable setting: a label/helper header + the control(s) beneath it
 * (or label-left/control-right when layout="row", e.g. for a toggle), wrapped
 * with a stable DOM id so search can scroll to + briefly highlight it.
 */
export function SettingRow({
  id,
  label,
  helper,
  layout = "stack",
  children,
}: {
  id: string; // unique across ALL tabs; must match an entry in searchIndex.ts if searchable
  label: string;
  helper?: string;
  layout?: "stack" | "row";
  children: React.ReactNode;
}) {
  const { highlightedSettingId, setHighlightedSettingId } = useSettings();
  const ref = React.useRef<any>(null);
  const highlighted = highlightedSettingId === id;

  React.useEffect(() => {
    if (!highlighted) return;
    const el = ref.current as { scrollIntoView?: (opts?: any) => void } | null;
    if (el && typeof el.scrollIntoView === "function") {
      requestAnimationFrame(() =>
        el.scrollIntoView!({ behavior: "smooth", block: "center" }),
      );
    }
    const t = setTimeout(() => setHighlightedSettingId(null), 2200);
    return () => clearTimeout(t);
  }, [highlighted, setHighlightedSettingId]);

  const highlightProps = highlighted
    ? ({
        borderColor: "$accent",
        borderWidth: 1,
        borderRadius: "$md",
        padding: "$xs",
      } as const)
    : undefined;

  if (layout === "row") {
    return (
      <XStack
        ref={ref}
        nativeID={id}
        alignItems="center"
        justifyContent="space-between"
        {...highlightProps}
      >
        <Field label={label} helper={helper} />
        {children}
      </XStack>
    );
  }
  return (
    <YStack ref={ref} nativeID={id} gap="$xs" {...highlightProps}>
      <Field label={label} helper={helper} />
      {children}
    </YStack>
  );
}
