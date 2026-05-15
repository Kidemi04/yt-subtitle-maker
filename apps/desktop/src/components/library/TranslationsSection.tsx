import { AlertTriangle } from "@tamagui/lucide-icons";
import { Stack, XStack, YStack } from "tamagui";
import {
  ButtonSecondary,
  Caption,
  DisplayMd,
} from "@yt-subtitle-maker/ui";
import type { TranscribeRun, TranslateRun } from "@yt-subtitle-maker/api-client";
import { RunRow } from "./RunRow";
import { useLibrary } from "../../state/library";
import { formatRelative } from "../../lib/format";

/**
 * TranslationsSection — editorial "Translations" group inside the right pane.
 *
 * Same header treatment as TranscriptsSection (Fraunces `DisplayMd` + quiet
 * count). Translations are grouped by their source transcript and rendered
 * under a thin `From — VI · whisper-large` label row with a hairline divider
 * above (no pill, no badge — just a discreet caption).
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

  const total = translations.length;
  const countLabel =
    total === 0 ? "no versions" : total === 1 ? "1 version" : `${total} versions`;

  const byTranscriptId = new Map<string, TranscribeRun>(
    transcribes.map((t) => [t.id, t]),
  );
  const groups = new Map<string | null, TranslateRun[]>();
  for (const tr of translations) {
    const key = byTranscriptId.has(tr.sourceTranscribeId)
      ? tr.sourceTranscribeId
      : null;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(tr);
  }

  return (
    <YStack gap="$sm">
      <XStack alignItems="baseline" justifyContent="space-between">
        <XStack alignItems="baseline" gap="$sm">
          <DisplayMd>Translations</DisplayMd>
          <Caption color="$textMuted">{countLabel}</Caption>
        </XStack>
        <ButtonSecondary
          onPress={onReTranslate}
          disabled={!canReTranslate}
          aria-disabled={!canReTranslate}
          aria-label={
            canReTranslate
              ? undefined
              : "Re-translate (disabled — add a transcript first)"
          }
          height={32}
          paddingHorizontal="$sm"
          borderColor="$borderSubtle"
        >
          + Re-translate
        </ButtonSecondary>
      </XStack>

      {translations.length === 0 ? (
        <YStack paddingVertical="$sm" paddingHorizontal="$sm">
          <Caption color="$textMuted" fontStyle="italic">
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
            const sourceLabel = orphan
              ? "Orphans (source transcript deleted)"
              : `From — ${source?.language.toUpperCase()} · ${
                  source?.model ?? source?.engine
                }`;
            return (
              <YStack key={transcriptId ?? "orphan"}>
                <Stack
                  borderTopWidth={1}
                  borderTopColor="$borderSubtle"
                  paddingTop="$xs"
                  paddingHorizontal="$sm"
                  marginBottom="$xxs"
                >
                  <XStack gap="$xs" alignItems="center">
                    {orphan ? <AlertTriangle size={12} color="#e8a55a" /> : null}
                    <Caption
                      color="$textMuted"
                      fontStyle={orphan ? undefined : "italic"}
                    >
                      {sourceLabel}
                    </Caption>
                  </XStack>
                </Stack>
                {runs.map((tr) => (
                  <RunRow
                    key={tr.id}
                    primaryLang={tr.targetLang.toUpperCase()}
                    primaryEngine={`${tr.translator} · ${tr.segmentCount} segs`}
                    secondary={formatRelative(tr.createdAt)}
                    onPlay={() => onPlayTranslation(tr.id)}
                    onDelete={() => {
                      if (
                        typeof window !== "undefined" &&
                        window.confirm("Delete this translation?")
                      ) {
                        void deleteTranslation(tr.id);
                      }
                    }}
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
