import { Stack, XStack, YStack } from "tamagui";
import { BadgePill, Caption, TitleSm } from "@yt-subtitle-maker/ui";
import type { LibraryItem } from "@yt-subtitle-maker/api-client";
import { formatRelative } from "../../lib/format";

export interface LibraryCardCompactProps {
  item: LibraryItem;
  selected: boolean;
  onPress: () => void;
}

export function LibraryCardCompact({ item, selected, onPress }: LibraryCardCompactProps) {
  const title = item.titleTranslated ?? item.titleOriginal;
  const tCount = item.transcribesCount ?? 0;
  const trCount = item.translationsCount ?? 0;

  return (
    <Stack
      tag="button"
      role="button"
      width={158}
      borderRadius="$md"
      overflow="hidden"
      backgroundColor={selected ? "$surfaceGlassMid" : "$surfaceGlass"}
      borderWidth={1}
      borderColor={selected ? "$accent" : "$borderSubtle"}
      cursor="pointer"
      onPress={onPress}
      hoverStyle={{ y: -2, borderColor: "$borderStrong" }}
      animation="quick"
    >
      <Stack
        height={90}
        backgroundColor="$bgElevated"
        style={{
          backgroundImage: item.thumbnailUrl ? `url(${item.thumbnailUrl})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <YStack padding="$sm" gap={2}>
        <TitleSm numberOfLines={2}>{title}</TitleSm>
        <Caption color="$textMuted">{formatRelative(item.createdAt)}</Caption>
        <XStack gap={4} marginTop={4} flexWrap="wrap">
          {tCount > 0 ? <BadgePill tone="neutral">{tCount}t</BadgePill> : null}
          {trCount > 0 ? <BadgePill tone="accent">{trCount}</BadgePill> : null}
        </XStack>
      </YStack>
    </Stack>
  );
}
