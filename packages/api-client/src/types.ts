/**
 * Shared types — mirrors backend Pydantic schemas.
 * Single source of truth for the frontend; the spec at
 * docs/superpowers/specs/2026-05-04-tamagui-rewrite-design.md §6.1
 * is the contract this file implements.
 */

export type TranslatorProvider = "gemini" | "local_openai" | "openai";

export interface VideoMetadata {
  ok: boolean;
  videoId?: string;
  titleOriginal?: string;
  titleTranslated?: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  channel?: string;
  error?: string;
}

export type SttSource = "auto" | "yt_captions" | "whisper";
export type SttEngine =
  | "openai-whisper"
  | "faster-whisper"
  | "whisperx"
  | "insanely-fast-whisper";
export type WhisperModel =
  | "tiny"
  | "base"
  | "small"
  | "medium"
  | "turbo"
  | "large-v3";
export type WhisperDevice = "auto" | "cpu" | "gpu";

export interface ProcessRequest {
  url: string;
  sttSource: SttSource;
  sttEngine?: SttEngine;
  whisperModel: WhisperModel;
  whisperDevice: WhisperDevice;
  vadEnabled: boolean;
  sourceLang: string;
  enableTranslation: boolean;
  targetLang?: string;
  translatorProvider?: TranslatorProvider;
  translatorBaseUrl?: string;
  translatorModel?: string;
  translatorApiKey?: string;
  downloadOnly?: boolean;
}

export interface TranscriptionSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  translated?: string;
}

export type ProcessEvent =
  | { status: "starting"; message: string }
  | {
      status: "downloading";
      message: string;
      percent?: number;
      speed?: number;
      eta?: number;
    }
  | {
      status: "transcribing";
      message?: string;
      progress?: number;
      engine: string;
    }
  | { status: "translating"; message?: string; progress?: number }
  | {
      status: "done";
      videoId: string;
      originalSrtPath: string;
      translatedSrtPath?: string;
      audioPath?: string;
      durationMs: number;
      sttSourceUsed: "yt_captions" | "whisper";
      previewSegments: TranscriptionSegment[];
    }
  | { status: "error"; error: string; recoverable: boolean };

export interface HistoryItem {
  videoId: string;
  url: string;
  titleOriginal: string;
  titleTranslated?: string;
  targetLang?: string;
  sttEngineUsed: string;
  subtitlePath?: string;
  audioPath?: string;
  videoPath?: string;
  thumbnailUrl?: string;
  createdAt: string;
  processingDurationMs: number;
}

/**
 * LibraryItem — backend ships `files` as a 4-slot object, NOT an array.
 * Each slot is either a download URL (string) or null when absent.
 *
 * Shape mirrors backend/api/routes/library.py::_scan_folder.
 */
export interface LibraryItem {
  videoId: string;
  url: string;
  titleOriginal: string;
  titleTranslated?: string | null;
  thumbnailUrl?: string;
  createdAt: string;
  files: LibraryFiles;
}

export interface LibraryFiles {
  originalSrt: string | null;
  translatedSrt: string | null;
  audio: string | null;
  video: string | null;
}

export type LibraryFileKind = keyof LibraryFiles;

export interface AppConfig {
  backendUrl: string;
  downloadDir: string;
  outputDir: string;
  cookieBrowser: "chrome" | "firefox" | "edge" | "opera" | "brave" | "";
  cookieProfile: string;
  cookiesTxtPath: string;
  defaultSttEngine: string;
  defaultWhisperModel: string;
  defaultWhisperDevice: string;
  defaultSourceLang: string;
  defaultTargetLang: string;
  ytCaptionsFirst: boolean;
  enableTranslation: boolean;
  autoTranslateTitle: boolean;
  translatorProvider: TranslatorProvider;
  geminiApiKey: string;
  geminiModel: string;
  localOpenaiBaseUrl: string;
  localOpenaiModel: string;
  localOpenaiApiKey: string;
  openaiBaseUrl: string;
  openaiApiKey: string;
  openaiModel: string;
  mpvPath: string;
  whisperCacheDir: string;
  ffmpegResample16k: boolean;
  logsVerbosity: "error" | "warning" | "info" | "debug";
  /** JS runtime override for yt-dlp. Empty = auto-detect node/deno on PATH. */
  jsRuntimePath: string;
}

export interface BackendCapabilities {
  mpvAvailable: boolean;
  cudaAvailable: boolean;
  installedSttEngines: string[];
  whisperModelsAvailable: string[];
  version: string;
  /** Detected runtime spec ("node:/path", "deno:/path") or null if missing.
   *  When null, yt-dlp degrades — many YouTube format URLs become
   *  unavailable and download/playback can fail. */
  jsRuntime: string | null;
}

/**
 * Backend ships per-model install state plus ffmpeg / mpv probe results.
 * Shape matches backend/api/routes/dependencies.py::get_dependencies.
 */
export interface DependencyStatus {
  models: Partial<Record<WhisperModel, boolean>>;
  ffmpegAvailable: boolean;
  mpvAvailable: boolean;
}

/** True if at least one Whisper model is installed. */
export function anyModelInstalled(d: DependencyStatus): boolean {
  return Object.values(d.models ?? {}).some(Boolean);
}

export type InstallEvent =
  | {
      status: "downloading";
      downloaded?: number;
      total?: number;
      speed?: number;
      percent?: number;
    }
  | { status: "done"; model: string; path?: string }
  | { status: "error"; error: string; recoverable?: boolean };
