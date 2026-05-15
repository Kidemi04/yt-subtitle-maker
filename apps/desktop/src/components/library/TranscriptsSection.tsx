import { XStack, YStack } from "tamagui";
import { ButtonSecondary, Caption, CaptionUpper } from "@yt-subtitle-maker/ui";
import type { TranscribeRun } from "@yt-subtitle-maker/api-client";
import { RunRow } from "./RunRow";
import { useLibrary } from "../../state/library";
import { formatRelative, formatDuration } from "../../lib/format";

/**
 * TranscriptsSection — the "Transcripts · N" group inside the right-pane
 * DetailPane. Header has a "Re-transcribe" CTA (always enabled — you can
 * always add a fresh transcript). Each row is a `RunRow` whose
 * Re-run action opens the translate modal seeded with that transcript.
 *
 * `LabelUpper` doesn't exist in @yt-subtitle-maker/ui yet — using
 * `CaptionUpper`, which has the exact same role (11px / 600 / uppercase /
 * letter-spaced label).
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

  return (
    <YStack gap="$sm">
      <XStack alignItems="center" justifyContent="space-between">
        <CaptionUpper>Transcripts · {transcribes.length}</CaptionUpper>
        <ButtonSecondary onPress={onReTranscribe} height={32} paddingHorizontal="$sm">
          + Re-transcribe
        </ButtonSecondary>
      </XStack>

      {transcribes.length === 0 ? (
        <YStack
          paddingVertical="$md"
          paddingHorizontal="$sm"
          borderRadius="$sm"
          borderWidth={1}
          borderColor="$borderSubtle"
          borderStyle="dashed"
        >
          <Caption color="$textMuted">No transcripts yet — Re-transcribe to add one.</Caption>
        </YStack>
      ) : (
        <YStack gap="$xs">
          {transcribes.map((t) => {
            const engineLabel = t.engine === "yt_captions" ? "yt-captions" : t.model ?? t.engine;
            const primary = `${t.language.toUpperCase()} · ${engineLabel} · ${t.segmentCount} segs · ${formatDuration(t.durationMs)}`;
            return (
              <RunRow
                key={t.id}
                primary={primary}
                secondary={formatRelative(t.createdAt)}
                onPlay={() => onPlayTranscript(t.id)}
                onReRun={() => onReTranslateFrom(t.id)}
                onDelete={() => {
                  if (typeof window !== "undefined" && window.confirm("Delete this transcript? Its translations will be deleted too.")) {
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
