import { Library as LibraryIconLucide } from "@tamagui/lucide-icons";
import { Stack, YStack } from "tamagui";
import { BodyMd, DisplayLg, HeroCard } from "@yt-subtitle-maker/ui";

/**
 * EmptyRightPane — editorial empty state for the right pane.
 *
 * A `HeroCard` with a compact 96x96 icon well (down from 120 — the previous
 * version felt overstated). Headline uses `DisplayLg` (Fraunces) and the
 * body line is italicised `BodyMd` to lean into the magazine feel. A soft
 * `$accentSoft` halo sits behind the icon for warmth.
 */
export function EmptyRightPane({ libraryEmpty }: { libraryEmpty: boolean }) {
  return (
    <YStack flex={1} alignItems="center" justifyContent="center" padding="$lg">
      <HeroCard variant="mid">
        <YStack alignItems="center" gap="$md" paddingVertical="$lg">
          <Stack
            width={96}
            height={96}
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
            <LibraryIconLucide size={40} color="$textMuted" />
          </Stack>
          <YStack alignItems="center" gap="$xs" maxWidth={400}>
            <DisplayLg textAlign="center">
              {libraryEmpty ? "Your library is empty" : "Pick a video"}
            </DisplayLg>
            <BodyMd
              color="$textSecondary"
              textAlign="center"
              fontStyle="italic"
            >
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
