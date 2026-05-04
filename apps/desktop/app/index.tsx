import * as React from "react";
import { ScrollView, Stack, Text, XStack, YStack } from "tamagui";
import { Settings, X } from "@tamagui/lucide-icons";
import {
  ButtonGhost,
  ButtonPrimary,
  ButtonSecondary,
  GlassCard,
  HeroCard,
  IconButton,
} from "@yt-subtitle-maker/ui";

/**
 * Phase 3 — foundation-component verification surface.
 *
 * Visually exercises every component shipped from @yt-subtitle-maker/ui in
 * Phase 3. The accent-orange "blob" sits behind the cards so the glass
 * `backdropFilter: blur(...)` becomes visible — if the blob looks crisp
 * through a card, the blur isn't being applied.
 */

function CaptionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text
      fontFamily="$body"
      fontSize={11}
      fontWeight="600"
      letterSpacing={1.5}
      textTransform="uppercase"
      color="$textMuted"
    >
      {children}
    </Text>
  );
}

export default function Index() {
  return (
    <Stack flex={1} bg="$bgBase" position="relative" overflow="hidden">
      {/* Accent blobs — give the glass cards something to blur. */}
      <Stack
        position="absolute"
        top={180}
        left={140}
        width={320}
        height={320}
        borderRadius="$pill"
        backgroundColor="$accent"
        opacity={0.22}
        pointerEvents="none"
        style={{ filter: "blur(40px)" }}
      />
      <Stack
        position="absolute"
        bottom={120}
        right={180}
        width={260}
        height={260}
        borderRadius="$pill"
        backgroundColor="$accent"
        opacity={0.16}
        pointerEvents="none"
        style={{ filter: "blur(50px)" }}
      />

      <ScrollView
        flex={1}
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: "center",
          paddingVertical: 64,
          paddingHorizontal: 24,
        }}
      >
        <YStack width="100%" maxWidth={720} gap="$xl">
          <YStack gap="$xs">
            <Text
              fontFamily="$display"
              fontSize={40}
              lineHeight={44}
              letterSpacing={-1}
              color="$textPrimary"
            >
              Phase 3 — foundation
            </Text>
            <Text
              fontFamily="$body"
              fontSize={14}
              lineHeight={22}
              color="$textSecondary"
            >
              Six components from @yt-subtitle-maker/ui composed against the
              token system shipped in Phase 2.
            </Text>
          </YStack>

          {/* GlassCard — mid variant (default surface) */}
          <YStack gap="$sm">
            <CaptionLabel>GlassCard / mid</CaptionLabel>
            <GlassCard>
              <YStack gap="$xs">
                <Text
                  fontFamily="$body"
                  fontSize={15}
                  fontWeight="600"
                  color="$textPrimary"
                >
                  Default surface
                </Text>
                <Text
                  fontFamily="$body"
                  fontSize={13}
                  lineHeight={20}
                  color="$textSecondary"
                >
                  glassMid recipe: rgba(255,255,255,0.06) bg, blur(40px)
                  saturate(180%). Radius $lg, padding $lg.
                </Text>
              </YStack>
            </GlassCard>
          </YStack>

          {/* HeroCard — XL radius/padding for splash + URL hero */}
          <YStack gap="$sm">
            <CaptionLabel>HeroCard</CaptionLabel>
            <HeroCard>
              <YStack gap="$md">
                <Text
                  fontFamily="$display"
                  fontSize={28}
                  lineHeight={34}
                  letterSpacing={-0.5}
                  color="$textPrimary"
                >
                  Make any video readable
                </Text>
                <Stack
                  height={56}
                  borderRadius="$md"
                  backgroundColor="$surfaceGlass"
                  borderWidth={1}
                  borderColor="$borderSubtle"
                  paddingHorizontal="$md"
                  justifyContent="center"
                >
                  <Text
                    fontFamily="$body"
                    fontSize={14}
                    color="$textMuted"
                  >
                    Paste a YouTube URL…
                  </Text>
                </Stack>
              </YStack>
            </HeroCard>
          </YStack>

          {/* Buttons — primary + secondary + ghost */}
          <YStack gap="$sm">
            <CaptionLabel>Buttons</CaptionLabel>
            <GlassCard variant="low">
              <YStack gap="$md">
                <ButtonPrimary onPress={() => {}}>
                  Generate Subtitles
                </ButtonPrimary>
                <XStack gap="$sm">
                  <ButtonSecondary onPress={() => {}} flex={1}>
                    Cancel
                  </ButtonSecondary>
                  <ButtonGhost onPress={() => {}} flex={1}>
                    Discard
                  </ButtonGhost>
                </XStack>
              </YStack>
            </GlassCard>
          </YStack>

          {/* IconButtons */}
          <YStack gap="$sm">
            <CaptionLabel>IconButton</CaptionLabel>
            <GlassCard variant="low">
              <XStack gap="$md" alignItems="center">
                <IconButton
                  icon={<X size={16} color="#a1a1a6" />}
                  onPress={() => {}}
                  aria-label="Close"
                />
                <IconButton
                  icon={<Settings size={16} color="#a1a1a6" />}
                  size={32}
                  onPress={() => {}}
                  aria-label="Open settings"
                />
                <Text
                  fontFamily="$body"
                  fontSize={13}
                  color="$textSecondary"
                >
                  36px (default) and 32px circles, glassLow surface.
                </Text>
              </XStack>
            </GlassCard>
          </YStack>

          {/* GlassCard — high variant (modal/sheet surface) */}
          <YStack gap="$sm">
            <CaptionLabel>GlassCard / high</CaptionLabel>
            <GlassCard variant="high">
              <Text
                fontFamily="$body"
                fontSize={13}
                lineHeight={20}
                color="$textSecondary"
              >
                glassHigh recipe: heavier blur(60px) saturate(200%) plus a
                drop shadow for modals and action sheets.
              </Text>
            </GlassCard>
          </YStack>
        </YStack>
      </ScrollView>
    </Stack>
  );
}
