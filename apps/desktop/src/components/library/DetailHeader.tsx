import { ExternalLink, Folder } from "@tamagui/lucide-icons";
import { Stack, XStack, YStack } from "tamagui";
import { BodySm, Caption, DisplayMd, IconButton } from "@yt-subtitle-maker/ui";
import type { VideoDetail } from "@yt-subtitle-maker/api-client";
import { apiClient } from "../../state/client";
import { formatRelative } from "../../lib/format";

/**
 * DetailHeader — the top of the right-pane DetailPane. Shows a 160x90
 * thumbnail tile, the (possibly translated) title with the original title
 * underneath when they differ, a single metadata strip (channel · duration
 * · added · videoId), and two icon buttons: "Open folder" (calls the
 * backend's reveal-in-Finder helper) and "Open URL" (opens the YouTube
 * page in a new tab).
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

  return (
    <XStack gap="$md" alignItems="center">
      <Stack
        width={160}
        height={90}
        borderRadius="$md"
        borderWidth={1}
        borderColor="$borderSubtle"
        overflow="hidden"
        backgroundColor="$bgElevated"
        flexShrink={0}
        style={{
          backgroundImage: detail.thumbnailUrl
            ? `url(${detail.thumbnailUrl})`
            : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <YStack flex={1} gap="$xs" minWidth={0}>
        <DisplayMd numberOfLines={2}>{title}</DisplayMd>
        {showOriginal ? (
          <BodySm color="$textSecondary" numberOfLines={1}>
            {detail.titleOriginal}
          </BodySm>
        ) : null}
        <XStack gap="$xs" alignItems="center" flexWrap="wrap">
          {detail.channel ? (
            <Caption color="$textSecondary">{detail.channel}</Caption>
          ) : null}
          {detail.channel && durationLabel ? (
            <Caption color="$textMuted">·</Caption>
          ) : null}
          {durationLabel ? (
            <Caption color="$textSecondary">{durationLabel}</Caption>
          ) : null}
          <Caption color="$textMuted">·</Caption>
          <Caption color="$textSecondary">
            Added {formatRelative(detail.createdAt)}
          </Caption>
          <Caption color="$textMuted">·</Caption>
          <Caption color="$textMuted" fontFamily="$mono">
            {detail.videoId}
          </Caption>
        </XStack>
      </YStack>
      <XStack gap="$xs" alignSelf="flex-start" marginLeft="auto">
        <IconButton
          size={36}
          icon={<Folder size={16} color="$textSecondary" />}
          aria-label="Open folder"
          onPress={handleOpenFolder}
        />
        <IconButton
          size={36}
          icon={<ExternalLink size={16} color="$textSecondary" />}
          aria-label="Open URL"
          onPress={handleOpenUrl}
        />
      </XStack>
    </XStack>
  );
}
