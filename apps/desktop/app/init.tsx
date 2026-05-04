import * as React from "react";
import { Stack, Text, XStack, YStack } from "tamagui";
import { Sparkles, Check } from "@tamagui/lucide-icons";
import {
  HeroCard,
  RadioCard,
  ButtonPrimary,
  ButtonGhost,
  ProgressBar,
  BadgeAccent,
  StatusDot,
  glassRecipes,
} from "@yt-subtitle-maker/ui";
import { useRouter } from "expo-router";
import { apiClient } from "../src/state/client";
import type { WhisperModel } from "@yt-subtitle-maker/api-client";

type InitState = "connecting" | "checking" | "picking" | "downloading" | "ready";

const MODELS: {
  value: WhisperModel;
  label: string;
  size: string;
  blurb: string;
  recommended?: boolean;
}[] = [
  {
    value: "tiny",
    label: "tiny",
    size: "75 MB",
    blurb: "Fastest, lowest accuracy. Quick previews.",
  },
  {
    value: "base",
    label: "base",
    size: "150 MB",
    blurb: "Fast, decent accuracy. ~1 GB RAM.",
  },
  {
    value: "small",
    label: "small",
    size: "500 MB",
    blurb: "Balanced. ~2 GB RAM.",
  },
  {
    value: "medium",
    label: "medium",
    size: "1.5 GB",
    blurb: "Accurate, slower. ~5 GB RAM.",
  },
  {
    value: "turbo",
    label: "turbo",
    size: "1.5 GB",
    blurb: "Fast + accurate. ~6 GB VRAM/RAM.",
    recommended: true,
  },
];

