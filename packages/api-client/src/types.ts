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
      transcribeId?: string;
      translateId?: string | null;
      previewSegments: TranscriptionSegment[];
    }
  | { status: "error"; error: string; recoverable: boolean };

/**
 * Streaming events for the per-video re-transcribe / re-translate endpoints
 * (POST /api/library/{id}/transcribe, /api/library/{id}/translate).
 *
 * Shape is a subset of ProcessEvent: starting/downloading aren't emitted
 * (audio is reused), and `done` carries the new run id + relative URL.
 */
export type LibraryRunEvent =
  | {
      status: "transcribing";
      progress?: number;
      engine: string;
    }
  | { status: "translating"; progress?: number }
  | {
      status: "done";
      videoId: string;
      transcribeId?: string;
      translateId?: string;
      sourceTranscribeId?: string;
      filename: string;
      url: string;
      durationMs: number;
      segmentCount: number;
      previewSegments: TranscriptionSegment[];
    }
  | { status: "error"; error: string; recoverable: boolean };

export interface HistoryItem {
  videoId: string;
  url: string;
  titleOriginal: string;
  titleTranslated?: string | null;
  targetLang?: string | null;
  sttEngineUsed: string;
  subtitlePath?: string | null;
  audioPath?: string | null;
  videoPath?: string | null;
  thumbnailUrl?: string;
  createdAt: string;
  processingDurationMs: number;
  /** Number of transcribe runs in this video's folder (V2 multi-SRT). */
  transcribesCount: number;
  /** Number of translation runs in this video's folder (V2 multi-SRT). */
  translationsCount: number;
}

/**
 * LibraryItem — V2 summary shape. The list endpoint returns counts
 * (transcribesCount, translationsCount) rather than a fixed 4-slot files
 * object; consumers that need the per-run breakdown call
 * GET /api/library/{videoId} for a `VideoDetail`.
 */
export interface LibraryItem {
  videoId: string;
  url: string;
  titleOriginal: string;
  titleTranslated?: string | null;
  thumbnailUrl?: string;
  createdAt: string;
  transcribesCount: number;
  translationsCount: number;
  audio: string | null;
  hasVideo: boolean;
}

/** A single STT run recorded in a video's _history.json sidecar. */
export interface TranscribeRun {
  id: string;
  /** SttEngine | "yt_captions". */
  engine: string;
  /** Whisper model name; null for yt_captions. */
  model: string | null;
  device: WhisperDevice | null;
  vadEnabled: boolean | null;
  language: string;
  filename: string;
  createdAt: string;
  durationMs: number;
  segmentCount: number;
  /** Download URL for the SRT file (null only if the file is missing). */
  url: string | null;
}

/** A single translator run, derived from a specific source transcript. */
export interface TranslateRun {
  id: string;
  sourceTranscribeId: string;
  translator: TranslatorProvider | string;
  translatorModel: string;
  targetLang: string;
  filename: string;
  createdAt: string;
  durationMs: number;
  segmentCount: number;
  url: string | null;
}

/**
 * VideoDetail — full per-video record returned by GET /api/library/{videoId}.
 * Lists every transcribe + translation run (with download URLs) plus the
 * top-level metadata stored in the sidecar.
 */
export interface VideoDetail {
  videoId: string;
  url: string;
  titleOriginal: string;
  titleTranslated: string | null;
  thumbnailUrl: string | null;
  channel: string | null;
  durationSeconds: number | null;
  createdAt: string;
  updatedAt: string;
  audio: string | null;
  hasVideo: boolean;
  transcribes: TranscribeRun[];
  translations: TranslateRun[];
}

/** Body for POST /api/library/{videoId}/transcribe. */
export interface LibraryTranscribeRequest {
  /** "openai-whisper" | "yt_captions" (frontend resolves "auto" upstream). */
  sttEngine: string;
  whisperModel?: string | null;
  whisperDevice?: WhisperDevice | null;
  vadEnabled?: boolean;
  sourceLang: string;
}

/** Body for POST /api/library/{videoId}/translate. */
export interface LibraryTranslateRequest {
  sourceTranscribeId: string;
  targetLang: string;
  translatorProvider?: TranslatorProvider;
  translatorModel?: string;
  translatorBaseUrl?: string;
  translatorApiKey?: string;
}

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
