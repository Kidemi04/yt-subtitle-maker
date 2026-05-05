import * as React from "react";
import { Stack, XStack, YStack } from "tamagui";
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
} from "@tamagui/lucide-icons";
import {
  HeroCard,
  GlassCard,
  TextInput,
  ButtonPrimary,
  ButtonSecondary,
  ButtonGhost,
  IconButton,
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
import { useRouter } from "expo-router";
import type {
  SttSource,
  SttEngine,
  WhisperModel,
  WhisperDevice,
  TranslatorProvider,
} from "@yt-subtitle-maker/api-client";

const TRANSLATOR_LABELS: Record<TranslatorProvider, string> = {
  gemini: "Gemini",
  local_openai: "Local AI",
  openai: "OpenAI-compat",
};

const TRANSLATOR_OPTIONS: { label: string; value: TranslatorProvider }[] = [
  { label: "Gemini", value: "gemini" },
  { label: "Local AI", value: "local_openai" },
  { label: "OpenAI-compat", value: "openai" },
];

/* ───────────── helpers ───────────── */

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

/* ───────────── language constants (subset) ───────────── */

const LANGUAGE_OPTIONS = [
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

const WHISPER_MODELS: { label: string; value: WhisperModel }[] = [
  { label: "tiny · 75 MB", value: "tiny" },
  { label: "base · 150 MB", value: "base" },
  { label: "small · 500 MB", value: "small" },
  { label: "medium · 1.5 GB", value: "medium" },
  { label: "turbo · 1.5 GB ⭐", value: "turbo" },
  { label: "large-v3 · 3 GB", value: "large-v3" },
];

const DEVICES: { label: string; value: WhisperDevice }[] = [
  { label: "Auto", value: "auto" },
  { label: "CPU", value: "cpu" },
  { label: "GPU (CUDA)", value: "gpu" },
];

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
  } = useGenerate();

  /* form state — defaults match the spec's recommended pick (Auto + faster-whisper + turbo + EN→ZH) */
  const [sttSource, setSttSource] = React.useState<SttSource>("auto");
  const [sourceLang, setSourceLang] = React.useState("en");
  const [enableTranslation, setEnableTranslation] = React.useState(true);
  const [targetLang, setTargetLang] = React.useState("zh");
  const [downloadOnly, setDownloadOnly] = React.useState(false);
  const [configureOpen, setConfigureOpen] = React.useState(false);
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

  return (
    <YStack gap="$lg">
      {/* HERO: URL input */}
      <HeroCard variant="mid">
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
              <XStack gap="$xs" marginTop="$xs" flexWrap="wrap">
                <BadgePill tone="neutral">{metadata.videoId}</BadgePill>
                {metadata.titleTranslated ? (
                  <BadgePill tone="accent">translated title ready</BadgePill>
                ) : null}
              </XStack>
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
                  ? "Auto + faster-whisper"
                  : sttSource === "yt_captions"
                  ? "YouTube captions only"
                  : sttEngine}
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
                      options={LANGUAGE_OPTIONS}
                      width="100%"
                      aria-label="Source language"
                    />
                  </YStack>
                  <YStack flex={1} gap="$xs">
                    <CaptionUpper>Target language</CaptionUpper>
                    <Dropdown
                      value={targetLang}
                      onValueChange={setTargetLang}
                      options={LANGUAGE_OPTIONS}
                      width="100%"
                      disabled={!enableTranslation || downloadOnly}
                      aria-label="Target language"
                    />
                  </YStack>
                </XStack>

                {/* Toggles */}
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
                      <BodyMd fontWeight="500">Just download, no subtitles</BodyMd>
                      <Caption>Skip transcription entirely.</Caption>
                    </YStack>
                    <Toggle
                      value={downloadOnly}
                      onValueChange={setDownloadOnly}
                      aria-label="Download only"
                    />
                  </XStack>
                </YStack>

                {/* Advanced */}
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
                            options={DEVICES}
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
          </YStack>
        </GlassCard>
      ) : null}

      {/* GENERATE button OR processing card */}
      {showVideoPreview && !isProcessing && !isDone ? (
        <ButtonPrimary onPress={onGenerate} disabled={!metadata?.ok}>
          <XStack gap="$xs" alignItems="center">
            <Sparkles size={16} color="$textPrimary" />
            <TitleMd>
              {downloadOnly ? "Download only" : "Generate Subtitles"}
            </TitleMd>
          </XStack>
        </ButtonPrimary>
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

            <YStack gap="$xs" alignItems="center">
              <TitleMd>
                {phaseMessage ??
                  (phase === "download"
                    ? "Downloading audio…"
                    : phase === "transcribe"
                    ? `Transcribing with ${sttEngine}…`
                    : phase === "translate"
                    ? "Translating segments…"
                    : "Working…")}
              </TitleMd>
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

      {/* RESULT */}
      {isDone && result ? (
        <GlassCard variant="mid">
          <YStack gap="$md">
            <XStack gap="$sm" alignItems="center">
              <Stack
                width={40}
                height={40}
                borderRadius="$pill"
                backgroundColor="rgba(93,184,114,0.15)"
                alignItems="center"
                justifyContent="center"
              >
                <CheckCircle2 size={20} color="$success" />
              </Stack>
              <YStack gap={2}>
                <TitleLg>
                  Done · {Math.round(result.durationMs / 1000)}s
                </TitleLg>
                <BodySm color="$textSecondary">
                  {result.sttSourceUsed === "yt_captions"
                    ? "YouTube auto-captions"
                    : `Whisper · ${sttEngine}`}
                  {" · "}
                  {sourceLang.toUpperCase()}
                  {enableTranslation && !downloadOnly
                    ? ` → ${targetLang.toUpperCase()}`
                    : ""}
                </BodySm>
              </YStack>
            </XStack>

            {metadata?.titleTranslated ? (
              <Stack
                backgroundColor="$accentSoft"
                borderColor="$accentDim"
                borderWidth={1}
                borderRadius="$md"
                padding="$md"
              >
                <YStack gap="$xs">
                  <CaptionUpper color="$accent">translated title</CaptionUpper>
                  <TitleMd>{metadata.titleTranslated}</TitleMd>
                  <BodySm color="$textSecondary">
                    {metadata.titleOriginal}
                  </BodySm>
                </YStack>
              </Stack>
            ) : null}

            {result.previewSegments.length > 0 ? (
              <Stack
                backgroundColor="rgba(0,0,0,0.25)"
                borderRadius="$md"
                paddingHorizontal="$md"
                paddingVertical="$sm"
                gap={2}
              >
                {result.previewSegments.slice(0, 5).map((seg, i) => (
                  <YStack
                    key={seg.id}
                    paddingVertical="$xs"
                    borderBottomWidth={
                      i === Math.min(result.previewSegments.length, 5) - 1
                        ? 0
                        : 1
                    }
                    borderBottomColor="$borderSubtle"
                  >
                    <Timestamp>
                      {formatTimestamp(seg.start)} → {formatTimestamp(seg.end)}
                    </Timestamp>
                    <BodySm>{seg.text}</BodySm>
                    {seg.translated ? (
                      <BodySm color="$accent">{seg.translated}</BodySm>
                    ) : null}
                  </YStack>
                ))}
              </Stack>
            ) : null}

            {/* Action buttons — Play takes prime real estate, admin actions cluster below. */}
            <YStack gap="$xs">
              {/* Subtitle picker for mpv playback. Only show "Translated"
                  when the pipeline actually produced one. */}
              <XStack alignItems="center" gap="$sm" flexWrap="wrap">
                <Caption>Subtitles</Caption>
                <SegmentedControl
                  value={subPreference}
                  onValueChange={(v) => setSubPreference(v as SubPreference)}
                  options={[
                    ...(result.translatedSrtPath
                      ? [{ label: "Translated", value: "translated" as const }]
                      : []),
                    { label: "Original", value: "original" as const },
                    { label: "None", value: "none" as const },
                  ]}
                  aria-label="Subtitle preference for mpv"
                />
              </XStack>
              <ButtonPrimary
                disabled={mpvBusy}
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
              <XStack gap="$xs" flexWrap="wrap">
                <ButtonSecondary
                  onPress={() =>
                    apiClient
                      .openLibraryFolder(result.videoId)
                      .catch(() => undefined)
                  }
                >
                  <XStack gap="$xs" alignItems="center">
                    <FolderOpen size={14} color="$textSecondary" />
                    <BodySm fontWeight="500" color="$textSecondary">
                      Open folder
                    </BodySm>
                  </XStack>
                </ButtonSecondary>
                <ButtonSecondary onPress={() => undefined} disabled={true}>
                  <XStack gap="$xs" alignItems="center">
                    <RotateCcw size={14} color="$textSecondary" />
                    <BodySm fontWeight="500" color="$textSecondary">
                      Re-transcribe with… (coming soon)
                    </BodySm>
                  </XStack>
                </ButtonSecondary>
                <ButtonSecondary
                  onPress={() => {
                    if (typeof window === "undefined") return;
                    const baseUrl = "http://127.0.0.1:8000";
                    const path = `/api/library/${result.videoId}/file/${result.videoId}_original.srt`;
                    window.open(`${baseUrl}${path}`, "_blank");
                  }}
                >
                  <XStack gap="$xs" alignItems="center">
                    <Download size={14} color="$textSecondary" />
                    <BodySm fontWeight="500" color="$textSecondary">
                      Download SRT
                    </BodySm>
                  </XStack>
                </ButtonSecondary>
                <ButtonGhost onPress={reset}>
                  <BodySm fontWeight="500" color="$textSecondary">
                    New transcription
                  </BodySm>
                </ButtonGhost>
              </XStack>
            </YStack>
          </YStack>
        </GlassCard>
      ) : null}

      {status === "error" && errorMessage ? (
        <GlassCard variant="mid">
          <YStack gap="$xs">
            <CaptionUpper color="$error">error</CaptionUpper>
            <BodySm>{errorMessage}</BodySm>
            <XStack>
              <ButtonSecondary onPress={reset}>Try again</ButtonSecondary>
            </XStack>
          </YStack>
        </GlassCard>
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
