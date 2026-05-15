import { XStack, YStack } from "tamagui";
import {
  ButtonSecondary,
  Caption,
  DisplayMd,
} from "@yt-subtitle-maker/ui";
import type { TranscribeRun } from "@yt-subtitle-maker/api-client";
import { RunRow } from "./RunRow";
import { useLibrary } from "../../state/library";
import { formatRelative, formatDuration } from "../../lib/format";

/**
 * TranscriptsSection — editorial "Transcripts" group inside the right pane.
 *
 * Header is a Fraunces `DisplayMd` label with a quiet `01 / 02`-style count
 * next to it (no badge). The Re-transcribe CTA on the right keeps the
 * existing `ButtonSecondary` but with a tightened sizing + a softer
 * `$borderSubtle` to avoid competing with the title.
 */
export interface TranscriptsSectionProps {
  videoId: string;
  transcribes: TranscribeRun[];
  onPlayTranscript: (transcribeId: string) => void;
  onReTranscribe: () => void;
  onReTranslateFrom: (transcribeId: string) => void;
}

export function TranscriptsSection({
  transcribes,
  onPlayTranscript,
  onReTranscribe,
  onReTranslateFrom,
}: TranscriptsSectionProps) {
  const deleteTranscript = useLibrary((s) => s.deleteTranscript);

  const total = transcribes.length;
  const countLabel =
    total === 0 ? "no versions" : total === 1 ? "1 version" : `${total} versions`;

  return (
    <YStack gap="$sm">
      <XStack alignItems="baseline" justifyContent="space-between">
        <XStack alignItems="baseline" gap="$sm">
          <DisplayMd>Transcripts</DisplayMd>
          <Caption color="$textMuted">{countLabel}</Caption>
        </XStack>
        <ButtonSecondary
          onPress={onReTranscribe}
          height={32}
          paddingHorizontal="$sm"
          borderColor="$borderSubtle"
        >
          + Re-transcribe
        </ButtonSecondary>
      </XStack>

      {transcribes.length === 0 ? (
        <YStack paddingVertical="$sm" paddingHorizontal="$sm">
          <Caption color="$textMuted" fontStyle="italic">
            No transcripts yet — Re-transcribe to add one.
          </Caption>
        </YStack>
      ) : (
        <YStack>
          {transcribes.map((t) => {
            const engineLabel =
              t.engine === "yt_captions" ? "yt-captions" : (t.model ?? t.engine);
            const secondary = `${t.segmentCount} segs · ${formatDuration(
              t.durationMs,
            )} · ${formatRelative(t.createdAt)}`;
            return (
              <RunRow
                key={t.id}
                primaryLang={t.language.toUpperCase()}
                primaryEngine={engineLabel}
                secondary={secondary}
                onPlay={() => onPlayTranscript(t.id)}
                onReRun={() => onReTranslateFrom(t.id)}
                onDelete={() => {
                  if (
                    typeof window !== "undefined" &&
                    window.confirm(
                      "Delete this transcript? Its translations will be deleted too.",
                    )
                  ) {
                    void deleteTranscript(t.id);
                  }
                }}
              />
            );
          })}
        </YStack>
      )}
    </YStack>
  );
}