export default function Init() {
  const router = useRouter();
  const [state, setState] = React.useState<InitState>("connecting");
  const [picked, setPicked] = React.useState<WhisperModel>("turbo");
  const [progress, setProgress] = React.useState<number | undefined>(0);
  const [progressMessage, setProgressMessage] = React.useState<string | undefined>();
  const [error, setError] = React.useState<string | undefined>();

  React.useEffect(() => {
    let cancelled = false;
    const probe = async () => {
      // Connecting
      let attempts = 0;
      while (attempts < 5) {
        try {
          await apiClient.fetchVersion();
          if (cancelled) return;
          break;
        } catch {
          attempts += 1;
          if (attempts >= 5) {
            if (!cancelled) {
              setError(
                "Couldn't reach the backend at 127.0.0.1:8000 after 5 tries.",
              );
            }
            return;
          }
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
      if (cancelled) return;
      setState("checking");

      try {
        const dep = await apiClient.fetchDependencies();
        if (cancelled) return;
        if (dep.whisperModelInstalled) {
          setState("ready");
          setTimeout(() => {
            if (!cancelled) router.replace("/");
          }, 600);
        } else {
          setState("picking");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    };
    probe();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const onDownload = async () => {
    setState("downloading");
    setProgress(0);
    setProgressMessage("Starting…");
    try {
      for await (const ev of apiClient.installDependency(picked)) {
        if (ev.status === "downloading" && typeof ev.percent === "number") {
          setProgress(ev.percent / 100);
        }
        if (ev.message) setProgressMessage(ev.message);
        if (ev.status === "complete") {
          setState("ready");
          setTimeout(() => router.replace("/"), 800);
          return;
        }
        if (ev.status === "error") {
          setError(ev.error ?? "Install failed");
          setState("picking");
          return;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState("picking");
    }
  };

  return (
    <Stack
      flex={1}
      alignItems="center"
      justifyContent="center"
      paddingHorizontal="$lg"
      paddingVertical="$xl"
      backgroundColor="$bgBase"
      minHeight={600}
      position="relative"
    >
      {/* Accent atmosphere */}
      <Stack
        position="absolute"
        top={120}
        left="50%"
        width={420}
        height={420}
        marginLeft={-210}
        borderRadius="$pill"
        backgroundColor="$accent"
        opacity={0.18}
        pointerEvents="none"
        style={{ filter: "blur(80px)" }}
      />

      <Stack
        width="100%"
        maxWidth={520}
        borderRadius="$xl"
        backgroundColor={glassRecipes.glassMid.bg}
        borderColor={glassRecipes.glassMid.border}
        borderWidth={1}
        padding="$xl"
        style={{
          backdropFilter: glassRecipes.glassMid.backdropFilter,
          WebkitBackdropFilter: glassRecipes.glassMid.backdropFilter,
        }}
      >
        <YStack gap="$lg">
          <YStack gap="$xs">
            <BadgeAccent>setup · one time</BadgeAccent>
            <Text
              fontFamily="$display"
              fontSize={28}
              lineHeight={34}
              letterSpacing={-0.5}
              color="$textPrimary"
            >
              Setting up your studio
            </Text>
            <Text
              fontFamily="$body"
              fontSize={14}
              lineHeight={22}
              color="$textSecondary"
            >
              {state === "connecting"
                ? "Reaching the local backend…"
                : state === "checking"
                ? "Looking for an installed Whisper model…"
                : state === "picking"
                ? "Pick a Whisper model. This only happens once."
                : state === "downloading"
                ? "Downloading the model. Hang tight."
                : "Ready. Heading to the Generate flow."}
            </Text>
          </YStack>

          {error ? (
            <Stack
              padding="$md"
              borderRadius="$md"
              backgroundColor="rgba(255,90,95,0.10)"
              borderColor="rgba(255,90,95,0.25)"
              borderWidth={1}
            >
              <Text fontFamily="$body" fontSize={13} color="$error">
                {error}
              </Text>
            </Stack>
          ) : null}

          {state === "connecting" || state === "checking" ? (
            <XStack alignItems="center" gap="$sm">
              <StatusDot status="warning" size={8} />
              <Text fontFamily="$body" fontSize={13} color="$textSecondary">
                {state === "connecting"
                  ? "127.0.0.1:8000"
                  : "Reading dependency state…"}
              </Text>
            </XStack>
          ) : null}

          {state === "picking" ? (
            <YStack gap="$xs">
              {MODELS.map((m) => (
                <RadioCard
                  key={m.value}
                  selected={picked === m.value}
                  onPress={() => setPicked(m.value)}
                >
                  <YStack gap={2} flex={1}>
                    <XStack alignItems="center" gap="$xs">
                      <Text
                        fontFamily="$body"
                        fontSize={14}
                        fontWeight="600"
                        color="$textPrimary"
                      >
                        {m.label}
                      </Text>
                      <Text
                        fontFamily="$mono"
                        fontSize={11}
                        color="$textMuted"
                      >
                        {m.size}
                      </Text>
                      {m.recommended ? (
                        <BadgeAccent>⭐ default</BadgeAccent>
                      ) : null}
                    </XStack>
                    <Text
                      fontFamily="$body"
                      fontSize={12}
                      color="$textSecondary"
                    >
                      {m.blurb}
                    </Text>
                  </YStack>
                </RadioCard>
              ))}
            </YStack>
          ) : null}

          {state === "downloading" ? (
            <YStack gap="$sm">
              <ProgressBar value={progress ?? 0} />
              <XStack justifyContent="space-between" alignItems="center">
                <Text fontFamily="$body" fontSize={13} color="$textSecondary">
                  {progressMessage ?? "Downloading…"}
                </Text>
                <Text
                  fontFamily="$mono"
                  fontSize={12}
                  color="$textMuted"
                  style={{ fontFeatureSettings: "'tnum'" }}
                >
                  {Math.round((progress ?? 0) * 100)}%
                </Text>
              </XStack>
            </YStack>
          ) : null}

          {state === "ready" ? (
            <XStack alignItems="center" gap="$sm">
              <Stack
                width={28}
                height={28}
                borderRadius="$pill"
                backgroundColor="rgba(93,184,114,0.15)"
                alignItems="center"
                justifyContent="center"
              >
                <Check size={16} color="#5db872" />
              </Stack>
              <Text fontFamily="$body" fontSize={14} color="$textPrimary">
                Ready · opening Generate.
              </Text>
            </XStack>
          ) : null}

          {state === "picking" ? (
            <YStack gap="$xs">
              <ButtonPrimary onPress={onDownload}>
                <XStack alignItems="center" gap="$xs">
                  <Sparkles size={16} color="#f5f5f7" />
                  <Text
                    fontFamily="$body"
                    fontSize={15}
                    fontWeight="600"
                    color="$textPrimary"
                  >
                    Download {picked}
                  </Text>
                </XStack>
              </ButtonPrimary>
              <ButtonGhost onPress={() => router.replace("/")}>
                <Text
                  fontFamily="$body"
                  fontSize={13}
                  fontWeight="500"
                  color="$textSecondary"
                >
                  Skip — I'll only use YouTube captions
                </Text>
              </ButtonGhost>
            </YStack>
          ) : null}

          <Text
            fontFamily="$body"
            fontSize={11}
            color="$textMuted"
            textAlign="center"
          >
            Models live in the Whisper cache directory; change it in
            Settings → Advanced.
          </Text>
        </YStack>
      </Stack>
    </Stack>
  );
}
