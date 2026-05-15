import { Play, RefreshCw, Trash2 } from "@tamagui/lucide-icons";
import { XStack, YStack } from "tamagui";
import { IconButton, BodyMd, Caption } from "@yt-subtitle-maker/ui";

/**
 * RunRow — one row inside `TranscriptsSection` / `TranslationsSection`.
 *
 * Two lines of text (primary metadata + secondary timestamp) and 2–3 chrome
 * actions on the right: Play, optional Re-run (re-translate from this
 * transcript — transcript rows only), and Delete. Uses the smallest
 * `IconButton` size (32) — the literal plan asked for 28, but
 * `IconButton.size` is typed as `32 | 36` so 32 is the closest match.
 */
export interface RunRowProps {
  primary: string;
  secondary: string;
  onPlay: () => void;
  /** Only provided for transcript rows; translation rows omit this. */
  onReRun?: () => void;
  onDelete: () => void;
  /** Disables Play while gating on the mpv install status check. */
  playLoading?: boolean;
}

export function RunRow({ primary, secondary, onPlay, onReRun, onDelete, playLoading }: RunRowProps) {
  return (
    <XStack
      paddingVertical="$sm"
      paddingHorizontal="$sm"
      backgroundColor="$surfaceGlass"
      borderRadius="$sm"
      borderWidth={1}
      borderColor="$borderSubtle"
      alignItems="center"
      gap="$sm"
      hoverStyle={{ y: -1, backgroundColor: "$surfaceGlassMid", borderColor: "$borderStrong" }}
      animation="quick"
    >
      <YStack flex={1} gap={2}>
        <BodyMd>{primary}</BodyMd>
        <Caption color="$textMuted">{secondary}</Caption>
      </YStack>
      <XStack gap="$xs">
        <IconButton
          size={32}
          icon={<Play size={14} color="#f5f5f7" />}
          aria-label="Play"
          onPress={onPlay}
          disabled={playLoading}
        />
        {onReRun ? (
          <IconButton
            size={32}
            icon={<RefreshCw size={14} color="#a1a1a6" />}
            aria-label="Re-translate"
            onPress={onReRun}
          />
        ) : null}
        <IconButton
          size={32}
          icon={<Trash2 size={14} color="#a1a1a6" />}
          aria-label="Delete"
          onPress={onDelete}
        />
      </XStack>
    </XStack>
  );
}
