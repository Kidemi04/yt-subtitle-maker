import { Text, YStack } from "tamagui";
import { GlassCard, BadgeAccent } from "@yt-subtitle-maker/ui";

/**
 * Generate — main flow screen (placeholder for Phase 9).
 *
 * Phase 9 fills in:
 *   1. URL-input HeroCard with paste icon + Load button
 *   2. Video preview card (after metadata fetch)
 *   3. Configure card (collapsible) — STT source / language / engine picks
 *   4. Generate ButtonPrimary
 *   5. Processing card with waveform + StepPill row + ProgressBar
 *   6. Result card with SRT preview + action buttons
 */
export default function Generate() {
  return (
    <YStack gap="$lg">
      <YStack gap="$xs">
        <BadgeAccent>placeholder</BadgeAccent>
        <Text
          fontFamily="$display"
          fontSize={40}
          lineHeight={44}
          letterSpacing={-1}
          color="$textPrimary"
        >
          What are we transcribing today?
        </Text>
        <Text fontFamily="$body" fontSize={14} color="$textSecondary">
          Phase 7 (layout shell + routing) is live. Phase 9 fills in the
          Generate flow itself.
        </Text>
      </YStack>

      <GlassCard variant="mid">
        <Text fontFamily="$body" fontSize={13} color="$textSecondary">
          The shell is wired — sidebar nav routes via expo-router's
          useRouter(), the topbar shows the current route's title, ⌘L /
          Ctrl+L is captured (drawer wiring lands in Phase 10), and the
          backend status dot at the bottom of the sidebar will be driven
          off /api/version once Phase 8 ships the api-client package.
        </Text>
      </GlassCard>
    </YStack>
  );
}
