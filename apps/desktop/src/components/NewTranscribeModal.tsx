/**
 * NewTranscribeModal — re-runs STT on a library video's existing audio.
 *
 * Streams via `apiClient.streamTranscribe`. Shows ProgressBar + StepPill in
 * the same modal. On `done`, fires `onComplete` so the parent can refetch
 * the VideoDetail.
 *
 * Form parity with /api/library/{videoId}/transcribe body:
 *   - sttEngine        — installed engines from /api/version
 *   - whisperModel     — installed Whisper models from /api/dependencies
 *   - whisperDevice
 *   - vadEnabled
 *   - sourceLang
 *
 * yt_captions skips the model/device/VAD section (those don't apply).
 */
import * as React from "react";
import { Stack, XStack, YStack } from "tamagui";
import {
  Modal,
  Dropdown,
  Toggle,
  ProgressBar,
  StepPill,
  ButtonPrimary,
  ButtonGhost,
  BodySm,
  Caption,
  CaptionUpper,
} from "@yt-subtitle-maker/ui";
import type {
  WhisperDevice,
  WhisperModel,
} from "@yt-subtitle-maker/api-client";
import { apiClient } from "../state/client";
import {
  WHISPER_MODELS,
  WHISPER_DEVICES,
  LANGUAGES,
  humanEngine,
} from "../constants";

type Phase = "idle" | "transcribing" | "done" | "error";

