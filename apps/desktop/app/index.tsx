import * as React from "react";
import { Stack, Text, XStack, YStack } from "tamagui";
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
  Tooltip,
  glassRecipes,
} from "@yt-subtitle-maker/ui";
import { useGenerate } from "../src/state/generate";
import type {
  SttSource,
  SttEngine,
  WhisperModel,
  WhisperDevice,
} from "@yt-subtitle-maker/api-client";

/* ───────────── helpers ───────────── */

function CaptionUpper({ children, color = "$textMuted" }: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <Text
      fontFamily="$body"
      fontSize={11}
      fontWeight="600"
      letterSpacing={1.5}
      textTransform="uppercase"
      color={color as never}
    >
      {children}
    </Text>
  );
}

function formatDuration(seconds: number | undefined): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
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
  const [sttEngine, setSttEngine] = React.useState<SttEngine>("faster-whisper");
  const [whisperModel, setWhisperModel] = React.useState<WhisperModel>("turbo");
  const [whisperDevice, setWhisperDevice] = React.useState<WhisperDevice>("auto");
  const [vadEnabled, setVadEnabled] = React.useState(true);

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
      downloadOnly,
    });
  };

  return (
    <YStack gap="$lg">
      {/* HERO: URL input */}
      <HeroCard variant="mid">
        <YStack gap="$md">
          <YStack gap="$xs">
            <Text
              fontFamily="$display"
              fontSize={28}
              lineHeight={34}
              letterSpacing={-0.5}
              color="$textPrimary"
            >
              What are we transcribing today?
            </Text>
            <Text fontFamily="$body" fontSize={14} color="$textSecondary">
              Drop a YouTube link to get started.
            </Text>
          </YStack>

          <XStack gap="$sm" alignItems="center">
            <XStack flex={1} alignItems="center" position="relative">
              <Stack position="absolute" left={14} zIndex={1}>
                <Link2 size={16} color="#6e6e73" />
              </Stack>
              <TextInput
                flex={1}
                paddingLeft={40}
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
            <Text fontFamily="$body" fontSize={13} color="$error">
              {metaError}
            </Text>
          ) : null}
        </YStack>
      </HeroCard>

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
              <Text
                fontFamily="$body"
                fontSize={18}
                fontWeight="600"
                color="$textPrimary"
                numberOfLines={2}
              >
                {metadata.titleOriginal ?? "Untitled"}
              </Text>
              <Text fontFamily="$body" fontSize={13} color="$textSecondary">
                {metadata.channel ?? "Unknown channel"} ·{" "}
                {formatDuration(metadata.durationSeconds)}
              </Text>
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
                  <ChevronDown size={16} color="#a1a1a6" />
                ) : (
                  <ChevronRight size={16} color="#a1a1a6" />
                )}
                <Text
                  fontFamily="$body"
                  fontSize={15}
                  fontWeight="600"
                  color="$textPrimary"
                >
                  Configure
                </Text>
              </XStack>
              <Text fontFamily="$body" fontSize={13} color="$textMuted">
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
              </Text>
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
                          <Text
                            fontFamily="$body"
                            fontSize={14}
                            fontWeight="600"
                            color="$textPrimary"
                          >
                            Auto
                          </Text>
                          <BadgeAccent>recommended</BadgeAccent>
                        </XStack>
                        <Text
                          fontFamily="$body"
                          fontSize={13}
                          color="$textSecondary"
                        >
                          Try YouTube auto-captions first, fall back to Whisper.
                        </Text>
                      </YStack>
                    </RadioCard>
                    <RadioCard
                      selected={sttSource === "yt_captions"}
                      onPress={() => setSttSource("yt_captions")}
                    >
                      <YStack gap={2}>
                        <Text
                          fontFamily="$body"
                          fontSize={14}
                          fontWeight="600"
                          color="$textPrimary"
                        >
                          YouTube auto-captions only
                        </Text>
                        <Text
                          fontFamily="$body"
                          fontSize={13}
                          color="$textSecondary"
                        >
                          Free + instant, but unavailable on many videos.
                        </Text>
                      </YStack>
                    </RadioCard>
                    <RadioCard
                      selected={sttSource === "whisper"}
                      onPress={() => setSttSource("whisper")}
                    >
                      <YStack gap={2}>
                        <Text
                          fontFamily="$body"
                          fontSize={14}
                          fontWeight="600"
                          color="$textPrimary"
                        >
                          Whisper only
                        </Text>
                        <Text
                          fontFamily="$body"
                          fontSize={13}
                          color="$textSecondary"
                        >
                          Skip YT captions, run Whisper directly on the audio.
                        </Text>
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
                    <YStack gap={2}>
                      <Text
                        fontFamily="$body"
                        fontSize={14}
                        fontWeight="500"
                        color="$textPrimary"
                      >
                        Translate subtitles
                      </Text>
                      <Text
                        fontFamily="$body"
                        fontSize={12}
                        color="$textMuted"
                      >
                        Using Gemini · change in Settings
                      </Text>
                    </YStack>
                    <Toggle
                      value={enableTranslation && !downloadOnly}
                      onValueChange={setEnableTranslation}
                      disabled={downloadOnly}
                      aria-label="Translate subtitles"
                    />
                  </XStack>
                  <XStack alignItems="center" justifyContent="space-between">
                    <YStack gap={2}>
                      <Text
                        fontFamily="$body"
                        fontSize={14}
                        fontWeight="500"
                        color="$textPrimary"
                      >
                        Just download, no subtitles
                      </Text>
                      <Text
                        fontFamily="$body"
                        fontSize={12}
                        color="$textMuted"
                      >
                        Skip transcription entirely.
                      </Text>
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
                      <ChevronDown size={14} color="#a1a1a6" />
                    ) : (
                      <ChevronRight size={14} color="#a1a1a6" />
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
                            options={WHISPER_MODELS}
                            width="100%"
                          />
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
                          <Text
                            fontFamily="$body"
                            fontSize={14}
                            fontWeight="500"
                            color="$textPrimary"
                          >
                            VAD (Voice Activity Detection)
                          </Text>
                          <Tooltip content="Skips silent sections of the audio. Prevents Whisper from inventing text in silence.">
                            <Info size={14} color="#6e6e73" />
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
            <Sparkles size={16} color="#f5f5f7" />
            <Text fontFamily="$body" fontSize={15} fontWeight="600" color="$textPrimary">
              {downloadOnly ? "Download only" : "Generate Subtitles"}
            </Text>
          </XStack>
        </ButtonPrimary>
      ) : null}

      {isProcessing ? (
        <GlassCard variant="mid">
          <YStack gap="$md">
            <XStack alignItems="center" justifyContent="space-between">
              <CaptionUpper>processing</CaptionUpper>
              <IconButton
                icon={<X size={14} color="#a1a1a6" />}
                aria-label="Cancel"
                size={32}
                onPress={cancel}
              />
            </XStack>

            <Waveform active />

            <YStack gap="$xs" alignItems="center">
              <Text
                fontFamily="$body"
                fontSize={15}
                fontWeight="600"
                color="$textPrimary"
              >
                {phaseMessage ??
                  (phase === "download"
                    ? "Downloading audio…"
                    : phase === "transcribe"
                    ? `Transcribing with ${sttEngine}…`
                    : phase === "translate"
                    ? "Translating segments…"
                    : "Working…")}
              </Text>
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
                <CheckCircle2 size={20} color="#5db872" />
              </Stack>
              <YStack gap={2}>
                <Text
                  fontFamily="$body"
                  fontSize={18}
                  fontWeight="600"
                  color="$textPrimary"
                >
                  Done · {Math.round(result.durationMs / 1000)}s
                </Text>
                <Text fontFamily="$body" fontSize={13} color="$textSecondary">
                  {result.sttSourceUsed === "yt_captions"
                    ? "YouTube auto-captions"
                    : `Whisper · ${sttEngine}`}
                  {" · "}
                  {sourceLang.toUpperCase()}
                  {enableTranslation && !downloadOnly
                    ? ` → ${targetLang.toUpperCase()}`
                    : ""}
                </Text>
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
                  <Text
                    fontFamily="$body"
                    fontSize={15}
                    fontWeight="600"
                    color="$textPrimary"
                  >
                    {metadata.titleTranslated}
                  </Text>
                  <Text fontFamily="$body" fontSize={13} color="$textSecondary">
                    {metadata.titleOriginal}
                  </Text>
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
                    <Text
                      fontFamily="$mono"
                      fontSize={11}
                      fontWeight="500"
                      color="$textMuted"
                      style={{ fontFeatureSettings: "'tnum'" }}
                    >
                      {formatTimestamp(seg.start)} → {formatTimestamp(seg.end)}
                    </Text>
                    <Text
                      fontFamily="$body"
                      fontSize={13}
                      color="$textPrimary"
                    >
                      {seg.text}
                    </Text>
                    {seg.translated ? (
                      <Text
                        fontFamily="$body"
                        fontSize={13}
                        color="$accent"
                      >
                        {seg.translated}
                      </Text>
                    ) : null}
                  </YStack>
                ))}
              </Stack>
            ) : null}

            <XStack gap="$xs" flexWrap="wrap">
              <ButtonPrimary onPress={() => undefined}>
                <XStack gap="$xs" alignItems="center">
                  <PlayCircle size={14} color="#f5f5f7" />
                  <Text
                    fontFamily="$body"
                    fontSize={15}
                    fontWeight="600"
                    color="$textPrimary"
                  >
                    Play with MPV
                  </Text>
                </XStack>
              </ButtonPrimary>
              <ButtonSecondary onPress={() => undefined}>
                <XStack gap="$xs" alignItems="center">
                  <FolderOpen size={14} color="#a1a1a6" />
                  <Text
                    fontFamily="$body"
                    fontSize={13}
                    fontWeight="500"
                    color="$textSecondary"
                  >
                    Open folder
                  </Text>
                </XStack>
              </ButtonSecondary>
              <ButtonSecondary onPress={() => undefined}>
                <XStack gap="$xs" alignItems="center">
                  <RotateCcw size={14} color="#a1a1a6" />
                  <Text
                    fontFamily="$body"
                    fontSize={13}
                    fontWeight="500"
                    color="$textSecondary"
                  >
                    Re-transcribe with…
                  </Text>
                </XStack>
              </ButtonSecondary>
              <ButtonSecondary onPress={() => undefined}>
                <XStack gap="$xs" alignItems="center">
                  <Download size={14} color="#a1a1a6" />
                  <Text
                    fontFamily="$body"
                    fontSize={13}
                    fontWeight="500"
                    color="$textSecondary"
                  >
                    Download SRT
                  </Text>
                </XStack>
              </ButtonSecondary>
              <ButtonGhost onPress={reset}>
                <Text
                  fontFamily="$body"
                  fontSize={13}
                  fontWeight="500"
                  color="$textSecondary"
                >
                  New transcription
                </Text>
              </ButtonGhost>
            </XStack>
          </YStack>
        </GlassCard>
      ) : null}

      {status === "error" && errorMessage ? (
        <GlassCard variant="mid">
          <YStack gap="$xs">
            <CaptionUpper color="$error">error</CaptionUpper>
            <Text fontFamily="$body" fontSize={13} color="$textPrimary">
              {errorMessage}
            </Text>
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
