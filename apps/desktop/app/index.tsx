import * as React from "react";
import { Stack, XStack, YStack } from "tamagui";
import { useWindowDimensions } from "react-native";
import {
  Link2,
  ChevronDown,
  ChevronRight,
  Sparkles,
  X,
  CheckCircle2,
  PlayCircle,
  FolderOpen,
  Download,
  RotateCcw,
  Info,
  MoreHorizontal,
  AlertTriangle,
} from "@tamagui/lucide-icons";
import {
  HeroCard,
  GlassCard,
  TextInput,
  ButtonPrimary,
  ButtonSecondary,
  ButtonGhost,
  IconButton,
  ActionSheet,
  BadgeAccent,
  BadgePill,
  ProgressBar,
  StepPill,
  RadioCard,
  Toggle,
  Dropdown,
  SegmentedControl,
  Tooltip,
  DisplayMd,
  DisplaySm,
  TitleLg,
  TitleMd,
  TitleSm,
  BodyMd,
  BodySm,
  Caption,
  CaptionUpper,
  Timestamp,
} from "@yt-subtitle-maker/ui";
import { useGenerate } from "../src/state/generate";
import { apiClient } from "../src/state/client";
import { useLogs } from "../src/state/logs";
import { NewTranscribeModal } from "../src/components/NewTranscribeModal";
import {
  WHISPER_MODELS,
  WHISPER_DEVICES,
  LANGUAGES,
  ENGINE_LABELS,
  TRANSLATOR_LABELS,
  humanEngine,
  platformModKey,
} from "../src/constants";
import { useRouter } from "expo-router";
import type {
  SttSource,
  SttEngine,
  WhisperModel,
  WhisperDevice,
  TranslatorProvider,
} from "@yt-subtitle-maker/api-client";

const TRANSLATOR_OPTIONS: { label: string; value: TranslatorProvider }[] = [
  { label: "Gemini", value: "gemini" },
  { label: "Local AI", value: "local_openai" },
  { label: "OpenAI-compat", value: "openai" },
];

/* ───────────── helpers ───────────── */

type ErrorCategory =
  | "network"
  | "youtube"
  | "cookies"
  | "engine"
  | "translator"
  | "generic";

/**
 * Categorize a free-form backend error into one of six buckets so the UI
 * can show a viewer-readable recovery hint instead of dumping a stack
 * trace. Keyword-based; intentionally lenient because backend wraps
 * exceptions inconsistently. Order matters — more specific patterns first.
 */
function categorizeError(msg: string): { category: ErrorCategory; hint: string } {
  const m = msg.toLowerCase();
  if (
    /econn|fetch failed|failed to fetch|timeout|etimedout|connection refused|network/.test(
      m,
    )
  ) {
    return {
      category: "network",
      hint: "Couldn't reach the backend. Check that it's running on http://127.0.0.1:8000 and that no firewall is blocking it.",
    };
  }
  if (/cookie/.test(m)) {
    return {
      category: "cookies",
      hint: "YouTube wants a logged-in session for this video. Configure cookies in Settings, then retry.",
    };
  }
  if (
    /video unavailable|private video|sign in to confirm|members-only|geo|429|sign in|age[- ]restricted/.test(
      m,
    )
  ) {
    return {
      category: "youtube",
      hint: "YouTube refused this video. It may be private, age-restricted, region-locked, or rate-limited.",
    };
  }
  if (/cuda|out of memory|outofmemoryerror|gpu/.test(m)) {
    return {
      category: "engine",
      hint: "Your GPU ran out of memory. Pick a smaller Whisper model or switch the device to CPU, then retry.",
    };
  }
  if (/model not found|whisper|stt|insanely[- ]fast|whisperx/.test(m)) {
    return {
      category: "engine",
      hint: "The Whisper engine couldn't process this audio. Try a different engine or smaller model.",
    };
  }
  if (
    /gemini|rate limit|api key|401|403|quota|translator|openai|local[_ ]openai/.test(
      m,
    )
  ) {
    return {
      category: "translator",
      hint: "The translator rejected the request. Check your API key in Settings or try a different provider.",
    };
  }
  return {
    category: "generic",
    hint: "An unexpected error occurred. Open logs for the full trace.",
  };
}

function formatDuration(seconds: number | undefined): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/* ───────────── flow placeholder ─────────────
 * Faded skeleton row used on the idle Generate screen to telegraph the
 * coming steps (Video preview → Configure → Generate). Inert, no real data.
 */
function FlowPlaceholder({ label, hint }: { label: string; hint: string }) {
  return (
    <XStack
      alignItems="center"
      gap="$md"
      paddingHorizontal="$lg"
      paddingVertical="$md"
      borderRadius="$lg"
      backgroundColor="$surfaceGlass"
      borderColor="$borderSubtle"
      borderWidth={1}
    >
      <Stack
        width={6}
        height={6}
        borderRadius="$pill"
        backgroundColor="$textMuted"
      />
      <YStack gap={2} flex={1}>
        <TitleSm color="$textSecondary">{label}</TitleSm>
        <Caption>{hint}</Caption>
      </YStack>
      <ChevronRight size={14} color="$textMuted" />
    </XStack>
  );
}

