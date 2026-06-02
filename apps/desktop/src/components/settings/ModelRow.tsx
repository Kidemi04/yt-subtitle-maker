import * as React from "react";
import { Stack, XStack, YStack } from "tamagui";
import { CheckCircle, Download, TriangleAlert } from "@tamagui/lucide-icons";
import {
  BadgePill,
  BodySm,
  ButtonGhost,
  ButtonSecondary,
  Caption,
  ProgressBar,
  TitleSm,
} from "@yt-subtitle-maker/ui";
import type { EngineModel, WhisperModel } from "@yt-subtitle-maker/api-client";
import { apiClient } from "../../state/client";
import { useSettings } from "./SettingsContext";

type DownloadState = "idle" | "downloading" | "done" | "error";

interface Props {
  model: EngineModel;
  engineId: string;
  selected: boolean;
  configuredDefault: boolean;
  onSelect: (name: string) => void;
}

function formatSize(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

function modelHint(name: string): string {
  switch (name) {
    case "tiny":
      return "Fastest. Good for quick tests.";
    case "base":
      return "Very quick. Better than Tiny.";
    case "small":
      return "Light daily option. CPU friendly.";
    case "medium":
      return "More accurate. Slower on CPU.";
    case "large-v3":
      return "Best quality. Slowest and largest.";
    case "turbo":
      return "Recommended default. Strong speed and quality balance.";
    default:
      return "Whisper model checkpoint.";
  }
}

export function ModelRow({
  model,
  engineId,
  selected,
  configuredDefault,
  onSelect,
}: Props) {
  const { refreshEngines } = useSettings();
  const [dlState, setDlState] = React.useState<DownloadState>("idle");
  const [progress, setProgress] = React.useState(0);
  const [progressMsg, setProgressMsg] = React.useState<string | undefined>();
  const [dlError, setDlError] = React.useState<string | undefined>();
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const startDownload = async () => {
    setDlState("downloading");
    setProgress(0);
    setProgressMsg("Starting...");
    setDlError(undefined);
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      for await (const ev of apiClient.installDependency(
        model.name as WhisperModel,
        ctrl.signal,
        engineId,
      )) {
        if (ctrl.signal.aborted) return;

        if (ev.status === "downloading") {
          const pct = typeof ev.percent === "number" ? ev.percent / 100 : 0;
          setProgress(pct);
          if (
            typeof ev.downloaded === "number" &&
            typeof ev.total === "number"
          ) {
            const dlMb = (ev.downloaded / 1024 / 1024).toFixed(1);
            const totMb = (ev.total / 1024 / 1024).toFixed(0);
            const speedPart =
              typeof ev.speed === "number"
                ? `, ${(ev.speed / 1024 / 1024).toFixed(1)} MB/s`
                : "";
            setProgressMsg(`${dlMb} / ${totMb} MB${speedPart}`);
          } else {
            setProgressMsg("Downloading...");
          }
        }

        if (ev.status === "done") {
          setProgress(1);
          setProgressMsg("Done");
          setDlState("done");
          await refreshEngines();
          onSelect(model.name);
          return;
        }

        if (ev.status === "error") {
          setDlError(ev.error ?? "Download failed");
          setDlState("error");
          return;
        }
      }
    } catch (err) {
      if (ctrl.signal.aborted) {
        setDlState("idle");
        return;
      }
      setDlError(err instanceof Error ? err.message : String(err));
      setDlState("error");
    }
  };

  const cancelDownload = () => {
    abortRef.current?.abort();
    setDlState("idle");
    setProgress(0);
    setProgressMsg(undefined);
  };

  const isDownloaded = model.downloaded || dlState === "done";
  const canSelect = isDownloaded && dlState !== "downloading";
  const hasMeasuredProgress = progress > 0 || Boolean(progressMsg?.includes("/"));

  return (
    <YStack
      padding="$sm"
      borderRadius="$md"
      backgroundColor={selected ? "$accentSoft" : "$bgBase"}
      borderWidth={1}
      borderColor={
        selected ? "$accent" : configuredDefault ? "$warning" : "$borderSubtle"
      }
      gap="$xs"
    >
      <XStack alignItems="center" gap="$sm">
        <Stack
          tag="button"
          role="button"
          aria-label={
            canSelect
              ? `Use ${model.name} as the default Whisper model`
              : `${model.name} is not installed`
          }
          width={28}
          height={28}
          borderRadius="$pill"
          alignItems="center"
          justifyContent="center"
          backgroundColor={selected ? "$accent" : "transparent"}
          borderWidth={selected ? 0 : 1}
          borderColor={
            configuredDefault ? "$warning" : isDownloaded ? "$borderStrong" : "$borderSubtle"
          }
          cursor={canSelect ? "pointer" : "not-allowed"}
          opacity={canSelect ? 1 : 0.6}
          disabled={!canSelect}
          onPress={canSelect ? () => onSelect(model.name) : undefined}
          flexShrink={0}
        >
          {selected ? (
            <CheckCircle size={16} color="$bgBase" />
          ) : configuredDefault ? (
            <TriangleAlert size={14} color="$warning" />
          ) : isDownloaded ? (
            <CheckCircle size={15} color="$success" />
          ) : (
            <Download size={14} color="$textMuted" />
          )}
        </Stack>

        <YStack
          flex={1}
          minWidth={0}
          gap={2}
          cursor={canSelect ? "pointer" : "default"}
          onPress={canSelect ? () => onSelect(model.name) : undefined}
        >
          <XStack alignItems="center" gap="$xs" flexWrap="wrap">
            <TitleSm color={selected ? "$accent" : "$text"}>
              {model.name}
            </TitleSm>
            {selected ? <BadgePill tone="accent">Default</BadgePill> : null}
            {configuredDefault && !selected ? (
              <BadgePill tone="warning">Needs download</BadgePill>
            ) : null}
            <BadgePill tone={isDownloaded ? "success" : "neutral"}>
              {isDownloaded ? "Installed" : "Not installed"}
            </BadgePill>
            <BadgePill tone="neutral">{formatSize(model.sizeMb)}</BadgePill>
          </XStack>
          <Caption color={isDownloaded ? "$textSecondary" : "$textMuted"}>
            {configuredDefault && !isDownloaded
              ? `${modelHint(model.name)} This is configured as default, but it must be downloaded before use.`
              : isDownloaded
              ? `${modelHint(model.name)} Click to use as default.`
              : `${modelHint(model.name)} Download before selecting.`}
          </Caption>
        </YStack>

        {!isDownloaded && dlState === "idle" ? (
          <ButtonSecondary onPress={startDownload} height={42}>
            Download
          </ButtonSecondary>
        ) : null}
        {dlState === "downloading" ? (
          <ButtonGhost onPress={cancelDownload} height={42}>
            Cancel
          </ButtonGhost>
        ) : null}
        {dlState === "error" ? (
          <ButtonSecondary onPress={startDownload} height={42}>
            Retry
          </ButtonSecondary>
        ) : null}
      </XStack>

      {dlState === "downloading" ? (
        <YStack gap="$xs">
          <ProgressBar value={progress} />
          <XStack justifyContent="space-between" gap="$sm">
            <Caption color="$textSecondary">
              {progressMsg ?? "Downloading..."}
            </Caption>
            <Caption color="$textMuted">
              {hasMeasuredProgress ? `${Math.round(progress * 100)}%` : "Working"}
            </Caption>
          </XStack>
        </YStack>
      ) : null}

      {dlError && dlState === "error" ? (
        <XStack alignItems="center" gap="$xs">
          <TriangleAlert size={14} color="$error" />
          <BodySm color="$error">{dlError}</BodySm>
        </XStack>
      ) : null}
    </YStack>
  );
}
