import { create } from "zustand";
import type {
  ProcessEvent,
  ProcessRequest,
  TranscriptionSegment,
  VideoMetadata,
} from "@yt-subtitle-maker/api-client";
import { apiClient } from "./client";

/**
 * generate store — single-flight state machine for the Generate screen.
 *
 *   idle → loading-meta → meta-loaded → processing → done
 *                                      ↘ error
 *
 * The store owns the AbortController for the in-flight request so any
 * caller (the Cancel ✕ button on the processing card, navigating away)
 * can abort cleanly.
 */

export type GenerateStatus =
  | "idle"
  | "loading-meta"
  | "meta-loaded"
  | "processing"
  | "done"
  | "error";

export type ProcessingPhase = "download" | "transcribe" | "translate" | "done";

export interface DoneResult {
  videoId: string;
  originalSrtPath: string;
  translatedSrtPath?: string;
  audioPath?: string;
  durationMs: number;
  sttSourceUsed: "yt_captions" | "whisper";
  /** V2 multi-SRT: id of the transcript run produced by this job (if any). */
  transcribeId?: string;
  /** V2 multi-SRT: id of the translation run produced by this job (if any). */
  translateId?: string | null;
  previewSegments: TranscriptionSegment[];
}

interface GenerateState {
  status: GenerateStatus;
  url: string;
  metadata?: VideoMetadata;
  metaError?: string;
  phase?: ProcessingPhase;
  phaseMessage?: string;
  phaseProgress?: number;
  result?: DoneResult;
  errorMessage?: string;
  abort?: AbortController;

  setUrl: (url: string) => void;
  loadMetadata: () => Promise<void>;
  runPipeline: (
    req: Omit<ProcessRequest, "url"> & Partial<Pick<ProcessRequest, "url">>,
  ) => Promise<void>;
  cancel: () => void;
  reset: () => void;
  /**
   * Dismiss the error and return to the meta-loaded stage with URL and
   * metadata preserved so the user can tweak Configure and retry without
   * having to paste the URL again.
   */
  dismissError: () => void;
}

const phaseFromEvent = (e: ProcessEvent): ProcessingPhase | undefined => {
  switch (e.status) {
    case "downloading":
      return "download";
    case "transcribing":
      return "transcribe";
    case "translating":
      return "translate";
    case "done":
      return "done";
    default:
      return undefined;
  }
};

export const useGenerate = create<GenerateState>((set, get) => ({
  status: "idle",
  url: "",

  setUrl(url) {
    set({ url, metadata: undefined, metaError: undefined });
  },

  async loadMetadata() {
    const url = get().url.trim();
    if (!url) return;
    set({ status: "loading-meta", metadata: undefined, metaError: undefined });
    try {
      const meta = await apiClient.fetchMetadata(url);
      if (!meta.ok) {
        set({ status: "idle", metaError: meta.error ?? "Unknown error" });
        return;
      }
      set({ status: "meta-loaded", metadata: meta });
    } catch (err) {
      set({
        status: "idle",
        metaError: err instanceof Error ? err.message : String(err),
      });
    }
  },

  async runPipeline(req) {
    const url = req.url ?? get().url;
    if (!url) return;
    const controller = new AbortController();
    set({
      status: "processing",
      phase: "download",
      phaseMessage: "Starting…",
      phaseProgress: 0,
      result: undefined,
      errorMessage: undefined,
      abort: controller,
    });

    try {
      for await (const ev of apiClient.processVideo(
        { ...req, url } as ProcessRequest,
        controller.signal,
      )) {
        if (ev.status === "error") {
          set({
            status: "error",
            errorMessage: ev.error,
            abort: undefined,
          });
          return;
        }
        if (ev.status === "done") {
          set({
            status: "done",
            phase: "done",
            phaseProgress: 1,
            result: {
              videoId: ev.videoId,
              originalSrtPath: ev.originalSrtPath,
              translatedSrtPath: ev.translatedSrtPath,
              audioPath: ev.audioPath,
              durationMs: ev.durationMs,
              sttSourceUsed: ev.sttSourceUsed,
              transcribeId: ev.transcribeId,
              translateId: ev.translateId,
              previewSegments: ev.previewSegments,
            },
            abort: undefined,
          });
          continue;
        }
        const phase = phaseFromEvent(ev);
        const message =
          "message" in ev && typeof ev.message === "string"
            ? ev.message
            : undefined;
        const progress =
          "progress" in ev && typeof ev.progress === "number"
            ? ev.progress
            : "percent" in ev && typeof ev.percent === "number"
            ? ev.percent / 100
            : undefined;
        set({
          phase: phase ?? get().phase,
          phaseMessage: message ?? get().phaseMessage,
          phaseProgress: progress ?? get().phaseProgress,
        });
      }
    } catch (err) {
      // AbortError is expected when the user clicks cancel — quiet path.
      if (err instanceof DOMException && err.name === "AbortError") {
        set({ status: "idle", abort: undefined });
        return;
      }
      set({
        status: "error",
        errorMessage: err instanceof Error ? err.message : String(err),
        abort: undefined,
      });
    }
  },

  cancel() {
    get().abort?.abort();
    apiClient.cancelProcess().catch(() => undefined);
  },

  reset() {
    get().abort?.abort();
    set({
      status: "idle",
      url: "",
      metadata: undefined,
      metaError: undefined,
      phase: undefined,
      phaseMessage: undefined,
      phaseProgress: undefined,
      result: undefined,
      errorMessage: undefined,
      abort: undefined,
    });
  },

  dismissError() {
    const { metadata } = get();
    set({
      // Preserve url/metadata so the user can tweak Configure and retry. If
      // metadata is missing (rare — error during load), fall back to idle.
      status: metadata?.ok ? "meta-loaded" : "idle",
      errorMessage: undefined,
      phase: undefined,
      phaseMessage: undefined,
      phaseProgress: undefined,
      result: undefined,
      abort: undefined,
    });
  },
}));
