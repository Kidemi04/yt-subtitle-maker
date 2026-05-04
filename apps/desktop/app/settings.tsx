import { Text, YStack } from "tamagui";
import { GlassCard } from "@yt-subtitle-maker/ui";

export default function Settings() {
  return (
    <YStack gap="$lg">
      <Text
        fontFamily="$display"
        fontSize={32}
        letterSpacing={-0.8}
        color="$textPrimary"
      >
        Settings
      </Text>
      <GlassCard variant="mid">
        <Text fontFamily="$body" fontSize={13} color="$textSecondary">
          5 sections (General, Cookies, STT engine, Translation, Advanced)
          land in Phase 11.
        </Text>
      </GlassCard>
    </YStack>
  );
}
