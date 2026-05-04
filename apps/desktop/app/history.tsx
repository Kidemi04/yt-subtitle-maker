import { Text, YStack } from "tamagui";
import { GlassCard } from "@yt-subtitle-maker/ui";

export default function History() {
  return (
    <YStack gap="$lg">
      <Text
        fontFamily="$display"
        fontSize={32}
        letterSpacing={-0.8}
        color="$textPrimary"
      >
        Past sessions
      </Text>
      <GlassCard variant="mid">
        <Text fontFamily="$body" fontSize={13} color="$textSecondary">
          History list lands in Phase 9.
        </Text>
      </GlassCard>
    </YStack>
  );
}
