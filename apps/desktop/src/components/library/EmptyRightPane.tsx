import { Library as LibraryIcon } from "@tamagui/lucide-icons";
import { Stack, YStack } from "tamagui";
import { BodyMd, DisplayMd } from "@yt-subtitle-maker/ui";

/**
 * EmptyRightPane — placeholder shown in the right pane when either:
 *   - the whole library is empty (libraryEmpty=true), or
 *   - nothing is selected yet on the left list.
 *
 * Visual: a 96x96 glass tile with a Library glyph, a large headline, and
 * one helper line of body copy. No CTA — the user navigates from the
 * left pane (or the Generate tab).
 */
export function EmptyRightPane({ libraryEmpty }: { libraryEmpty: boolean }) {
  return (
    <YStack
      flex={1}
      alignItems="center"
      justifyContent="center"
      gap="$md"
      padding="$lg"
    >
      <Stack
        width={96}
        height={96}
        borderRadius="$xl"
        alignItems="center"
        justifyContent="center"
        backgroundColor="$surfaceGlass"
        borderWidth={1}
        borderColor="$borderSubtle"
      >
        <LibraryIcon size={40} color="$textMuted" />
      </Stack>
      <YStack alignItems="center" gap="$xs" maxWidth={360}>
        <DisplayMd textAlign="center">
          {libraryEmpty ? "Your library is empty" : "Pick a video"}
        </DisplayMd>
        <BodyMd color="$textSecondary" textAlign="center">
          {libraryEmpty
            ? "Generate some subtitles and they'll show up here."
            : "Select a video on the left to see transcripts and translations."}
        </BodyMd>
      </YStack>
    </YStack>
  );
}
