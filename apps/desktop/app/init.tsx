import * as React from "react";
import { Stack, XStack, YStack } from "tamagui";
import { Check } from "@tamagui/lucide-icons";
import {
  RadioCard,
  ButtonPrimary,
  ButtonGhost,
  ProgressBar,
  BadgeAccent,
  StatusDot,
  DisplayMd,
  TitleMd,
  TitleSm,
  BodyMd,
  BodySm,
  Caption,
  Timestamp,
  glassRecipes,
} from "@yt-subtitle-maker/ui";
import { useRouter } from "expo-router";
import { apiClient } from "../src/state/client";
import {
  anyModelInstalled,
  type WhisperModel,
} from "@yt-subtitle-maker/api-client";

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
        if (anyModelInstalled(dep)) {
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
        if (ev.status === "downloading") {
          if (typeof ev.percent === "number") setProgress(ev.percent / 100);
          if (typeof ev.downloaded === "number" && typeof ev.total === "number") {
            const mb = (ev.downloaded / 1024 / 1024).toFixed(1);
            const tot = (ev.total / 1024 / 1024).toFixed(0);
            const mbps =
              typeof ev.speed === "number"
                ? ` · ${(ev.speed / 1024 / 1024).toFixed(1)} MB/s`
                : "";
            setProgressMessage(`${mb} / ${tot} MB${mbps}`);
          }
        }
        if (ev.status === "done") {
          setProgress(1);
          setProgressMessage("Done");
          setState("ready");
          setTimeout(() => router.replace("/"), 600);
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
            <DisplayMd>Setting up your studio</DisplayMd>
            <BodyMd color="$textSecondary">
              {state === "connecting"
                ? "Reaching the local backend…"
                : state === "checking"
                ? "Looking for an installed Whisper model…"
                : state === "picking"
                ? "Pick a Whisper model. This only happens once."
                : state === "downloading"
                ? "Downloading the model. Hang tight."
                : "Ready. Heading to the Generate flow."}
            </BodyMd>
          </YStack>

          {error ? (
            <Stack
              padding="$md"
              borderRadius="$md"
              backgroundColor="rgba(255,90,95,0.10)"
              borderColor="rgba(255,90,95,0.25)"
              borderWidth={1}
            >
              <BodySm color="$error">{error}</BodySm>
            </Stack>
          ) : null}

          {state === "connecting" || state === "checking" ? (
            <XStack alignItems="center" gap="$sm">
              <StatusDot status="untested" size={8} />
              <BodySm color="$textSecondary">
                {state === "connecting"
                  ? "Reaching the local backend…"
                  : "Reading dependency state…"}
              </BodySm>
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
                      <TitleSm>{m.label}</TitleSm>
                      <Timestamp>{m.size}</Timestamp>
                      {m.recommended ? (
                        <BadgeAccent>⭐ default</BadgeAccent>
                      ) : null}
                    </XStack>
                    <Caption color="$textSecondary">{m.blurb}</Caption>
                  </YStack>
                </RadioCard>
              ))}
            </YStack>
          ) : null}

          {state === "downloading" ? (
            <YStack gap="$sm">
              <ProgressBar value={progress ?? 0} />
              <XStack justifyContent="space-between" alignItems="center">
                <BodySm color="$textSecondary">
                  {progressMessage ?? "Downloading…"}
                </BodySm>
                <Timestamp fontSize={12}>
                  {Math.round((progress ?? 0) * 100)}%
                </Timestamp>
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
                <Check size={16} color="$success" />
              </Stack>
              <BodyMd>Ready · opening Generate.</BodyMd>
            </XStack>
          ) : null}

          {state === "picking" ? (
            <YStack gap="$xs">
              <ButtonPrimary onPress={onDownload}>
                <TitleMd>Download {picked}</TitleMd>
              </ButtonPrimary>
              <ButtonGhost
                onPress={() => {
                  // Skip persists across reloads so _layout's init gate
                  // doesn't loop the user back here. Clears automatically
                  // once any Whisper model is installed.
                  if (typeof window !== "undefined") {
                    window.localStorage.setItem("yt_init_skipped", "1");
                  }
                  router.replace("/");
                }}
              >
                <BodySm fontWeight="500" color="$textSecondary">
                  Skip — I'll only use YouTube captions
                </BodySm>
              </ButtonGhost>
            </YStack>
          ) : null}

          <Caption textAlign="center">
            Models live in the Whisper cache directory; change it in
            Settings → Advanced.
          </Caption>
        </YStack>
      </Stack>
    </Stack>
  );
}
