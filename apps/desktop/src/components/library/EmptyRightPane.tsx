import { Library as LibraryIconLucide } from "@tamagui/lucide-icons";
import { Stack, YStack } from "tamagui";
import { BodyMd, DisplayMd, HeroCard } from "@yt-subtitle-maker/ui";

/**
 * EmptyRightPane — placeholder shown in the right pane when either:
 *   - the whole library is empty (libraryEmpty=true), or
 *   - nothing is selected yet on the left list.
 *
 * Visual: a HeroCard with a 120x120 glass tile (and a soft $accentSoft halo
 * behind the icon) hosting the Library glyph, a DisplayMd headline, and one
 * helper line of body copy. No CTA — the user navigates from the left pane
 * (or the Generate tab).
 */
export function EmptyRightPane({ libraryEmpty }: { libraryEmpty: boolean }) {
  return (
    <YStack
      flex={1}
      alignItems="center"
      justifyContent="center"
      padding="$lg"
    >
      <HeroCard variant="mid">
        <YStack alignItems="center" gap="$md" paddingVertical="$lg">
          <Stack
            width={120}
            height={120}
            borderRadius="$xl"
            alignItems="center"
            justifyContent="center"
            backgroundColor="$surfaceGlass"
            borderWidth={1}
            borderColor="$borderSubtle"
            position="relative"
          >
            <Stack
              position="absolute"
              width={32}
              height={32}
              borderRadius="$pill"
              backgroundColor="$accentSoft"
              opacity={0.6}
              style={{ filter: "blur(12px)" }}
            />
            <LibraryIconLucide size={48} color="$textMuted" />
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
      </HeroCard>
    </YStack>
  );
}