/* ───────────── waveform ─────────────
 * 36 bars, 4px wide, pill-shaped. Active center bars animate scaleY
 * (CSS keyframes — already injected by Phase 5's keyframes helper for
 * yt-ui-pulse; we add a small inline-keyframes injection for the wave).
 */
const WAVE_BARS = 36;
const WAVE_KEYFRAMES_ID = "yt-ui-wave-keyframes";

function ensureWaveKeyframes() {
  if (typeof document === "undefined") return;
  if (document.getElementById(WAVE_KEYFRAMES_ID)) return;
  const style = document.createElement("style");
  style.id = WAVE_KEYFRAMES_ID;
  style.textContent = `
    @keyframes yt-ui-wave {
      0%, 100% { transform: scaleY(0.4); }
      50%      { transform: scaleY(1.3); }
    }
  `;
  document.head.appendChild(style);
}

function Waveform({ active }: { active: boolean }) {
  React.useEffect(ensureWaveKeyframes, []);
  return (
    <XStack
      height={64}
      borderRadius="$md"
      backgroundColor="rgba(0,0,0,0.2)"
      paddingHorizontal="$md"
      paddingVertical="$sm"
      alignItems="center"
      justifyContent="center"
      gap={3}
    >
      {Array.from({ length: WAVE_BARS }).map((_, i) => {
        const distFromCenter = Math.abs(i - WAVE_BARS / 2);
        const isCenter = distFromCenter < 6;
        return (
          <Stack
            key={i}
            width={4}
            height={28}
            borderRadius="$pill"
            backgroundColor={
              isCenter
                ? undefined
                : "rgba(255,255,255,0.10)"
            }
            style={
              isCenter
                ? {
                    backgroundImage:
                      "linear-gradient(180deg, #fb923c 0%, #f97316 100%)",
                    transformOrigin: "center",
                    animation: active
                      ? `yt-ui-wave 1s ease-in-out ${i * 40}ms infinite`
                      : undefined,
                  }
                : undefined
            }
          />
        );
      })}
    </XStack>
  );
}

/* ───────────── Generate screen ───────────── */

