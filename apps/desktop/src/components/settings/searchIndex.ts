import type { TabId } from "./constants";

export interface SearchEntry {
  id: string;
  tab: TabId;
  label: string;
  keywords: string[];
}

export const SETTINGS_INDEX: SearchEntry[] = [
  // General
  { id: "general.output-dir", tab: "general", label: "Output folder", keywords: ["output", "srt", "save", "directory", "folder"] },
  { id: "general.download-dir", tab: "general", label: "Download folder", keywords: ["download", "audio", "temp", "directory", "folder"] },
  { id: "general.whisper-cache-dir", tab: "general", label: "Whisper cache directory", keywords: ["whisper", "cache", "model", "weights", "directory"] },
  { id: "general.logs-verbosity", tab: "general", label: "Logs verbosity", keywords: ["logs", "verbosity", "debug", "log level"] },
  // YouTube
  { id: "youtube.cookie-source", tab: "youtube", label: "Cookie source", keywords: ["cookies", "browser", "firefox", "chrome", "age restricted"] },
  { id: "youtube.cookie-profile", tab: "youtube", label: "Browser profile", keywords: ["cookie", "profile", "browser"] },
  { id: "youtube.cookies-txt-path", tab: "youtube", label: "cookies.txt path", keywords: ["cookies.txt", "netscape", "cookie file"] },
  { id: "youtube.js-runtime-path", tab: "youtube", label: "JS runtime for yt-dlp", keywords: ["javascript", "node", "deno", "yt-dlp", "runtime"] },
  // Transcription
  { id: "transcription.engine", tab: "transcription", label: "Default engine", keywords: ["stt", "speech", "whisper", "engine"] },
  { id: "transcription.model", tab: "transcription", label: "Default model", keywords: ["whisper", "model", "tiny", "base", "turbo", "large"] },
  { id: "transcription.device", tab: "transcription", label: "Default device", keywords: ["device", "cpu", "gpu", "cuda", "mps"] },
  { id: "transcription.source-lang", tab: "transcription", label: "Default source language", keywords: ["language", "source", "spoken", "detect"] },
  { id: "transcription.yt-captions-first", tab: "transcription", label: "Try YouTube auto-captions first", keywords: ["captions", "auto", "youtube", "subtitles"] },
  { id: "transcription.vad", tab: "transcription", label: "Voice-Activity Detection (VAD) by default", keywords: ["vad", "silence", "voice activity"] },
  { id: "transcription.ffmpeg-resample-16k", tab: "transcription", label: "FFmpeg 16 kHz pre-resample", keywords: ["ffmpeg", "resample", "16khz", "audio"] },
  // Translation (base only)
  { id: "translation.provider", tab: "translation", label: "Provider", keywords: ["translate", "provider", "gemini", "openai", "local ai", "lm studio"] },
  { id: "translation.target-lang", tab: "translation", label: "Default target language", keywords: ["target", "language", "translate to"] },
  { id: "translation.enable-by-default", tab: "translation", label: "Enable translation by default", keywords: ["translate", "enable", "default"] },
  { id: "translation.auto-translate-title", tab: "translation", label: "Auto-translate the video title", keywords: ["title", "translate"] },
  // Subtitles
  { id: "subtitles.mpv-path", tab: "subtitles", label: "MPV executable path", keywords: ["mpv", "player", "executable", "path"] },
  { id: "subtitles.font", tab: "subtitles", label: "Font family", keywords: ["font", "typeface", "family", "cjk"] },
  { id: "subtitles.font-size", tab: "subtitles", label: "Font size", keywords: ["font", "size", "px"] },
  { id: "subtitles.margin-y", tab: "subtitles", label: "Bottom margin", keywords: ["margin", "bottom", "position"] },
  { id: "subtitles.color", tab: "subtitles", label: "Text color", keywords: ["color", "text", "hex", "white"] },
  { id: "subtitles.border-color", tab: "subtitles", label: "Outline color", keywords: ["outline", "border", "color", "hex", "black"] },
  { id: "subtitles.border-size", tab: "subtitles", label: "Outline width", keywords: ["outline", "width", "border", "px"] },
  { id: "subtitles.back-color", tab: "subtitles", label: "Background", keywords: ["background", "box", "color", "alpha"] },
  { id: "subtitles.bold", tab: "subtitles", label: "Bold", keywords: ["bold", "weight"] },
  // Advanced
  { id: "advanced.backend-url", tab: "advanced", label: "Backend URL", keywords: ["backend", "url", "server", "ngrok", "host", "port"] },
  { id: "advanced.reset-all", tab: "advanced", label: "Reset all to defaults", keywords: ["reset", "defaults", "factory", "wipe"] },
];
