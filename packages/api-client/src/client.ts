import type {
  AppConfig,
  BackendCapabilities,
  DependencyStatus,
  EngineDescriptor,
  HistoryItem,
  InstallEvent,
  LibraryItem,
  LibraryRunEvent,
  LibraryTranscribeRequest,
  LibraryTranslateRequest,
  ProcessEvent,
  ProcessRequest,
  SystemReport,
  TranslatorProfile,
  TranslatorProvider,
  TranslatorTestResult,
  VideoDetail,
  VideoMetadata,
  WhisperModel,
  CheckFsRequest,
  CheckFsResult,
} from "./types";

/**
 * ApiClient — the single HTTP / NDJSON-stream client used by the desktop
 * app and (future) mobile app.
 *
 * Spec: docs/superpowers/specs/2026-05-04-tamagui-rewrite-design.md §6.2.
 *
 * NDJSON streaming for /api/process and /api/dependencies/install: each
 * line is one event JSON; the async generators yield events one at a
 * time as they arrive (no buffering of the whole response).
 *
 * The Authorization header slot is reserved (V1 sends none) so V2 can
 * tunnel through ngrok with a token without breaking the surface.
 */
export class ApiClient {
  private baseUrl: string;
  private authToken?: string;

  constructor(baseUrl: string, opts: { authToken?: string } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.authToken = opts.authToken;
  }

  setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/$/, "");
  }

  setAuthToken(token: string | undefined): void {
    this.authToken = token;
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    const h: Record<string, string> = {
      "Content-Type": "application/json",
      ...extra,
    };
    if (this.authToken) h.Authorization = `Bearer ${this.authToken}`;
    return h;
  }

  // ─── Version + capabilities ────────────────────────────────────────────
  async fetchVersion(): Promise<BackendCapabilities> {
    const res = await fetch(`${this.baseUrl}/api/version`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`/api/version ${res.status}`);
    return res.json();
  }

  // ─── System report ────────────────────────────────────────────────────
  async getSystem(): Promise<SystemReport> {
    const res = await fetch(`${this.baseUrl}/api/system`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`/api/system ${res.status}`);
    return res.json();
  }

  // ─── Engine descriptors ───────────────────────────────────────────────
  async getEngines(): Promise<EngineDescriptor[]> {
    const res = await fetch(`${this.baseUrl}/api/engines`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`/api/engines ${res.status}`);
    return res.json();
  }

  // ─── Metadata ─────────────────────────────────────────────────────────
  async fetchMetadata(url: string): Promise<VideoMetadata> {
    const res = await fetch(`${this.baseUrl}/api/metadata`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ url }),
    });
    if (!res.ok) throw new Error(`/api/metadata ${res.status}`);
    return res.json();
  }

  // ─── Process pipeline (streaming) ──────────────────────────────────────
  async *processVideo(
    req: ProcessRequest,
    signal?: AbortSignal,
  ): AsyncIterable<ProcessEvent> {
    yield* this.streamNdjson<ProcessEvent>("/api/process", req, signal);
  }

  async cancelProcess(): Promise<void> {
    await fetch(`${this.baseUrl}/api/process/cancel`, {
      method: "POST",
      headers: this.headers(),
    });
  }

  // ─── Translation helpers ───────────────────────────────────────────────
  /**
   * Test a translator. Two call forms:
   *
   * **Ad-hoc spec** (test before saving):
   *   `{ provider, baseUrl?, apiKey?, model?, targetLang? }`
   *
   * **Saved-profile** (uses persisted credentials server-side):
   *   `{ profileId, useSavedKey: true, targetLang? }`
   *
   * Both return a `TranslatorTestResult` with a real one-line translation
   * round-trip or a structured error.
   */
  async testTranslator(
    input:
      | {
          provider: TranslatorProvider;
          baseUrl?: string;
          apiKey?: string;
          model?: string;
          targetLang?: string;
        }
      | {
          profileId: string;
          useSavedKey: true;
          targetLang?: string;
        },
  ): Promise<TranslatorTestResult> {
    const res = await fetch(`${this.baseUrl}/api/translator/test`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`/api/translator/test ${res.status}`);
    return res.json();
  }

  async listTranslatorModels(
    input:
      | { provider: TranslatorProvider; baseUrl?: string; apiKey?: string }
      | { profileId: string; useSavedKey: true },
  ): Promise<{ ok: boolean; models: string[]; error?: string }> {
    const res = await fetch(`${this.baseUrl}/api/translator/list-models`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`/api/translator/list-models ${res.status}`);
    return res.json();
  }

  // ─── Cookies ──────────────────────────────────────────────────────────
  async testCookies(
    input?: {
      cookieBrowser?: string;
      cookieProfile?: string;
      cookiesTxtPath?: string;
    },
  ): Promise<{
    ok: boolean;
    error?: string;
    title?: string;
    cookiesAttached?: boolean;
    cookieSource?: string;
  }> {
    const res = await fetch(`${this.baseUrl}/api/test-cookies`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(input ?? {}),
    });
    if (!res.ok) throw new Error(`/api/test-cookies ${res.status}`);
    return res.json();
  }

  // ─── Library ──────────────────────────────────────────────────────────
  async fetchLibrary(): Promise<{ items: LibraryItem[] }> {
    const res = await fetch(`${this.baseUrl}/api/library`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`/api/library ${res.status}`);
    return res.json();
  }

  async fetchVideoDetail(videoId: string): Promise<VideoDetail> {
    const res = await fetch(`${this.baseUrl}/api/library/${videoId}`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`/api/library/${videoId} ${res.status}`);
    return res.json();
  }

  async deleteLibraryItem(videoId: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/library/delete`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ videoId }),
    });
    if (!res.ok) throw new Error(`/api/library/delete ${res.status}`);
  }

  /** Delete a single transcript or translation run from a video's folder. */
  async deleteSrt(
    videoId: string,
    kind: "transcribe" | "translate",
    id: string,
  ): Promise<{ ok: boolean; deleted: string[] }> {
    const res = await fetch(
      `${this.baseUrl}/api/library/${videoId}/delete-srt`,
      {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({ id, kind }),
      },
    );
    if (!res.ok)
      throw new Error(`/api/library/${videoId}/delete-srt ${res.status}`);
    return res.json();
  }

  async openLibraryFolder(videoId: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/library/open-folder`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ videoId }),
    });
    if (!res.ok) throw new Error(`/api/library/open-folder ${res.status}`);
  }

  async playMpv(
    videoId: string,
    opts?: {
      subtitlePreference?: "translated" | "original" | "none";
      transcribeId?: string;
      translateId?: string;
    },
  ): Promise<{
    ok: boolean;
    error?: string;
    media?: string;
    /** The ACTIVE subtitle filename (the one mpv selected as the default track) — or null when no sub overlay. */
    subtitle?: string | null;
    /**
     * Every subtitle loaded into mpv, in track order. When both translated
     * and original exist, BOTH are loaded so the user can switch with `j`.
     * The last entry is the active track; earlier entries are alternatives.
     */
    subtitles?: string[];
  }> {
    const res = await fetch(`${this.baseUrl}/api/library/play-mpv`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        videoId,
        subtitlePreference: opts?.subtitlePreference,
        transcribeId: opts?.transcribeId,
        translateId: opts?.translateId,
      }),
    });
    if (!res.ok) throw new Error(`/api/library/play-mpv ${res.status}`);
    return res.json();
  }

  /** Re-run STT on a library video's existing audio. NDJSON stream. */
  async *streamTranscribe(
    videoId: string,
    req: LibraryTranscribeRequest,
    signal?: AbortSignal,
  ): AsyncIterable<LibraryRunEvent> {
    yield* this.streamNdjson<LibraryRunEvent>(
      `/api/library/${videoId}/transcribe`,
      req,
      signal,
    );
  }

  /** Re-translate an existing transcript into another language. NDJSON stream. */
  async *streamTranslate(
    videoId: string,
    req: LibraryTranslateRequest,
    signal?: AbortSignal,
  ): AsyncIterable<LibraryRunEvent> {
    yield* this.streamNdjson<LibraryRunEvent>(
      `/api/library/${videoId}/translate`,
      req,
      signal,
    );
  }

  // ─── History ──────────────────────────────────────────────────────────
  async fetchHistory(): Promise<{ items: HistoryItem[] }> {
    const res = await fetch(`${this.baseUrl}/api/history`, {
      headers: this.headers(),
    });
    if (!res.ok) {
      // History endpoint may live behind /api/library in some backends —
      // tolerate 404 here so the screen renders empty rather than crashes.
      if (res.status === 404) return { items: [] };
      throw new Error(`/api/history ${res.status}`);
    }
    return res.json();
  }

  // ─── Config ───────────────────────────────────────────────────────────
  async fetchConfig(): Promise<AppConfig> {
    const res = await fetch(`${this.baseUrl}/api/config`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`/api/config ${res.status}`);
    return res.json();
  }

  async updateConfig(patch: Partial<AppConfig>): Promise<AppConfig> {
    const res = await fetch(`${this.baseUrl}/api/config`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`POST /api/config ${res.status}`);
    return res.json();
  }

  async resetConfig(): Promise<AppConfig> {
    const res = await fetch(`${this.baseUrl}/api/config/reset`, {
      method: "POST",
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`POST /api/config/reset ${res.status}`);
    return res.json();
  }

  // ─── Dependencies (Whisper model) ──────────────────────────────────────
  async fetchDependencies(engine?: string): Promise<DependencyStatus> {
    const url = engine
      ? `${this.baseUrl}/api/dependencies?engine=${encodeURIComponent(engine)}`
      : `${this.baseUrl}/api/dependencies`;
    const res = await fetch(url, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`/api/dependencies ${res.status}`);
    return res.json();
  }

  async *installDependency(
    model: WhisperModel,
    signal?: AbortSignal,
    engine?: string,
  ): AsyncIterable<InstallEvent> {
    yield* this.streamNdjson<InstallEvent>(
      "/api/dependencies/install",
      engine ? { model, engine } : { model },
      signal,
    );
  }

  // ─── Filesystem path check ────────────────────────────────────────────
  async checkFs(req: CheckFsRequest): Promise<CheckFsResult> {
    const res = await fetch(`${this.baseUrl}/api/fs/check`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error(`/api/fs/check ${res.status}`);
    return res.json();
  }

  // ─── NDJSON streaming primitive ────────────────────────────────────────
  private async *streamNdjson<T>(
    path: string,
    body: unknown,
    signal?: AbortSignal,
  ): AsyncIterable<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
      signal,
    });
    if (!response.ok) {
      throw new Error(`${path} ${response.status}: ${await response.text()}`);
    }
    if (!response.body) {
      throw new Error(`${path} returned no body`);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          yield JSON.parse(trimmed) as T;
        }
      }
      // Flush any final buffered line that lacked a trailing newline.
      const tail = buffer.trim();
      if (tail) yield JSON.parse(tail) as T;
    } finally {
      reader.releaseLock();
    }
  }
}
