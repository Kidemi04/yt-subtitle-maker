import { Stack, XStack, YStack } from "tamagui";
import { BadgePill, Caption, TitleSm } from "@yt-subtitle-maker/ui";
import type { LibraryItem, VideoDetail } from "@yt-subtitle-maker/api-client";
import { formatRelative } from "../../lib/format";

export interface LibraryRowProps {
  item: LibraryItem;
  selected: boolean;
  /** Optional detail (when this video is the selected one) for richer chips. */
  detail?: VideoDetail | null;
  onPress: () => void;
}

/** Lowercased ISO 639-1 language tag set extracted from a detail payload. */
function languageChipsFromDetail(detail: VideoDetail | null | undefined) {
  if (!detail) return { transcripts: new Set<string>(), translations: new Set<string>() };
  const transcripts = new Set<string>();
  const translations = new Set<string>();
  for (const t of detail.transcribes) transcripts.add(t.language.toLowerCase());
  for (const tr of detail.translations) translations.add(tr.targetLang.toLowerCase());
  return { transcripts, translations };
}

export function LibraryRow({ item, selected, detail, onPress }: LibraryRowProps) {
  const title = item.titleTranslated ?? item.titleOriginal;
  const { transcripts, translations } = languageChipsFromDetail(detail);

  // When detail isn't yet loaded for this row, fall back to count badges.
  const showCountFallback = !detail;
  const tCount = item.transcribesCount ?? 0;
  const trCount = item.translationsCount ?? 0;

  return (
    <Stack
      tag="button"
      role="button"
      onPress={onPress}
      cursor="pointer"
      paddingVertical="$sm"
      paddingHorizontal="$sm"
      borderLeftWidth={selected ? 2 : 0}
      borderLeftColor="$accent"
      backgroundColor={selected ? "$surfaceGlassMid" : "transparent"}
      hoverStyle={{ backgroundColor: "$surfaceGlass" }}
      animation="quick"
    >
      <XStack gap="$sm" alignItems="flex-start">
        <Stack
          width={80}
          height={45}
          borderRadius="$xs"
          borderWidth={1}
          borderColor="$borderSubtle"
          backgroundColor="$bgElevated"
          flexShrink={0}
          overflow="hidden"
          style={{
            backgroundImage: item.thumbnailUrl ? `url(${item.thumbnailUrl})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <YStack flex={1} gap={2} minWidth={0}>
          <TitleSm numberOfLines={2}>{title}</TitleSm>
          <Caption color="$textMuted">
            {formatRelative(item.createdAt)}
            {item.hasVideo ? "" : " · audio"}
          </Caption>
          <XStack gap={4} flexWrap="wrap" marginTop={2}>
            {showCountFallback ? (
              <>
                {tCount > 0 ? (
                  <BadgePill tone="neutral">
                    {tCount}t
                  </BadgePill>
                ) : null}
                {trCount > 0 ? (
                  <BadgePill tone="accent">
                    {trCount}
                  </BadgePill>
                ) : null}
              </>
            ) : (
              <>
                {Array.from(transcripts)
                  .filter((lang) => !translations.has(lang))
                  .map((lang) => (
                    <BadgePill key={`t-${lang}`} tone="neutral">
                      {lang.toUpperCase()}
                    </BadgePill>
                  ))}
                {Array.from(translations).map((lang) => (
                  <BadgePill key={`tr-${lang}`} tone="accent">
                    {lang.toUpperCase()}
                  </BadgePill>
                ))}
              </>
            )}
          </XStack>
        </YStack>
      </XStack>
    </Stack>
  );
}
