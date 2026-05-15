import { ExternalLink, Folder } from "@tamagui/lucide-icons";
import { Stack, XStack, YStack } from "tamagui";
import { BodySm, Caption, IconButton, TitleLg } from "@yt-subtitle-maker/ui";
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
    <XStack gap="$md" padding="$md" alignItems="center">
      <Stack
        width={160}
        height={90}
        borderRadius="$sm"
        backgroundColor="$bgElevated"
        style={{
          backgroundImage: detail.thumbnailUrl
            ? `url(${detail.thumbnailUrl})`
            : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <YStack flex={1} gap="$xs" minWidth={0}>
        <TitleLg numberOfLines={2}>{title}</TitleLg>
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
        <XStack gap="$xs" marginTop="$xs">
          <IconButton
            size={32}
            icon={<Folder size={14} color="#a1a1a6" />}
            aria-label="Open folder"
            onPress={handleOpenFolder}
          />
          <IconButton
            size={32}
            icon={<ExternalLink size={14} color="#a1a1a6" />}
            aria-label="Open URL"
            onPress={handleOpenUrl}
          />
        </XStack>
      </YStack>
    </XStack>
  );
}
