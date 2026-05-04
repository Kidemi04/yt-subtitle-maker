import * as React from "react";
import { ScrollView, Stack, Text, XStack, YStack } from "tamagui";
import {
  BadgeAccent,
  BadgePill,
  GlassCard,
  ProgressBar,
  StatusDot,
  StepPill,
} from "@yt-subtitle-maker/ui";

/**
 * Phase 5 — status / badge component verification surface.
 *
 * Visually exercises every component shipped from @yt-subtitle-maker/ui in
 * Phase 5 (BadgePill, BadgeAccent, ProgressBar, StepPill, StatusDot). The
 * accent-orange "blob" sits behind the cards so the glass `backdropFilter:
 * blur(...)` is visible — if the blob looks crisp through a card, the blur
 * isn't being applied. Layout is two-column so the full Phase 5 surface fits
 * inside a 1440×900 capture without scrolling.
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

function SmallLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text fontFamily="$body" fontSize={13} color="$textSecondary">
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
        top={120}
        left={120}
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
        bottom={80}
        right={140}
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
          paddingVertical: 32,
          paddingHorizontal: 24,
        }}
      >
        <YStack width="100%" maxWidth={1240} gap="$lg">
          <YStack gap="$xs">
            <Text
              fontFamily="$display"
              fontSize={32}
              lineHeight={36}
              letterSpacing={-0.8}
              color="$textPrimary"
            >
              Phase 5 — status & badges
            </Text>
            <Text
              fontFamily="$body"
              fontSize={13}
              lineHeight={20}
              color="$textSecondary"
            >
              Five status/badge components from @yt-subtitle-maker/ui composed
              against the token system shipped in Phase 2.
            </Text>
          </YStack>

          <XStack gap="$lg" flexWrap="wrap">
            {/* LEFT COLUMN */}
            <YStack flex={1} minWidth={520} gap="$md">
              {/* BadgePill — one per tone */}
              <YStack gap="$xs">
                <CaptionLabel>BadgePill — tones</CaptionLabel>
                <GlassCard variant="low">
                  <XStack gap="$xs" flexWrap="wrap" alignItems="center">
                    <BadgePill tone="neutral">Neutral</BadgePill>
                    <BadgePill tone="accent">Accent</BadgePill>
                    <BadgePill tone="success">Success</BadgePill>
                    <BadgePill tone="warning">Warning</BadgePill>
                    <BadgePill tone="error">Error</BadgePill>
                  </XStack>
                </GlassCard>
              </YStack>

              {/* BadgeAccent */}
              <YStack gap="$xs">
                <CaptionLabel>BadgeAccent</CaptionLabel>
                <GlassCard variant="low">
                  <XStack gap="$sm" alignItems="center">
                    <BadgeAccent>RECOMMENDED</BadgeAccent>
                    <SmallLabel>Inter 11 / 600 · letterSpacing 1.5</SmallLabel>
                  </XStack>
                </GlassCard>
              </YStack>

              {/* ProgressBar */}
              <YStack gap="$xs">
                <CaptionLabel>ProgressBar</CaptionLabel>
                <GlassCard variant="low">
                  <YStack gap="$md">
                    <YStack gap="$xs">
                      <SmallLabel>Determinate · value 0.6</SmallLabel>
                      <ProgressBar value={0.6} />
                    </YStack>
                    <YStack gap="$xs">
                      <SmallLabel>Indeterminate · barber-pole</SmallLabel>
                      <ProgressBar indeterminate />
                    </YStack>
                  </YStack>
                </GlassCard>
              </YStack>
            </YStack>

            {/* RIGHT COLUMN */}
            <YStack flex={1} minWidth={520} gap="$md">
              {/* StepPill */}
              <YStack gap="$xs">
                <CaptionLabel>StepPill — process flow</CaptionLabel>
                <GlassCard variant="low">
                  <XStack gap="$xs" flexWrap="wrap" alignItems="center">
                    <StepPill status="done">Download</StepPill>
                    <StepPill status="active">Transcribe</StepPill>
                    <StepPill status="pending">Translate</StepPill>
                    <StepPill status="pending">Done</StepPill>
                  </XStack>
                </GlassCard>
              </YStack>

              {/* StatusDot */}
              <YStack gap="$xs">
                <CaptionLabel>StatusDot</CaptionLabel>
                <GlassCard variant="low">
                  <YStack gap="$sm">
                    <XStack alignItems="center" gap="$sm">
                      <StatusDot status="ok" />
                      <SmallLabel>OK · pulsing (default)</SmallLabel>
                    </XStack>
                    <XStack alignItems="center" gap="$sm">
                      <StatusDot status="warning" />
                      <SmallLabel>Warning</SmallLabel>
                    </XStack>
                    <XStack alignItems="center" gap="$sm">
                      <StatusDot status="error" />
                      <SmallLabel>Error</SmallLabel>
                    </XStack>
                    <XStack alignItems="center" gap="$sm">
                      <StatusDot status="untested" />
                      <SmallLabel>Untested · no pulse</SmallLabel>
                    </XStack>
                  </YStack>
                </GlassCard>
              </YStack>
            </YStack>
          </XStack>
        </YStack>
      </ScrollView>
    </Stack>
  );
}
