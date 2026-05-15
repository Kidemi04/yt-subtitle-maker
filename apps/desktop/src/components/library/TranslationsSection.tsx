import { AlertTriangle } from "@tamagui/lucide-icons";
import { XStack, YStack } from "tamagui";
import { ButtonSecondary, Caption, CaptionUpper } from "@yt-subtitle-maker/ui";
import type { TranscribeRun, TranslateRun } from "@yt-subtitle-maker/api-client";
import { RunRow } from "./RunRow";
import { useLibrary } from "../../state/library";
import { formatRelative } from "../../lib/format";

/**
 * TranslationsSection — the "Translations · N" group inside the right-pane
 * DetailPane. Translations are grouped by their `sourceTranscribeId` so users
 * can see which transcript each one was derived from; runs whose source has
 * since been deleted ("orphans") get bucketed under a warning-iconed header.
 *
 * The "Re-translate" CTA is disabled when there are no transcripts to pick
 * from — translation always requires a source transcript.
 */
export interface TranslationsSectionProps {
  videoId: string;
  transcribes: TranscribeRun[];
  translations: TranslateRun[];
  onPlayTranslation: (translateId: string) => void;
  onReTranslate: () => void;
}

export function TranslationsSection({
  transcribes,
  translations,
  onPlayTranslation,
  onReTranslate,
}: TranslationsSectionProps) {
  const deleteTranslation = useLibrary((s) => s.deleteTranslation);
  const canReTranslate = transcribes.length > 0;

  const byTranscriptId = new Map<string, TranscribeRun>(transcribes.map((t) => [t.id, t]));
  // Preserve insertion order so groups appear in a stable order on each render.
  const groups = new Map<string | null, TranslateRun[]>();
  for (const tr of translations) {
    const key = byTranscriptId.has(tr.sourceTranscribeId) ? tr.sourceTranscribeId : null;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(tr);
  }

  return (
    <YStack gap="$sm">
      <XStack alignItems="center" justifyContent="space-between">
        <CaptionUpper>Translations · {translations.length}</CaptionUpper>
        <ButtonSecondary
          onPress={onReTranslate}
          disabled={!canReTranslate}
          aria-disabled={!canReTranslate}
          aria-label={canReTranslate ? undefined : "Re-translate (disabled — add a transcript first)"}
          height={32}
          paddingHorizontal="$sm"
        >
          + Re-translate
        </ButtonSecondary>
      </XStack>

      {translations.length === 0 ? (
        <YStack
          paddingVertical="$md"
          paddingHorizontal="$sm"
          borderRadius="$sm"
          borderWidth={1}
          borderColor="$borderSubtle"
          borderStyle="dashed"
        >
          <Caption color="$textMuted">
            {canReTranslate
              ? "No translations yet — Re-translate to add one."
              : "Add a transcript first, then you can translate it."}
          </Caption>
        </YStack>
      ) : (
        <YStack gap="$md">
          {Array.from(groups.entries()).map(([transcriptId, runs]) => {
            const orphan = transcriptId === null;
            const source = transcriptId ? byTranscriptId.get(transcriptId) : null;
            const header = orphan
              ? "Orphans (source transcript deleted)"
              : `From: ${source?.language.toUpperCase()} · ${source?.model ?? source?.engine}`;
            return (
              <YStack key={transcriptId ?? "orphan"} gap="$xs">
                <XStack gap="$xs" alignItems="center">
                  {orphan ? <AlertTriangle size={12} color="#e8a55a" /> : null}
                  <Caption color="$textSecondary">{header}</Caption>
                </XStack>
                {runs.map((tr) => (
                  <RunRow
                    key={tr.id}
                    primary={`${tr.targetLang.toUpperCase()} · ${tr.translator} · ${tr.segmentCount} segs`}
                    secondary={formatRelative(tr.createdAt)}
                    onPlay={() => onPlayTranslation(tr.id)}
                    onDelete={() => void deleteTranslation(tr.id)}
                  />
                ))}
              </YStack>
            );
          })}
        </YStack>
      )}
    </YStack>
  );
}
