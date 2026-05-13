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
  BadgePill,
  ProgressBar,
  StepPill,
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
import { useSettings } from "../src/components/settings/SettingsContext";
import { engineVerdict } from "../src/components/settings/engineVerdict";
import { NewTranscribeModal } from "../src/components/NewTranscribeModal";
import { useRouter } from "expo-router";
import type {
  SttSource,
  SttEngine,
  WhisperModel,
  WhisperDevice,
} from "@yt-subtitle-maker/api-client";

// Display name for built-in translator profile ids. Custom profiles use
// their own `name` from `customTranslators`.
const BUILTIN_TRANSLATOR_LABELS: Record<string, string> = {
  gemini: "Gemini",
  local_openai: "Local AI",
};

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

  // Translation-may-fail banner — reads last test result from SettingsContext
  // (persisted in-memory across route navigations; SettingsProvider lives in
  // the root layout so it is always mounted).
  const {
    lastTestResult,
    activeTranslator,
    customTranslators,
    // engines + system feed the engine label + verdict pill + per-model
    // size/downloaded indicators on the Advanced section, mirroring what
    // Settings → Transcription shows via <EnginePicker>.
    engines,
    system,
  } = useSettings();

  // Derive the profile id used as key into lastTestResult.
  // activeTranslator is stored as "gemini" | "local_openai" | "custom:<id>".
  // Strip the "custom:" prefix to get the raw id used when recording results.
  const activeProfileId = activeTranslator?.startsWith("custom:")
    ? activeTranslator.slice("custom:".length)
    : (activeTranslator ?? "gemini");

  // Derive a human-readable name for the active profile.
  function activeProfileName(): string {
    if (!activeTranslator || activeTranslator === "gemini") return "Gemini";
    if (activeTranslator === "local_openai") return "Local AI";
    // custom profile — look up by id in customTranslators
    const id = activeTranslator.startsWith("custom:")
      ? activeTranslator.slice("custom:".length)
      : activeTranslator;
    const profile = customTranslators?.find((p) => p.id === id);
    return profile?.name ?? activeTranslator;
  }

  const activeLastTest = lastTestResult[activeProfileId];
  const translationMayFail = Boolean(activeLastTest && !activeLastTest.ok);

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

  // Whisper model options enriched to match Settings → Transcription →
  // EnginePicker's per-model rows: each label shows the size in GB/MB and a
  // "✓ downloaded" indicator. Sourced from the live `engines` descriptor
  // when available, with a graceful fallback to the static WHISPER_MODELS
  // list (only the installed subset) if engines hasn't loaded yet.
  const whisperEngine = React.useMemo(
    () => engines?.find((e) => e.id === "openai-whisper"),
    [engines],
  );
  const whisperModelOptions = React.useMemo(() => {
    if (whisperEngine) {
      return whisperEngine.models.map((m) => {
        const gb = m.sizeMb >= 1024 ? (m.sizeMb / 1024).toFixed(1) + " GB" : m.sizeMb + " MB";
        const downloaded = m.downloaded ? " · ✓" : "";
        return { label: `${m.name} · ${gb}${downloaded}`, value: m.name as WhisperModel };
      });
    }
    if (!installedWhisperModels) return WHISPER_MODELS;
    return WHISPER_MODELS.filter((opt) => installedWhisperModels.has(opt.value));
  }, [whisperEngine, installedWhisperModels]);

  // Verdict pill — mirrors Settings → Transcription. "✓ works (Apple MPS)"
  // / "⚠ runs but no acceleration here (…)" / etc.
  const whisperVerdict = React.useMemo(() => {
    if (!whisperEngine || !system) return null;
    return engineVerdict(whisperEngine, system);
  }, [whisperEngine, system]);

  // Translator provider — initialized from Settings' `activeTranslator`
  // (the named-profile model from Phase 4d). Per-job override stays in this
  // state and is sent in the process request as `translatorProvider`, so
  // switching between Gemini / Local AI / a saved DeepSeek profile / etc.
  // doesn't require visiting Settings. Format mirrors `activeTranslator`:
  // `"gemini" | "local_openai" | "custom:<id>"` — the backend's pipeline
  // `_make_translator` accepts the same shapes for the override.
  const [translatorProvider, setTranslatorProvider] =
    React.useState<string>("gemini");

  // When Settings' active translator finishes loading, seed this screen's
  // default. Won't clobber a user's mid-session override because we only
  // run when the source value first becomes defined.
  const seededFromSettings = React.useRef(false);
  React.useEffect(() => {
    if (seededFromSettings.current) return;
    if (activeTranslator) {
      setTranslatorProvider(activeTranslator);
      seededFromSettings.current = true;
    }
  }, [activeTranslator]);

  // Build the dropdown options from the live profile list. Built-ins first
  // (Gemini, Local AI), then every entry in `customTranslators` by its
  // display name. If `customTranslators` hasn't loaded yet we still show
  // the two built-ins so the screen renders.
  const translatorOptions = React.useMemo(() => {
    const opts: { label: string; value: string }[] = [
      { label: "Gemini", value: "gemini" },
      { label: "Local AI", value: "local_openai" },
    ];
    for (const p of customTranslators ?? []) {
      opts.push({ label: p.name || "(unnamed)", value: `custom:${p.id}` });
    }
    return opts;
  }, [customTranslators]);

  // Human-readable label for whatever is selected — used in the
  // "Translate subtitles · Using {label}" caption.
  const translatorLabel = React.useMemo(() => {
    if (translatorProvider in BUILTIN_TRANSLATOR_LABELS) {
      return BUILTIN_TRANSLATOR_LABELS[translatorProvider];
    }
    if (translatorProvider.startsWith("custom:")) {
      const id = translatorProvider.slice("custom:".length);
      const p = customTranslators?.find((x) => x.id === id);
      return p?.name ?? "(custom)";
    }
    return translatorProvider;
  }, [translatorProvider, customTranslators]);

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
      // Saved-profile form: send the chosen profile id and let the backend
      // resolve credentials server-side. Works for ALL profiles — built-in
      // (gemini, local_openai) AND custom (custom:<id>) — using the
      // ping()-based smoke check from Phase 4d-fix-2 (~250ms, no LLM
      // inference). Same path the Settings → Translation rows use.
      const res = await apiClient.testTranslator({
        profileId: translatorProvider,
        useSavedKey: true,
        targetLang: enableTranslation ? targetLang : undefined,
      });
      setTranslatorTest(
        res.ok
          ? {
              kind: "ok",
              text: `Connected${res.latencyMs ? ` · ${res.latencyMs}ms` : ""}`,
            }
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
                {/* Subtitle source — mirrors Settings → Transcription →
                    SourceModeControl: a SegmentedControl over the three
                    modes that map onto defaultSttEngine + ytCaptionsFirst.
                    Helper text explains the Auto fall-through. */}
                <YStack gap="$sm">
                  <CaptionUpper>Subtitle source</CaptionUpper>
                  <SegmentedControl
                    value={sttSource}
                    onValueChange={(v) => setSttSource(v as SttSource)}
                    options={[
                      { label: "Auto", value: "auto" },
                      { label: "YouTube captions only", value: "yt_captions" },
                      { label: "Whisper only", value: "whisper" },
                    ]}
                    aria-label="Subtitle source"
                  />
                  <Caption color="$textMuted">
                    {sttSource === "auto"
                      ? "Try YouTube auto-captions first, fall back to Whisper."
                      : sttSource === "yt_captions"
                      ? "Free + instant, but unavailable on many videos."
                      : "Skip YT captions, run Whisper directly on the audio."}
                  </Caption>
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
                        <Caption>Using {translatorLabel}</Caption>
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

                  {translationMayFail && enableTranslation && !downloadOnly ? (
                    <BadgePill tone="warning">
                      <Caption>
                        Translation may fail — {activeProfileName()}&apos;s last test failed
                        {activeLastTest?.error ? `: ${activeLastTest.error}` : ""}
                      </Caption>
                    </BadgePill>
                  ) : null}

                  {enableTranslation && !downloadOnly ? (
                    <YStack gap="$xs">
                      {/* Dropdown of every available translator profile
                          (built-ins + custom_translators). Replaces the old
                          3-slot SegmentedControl that couldn't pick user-
                          configured custom profiles like DeepSeek. Initial
                          value seeded from Settings' activeTranslator. */}
                      <Dropdown
                        value={translatorProvider}
                        onValueChange={(v) => setTranslatorProvider(v)}
                        options={translatorOptions}
                        width="100%"
                        aria-label="Translator profile"
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
                      {/* Engine header — mirrors Settings → Transcription
                          EnginePicker: engine name + machine-compat
                          verdict pill (works / runs-no-accel / wont-help)
                          using the same engineVerdict() helper. Hidden if
                          engines/system haven't loaded yet. */}
                      {whisperEngine && whisperVerdict ? (
                        <XStack alignItems="center" gap="$sm" flexWrap="wrap">
                          <TitleSm>{whisperEngine.label}</TitleSm>
                          <BadgePill
                            tone={
                              whisperVerdict.level === "works"
                                ? "success"
                                : whisperVerdict.level === "runs-no-accel"
                                ? "warning"
                                : whisperVerdict.level === "wont-help"
                                ? "error"
                                : "neutral"
                            }
                          >
                            {whisperVerdict.line}
                          </BadgePill>
                        </XStack>
                      ) : null}

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
                          {/* Footnote — different copy based on which data
                              source is feeding the dropdown. With live
                              engines data we show sizes for every model;
                              with the static fallback we filter to installed
                              only and prompt the user to install more. */}
                          {whisperEngine ? (
                            <Caption color="$textMuted">
                              Sizes from the live engine catalog. Download more
                              models in Settings.
                            </Caption>
                          ) : installedWhisperModels &&
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
                <ButtonSecondary onPress={() => setReTranscribeOpen(true)}>
                  <XStack gap="$xs" alignItems="center">
                    <RotateCcw size={14} color="$textSecondary" />
                    <BodySm fontWeight="500" color="$textSecondary">
                      Re-transcribe with…
                    </BodySm>
                  </XStack>
                </ButtonSecondary>
                <ButtonSecondary
                  onPress={() => {
                    if (typeof window === "undefined") return;
                    const baseUrl = "http://127.0.0.1:8000";
                    // V2 multi-SRT: file is in transcripts/<id>.srt. Fall back
                    // to the legacy filename for jobs created before the
                    // pipeline migration.
                    const path = result.transcribeId
                      ? `/api/library/${result.videoId}/file/transcripts/${result.transcribeId}.srt`
                      : `/api/library/${result.videoId}/file/${result.videoId}_original.srt`;
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

      {result ? (
        <NewTranscribeModal
          open={reTranscribeOpen}
          onOpenChange={setReTranscribeOpen}
          videoId={result.videoId}
          onComplete={() => undefined}
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
