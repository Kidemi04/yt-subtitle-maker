// apps/desktop/src/components/settings/constants.ts
// Leaf module: imports NOTHING from the settings folder (only the api-client
// type). Holds the tab list, the masked-secret sentinel, the dropdown option
// arrays, and the SettingRow-id → AppConfig-key map. Splitting these out of
// shared.tsx breaks the old `SettingsContext.tsx -> shared.tsx -> SettingsContext.tsx`
// Metro require-cycle warning.
import type { AppConfig } from "@yt-subtitle-maker/api-client";
export { ALL_LANGUAGES as LANGS } from "./languages";

export const MASK = "***";
export const isMasked = (v: string | undefined): boolean => v === MASK;

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

/**
 * SettingRow `id` → the `AppConfig` key it edits. Used by the per-field `↺`
 * (Task 3) to know which config value a row owns and what its effective default
 * is. Rows whose id is NOT in this map don't get a `↺` (e.g. armed-field rows,
 * the "Reset all" row, the cookie-Test row, the masked-key Replace rows — those
 * are handled by their own affordances). Keys must match the `nativeID`s used in
 * the tab components and the entries in `searchIndex.ts`.
 */
export const SETTING_FIELD: Partial<Record<string, keyof AppConfig>> = {
  // General
  "general.output-dir": "outputDir",
  "general.download-dir": "downloadDir",
  "general.whisper-cache-dir": "whisperCacheDir",
  "general.logs-verbosity": "logsVerbosity",
  // YouTube
  "youtube.cookie-source": "cookieBrowser",
  "youtube.cookie-profile": "cookieProfile",
  "youtube.cookies-txt-path": "cookiesTxtPath",
  "youtube.js-runtime-path": "jsRuntimePath",
  // Transcription
  // Note: transcription.source-mode and transcription.engine-picker are NOT here
  // because they map to multiple AppConfig keys (or none); they live only in
  // SETTINGS_INDEX (for search). The old transcription.engine /
  // transcription.model / transcription.yt-captions-first rows are gone —
  // replaced by SourceModeControl + EnginePicker in the rewritten tab.
  "transcription.device": "defaultWhisperDevice",
  "transcription.source-lang": "defaultSourceLang",
  "transcription.vad": "vadEnabled",
  "transcription.ffmpeg-resample-16k": "ffmpegResample16k",
  // Translation
  "translation.target-lang": "defaultTargetLang",
  "translation.enable-by-default": "enableTranslation",
  "translation.auto-translate-title": "autoTranslateTitle",
  // Subtitles
  "subtitles.mpv-path": "mpvPath",
  "subtitles.font": "subFont",
  "subtitles.font-size": "subFontSize",
  "subtitles.margin-y": "subMarginY",
  "subtitles.color": "subColor",
  "subtitles.border-color": "subBorderColor",
  "subtitles.border-size": "subBorderSize",
  "subtitles.back-color": "subBackColor",
  "subtitles.bold": "subBold",
  // Advanced — `advanced.backend-url` is an armed field (no ↺ row affordance;
  // it has "Reset to 127.0.0.1:8000" instead); `advanced.reset-all` isn't a field.
};

/** The tab that owns a given SettingRow id (derived from the id prefix). */
export const tabOfSettingId = (id: string): TabId | undefined => {
  const prefix = id.split(".")[0];
  return TABS.some((t) => t.id === prefix) ? (prefix as TabId) : undefined;
};
