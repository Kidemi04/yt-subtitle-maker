import { useEffect, useMemo, useState, type ComponentType } from "react";
import { useRouter } from "expo-router";
import { Stack, XStack, YStack } from "tamagui";
import {
  CheckCircle2,
  Cpu,
  Database,
  Download,
  Film,
  Gauge,
  HardDrive,
  Languages,
  Library,
  MonitorPlay,
  Settings,
  Sparkles,
  TerminalSquare,
  TriangleAlert,
  Wand2,
} from "@tamagui/lucide-icons";
import {
  BadgeAccent,
  BadgePill,
  BodyMd,
  BodySm,
  ButtonGhost,
  ButtonSecondary,
  Caption,
  CaptionUpper,
  Code,
  DisplayLg,
  GlassCard,
  StatusDot,
  TitleMd,
  TitleSm,
} from "@yt-subtitle-maker/ui";
import {
  anyModelInstalled,
  type BackendCapabilities,
  type DependencyStatus,
} from "@yt-subtitle-maker/api-client";
import { apiClient } from "../src/state/client";

type StatusTone = "ok" | "warning" | "error" | "untested";

interface StatusItem {
  label: string;
  value: string;
  status: StatusTone;
  detail: string;
  icon: ComponentType<{ size?: number; color?: string }>;
}

const WORKFLOW = [
  {
    title: "Pull the source",
    body: "Start from a YouTube URL and keep downloads, transcripts, translations, and subtitle files tied to the same project.",
    icon: Download,
  },
  {
    title: "Transcribe with a fallback",
    body: "Use YouTube captions when available, or run Whisper locally when the video needs fresh transcription.",
    icon: Wand2,
  },
  {
    title: "Translate with your provider",
    body: "Use Gemini, local OpenAI-compatible servers, or custom providers such as OpenRouter, Fireworks.ai, DeepSeek, OpenAI, and Claude.",
    icon: Languages,
  },
  {
    title: "Preview and reuse",
    body: "Save the result into Library, preview with mpv, and come back later without losing context.",
    icon: MonitorPlay,
  },
];

const STACK = [
  "Tauri 2",
  "Expo 51",
  "Tamagui",
  "FastAPI",
  "yt-dlp",
  "OpenAI Whisper",
  "mpv",
];

function useAboutRuntime() {
  const [version, setVersion] = useState<BackendCapabilities | null>(null);
  const [deps, setDeps] = useState<DependencyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [versionResult, depsResult] = await Promise.all([
          apiClient.fetchVersion(),
          apiClient.fetchDependencies(),
        ]);
        if (cancelled) return;
        setVersion(versionResult);
        setDeps(depsResult);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { version, deps, loading, error };
}

function SummaryMetric({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <YStack
      flex={1}
      minWidth={180}
      gap="$xs"
      paddingVertical="$sm"
      borderTopWidth={1}
      borderTopColor="$borderSubtle"
    >
      <CaptionUpper>{label}</CaptionUpper>
      <TitleMd>{value}</TitleMd>
      <Caption color="$textMuted">{helper}</Caption>
    </YStack>
  );
}

function StatusRow({ item }: { item: StatusItem }) {
  const Icon = item.icon;
  return (
    <XStack
      alignItems="center"
      gap="$sm"
      paddingVertical="$sm"
      borderTopWidth={1}
      borderTopColor="$borderSubtle"
    >
      <Stack
        width={40}
        height={40}
        borderRadius="$md"
        alignItems="center"
        justifyContent="center"
        backgroundColor="$accentSoft"
        flexShrink={0}
      >
        <Icon size={18} color="$accent" />
      </Stack>
      <YStack flex={1} minWidth={0} gap={2}>
        <XStack gap="$xs" alignItems="center" flexWrap="wrap">
          <StatusDot status={item.status} size={8} />
          <TitleSm>{item.label}</TitleSm>
          <BadgePill tone={item.status === "ok" ? "success" : item.status === "error" ? "warning" : "neutral"}>
            {item.value}
          </BadgePill>
        </XStack>
        <Caption color="$textMuted" numberOfLines={2}>
          {item.detail}
        </Caption>
      </YStack>
    </XStack>
  );
}

