// apps/desktop/src/components/settings/ModelRow.tsx
import * as React from "react";
import { XStack, YStack } from "tamagui";
import { CheckCircle } from "@tamagui/lucide-icons";
import {
  ButtonSecondary,
  ButtonGhost,
  ProgressBar,
  Caption,
  TitleSm,
  BadgePill,
} from "@yt-subtitle-maker/ui";
import type { EngineModel, WhisperModel } from "@yt-subtitle-maker/api-client";
import { apiClient } from "../../state/client";
import { useSettings } from "./SettingsContext";

type DownloadState = "idle" | "downloading" | "done" | "error";

interface Props {
  model: EngineModel;
  engineId: string;
  /** Whether this model is the currently-selected default. */
  selected: boolean;
  onSelect: (name: string) => void;
}

function formatSize(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

export function ModelRow({ model, engineId, selected, onSelect }: Props) {
  const { refreshEngines } = useSettings();
  const [dlState, setDlState] = React.useState<DownloadState>("idle");
  const [progress, setProgress] = React.useState(0);
  const [progressMsg, setProgressMsg] = React.useState<string | undefined>();
  const [dlError, setDlError] = React.useState<string | undefined>();
  const abortRef = React.useRef<AbortController | null>(null);

  // Clean up on unmount — cancel any in-progress download
  React.useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const startDownload = async () => {
    setDlState("downloading");
    setProgress(0);
    setProgressMsg("Starting…");
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
                ? ` · ${(ev.speed / 1024 / 1024).toFixed(1)} MB/s`
                : "";
            setProgressMsg(`${dlMb} / ${totMb} MB${speedPart}`);
          }
        }
        if (ev.status === "done") {
          setProgress(1);
          setProgressMsg("Done");
          setDlState("done");
          // Refresh the engine descriptor so the downloaded flag flips to true
          await refreshEngines();
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

  return (
    <YStack
      paddingVertical="$xs"
      paddingHorizontal="$sm"
      borderRadius="$sm"
      backgroundColor={selected ? "$accentSoft" : "transparent"}
      borderWidth={selected ? 1 : 0}
      borderColor={selected ? "$accentDim" : "transparent"}
      gap="$xxs"
    >
      <XStack alignItems="center" gap="$sm">
        {/* Model name + size — pressing the name/left side selects this model */}
        <YStack flex={1} gap={2} onPress={() => onSelect(model.name)} cursor="pointer">
          <XStack alignItems="center" gap="$xs">
            <TitleSm color={selected ? "$accent" : "$text"}>
              {model.name}
            </TitleSm>
            <BadgePill tone={isDownloaded ? "success" : "neutral"}>
              {formatSize(model.sizeMb)}
            </BadgePill>
            {isDownloaded ? (
              <CheckCircle size={13} color="$success" />
            ) : null}
          </XStack>
          {isDownloaded ? (
            <Caption color="$textSecondary">Downloaded · tap to select as default</Caption>
          ) : (
            <Caption color="$textMuted">Not downloaded</Caption>
          )}
        </YStack>

        {/* Action buttons — separate hit area, do not propagate to the row's onSelect */}
        {!isDownloaded && dlState === "idle" ? (
          <ButtonSecondary onPress={startDownload}>
            Download ({formatSize(model.sizeMb)})
          </ButtonSecondary>
        ) : null}
        {dlState === "downloading" ? (
          <ButtonGhost onPress={cancelDownload}>
            Cancel
          </ButtonGhost>
        ) : null}
        {dlState === "error" ? (
          <ButtonSecondary onPress={startDownload}>
            Retry
          </ButtonSecondary>
        ) : null}
      </XStack>

      {/* Progress */}
      {dlState === "downloading" ? (
        <YStack gap={4}>
          <ProgressBar value={progress} />
          <XStack justifyContent="space-between">
            <Caption color="$textSecondary">{progressMsg ?? "Downloading…"}</Caption>
            <Caption color="$textMuted">{Math.round(progress * 100)}%</Caption>
          </XStack>
        </YStack>
      ) : null}

      {/* Error message */}
      {dlError && dlState === "error" ? (
        <Caption color="$error">{dlError}</Caption>
      ) : null}
    </YStack>
  );
}
