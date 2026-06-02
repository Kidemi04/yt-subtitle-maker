/**
 * NewTranslationModal — re-translates an existing transcript into another
 * target language via a chosen translator provider.
 *
 * Streams via `apiClient.streamTranslate`. Same UX shape as
 * NewTranscribeModal: form → ProgressBar/StepPill → done → close + parent
 * refetch.
 */
import * as React from "react";
import { Stack, XStack, YStack } from "tamagui";
import {
  Modal,
  Dropdown,
  ProgressBar,
  StepPill,
  ButtonPrimary,
  ButtonGhost,
  BodySm,
  Caption,
  CaptionUpper,
} from "@yt-subtitle-maker/ui";
import { LanguagePicker } from "./settings/LanguagePicker";
import type {
  TranscribeRun,
} from "@yt-subtitle-maker/api-client";
import { apiClient } from "../state/client";

type Phase = "idle" | "translating" | "done" | "error";

export function NewTranslationModal({
  open,
  onOpenChange,
  videoId,
  transcribes,
  initialSourceTranscribeId,
  onComplete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoId: string;
  transcribes: TranscribeRun[];
  /** Pre-select a transcript when opened from its row's Translate button. */
  initialSourceTranscribeId?: string;
  onComplete: () => void;
}) {
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [progress, setProgress] = React.useState<number | undefined>(undefined);
  const [errorMsg, setErrorMsg] = React.useState<string | undefined>();
  const abortRef = React.useRef<AbortController | undefined>(undefined);

  // Form state
  const [sourceTranscribeId, setSourceTranscribeId] = React.useState<string>(
    initialSourceTranscribeId ?? transcribes[0]?.id ?? "",
  );
  const [translator, setTranslator] = React.useState("gemini");
  const [targetLang, setTargetLang] = React.useState("zh");
  const [translatorOptions, setTranslatorOptions] = React.useState<
    { label: string; value: string }[]
  >([{ label: "Gemini", value: "gemini" }]);

  React.useEffect(() => {
    if (!open) return;
    if (initialSourceTranscribeId) {
      setSourceTranscribeId(initialSourceTranscribeId);
    } else if (!sourceTranscribeId && transcribes.length > 0) {
      setSourceTranscribeId(transcribes[0].id);
    }
    // Default translator from saved config so the user's Settings choice
    // is the starting point.
    let cancelled = false;
    apiClient.fetchConfig().then((cfg) => {
      if (cancelled) return;
      const active = cfg.activeTranslator || cfg.translatorProvider || "gemini";
      const customOptions = (cfg.customTranslators ?? []).map((profile) => ({
        label: profile.name || "(unnamed)",
        value: `custom:${profile.id}`,
      }));
      const selected = customOptions.some((option) => option.value === active)
        ? active
        : customOptions[0]?.value ?? active;
      setTranslatorOptions(
        customOptions.length > 0 ? customOptions : [{ label: active, value: active }],
      );
      setTranslator(selected);
      if (cfg.defaultTargetLang) setTargetLang(cfg.defaultTargetLang);
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialSourceTranscribeId, transcribes.length]);

  const reset = React.useCallback(() => {
    setPhase("idle");
    setProgress(undefined);
    setErrorMsg(undefined);
    abortRef.current = undefined;
  }, []);

  const handleClose = (next: boolean) => {
    if (!next && phase === "translating") {
      abortRef.current?.abort();
    }
    onOpenChange(next);
    if (!next) {
      setTimeout(reset, 200);
    }
  };

  const onRun = async () => {
    setPhase("translating");
    setProgress(undefined);
    setErrorMsg(undefined);

    const abort = new AbortController();
    abortRef.current = abort;
    try {
      const stream = apiClient.streamTranslate(
        videoId,
        {
          sourceTranscribeId,
          targetLang,
          translatorProvider: translator,
        },
        abort.signal,
      );
      for await (const ev of stream) {
        if (ev.status === "translating") {
          setProgress(ev.progress);
        } else if (ev.status === "done") {
          setPhase("done");
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

  const transcribeOptions = transcribes.map((t) => ({
    label: t.id,
    value: t.id,
  }));

  return (
    <Modal
      open={open}
      onOpenChange={handleClose}
      title="New translation"
      width={520}
    >
      <YStack gap="$md">
        <YStack gap="$xs">
          <CaptionUpper>Source transcript</CaptionUpper>
          {transcribes.length === 0 ? (
            <BodySm color="$textMuted">
              No transcripts available. Run a transcript first.
            </BodySm>
          ) : (
            <Dropdown
              value={sourceTranscribeId}
              onValueChange={setSourceTranscribeId}
              options={transcribeOptions}
              aria-label="Source transcript"
              disabled={phase === "translating"}
            />
          )}
        </YStack>

        <YStack gap="$xs">
          <CaptionUpper>Translator</CaptionUpper>
          <Dropdown
            value={translator}
            onValueChange={setTranslator}
            options={translatorOptions}
            width="100%"
            aria-label="Translator profile"
            disabled={phase === "translating"}
          />
          <Caption color="$textMuted">
            Uses the credentials + model set in Settings → Translator.
          </Caption>
        </YStack>

        <YStack gap="$xs">
          <CaptionUpper>Target language</CaptionUpper>
          <LanguagePicker
            value={targetLang}
            onValueChange={setTargetLang}
            aria-label="Target language"
            disabled={phase === "translating"}
          />
        </YStack>

        {phase === "translating" ? (
          <YStack gap="$sm">
            <StepPill status="active">Translating</StepPill>
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
            <BodySm color="$accent">Translation saved.</BodySm>
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
            disabled={phase === "translating"}
          >
            Cancel
          </ButtonGhost>
          <ButtonPrimary
            onPress={onRun}
            disabled={
              phase === "translating" ||
              phase === "done" ||
              !sourceTranscribeId ||
              transcribes.length === 0
            }
          >
            Run translation
          </ButtonPrimary>
        </XStack>
      </YStack>
    </Modal>
  );
}
