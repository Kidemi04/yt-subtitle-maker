import { ExternalLink, Film, Folder } from "@tamagui/lucide-icons";
import { Stack, XStack, YStack } from "tamagui";
import { BodySm, Caption, DisplayMd, IconButton } from "@yt-subtitle-maker/ui";
import type { VideoDetail } from "@yt-subtitle-maker/api-client";
import { apiClient } from "../../state/client";
import { formatRelative } from "../../lib/format";

/**
 * DetailHeader — editorial hero header for the right pane.
 *
 * Layout: a 220x124 recessed thumbnail well on the left, a 3-line Fraunces
 * `DisplayMd` title that wraps naturally, an optional italic original-title
 * subline, and a single meta strip (channel · duration · added · videoId).
 * Folder + ExternalLink IconButtons sit in the top-right corner of the
 * header, aligned with the top of the thumbnail. A soft $accentSoft radial
 * glow sits behind the top-right of the thumbnail to lift the composition
 * without adding chrome.
 */
export function DetailHeader({ detail }: { detail: VideoDetail }) {
  const handleOpenFolder = () => {
    void apiClient.openLibraryFolder(detail.videoId);
  };
  const handleOpenUrl = () => {
    window.open(detail.url, "_blank", "noopener,noreferrer");
  };

  const title = detail.titleTranslated ?? detail.titleOriginal;
  const showOriginal =
    detail.titleTranslated && detail.titleOriginal !== detail.titleTranslated;
  const durationLabel = detail.durationSeconds
    ? `${Math.floor(detail.durationSeconds / 60)}:${String(
        detail.durationSeconds % 60,
      ).padStart(2, "0")}`
    : detail.hasVideo
      ? null
      : "audio";

  const metaSegments: string[] = [];
  if (detail.channel) metaSegments.push(detail.channel);
  if (durationLabel) metaSegments.push(durationLabel);
  metaSegments.push(`Added ${formatRelative(detail.createdAt)}`);

  return (
    <XStack gap="$lg" alignItems="flex-start" position="relative">
      {/* Soft accent glow tucked behind the thumbnail's top-right corner. */}
      <Stack
        position="absolute"
        top={-20}
        left={180}
        width={120}
        height={120}
        borderRadius="$pill"
        backgroundColor="$accentSoft"
        opacity={0.4}
        pointerEvents="none"
        style={{ filter: "blur(60px)" }}
      />

      <Stack
        width={220}
        height={124}
        borderRadius="$sm"
        borderWidth={1}
        borderColor="$borderSubtle"
        overflow="hidden"
        backgroundColor="$bgElevated"
        flexShrink={0}
        alignItems="center"
        justifyContent="center"
        style={{
          backgroundImage: detail.thumbnailUrl
            ? `url(${detail.thumbnailUrl})`
            : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.4)",
        }}
      >
        {!detail.thumbnailUrl ? (
          <Film size={28} color="$textMuted" />
        ) : null}
      </Stack>

      <YStack flex={1} gap="$xs" minWidth={0} paddingRight={88}>
        <DisplayMd numberOfLines={3} lineHeight={32}>
          {title}
        </DisplayMd>
        {showOriginal ? (
          <BodySm
            color="$textSecondary"
            numberOfLines={1}
            fontStyle="italic"
          >
            {detail.titleOriginal}
          </BodySm>
        ) : null}
        <XStack alignItems="center" gap="$xs" minWidth={0}>
          <Caption color="$textSecondary" numberOfLines={1} flexShrink={1}>
            {metaSegments.join("  ·  ")}
          </Caption>
          <Caption color="$textMuted">·</Caption>
          <Caption
            color="$textMuted"
            fontFamily="$mono"
            numberOfLines={1}
            flexShrink={0}
          >
            {detail.videoId}
          </Caption>
        </XStack>
      </YStack>

      <XStack
        gap="$xxs"
        position="absolute"
        top={0}
        right={0}
      >
        <IconButton
          size={32}
          icon={<Folder size={14} color="$textMuted" />}
          aria-label="Open folder"
          onPress={handleOpenFolder}
        />
        <IconButton
          size={32}
          icon={<ExternalLink size={14} color="$textMuted" />}
          aria-label="Open URL"
          onPress={handleOpenUrl}
        />
      </XStack>
    </XStack>
  );
}