export function NewTranscribeModal({
  open,
  onOpenChange,
  videoId,
  onComplete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoId: string;
  onComplete: () => void;
}) {
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [progress, setProgress] = React.useState<number | undefined>(undefined);
  const [errorMsg, setErrorMsg] = React.useState<string | undefined>();
  const abortRef = React.useRef<AbortController | undefined>(undefined);

  // Form state
  const [sttEngine, setSttEngine] = React.useState<string>("openai-whisper");
  const [installedEngines, setInstalledEngines] = React.useState<string[]>([
    "openai-whisper",
  ]);
  const [whisperModel, setWhisperModel] = React.useState<WhisperModel>("turbo");
  const [installedModels, setInstalledModels] = React.useState<Set<WhisperModel>>(
    new Set(),
  );
  const [whisperDevice, setWhisperDevice] = React.useState<WhisperDevice>("auto");
  const [vadEnabled, setVadEnabled] = React.useState(true);
  const [sourceLang, setSourceLang] = React.useState("en");

  // Probe dependencies + version on open so the dropdowns show only what's
  // actually installed (matches the Generate screen's behavior).
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    apiClient.fetchVersion().then((v) => {
      if (cancelled) return;
      const installed = v.installedSttEngines ?? [];
      if (installed.length > 0) {
        setInstalledEngines(installed);
        if (!installed.includes(sttEngine)) setSttEngine(installed[0]);
      }
    }).catch(() => undefined);
    apiClient.fetchDependencies().then((dep) => {
      if (cancelled) return;
      const installed = new Set<WhisperModel>(
        Object.entries(dep.models ?? {})
          .filter(([, v]) => v === true)
          .map(([k]) => k) as WhisperModel[],
      );
      setInstalledModels(installed);
      if (installed.size > 0 && !installed.has(whisperModel)) {
        setWhisperModel(Array.from(installed)[0]);
      }
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const reset = React.useCallback(() => {
    setPhase("idle");
    setProgress(undefined);
    setErrorMsg(undefined);
    abortRef.current = undefined;
  }, []);

  const handleClose = (next: boolean) => {
    if (!next && phase === "transcribing") {
      abortRef.current?.abort();
    }
    onOpenChange(next);
    if (!next) {
      // Reset form state on close so the next open is clean.
      setTimeout(reset, 200);
    }
  };

  const isYtCaptions = sttEngine === "yt_captions";
  const sttEngineOptions = installedEngines.map((e) => ({
    label: humanEngine(e),
    value: e,
  }));
  // yt_captions is always available alongside installed Whisper engines.
  if (!sttEngineOptions.some((o) => o.value === "yt_captions")) {
    sttEngineOptions.push({
      label: humanEngine("yt_captions"),
      value: "yt_captions",
    });
  }
  const whisperModelOptions = WHISPER_MODELS.filter((opt) =>
    installedModels.size === 0 ? true : installedModels.has(opt.value),
  );

  const onRun = async () => {
    setPhase("transcribing");
    setProgress(undefined);
    setErrorMsg(undefined);

    const abort = new AbortController();
    abortRef.current = abort;
    try {
      const stream = apiClient.streamTranscribe(
        videoId,
        {
          sttEngine,
          whisperModel: isYtCaptions ? null : whisperModel,
          whisperDevice: isYtCaptions ? null : whisperDevice,
          vadEnabled: isYtCaptions ? false : vadEnabled,
          sourceLang,
        },
        abort.signal,
      );
      for await (const ev of stream) {
        if (ev.status === "transcribing") {
          setProgress(ev.progress);
        } else if (ev.status === "done") {
          setPhase("done");
          // Notify parent to refresh, then close after a short beat so the
          // user sees the success state.
          onComplete();
          setTimeout(() => onOpenChange(false), 600);
        } else if (ev.status === "error") {
          setPhase("error");
          setErrorMsg(ev.error);
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setPhase("error");
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={handleClose}
      title="New transcript"
      width={520}
    >
      <YStack gap="$md">
        <YStack gap="$xs">
          <CaptionUpper>Source</CaptionUpper>
          <BodySm color="$textSecondary">
            Re-uses the audio file already in this video's folder ({videoId}.wav).
          </BodySm>
        </YStack>

        <YStack gap="$xs">
          <CaptionUpper>STT engine</CaptionUpper>
          <Dropdown
            value={sttEngine}
            onValueChange={setSttEngine}
            options={sttEngineOptions}
            aria-label="STT engine"
            disabled={phase === "transcribing"}
          />
        </YStack>

        {!isYtCaptions ? (
          <>
            <YStack gap="$xs">
              <CaptionUpper>Whisper model</CaptionUpper>
              <Dropdown
                value={whisperModel}
                onValueChange={(v) => setWhisperModel(v as WhisperModel)}
                options={whisperModelOptions}
                aria-label="Whisper model"
                disabled={phase === "transcribing"}
              />
              {installedModels.size === 0 ? (
                <Caption color="$textMuted">
                  Couldn't probe installed models — showing the full list.
                </Caption>
              ) : null}
            </YStack>

            <YStack gap="$xs">
              <CaptionUpper>Device</CaptionUpper>
              <Dropdown
                value={whisperDevice}
                onValueChange={(v) => setWhisperDevice(v as WhisperDevice)}
                options={WHISPER_DEVICES}
                aria-label="Device"
                disabled={phase === "transcribing"}
              />
            </YStack>

            <XStack alignItems="center" justifyContent="space-between">
              <YStack gap={2} flex={1}>
                <BodySm>Voice Activity Detection</BodySm>
                <Caption>Skip silence; faster on long videos.</Caption>
              </YStack>
              <Toggle
                value={vadEnabled}
                onValueChange={setVadEnabled}
                disabled={phase === "transcribing"}
                aria-label="VAD"
              />
            </XStack>
          </>
        ) : null}

        <YStack gap="$xs">
          <CaptionUpper>Source language</CaptionUpper>
          <Dropdown
            value={sourceLang}
            onValueChange={setSourceLang}
            options={LANGUAGES}
            aria-label="Source language"
            disabled={phase === "transcribing"}
          />
        </YStack>

        {phase === "transcribing" ? (
          <YStack gap="$sm">
            <StepPill status="active">Transcribing</StepPill>
            <ProgressBar
              indeterminate={typeof progress !== "number"}
              value={typeof progress === "number" ? progress * 100 : 0}
            />
          </YStack>
        ) : null}
        {phase === "done" ? (
          <Stack
            padding="$sm"
            borderRadius="$md"
            backgroundColor="$accentSoft"
            borderWidth={1}
            borderColor="$accent"
          >
            <BodySm color="$accent">Transcript saved.</BodySm>
          </Stack>
        ) : null}
        {phase === "error" && errorMsg ? (
          <Stack
            padding="$sm"
            borderRadius="$md"
            backgroundColor="rgba(239,68,68,0.08)"
            borderWidth={1}
            borderColor="$error"
          >
            <BodySm color="$error">{errorMsg}</BodySm>
          </Stack>
        ) : null}

        <XStack gap="$xs" justifyContent="flex-end">
          <ButtonGhost
            onPress={() => handleClose(false)}
            disabled={phase === "transcribing"}
          >
            Cancel
          </ButtonGhost>
          <ButtonPrimary
            onPress={onRun}
            disabled={phase === "transcribing" || phase === "done"}
            glow={
              phase === "transcribing" || phase === "done" ? "none" : "ready"
            }
          >
            Run transcribe
          </ButtonPrimary>
        </XStack>
      </YStack>
    </Modal>
  );
}