function WorkflowRow({
  title,
  body,
  icon: Icon,
  index,
}: {
  title: string;
  body: string;
  icon: ComponentType<{ size?: number; color?: string }>;
  index: number;
}) {
  return (
    <XStack
      gap="$sm"
      paddingVertical="$sm"
      borderTopWidth={index === 0 ? 0 : 1}
      borderTopColor="$borderSubtle"
    >
      <Stack
        width={36}
        height={36}
        borderRadius="$md"
        alignItems="center"
        justifyContent="center"
        backgroundColor="$bgBase"
        borderWidth={1}
        borderColor="$borderSubtle"
        flexShrink={0}
      >
        <Icon size={17} color="$accent" />
      </Stack>
      <YStack flex={1} minWidth={0} gap={2}>
        <TitleSm>{title}</TitleSm>
        <BodySm color="$textSecondary">{body}</BodySm>
      </YStack>
    </XStack>
  );
}

export default function About() {
  const router = useRouter();
  const { version, deps, loading, error } = useAboutRuntime();

  const modelCount = useMemo(() => {
    if (!deps) return 0;
    return Object.values(deps.models ?? {}).filter(Boolean).length;
  }, [deps]);

  const statusItems: StatusItem[] = [
    {
      label: "Backend",
      value: version ? version.version : loading ? "Checking" : "Offline",
      status: version ? "ok" : error ? "error" : "untested",
      detail: version
        ? "FastAPI is reachable from the desktop UI."
        : error ?? "Waiting for the backend status check.",
      icon: TerminalSquare,
    },
    {
      label: "Whisper models",
      value: deps ? `${modelCount} installed` : loading ? "Checking" : "Unknown",
      status: deps ? (anyModelInstalled(deps) ? "ok" : "warning") : "untested",
      detail: deps
        ? anyModelInstalled(deps)
          ? "Local transcription is ready."
          : "Install a Whisper model in Settings before local transcription."
        : "Model state comes from the backend dependency probe.",
      icon: Database,
    },
    {
      label: "mpv preview",
      value: deps?.mpvAvailable ? "Available" : loading ? "Checking" : "Missing",
      status: deps ? (deps.mpvAvailable ? "ok" : "warning") : "untested",
      detail: deps?.mpvAvailable
        ? "Subtitle preview playback can launch from this machine."
        : "Install mpv or use Settings to configure preview playback.",
      icon: Film,
    },
    {
      label: "CUDA",
      value: version?.cudaAvailable ? "Detected" : loading ? "Checking" : "Not detected",
      status: version ? (version.cudaAvailable ? "ok" : "warning") : "untested",
      detail: version?.cudaAvailable
        ? "GPU acceleration is available to compatible engines."
        : "CPU transcription still works when a model is installed.",
      icon: Cpu,
    },
    {
      label: "JavaScript runtime",
      value: version?.jsRuntime ? "Ready" : loading ? "Checking" : "Missing",
      status: version ? (version.jsRuntime ? "ok" : "warning") : "untested",
      detail: version?.jsRuntime
        ? version.jsRuntime
        : "yt-dlp can need Node or Deno for some YouTube formats.",
      icon: Gauge,
    },
  ];

  return (
    <YStack gap="$lg">
      <YStack gap="$md">
        <XStack gap="$xs" alignItems="center" flexWrap="wrap">
          <BadgeAccent>v2.0 alpha</BadgeAccent>
          <BadgePill tone="neutral">Desktop first</BadgePill>
          <BadgePill tone={version ? "success" : error ? "warning" : "neutral"}>
            {version ? "Backend online" : error ? "Backend offline" : "Checking backend"}
          </BadgePill>
        </XStack>

        <YStack gap="$sm" maxWidth={760}>
          <DisplayLg>Translator Subtitle Studio</DisplayLg>
          <BodyMd color="$textSecondary">
            A local-first workspace for turning YouTube videos into transcripts,
            translations, and subtitle files without spreading the workflow across
            a pile of one-off tools.
          </BodyMd>
        </YStack>

        <XStack gap="$sm" flexWrap="wrap">
          <ButtonSecondary onPress={() => router.push("/" as never)}>
            Start a project
          </ButtonSecondary>
          <ButtonGhost onPress={() => router.push("/settings" as never)}>
            Open settings
          </ButtonGhost>
          <ButtonGhost onPress={() => router.push("/library" as never)}>
            View library
          </ButtonGhost>
        </XStack>
      </YStack>

      <GlassCard variant="high" padding="$lg">
        <YStack gap="$md">
          <XStack alignItems="center" gap="$sm">
            <HardDrive size={18} color="$accent" />
            <YStack flex={1} gap={2}>
              <CaptionUpper>Runtime summary</CaptionUpper>
              <TitleMd>What this install can do right now</TitleMd>
            </YStack>
          </XStack>

          <XStack gap="$lg" flexWrap="wrap">
            <SummaryMetric
              label="Backend"
              value={version?.version ?? (loading ? "Checking" : "Unavailable")}
              helper="API version reported by the local server."
            />
            <SummaryMetric
              label="STT engines"
              value={
                version?.installedSttEngines.length
                  ? version.installedSttEngines.length.toString()
                  : loading
                    ? "Checking"
                    : "0"
              }
              helper="Installed transcription engines detected by backend."
            />
            <SummaryMetric
              label="Whisper models"
              value={deps ? modelCount.toString() : loading ? "Checking" : "0"}
              helper="Downloaded local model checkpoints."
            />
          </XStack>
        </YStack>
      </GlassCard>

      <XStack gap="$lg" alignItems="flex-start" flexWrap="wrap">
        <GlassCard variant="mid" padding="$lg" flex={1} minWidth={320}>
          <YStack gap="$md">
            <XStack alignItems="center" gap="$sm">
              <CheckCircle2 size={18} color="$accent" />
              <YStack flex={1} gap={2}>
                <CaptionUpper>Health checks</CaptionUpper>
                <TitleMd>Local runtime</TitleMd>
              </YStack>
            </XStack>
            <YStack>
              {statusItems.map((item) => (
                <StatusRow key={item.label} item={item} />
              ))}
            </YStack>
          </YStack>
        </GlassCard>

        <GlassCard variant="mid" padding="$lg" flex={1} minWidth={320}>
          <YStack gap="$md">
            <XStack alignItems="center" gap="$sm">
              <Sparkles size={18} color="$accent" />
              <YStack flex={1} gap={2}>
                <CaptionUpper>Workflow</CaptionUpper>
                <TitleMd>What the app is built for</TitleMd>
              </YStack>
            </XStack>
            <YStack>
              {WORKFLOW.map((item, index) => (
                <WorkflowRow key={item.title} {...item} index={index} />
              ))}
            </YStack>
          </YStack>
        </GlassCard>
      </XStack>

      <GlassCard variant="mid" padding="$lg">
        <YStack gap="$md">
          <XStack alignItems="center" gap="$sm">
            <Library size={18} color="$accent" />
            <YStack flex={1} gap={2}>
              <CaptionUpper>Local workspace</CaptionUpper>
              <TitleMd>Project files stay organized on this machine</TitleMd>
            </YStack>
          </XStack>
          <BodySm color="$textSecondary" maxWidth={820}>
            The app keeps transcripts, translations, subtitle exports, and run
            history together so you can revisit a video later. Provider API keys
            live in the backend config instead of being scattered through each
            screen.
          </BodySm>
          <XStack gap="$xs" flexWrap="wrap">
            {STACK.map((item) => (
              <BadgePill key={item} tone="neutral">
                {item}
              </BadgePill>
            ))}
          </XStack>
        </YStack>
      </GlassCard>

      <GlassCard variant="low" padding="$md">
        <XStack gap="$sm" alignItems="flex-start">
          <TriangleAlert size={17} color="$textMuted" />
          <YStack flex={1} gap="$xs">
            <CaptionUpper>Alpha note</CaptionUpper>
            <Caption color="$textMuted">
              This is still an alpha build. Settings, provider support, and local
              dependency checks are expected to keep improving. MIT licensed.
            </Caption>
            {version?.jsRuntime ? (
              <Code numberOfLines={1}>JS runtime: {version.jsRuntime}</Code>
            ) : null}
          </YStack>
          <ButtonGhost onPress={() => router.push("/settings" as never)}>
            Settings
          </ButtonGhost>
        </XStack>
      </GlassCard>
    </YStack>
  );
}
