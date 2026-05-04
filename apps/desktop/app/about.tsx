import { Text, YStack, XStack } from "tamagui";
import { GlassCard, BadgeAccent } from "@yt-subtitle-maker/ui";

export default function About() {
  return (
    <YStack gap="$lg">
      <YStack gap="$xs">
        <BadgeAccent>v2.0 · alpha</BadgeAccent>
        <Text
          fontFamily="$display"
          fontSize={40}
          lineHeight={44}
          letterSpacing={-1}
          color="$textPrimary"
        >
          YT Subtitle Maker
        </Text>
        <Text fontFamily="$body" fontSize={14} color="$textSecondary">
          A desktop-first transcription studio. Whisper or YouTube
          captions, then translation via Gemini or any local AI.
        </Text>
      </YStack>

      <GlassCard variant="mid">
        <YStack gap="$md">
          <XStack gap="$xl">
            <YStack gap="$xxs">
              <Text
                fontFamily="$body"
                fontSize={11}
                fontWeight="600"
                letterSpacing={1.5}
                textTransform="uppercase"
                color="$textMuted"
              >
                Frontend
              </Text>
              <Text
                fontFamily="$mono"
                fontSize={12}
                color="$textPrimary"
              >
                Tauri 2 · Expo 51 · Tamagui 1.115
              </Text>
            </YStack>
            <YStack gap="$xxs">
              <Text
                fontFamily="$body"
                fontSize={11}
                fontWeight="600"
                letterSpacing={1.5}
                textTransform="uppercase"
                color="$textMuted"
              >
                Backend
              </Text>
              <Text
                fontFamily="$mono"
                fontSize={12}
                color="$textPrimary"
              >
                FastAPI · faster-whisper · Gemini
              </Text>
            </YStack>
          </XStack>
        </YStack>
      </GlassCard>
    </YStack>
  );
}
