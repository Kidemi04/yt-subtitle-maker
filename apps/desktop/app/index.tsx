import { Stack, Text, XStack, YStack } from "tamagui";

/**
 * Phase 2 — token verification surface.
 *
 * Every visual property here is sourced from tamagui.config.ts tokens
 * (no hardcoded hex). The screenshot for this screen proves the token
 * system + font loading both took effect:
 *   - bg "$bgBase" → almost-black warm dark
 *   - Fraunces serif heading
 *   - Inter sans-serif body / chip
 *   - JetBrains Mono timestamp
 *   - "$accent" / "$accentSoft" / "$accentDim" sunset-orange chip
 *   - glass-mid surface + "$borderStrong" outline
 */
export default function Index() {
  return (
    <YStack
      flex={1}
      bg="$bgBase"
      padding="$xl"
      gap="$lg"
      justifyContent="center"
      alignItems="center"
    >
      <Text
        fontFamily="$display"
        fontSize={56}
        lineHeight={59}
        letterSpacing={-1.5}
        color="$textPrimary"
      >
        yt-subtitle-maker
      </Text>

      <Text
        fontFamily="$body"
        fontSize={14}
        lineHeight={22}
        color="$textSecondary"
      >
        Phase 2 — design tokens online
      </Text>

      <XStack gap="$sm">
        {/* Accent chip — proves $accent / $accentSoft / $accentDim resolve */}
        <Stack
          bg="$accentSoft"
          borderColor="$accentDim"
          borderWidth={1}
          borderRadius="$pill"
          paddingHorizontal="$md"
          paddingVertical="$xs"
        >
          <Text
            fontFamily="$body"
            fontSize={12}
            fontWeight="600"
            color="$accent"
          >
            accent #fb923c
          </Text>
        </Stack>

        {/* Mono chip — proves JetBrains Mono loaded with tabular figures */}
        <Stack
          bg="$surfaceGlass"
          borderColor="$borderSubtle"
          borderWidth={1}
          borderRadius="$pill"
          paddingHorizontal="$md"
          paddingVertical="$xs"
        >
          <Text
            fontFamily="$mono"
            fontSize={11}
            color="$textMuted"
            // tabular figures so digits sit on a fixed grid — the visual
            // payoff of using a mono font for timestamps.
            style={{ fontFeatureSettings: "'tnum'" }}
          >
            12:34:56.789
          </Text>
        </Stack>
      </XStack>

      {/* Glass-mid card — exercises a surface, border, radius and bodyMd */}
      <Stack
        bg="$surfaceGlassMid"
        borderColor="$borderStrong"
        borderWidth={1}
        borderRadius="$lg"
        padding="$lg"
        maxWidth={480}
      >
        <Text
          fontFamily="$body"
          fontSize={13}
          lineHeight={20}
          color="$textSecondary"
        >
          Spacing $xxs–$section / radius $xs–$pill / colors 15 / typography 13
          styles / 4 durations + 4 easings.
        </Text>
      </Stack>
    </YStack>
  );
}
