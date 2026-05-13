import type {
  SttEngine,
  TranslatorProvider,
  WhisperDevice,
  WhisperModel,
} from "@yt-subtitle-maker/api-client";

/**
 * Human-readable engine names. Kebab-case identifiers like "openai-whisper"
 * are implementation detail — the viewer surface should never render them.
 * The engine picker in Advanced is fine to show the slug there (engineers
 * recognize it); user-facing status text (Processing / Result / dropdown
 * labels) should run through this map.
 */
export const ENGINE_LABELS: Record<SttEngine, string> = {
  "openai-whisper": "Whisper",
  "faster-whisper": "Faster Whisper",
  whisperx: "WhisperX",
  "insanely-fast-whisper": "Insanely Fast Whisper",
};

/**
 * Single helper consumed by every viewer surface that renders an engine
 * value. Accepts the union slug, the special yt_captions marker, or any
 * future backend-added engine name (falls back to a title-cased version of
 * the slug so the kebab-case never leaks raw).
 */
export function humanEngine(value: string | undefined | null): string {
  if (!value) return "";
  if (value === "yt_captions") return "YouTube auto-captions";
  if (value in ENGINE_LABELS) return ENGINE_LABELS[value as SttEngine];
  // Future-proof: title-case unknown slugs so a new engine doesn't show up
  // as kebab-case while the labels map catches up.
  return value
    .split(/[-_]/)
    .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p))
    .join(" ");
}

/**
 * Human-readable translator label. `local_openai` is the only slug-y
 * value; we map it here and pass the rest through.
 */
export function humanTranslator(value: string | undefined | null): string {
  if (!value) return "";
  if (value in TRANSLATOR_LABELS)
    return TRANSLATOR_LABELS[value as TranslatorProvider];
  return value;
}

/**
 * Human-readable translator provider names. Same rationale as ENGINE_LABELS:
 * `local_openai` is an internal slug, not viewer copy.
 */
export const TRANSLATOR_LABELS: Record<TranslatorProvider, string> = {
  gemini: "Gemini",
  local_openai: "Local AI",
  openai: "OpenAI-compat",
};

/**
 * Returns the platform-appropriate modifier-key glyph for keyboard hints.
 * `⌘` on macOS, `Ctrl` elsewhere. Safe to call during SSR (returns Ctrl).
 */
export function platformModKey(): string {
  if (typeof navigator === "undefined") return "Ctrl";
  return /Mac|iPod|iPhone|iPad/i.test(navigator.platform) ? "⌘" : "Ctrl";
}

/**
 * Shared form-option constants. Lives here (not in @yt-subtitle-maker/api-client)
 * because the labels are human-facing copy belonging to the desktop app —
 * the package only exports the type union.
 *
 * `turbo` carries the ⭐ default badge per the handoff (Screen 1 Init flow);
 * other screens consume the same array so the marker is consistent.
 */
export const WHISPER_MODELS: { label: string; value: WhisperModel }[] = [
  { label: "tiny · 75 MB", value: "tiny" },
  { label: "base · 150 MB", value: "base" },
  { label: "small · 500 MB", value: "small" },
  { label: "medium · 1.5 GB", value: "medium" },
  { label: "turbo · 1.5 GB ⭐", value: "turbo" },
  { label: "large-v3 · 3 GB", value: "large-v3" },
];

export const WHISPER_DEVICES: { label: string; value: WhisperDevice }[] = [
  { label: "Auto", value: "auto" },
  { label: "CPU", value: "cpu" },
  { label: "GPU (CUDA)", value: "gpu" },
];

export const LANGUAGES = [
  { label: "English", value: "en" },
  { label: "中文 (Chinese)", value: "zh" },
  { label: "日本語 (Japanese)", value: "ja" },
  { label: "한국어 (Korean)", value: "ko" },
  { label: "Español", value: "es" },
  { label: "Français", value: "fr" },
  { label: "Deutsch", value: "de" },
  { label: "Português", value: "pt" },
  { label: "Русский", value: "ru" },
  { label: "Tiếng Việt", value: "vi" },
];
