import { Text, YStack } from "tamagui";
import { GlassCard } from "@yt-subtitle-maker/ui";

export default function Library() {
  return (
    <YStack gap="$lg">
      <Text
        fontFamily="$display"
        fontSize={32}
        letterSpacing={-0.8}
        color="$textPrimary"
      >
        Your library
      </Text>
      <GlassCard variant="mid">
        <Text fontFamily="$body" fontSize={13} color="$textSecondary">
          Library grid lands in Phase 9. Will list all locally stored media +
          SRT files in a 4-up grid with filter chips and search.
        </Text>
      </GlassCard>
    </YStack>
  );
}