export default function Generate() {
  const {
    status,
    url,
    metadata,
    metaError,
    phase,
    phaseMessage,
    phaseProgress,
    result,
    errorMessage,
    setUrl,
    loadMetadata,
    runPipeline,
    cancel,
    reset,
    dismissError,
  } = useGenerate();
  const toggleLogsDrawer = useLogs((s) => s.toggleDrawer);

  /* form state — defaults match the spec's recommended pick (Auto + faster-whisper + turbo + EN→ZH) */
  const [sttSource, setSttSource] = React.useState<SttSource>("auto");
  const [sourceLang, setSourceLang] = React.useState("en");
  const [enableTranslation, setEnableTranslation] = React.useState(true);
  const [targetLang, setTargetLang] = React.useState("zh");
  const [downloadOnly, setDownloadOnly] = React.useState(false);
  // Desktop lands with Configure open so source/target language are visible
  // without a discoverable-only click; mobile keeps it folded to save space.
  // 768px matches the handoff's tablet breakpoint (collapsed sidebar threshold).
  const { width: viewportWidth } = useWindowDimensions();
  const [configureOpen, setConfigureOpen] = React.useState(
    () => viewportWidth >= 768,
  );
  // Advanced chevron inside Configure. Holds engine internals only (Whisper
  // model / Device / VAD). Translation lives above the chevron as the user's
  // primary intent — hiding it behind "advanced" buries the most-likely-
  // toggled option (reviewer feedback across multiple rounds).
  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  // V1 backend currently only ships `openai-whisper`. The spec lists 4 engines
  // but only this one is installed (faster-whisper / WhisperX / IFW are V1.1+).
  // We probe /api/version.installedSttEngines on mount and switch if needed.
  const [sttEngine, setSttEngine] = React.useState<SttEngine>("openai-whisper");

  React.useEffect(() => {
    let cancelled = false;
    apiClient
      .fetchVersion()
      .then((v) => {
        if (cancelled) return;
        const installed = v.installedSttEngines ?? [];
        if (installed.length > 0 && !installed.includes(sttEngine)) {
          setSttEngine(installed[0] as SttEngine);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [whisperModel, setWhisperModel] = React.useState<WhisperModel>("turbo");
  const [whisperDevice, setWhisperDevice] = React.useState<WhisperDevice>("auto");
  const [vadEnabled, setVadEnabled] = React.useState(true);

  // Installed Whisper models — drives the dropdown so the user can't pick a
  // model they haven't downloaded (which would 422 mid-pipeline). undefined
  // = not yet probed; show full list to avoid flash. Empty set after probe
  // means "nothing installed" — the init flow handles that case.
  const [installedWhisperModels, setInstalledWhisperModels] = React.useState<
    Set<WhisperModel> | undefined
  >(undefined);

  React.useEffect(() => {
    let cancelled = false;
    apiClient
      .fetchDependencies()
      .then((dep) => {
        if (cancelled) return;
        const installed = new Set<WhisperModel>(
          (Object.entries(dep.models ?? {})
            .filter(([, v]) => v === true)
            .map(([k]) => k) as WhisperModel[]),
        );
        setInstalledWhisperModels(installed);
        // If the current pick isn't installed, swap to the first installed
        // model so submitting won't fail. Falls back to leaving as-is when
        // nothing is installed (init flow will redirect first anyway).
        if (installed.size > 0 && !installed.has(whisperModel)) {
          const first = Array.from(installed)[0];
          if (first) setWhisperModel(first);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const whisperModelOptions = React.useMemo(() => {
    if (!installedWhisperModels) return WHISPER_MODELS;
    return WHISPER_MODELS.filter((opt) => installedWhisperModels.has(opt.value));
  }, [installedWhisperModels]);

  // Translator provider — initialized from server config so the user's
  // Settings choice is the default. Per-job override stays in this state
  // and is sent in the process request, so flipping providers between
  // Gemini and Local AI doesn't require visiting Settings each time.
  const [translatorProvider, setTranslatorProvider] =
    React.useState<TranslatorProvider>("gemini");

  React.useEffect(() => {
    let cancelled = false;
    apiClient
      .fetchConfig()
      .then((cfg) => {
        if (cancelled) return;
        if (cfg.translatorProvider) {
          setTranslatorProvider(cfg.translatorProvider);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // MPV launch feedback — tells the user the click did something even when
  // the mpv window pops up behind/off-screen, and surfaces backend errors
  // (mpv-not-found, etc.) inline instead of via window.alert.
  const [mpvBusy, setMpvBusy] = React.useState(false);
  const [mpvStatus, setMpvStatus] = React.useState<
    { kind: "ok" | "error"; text: string } | undefined
  >(undefined);

  // Re-transcribe modal — opens for the just-finished video so the user can
  // try a different engine/model on the same audio without re-downloading.
  const [reTranscribeOpen, setReTranscribeOpen] = React.useState(false);
  const [resultOverflowOpen, setResultOverflowOpen] = React.useState(false);

  // Which SRT to overlay when launching mpv. Snaps to a sensible default
  // every time a new result lands: "translated" if the pipeline produced
  // one, "original" otherwise. User can override via SegmentedControl.
  type SubPreference = "translated" | "original" | "none";
  const [subPreference, setSubPreference] =
    React.useState<SubPreference>("translated");

  React.useEffect(() => {
    if (!result) return;
    setSubPreference(result.translatedSrtPath ? "translated" : "original");
  }, [result]);

  // Inline translator-test feedback for the per-job provider switcher.
  // Lets the user verify the chosen provider's credentials before kicking
  // off a job; auto-clears when the provider changes.
  const [translatorTest, setTranslatorTest] = React.useState<
    { kind: "ok" | "error" | "busy"; text?: string } | undefined
  >(undefined);

  React.useEffect(() => {
    setTranslatorTest(undefined);
  }, [translatorProvider]);

  const testCurrentTranslator = async () => {
    setTranslatorTest({ kind: "busy" });
    try {
      // Send only `provider` — backend resolves baseUrl/model/apiKey from
      // saved config (see backend/api/routes/translator.py::_resolve_field).
      // Saves the user from re-typing credentials they've already saved.
      const res = await apiClient.testTranslator({
        provider: translatorProvider,
      });
      setTranslatorTest(
        res.ok
          ? { kind: "ok", text: "Reachable" }
          : { kind: "error", text: res.error ?? "unreachable" },
      );
    } catch (err) {
      setTranslatorTest({
        kind: "error",
        text: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const router = useRouter();

  const isProcessing = status === "processing";
  const isDone = status === "done";
  const showVideoPreview =
    status === "meta-loaded" || status === "processing" || status === "done";

  const onGenerate = () => {
    runPipeline({
      sttSource,
      sttEngine: sttSource === "yt_captions" ? undefined : sttEngine,
      whisperModel,
      whisperDevice,
      vadEnabled,
      sourceLang,
      enableTranslation: !downloadOnly && enableTranslation,
      targetLang: enableTranslation ? targetLang : undefined,
      // Forward the user's per-job provider choice. The matching credentials
      // (api key / base url / model) come from server config — pipeline.py
      // resolves them per-provider via `cfg.<gemini|local_openai|openai>_*`.
      translatorProvider:
        enableTranslation && !downloadOnly ? translatorProvider : undefined,
      downloadOnly,
    });
  };

  // Cmd+Enter (mac) / Ctrl+Enter (win/linux) triggers Generate when metadata
  // is loaded and the pipeline isn't running. Power-user shortcut requested
  // by heuristic #7 (Flexibility & efficiency).
  const canGenerate =
    showVideoPreview && !isProcessing && !isDone && metadata?.ok === true;
  // Platform-aware keycap shown next to the Generate label so the shortcut is
  // discoverable instead of a hidden gem.
  const submitHintKey = React.useMemo(
    () => `${platformModKey()} + ↵`,
    [],
  );
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!canGenerate) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onGenerate();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // onGenerate captures every form-state field via closure; re-binding on
    // every render is cheap and ensures the latest values are submitted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });

  return (
    <YStack gap="$lg">
      {/* HERO: URL input */}
      <HeroCard variant="mid" shimmer={!showVideoPreview && status !== "loading-meta"}>
        <YStack gap="$md">
          <YStack gap="$xs">
            <DisplayMd>What are we transcribing today?</DisplayMd>
            <BodyMd color="$textSecondary">
              Drop a YouTube link to get started.
            </BodyMd>
          </YStack>

          <XStack gap="$sm" alignItems="center">
            <XStack flex={1} alignItems="center" position="relative">
              <Stack position="absolute" left={18} zIndex={1}>
                <Link2 size={16} color="$textMuted" />
              </Stack>
              <TextInput
                flex={1}
                paddingLeft={44}
                height={52}
                value={url}
                onChangeText={setUrl}
                placeholder="https://www.youtube.com/watch?v=..."
                onSubmitEditing={loadMetadata}
              />
            </XStack>
            <ButtonPrimary
              onPress={loadMetadata}
              disabled={!url.trim() || status === "loading-meta"}
              height={52}
            >
              {status === "loading-meta" ? "Loading…" : "Load"}
            </ButtonPrimary>
          </XStack>

          {metaError ? (
            <BodySm color="$error">{metaError}</BodySm>
          ) : null}
        </YStack>
      </HeroCard>

      {/* IDLE FLOW HINT — three faded placeholder rows that telegraph the
          coming steps so the page doesn't feel half-empty before a URL is
          loaded. They fade out the moment metadata arrives. (Spec: design
          handoff §"Generate — Idle".) */}
      {!showVideoPreview && status !== "loading-meta" ? (
        <YStack gap="$sm" opacity={0.35} pointerEvents="none">
          <FlowPlaceholder label="Video preview" hint="Title, channel, thumbnail" />
          <FlowPlaceholder label="Configure" hint="Source · language · engine" />
          <FlowPlaceholder label="Generate" hint="One click to start" />
        </YStack>
      ) : null}

      {/* VIDEO PREVIEW (after metadata) */}
      {showVideoPreview && metadata?.videoId ? (
        <GlassCard variant="mid">
          <XStack gap="$md" alignItems="flex-start">
            <Stack
              width={192}
              height={108}
              borderRadius="$md"
              overflow="hidden"
              backgroundColor="$bgElevated"
              style={{
                backgroundImage: metadata.thumbnailUrl
                  ? `url(${metadata.thumbnailUrl})`
                  : "linear-gradient(135deg, #1a1a1d 0%, #0a0a0c 100%)",
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
            <YStack flex={1} gap="$xs">
              <TitleLg numberOfLines={2}>
                {metadata.titleOriginal ?? "Untitled"}
              </TitleLg>
              <BodySm color="$textSecondary">
                {metadata.channel ?? "Unknown channel"} ·{" "}
                {formatDuration(metadata.durationSeconds)}
              </BodySm>
              {metadata.titleTranslated ? (
                <XStack gap="$xs" marginTop="$xs" flexWrap="wrap">
                  <BadgePill tone="accent">translated title ready</BadgePill>
                </XStack>
              ) : null}
            </YStack>
          </XStack>
        </GlassCard>
      ) : null}

      {/* CONFIGURE (collapsible) */}
      {showVideoPreview ? (
        <GlassCard variant="mid">
          <YStack gap="$md">
            <XStack
              alignItems="center"
              justifyContent="space-between"
              cursor="pointer"
              onPress={() => setConfigureOpen((v) => !v)}
            >
              <XStack gap="$sm" alignItems="center">
                {configureOpen ? (
                  <ChevronDown size={16} color="$textSecondary" />
                ) : (
                  <ChevronRight size={16} color="$textSecondary" />
                )}
                <TitleMd>Configure</TitleMd>
              </XStack>
              <Caption>
                {sttSource === "auto"
                  ? "Auto"
                  : sttSource === "yt_captions"
                  ? "YouTube only"
                  : "Whisper only"}
                {" · "}
                {sourceLang.toUpperCase()}
                {enableTranslation && !downloadOnly
                  ? ` → ${targetLang.toUpperCase()}`
                  : ""}
              </Caption>
            </XStack>

            {configureOpen ? (
              <YStack gap="$lg">
                {/* Subtitle source radio group */}
                <YStack gap="$sm">
                  <CaptionUpper>Subtitle source</CaptionUpper>
                  <YStack gap="$xs">
                    <RadioCard
                      selected={sttSource === "auto"}
                      onPress={() => setSttSource("auto")}
                    >
                      <YStack gap={2} flex={1}>
                        <XStack alignItems="center" gap="$xs">
                          <TitleSm>Auto</TitleSm>
                          <BadgeAccent>recommended</BadgeAccent>
                        </XStack>
                        <BodySm color="$textSecondary">
                          Try YouTube auto-captions first, fall back to Whisper.
                        </BodySm>
                      </YStack>
                    </RadioCard>
                    <RadioCard
                      selected={sttSource === "yt_captions"}
                      onPress={() => setSttSource("yt_captions")}
                    >
                      <YStack gap={2}>
                        <TitleSm>YouTube auto-captions only</TitleSm>
                        <BodySm color="$textSecondary">
                          Free + instant, but unavailable on many videos.
                        </BodySm>
                      </YStack>
                    </RadioCard>
                    <RadioCard
                      selected={sttSource === "whisper"}
                      onPress={() => setSttSource("whisper")}
                    >
                      <YStack gap={2}>
                        <TitleSm>Whisper only</TitleSm>
                        <BodySm color="$textSecondary">
                          Skip YT captions, run Whisper directly on the audio.
                        </BodySm>
                      </YStack>
                    </RadioCard>
                  </YStack>
                </YStack>

                {/* Languages */}
                <XStack gap="$md">
                  <YStack flex={1} gap="$xs">
                    <CaptionUpper>Source language</CaptionUpper>
                    <Dropdown
                      value={sourceLang}
                      onValueChange={setSourceLang}
                      options={LANGUAGES}
                      width="100%"
                      aria-label="Source language"
                    />
                  </YStack>
                  <YStack flex={1} gap="$xs">
                    <CaptionUpper>Target language</CaptionUpper>
                    <Dropdown
                      value={targetLang}
                      onValueChange={setTargetLang}
                      options={LANGUAGES}
                      width="100%"
                      disabled={!enableTranslation || downloadOnly}
                      aria-label="Target language"
                    />
                  </YStack>
                </XStack>

                {/* Translation — always visible. It IS the user's primary
                    intent (they came here for subtitles in their language);
                    hiding it behind a chevron buries the most-likely-toggled
                    option. */}
                <YStack gap="$sm">
                  <XStack alignItems="center" justifyContent="space-between">
                    <YStack gap={2} flex={1}>
                      <BodyMd fontWeight="500">Translate subtitles</BodyMd>
                      <XStack gap={4} alignItems="center" flexWrap="wrap">
                        <Caption>
                          Using {TRANSLATOR_LABELS[translatorProvider]}
                        </Caption>
                        <Caption>·</Caption>
                        <Caption
                          color="$accent"
                          cursor="pointer"
                          hoverStyle={{ opacity: 0.8 }}
                          onPress={() => router.push("/settings")}
                        >
                          configure credentials
                        </Caption>
                      </XStack>
                    </YStack>
                    <Toggle
                      value={enableTranslation && !downloadOnly}
                      onValueChange={setEnableTranslation}
                      disabled={downloadOnly}
                      aria-label="Translate subtitles"
                    />
                  </XStack>

                  {enableTranslation && !downloadOnly ? (
                    <YStack gap="$xs">
                      <SegmentedControl
                        value={translatorProvider}
                        onValueChange={(v) =>
                          setTranslatorProvider(v as TranslatorProvider)
                        }
                        options={TRANSLATOR_OPTIONS}
                        aria-label="Translator provider"
                      />
                      <XStack alignItems="center" gap="$sm">
                        <ButtonGhost
                          onPress={testCurrentTranslator}
                          disabled={translatorTest?.kind === "busy"}
                        >
                          <Caption color="$textPrimary">
                            {translatorTest?.kind === "busy"
                              ? "Testing…"
                              : "Test connection"}
                          </Caption>
                        </ButtonGhost>
                        {translatorTest && translatorTest.kind !== "busy" ? (
                          <XStack alignItems="center" gap="$xs">
                            <Stack
                              width={8}
                              height={8}
                              borderRadius="$pill"
                              backgroundColor={
                                translatorTest.kind === "ok"
                                  ? "$success"
                                  : "$error"
                              }
                            />
                            <Caption
                              color={
                                translatorTest.kind === "ok"
                                  ? "$success"
                                  : "$error"
                              }
                            >
                              {translatorTest.text}
                            </Caption>
                          </XStack>
                        ) : null}
                      </XStack>
                    </YStack>
                  ) : null}

                  <XStack alignItems="center" justifyContent="space-between">
                    <YStack gap={2}>
                      <BodyMd fontWeight="500">
                        Just download, no subtitles
                      </BodyMd>
                      <Caption>Skip transcription entirely.</Caption>
                    </YStack>
                    <Toggle
                      value={downloadOnly}
                      onValueChange={setDownloadOnly}
                      aria-label="Download only"
                    />
                  </XStack>
                </YStack>

                {/* Advanced — engine internals only (model / device / VAD).
                    Default closed; this is the genuinely advanced surface. */}
                <YStack gap="$sm">
                  <XStack
                    alignItems="center"
                    gap="$xs"
                    cursor="pointer"
                    onPress={() => setAdvancedOpen((v) => !v)}
                  >
                    {advancedOpen ? (
                      <ChevronDown size={14} color="$textSecondary" />
                    ) : (
                      <ChevronRight size={14} color="$textSecondary" />
                    )}
                    <CaptionUpper>Advanced</CaptionUpper>
                  </XStack>
                  {advancedOpen ? (
                    <YStack gap="$md">
                      <XStack gap="$md" flexWrap="wrap">
                        <YStack flex={1} minWidth={180} gap="$xs">
                          <CaptionUpper>Whisper model</CaptionUpper>
                          <Dropdown
                            value={whisperModel}
                            onValueChange={(v) =>
                              setWhisperModel(v as WhisperModel)
                            }
                            options={whisperModelOptions}
                            width="100%"
                          />
                          {installedWhisperModels &&
                          installedWhisperModels.size <
                            WHISPER_MODELS.length ? (
                            <Caption>
                              Only installed models shown · install more in
                              first-run setup
                            </Caption>
                          ) : null}
                        </YStack>
                        <YStack flex={1} minWidth={180} gap="$xs">
                          <CaptionUpper>Device</CaptionUpper>
                          <Dropdown
                            value={whisperDevice}
                            onValueChange={(v) =>
                              setWhisperDevice(v as WhisperDevice)
                            }
                            options={WHISPER_DEVICES}
                            width="100%"
                          />
                        </YStack>
                      </XStack>
                      <XStack alignItems="center" justifyContent="space-between">
                        <XStack gap="$xs" alignItems="center">
                          <BodyMd fontWeight="500">
                            VAD (Voice Activity Detection)
                          </BodyMd>
                          <Tooltip content="Skips silent sections of the audio. Prevents Whisper from inventing text in silence.">
                            <Stack>
                              <Info size={14} color="$textMuted" />
                            </Stack>
                          </Tooltip>
                        </XStack>
                        <Toggle
                          value={vadEnabled}
                          onValueChange={setVadEnabled}
                          aria-label="Enable VAD"
                        />
                      </XStack>
                    </YStack>
                  ) : null}
                </YStack>
              </YStack>
            ) : null}

            {/* Commit slot — docked inside Configure so the CTA reads as the
                "commit" of this card, not a fifth orphan flow item. Stays
                visible even when Configure is collapsed so the user can
                press Generate without expanding. */}
            {!isProcessing && !isDone ? (
              <ButtonPrimary
                onPress={onGenerate}
                disabled={!metadata?.ok}
                glow="ready"
              >
                <XStack gap="$xs" alignItems="center">
                  {downloadOnly ? (
                    <Download size={16} color="$textPrimary" />
                  ) : (
                    <Sparkles size={16} color="$textPrimary" />
                  )}
                  <TitleMd>
                    {downloadOnly ? "Download only" : "Generate Subtitles"}
                  </TitleMd>
                  {!downloadOnly && metadata?.ok ? (
                    <Caption
                      color="rgba(245,245,247,0.55)"
                      marginLeft="$xs"
                    >
                      {submitHintKey}
                    </Caption>
                  ) : null}
                </XStack>
              </ButtonPrimary>
            ) : null}
          </YStack>
        </GlassCard>
      ) : null}

      {isProcessing ? (
        <GlassCard variant="mid">
          <YStack gap="$md">
            <XStack alignItems="center" justifyContent="space-between">
              <CaptionUpper>processing</CaptionUpper>
              <IconButton
                icon={<X size={14} color="$textSecondary" />}
                aria-label="Cancel"
                size={32}
                onPress={cancel}
              />
            </XStack>

            <Waveform active />

            <YStack gap={2} alignItems="center">
              <TitleMd>
                {phaseMessage ??
                  (phase === "download"
                    ? "Downloading audio…"
                    : phase === "transcribe"
                    ? `Transcribing with ${humanEngine(sttEngine)}…`
                    : phase === "translate"
                    ? "Translating segments…"
                    : "Working…")}
              </TitleMd>
              {(() => {
                const totalSteps =
                  enableTranslation && !downloadOnly ? 4 : 3;
                const step =
                  phase === "download"
                    ? 1
                    : phase === "transcribe"
                    ? 2
                    : phase === "translate"
                    ? 3
                    : phase === "done"
                    ? totalSteps
                    : 0;
                return step > 0 ? (
                  <BodySm color="$textSecondary">
                    Step {step} / {totalSteps}
                  </BodySm>
                ) : null;
              })()}
            </YStack>

            <ProgressBar
              value={phaseProgress ?? 0}
              indeterminate={phaseProgress === undefined}
            />

            <XStack gap="$xs" justifyContent="center" flexWrap="wrap">
              <StepPill
                status={
                  phase === "download"
                    ? "active"
                    : phase === "transcribe" ||
                      phase === "translate" ||
                      phase === "done"
                    ? "done"
                    : "pending"
                }
              >
                Download
              </StepPill>
              <StepPill
                status={
                  phase === "transcribe"
                    ? "active"
                    : phase === "translate" || phase === "done"
                    ? "done"
                    : "pending"
                }
              >
                Transcribe
              </StepPill>
              {enableTranslation && !downloadOnly ? (
                <StepPill
                  status={
                    phase === "translate"
                      ? "active"
                      : phase === "done"
                      ? "done"
                      : "pending"
                  }
                >
                  Translate
                </StepPill>
              ) : null}
              <StepPill status={phase === "done" ? "done" : "pending"}>
                Done
              </StepPill>
            </XStack>
          </YStack>
        </GlassCard>
      ) : null}

      {/* RESULT
       *
       * Distilled layout: the translated title is the earned editorial moment
       * and leads the card; Done meta is demoted to a quieter line beneath;
       * the action row carries only Play + sub-picker + ⋯ overflow. Open
       * folder / Re-transcribe / Download SRT / New transcription live in the
       * ActionSheet so the success moment stays uncluttered.
       */}
      {isDone && result ? (
        <GlassCard variant="mid">
          <YStack gap="$md">
            {/* The earned moment — translated title in Fraunces, original beneath.
                Falls back to original-only when nothing was translated. */}
            <YStack gap={4}>
              {metadata?.titleTranslated ? (
                <>
                  <DisplaySm>{metadata.titleTranslated}</DisplaySm>
                  <BodySm color="$textMuted">{metadata.titleOriginal}</BodySm>
                </>
              ) : metadata?.titleOriginal ? (
                <DisplaySm>{metadata.titleOriginal}</DisplaySm>
              ) : null}
            </YStack>

            {/* Done meta — calm, not loud */}
            <XStack gap="$sm" alignItems="center">
              <Stack
                width={28}
                height={28}
                borderRadius="$pill"
                backgroundColor="rgba(93,184,114,0.15)"
                alignItems="center"
                justifyContent="center"
              >
                <CheckCircle2 size={14} color="$success" />
              </Stack>
              <BodySm color="$textSecondary">
                Done · {Math.round(result.durationMs / 1000)}s ·{" "}
                {result.sttSourceUsed === "yt_captions"
                  ? "YouTube auto-captions"
                  : humanEngine(sttEngine)}
                {" · "}
                {sourceLang.toUpperCase()}
                {enableTranslation && !downloadOnly
                  ? ` → ${targetLang.toUpperCase()}`
                  : ""}
              </BodySm>
            </XStack>

            {result.previewSegments.length > 0 ? (
              <Stack
                backgroundColor="rgba(0,0,0,0.25)"
                borderRadius="$md"
                paddingHorizontal="$md"
                paddingVertical="$sm"
                gap={2}
              >
                {result.previewSegments.slice(0, 5).map((seg, i) => (
                  <XStack
                    key={seg.id}
                    paddingVertical="$xs"
                    gap="$md"
                    alignItems="flex-start"
                    borderBottomWidth={
                      i === Math.min(result.previewSegments.length, 5) - 1
                        ? 0
                        : 1
                    }
                    borderBottomColor="$borderSubtle"
                  >
                    <Stack width={88} flexShrink={0} paddingTop={2}>
                      <Timestamp>{formatTimestamp(seg.start)}</Timestamp>
                    </Stack>
                    <YStack flex={1}>
                      <BodySm>{seg.text}</BodySm>
                      {seg.translated ? (
                        <BodySm color="$accent">{seg.translated}</BodySm>
                      ) : null}
                    </YStack>
                  </XStack>
                ))}
              </Stack>
            ) : null}

            {/* Single action row: Play / Subs / ⋯ */}
            <YStack gap="$sm">
              <XStack
                alignItems="center"
                gap="$sm"
                flexWrap="wrap"
              >
                <ButtonPrimary
                  disabled={mpvBusy}
                  glow="none"
                  onPress={async () => {
                    setMpvBusy(true);
                    setMpvStatus(undefined);
                    try {
                      const res = await apiClient.playMpv(result.videoId, {
                        subtitlePreference: subPreference,
                      });
                      if (res.ok) {
                        setMpvStatus({
                          kind: "ok",
                          text: res.subtitle
                            ? `Launched mpv · subs ${res.subtitle}`
                            : "Launched mpv",
                        });
                      } else {
                        setMpvStatus({
                          kind: "error",
                          text: res.error ?? "mpv launch failed",
                        });
                      }
                    } catch (err) {
                      setMpvStatus({
                        kind: "error",
                        text: err instanceof Error ? err.message : String(err),
                      });
                    } finally {
                      setMpvBusy(false);
                    }
                  }}
                >
                  <XStack gap="$xs" alignItems="center">
                    <PlayCircle size={14} color="$textPrimary" />
                    <TitleMd>
                      {mpvBusy ? "Opening mpv…" : "Play with MPV"}
                    </TitleMd>
                  </XStack>
                </ButtonPrimary>
                <SegmentedControl
                  value={subPreference}
                  onValueChange={(v) => setSubPreference(v as SubPreference)}
                  options={[
                    ...(result.translatedSrtPath
                      ? [{ label: "Translated", value: "translated" as const }]
                      : []),
                    { label: "Original", value: "original" as const },
                    { label: "Off", value: "none" as const },
                  ]}
                  aria-label="Subtitle preference for mpv"
                />
                <Stack flex={1} />
                <ButtonSecondary onPress={() => setReTranscribeOpen(true)}>
                  <XStack gap="$xs" alignItems="center">
                    <RotateCcw size={14} color="$textSecondary" />
                    <BodySm fontWeight="500" color="$textSecondary">
                      Re-transcribe with…
                    </BodySm>
                  </XStack>
                </ButtonSecondary>
                <IconButton
                  icon={<MoreHorizontal size={16} color="$textSecondary" />}
                  aria-label="More actions"
                  onPress={() => setResultOverflowOpen(true)}
                />
              </XStack>

              {mpvStatus ? (
                <XStack
                  alignItems="center"
                  gap="$xs"
                  paddingHorizontal="$sm"
                  paddingVertical="$xs"
                  borderRadius="$sm"
                  backgroundColor={
                    mpvStatus.kind === "ok"
                      ? "rgba(93,184,114,0.10)"
                      : "rgba(255,90,95,0.10)"
                  }
                  borderWidth={1}
                  borderColor={
                    mpvStatus.kind === "ok"
                      ? "rgba(93,184,114,0.25)"
                      : "rgba(255,90,95,0.25)"
                  }
                >
                  <Caption
                    color={mpvStatus.kind === "ok" ? "$success" : "$error"}
                  >
                    {mpvStatus.text}
                  </Caption>
                </XStack>
              ) : null}
            </YStack>
          </YStack>
        </GlassCard>
      ) : null}

      {status === "error" && errorMessage ? (() => {
        const { category, hint } = categorizeError(errorMessage);
        const showConfigureFix =
          (category === "engine" || category === "translator") &&
          metadata?.ok === true;
        const showCookieFix = category === "cookies";
        return (
          <GlassCard variant="mid">
            <YStack gap="$md">
              <XStack gap="$sm" alignItems="flex-start">
                <Stack
                  width={28}
                  height={28}
                  borderRadius="$pill"
                  backgroundColor="rgba(255,90,95,0.15)"
                  alignItems="center"
                  justifyContent="center"
                  flexShrink={0}
                >
                  <AlertTriangle size={14} color="$error" />
                </Stack>
                <YStack gap={2} flex={1}>
                  <TitleMd>Something went wrong</TitleMd>
                  <BodySm color="$textSecondary">{hint}</BodySm>
                </YStack>
              </XStack>

              <Stack
                backgroundColor="rgba(255,90,95,0.06)"
                borderColor="rgba(255,90,95,0.25)"
                borderWidth={1}
                borderRadius="$md"
                paddingHorizontal="$md"
                paddingVertical="$sm"
              >
                <Caption color="$textMuted">{errorMessage}</Caption>
              </Stack>

              <XStack gap="$xs" flexWrap="wrap" alignItems="center">
                <ButtonPrimary
                  glow="none"
                  onPress={onGenerate}
                  disabled={!metadata?.ok}
                  height={44}
                >
                  <XStack gap="$xs" alignItems="center">
                    <RotateCcw size={14} color="$textPrimary" />
                    <TitleSm>Try again</TitleSm>
                  </XStack>
                </ButtonPrimary>

                {showConfigureFix ? (
                  <ButtonSecondary
                    onPress={() => {
                      dismissError();
                      setConfigureOpen(true);
                      // Engine errors live behind the Advanced chevron;
                      // translator errors live in the always-visible
                      // Translation block, so no inner expansion needed.
                      if (category === "engine") setAdvancedOpen(true);
                    }}
                  >
                    <BodySm fontWeight="500" color="$textSecondary">
                      Configure differently →
                    </BodySm>
                  </ButtonSecondary>
                ) : null}

                {showCookieFix ? (
                  <ButtonSecondary onPress={() => router.push("/settings")}>
                    <BodySm fontWeight="500" color="$textSecondary">
                      Open cookie settings →
                    </BodySm>
                  </ButtonSecondary>
                ) : null}

                <ButtonGhost onPress={toggleLogsDrawer}>
                  <BodySm fontWeight="500" color="$textSecondary">
                    Open logs (⌘L)
                  </BodySm>
                </ButtonGhost>

                <Stack flex={1} />

                <ButtonGhost onPress={reset}>
                  <BodySm fontWeight="500" color="$textMuted">
                    Start over
                  </BodySm>
                </ButtonGhost>
              </XStack>
            </YStack>
          </GlassCard>
        );
      })() : null}

      {result ? (
        <NewTranscribeModal
          open={reTranscribeOpen}
          onOpenChange={setReTranscribeOpen}
          videoId={result.videoId}
          onComplete={() => undefined}
        />
      ) : null}

      {result ? (
        <ActionSheet
          open={resultOverflowOpen}
          onOpenChange={setResultOverflowOpen}
          actions={[
            {
              label: "Open folder",
              icon: <FolderOpen size={16} color="$textSecondary" />,
              onPress: () =>
                apiClient
                  .openLibraryFolder(result.videoId)
                  .catch(() => undefined),
            },
            {
              label: "Download SRT",
              icon: <Download size={16} color="$textSecondary" />,
              onPress: () => {
                if (typeof window === "undefined") return;
                const baseUrl = "http://127.0.0.1:8000";
                // V2 multi-SRT: file is in transcripts/<id>.srt. Fall back
                // to the legacy filename for jobs created before the
                // pipeline migration.
                const path = result.transcribeId
                  ? `/api/library/${result.videoId}/file/transcripts/${result.transcribeId}.srt`
                  : `/api/library/${result.videoId}/file/${result.videoId}_original.srt`;
                window.open(`${baseUrl}${path}`, "_blank");
              },
            },
            { label: "New transcription", onPress: reset },
          ]}
        />
      ) : null}
    </YStack>
  );
}

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${h.toString().padStart(2, "0")}:${m
    .toString()
    .padStart(2, "0")}:${s.toString().padStart(2, "0")}.${ms
    .toString()
    .padStart(3, "0")}`;
}
