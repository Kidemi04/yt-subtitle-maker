import { Play, RefreshCw, Trash2 } from "@tamagui/lucide-icons";
import { Stack, XStack, YStack } from "tamagui";
import { BodySm, Caption, IconButton, TitleSm } from "@yt-subtitle-maker/ui";

/**
 * RunRow — an editorial track-list row.
 *
 * Layout (L→R):
 *   1. 36px circular Play target (primary affordance, accent-tinted on hover)
 *   2. Two-line text block: language + engine (Title weight) above
 *      `Caption` mono secondary details (segments · duration · timestamp)
 *   3. Right-edge "track actions" (Re-run, Delete) — borderless icon buttons
 *      that fade to opacity 1 on row hover.
 *
 * The row itself is chromeless — no background, no border — separated from
 * its neighbours only by a bottom hairline. On hover, the row gets a faint
 * glass tint and shifts right by `$xxs` to read as a selectable track.
 *
 * The plan asked for 28px right-edge actions, but `IconButton.size` is typed
 * `32 | 36`, so we use 32 — the closest allowed value.
 */
export interface RunRowProps {
  /** Short, uppercased language code rendered prominently (e.g. "EN", "中文"). */
  primaryLang: string;
  /** Engine / translator label rendered inline, low-emphasis (e.g. "whisper-large"). */
  primaryEngine: string;
  /** Mono details below the primary line (e.g. "47 segs · 41s · 1d ago"). */
  secondary: string;
  onPlay: () => void;
  /** Only provided for transcript rows; translation rows omit this. */
  onReRun?: () => void;
  onDelete: () => void;
  /** Disables Play while gating on the mpv install status check. */
  playLoading?: boolean;
}

export function RunRow({
  primaryLang,
  primaryEngine,
  secondary,
  onPlay,
  onReRun,
  onDelete,
  playLoading,
}: RunRowProps) {
  return (
    <XStack
      paddingVertical="$sm"
      paddingHorizontal="$sm"
      borderBottomWidth={1}
      borderBottomColor="$borderSubtle"
      alignItems="center"
      gap="$md"
      hoverStyle={{
        backgroundColor: "$surfaceGlass",
        paddingLeft: "$md",
      }}
      animation="quick"
      cursor="default"
    >
      <Stack
        width={36}
        height={36}
        borderRadius="$pill"
        backgroundColor="$surfaceGlass"
        borderWidth={1}
        borderColor="$borderSubtle"
        alignItems="center"
        justifyContent="center"
        cursor={playLoading ? "not-allowed" : "pointer"}
        opacity={playLoading ? 0.4 : 1}
        hoverStyle={
          playLoading
            ? undefined
            : {
                backgroundColor: "$accentDim",
                borderColor: "$accent",
              }
        }
        pressStyle={playLoading ? undefined : { scale: 0.95 }}
        animation="quick"
        onPress={playLoading ? undefined : onPlay}
        tag="button"
        role="button"
        aria-label="Play"
        flexShrink={0}
      >
        <Play size={14} color="$accent" />
      </Stack>

      <YStack flex={1} gap={2} minWidth={0}>
        <XStack alignItems="baseline" gap="$xs" minWidth={0}>
          <TitleSm numberOfLines={1}>{primaryLang}</TitleSm>
          <Caption color="$textMuted">·</Caption>
          <BodySm color="$textSecondary" numberOfLines={1} flexShrink={1}>
            {primaryEngine}
          </BodySm>
        </XStack>
        <Caption color="$textMuted" fontFamily="$mono" numberOfLines={1}>
          {secondary}
        </Caption>
      </YStack>

      <XStack gap="$xxs" opacity={0.7} animation="quick">
        {onReRun ? (
          <IconButton
            size={44}
            icon={<RefreshCw size={13} color="$textMuted" />}
            aria-label="Re-translate"
            onPress={onReRun}
            backgroundColor="transparent"
            borderColor="transparent"
          />
        ) : null}
        <IconButton
          size={44}
          icon={<Trash2 size={13} color="$textMuted" />}
          aria-label="Delete"
          onPress={onDelete}
          backgroundColor="transparent"
          borderColor="transparent"
        />
      </XStack>
    </XStack>
  );
}
