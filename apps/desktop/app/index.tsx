import * as React from "react";
import { ScrollView, Stack, Text, XStack, YStack } from "tamagui";
import {
  Dropdown,
  FilterChip,
  GlassCard,
  RadioCard,
  SegmentedControl,
  TextInput,
  Toggle,
} from "@yt-subtitle-maker/ui";

/**
 * Phase 4 — form-component verification surface.
 *
 * Visually exercises every component shipped from @yt-subtitle-maker/ui in
 * Phase 4 (TextInput, Dropdown, Toggle, RadioCard, FilterChip,
 * SegmentedControl). The accent-orange "blob" sits behind the cards so the
 * glass `backdropFilter: blur(...)` becomes visible — if the blob looks
 * crisp through a card, the blur isn't being applied. Layout is two-column
 * so the full Phase 4 surface fits inside a 1440×900 capture without
 * scrolling.
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

const LANGUAGE_OPTIONS = [
  { label: "Auto-detect", value: "auto" },
  { label: "English", value: "en" },
  { label: "Spanish", value: "es" },
  { label: "Japanese", value: "ja" },
];

type FilterValue = "all" | "video" | "audio" | "srt";
type SegmentedValue = "gemini" | "local" | "openai";

const SEGMENTED_OPTIONS: ReadonlyArray<{
  label: string;
  value: SegmentedValue;
}> = [
  { label: "Gemini", value: "gemini" },
  { label: "Local AI", value: "local" },
  { label: "OpenAI-compat", value: "openai" },
];

export default function Index() {
  const [language, setLanguage] = React.useState<string | undefined>(
    undefined
  );
  const [notifications, setNotifications] = React.useState(false);
  const [autoStart, setAutoStart] = React.useState(true);
  const [selectedModel, setSelectedModel] = React.useState<
    "gemini-2-flash" | "gemini-2-pro"
  >("gemini-2-flash");
  const [filter, setFilter] = React.useState<FilterValue>("all");
  const [provider, setProvider] = React.useState<SegmentedValue>("gemini");

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
              Phase 4 — forms
            </Text>
            <Text
              fontFamily="$body"
              fontSize={13}
              lineHeight={20}
              color="$textSecondary"
            >
              Six form components from @yt-subtitle-maker/ui composed against
              the token system shipped in Phase 2.
            </Text>
          </YStack>

          <XStack gap="$lg" flexWrap="wrap">
            {/* LEFT COLUMN */}
            <YStack flex={1} minWidth={520} gap="$md">
              {/* TextInput */}
              <YStack gap="$xs">
                <CaptionLabel>TextInput</CaptionLabel>
                <GlassCard variant="low">
                  <YStack gap="$sm">
                    <TextInput placeholder="Paste a YouTube URL…" />
                    <TextInput
                      placeholder="Filename prefix"
                      defaultValue="lecture-2026-05-04"
                      autoFocus
                    />
                  </YStack>
                </GlassCard>
              </YStack>

              {/* Dropdown */}
              <YStack gap="$xs">
                <CaptionLabel>Dropdown</CaptionLabel>
                <GlassCard variant="low">
                  <Dropdown
                    value={language}
                    onValueChange={setLanguage}
                    options={LANGUAGE_OPTIONS}
                    placeholder="Source language"
                    aria-label="Source language"
                    width={280}
                  />
                </GlassCard>
              </YStack>

              {/* Toggle */}
              <YStack gap="$xs">
                <CaptionLabel>Toggle</CaptionLabel>
                <GlassCard variant="low">
                  <YStack gap="$sm">
                    <XStack
                      alignItems="center"
                      justifyContent="space-between"
                    >
                      <Text
                        fontFamily="$body"
                        fontSize={14}
                        color="$textPrimary"
                      >
                        Show notifications
                      </Text>
                      <Toggle
                        value={notifications}
                        onValueChange={setNotifications}
                        aria-label="Show notifications"
                      />
                    </XStack>
                    <XStack
                      alignItems="center"
                      justifyContent="space-between"
                    >
                      <Text
                        fontFamily="$body"
                        fontSize={14}
                        color="$textPrimary"
                      >
                        Auto-start jobs
                      </Text>
                      <Toggle
                        value={autoStart}
                        onValueChange={setAutoStart}
                        aria-label="Auto-start jobs"
                      />
                    </XStack>
                  </YStack>
                </GlassCard>
              </YStack>
            </YStack>

            {/* RIGHT COLUMN */}
            <YStack flex={1} minWidth={520} gap="$md">
              {/* RadioCard */}
              <YStack gap="$xs">
                <CaptionLabel>RadioCard</CaptionLabel>
                <GlassCard variant="low">
                  <YStack gap="$sm">
                    <RadioCard
                      selected={selectedModel === "gemini-2-flash"}
                      onPress={() => setSelectedModel("gemini-2-flash")}
                    >
                      <YStack gap={2}>
                        <Text
                          fontFamily="$body"
                          fontSize={14}
                          fontWeight="600"
                          color="$textPrimary"
                        >
                          Gemini 2.0 Flash
                        </Text>
                        <Text
                          fontFamily="$body"
                          fontSize={12}
                          color="$textSecondary"
                        >
                          Fast + cheap. 1M context.
                        </Text>
                      </YStack>
                    </RadioCard>
                    <RadioCard
                      selected={selectedModel === "gemini-2-pro"}
                      onPress={() => setSelectedModel("gemini-2-pro")}
                    >
                      <YStack gap={2}>
                        <Text
                          fontFamily="$body"
                          fontSize={14}
                          fontWeight="600"
                          color="$textPrimary"
                        >
                          Gemini 2.0 Pro
                        </Text>
                        <Text
                          fontFamily="$body"
                          fontSize={12}
                          color="$textSecondary"
                        >
                          Higher quality, slower.
                        </Text>
                      </YStack>
                    </RadioCard>
                  </YStack>
                </GlassCard>
              </YStack>

              {/* FilterChip */}
              <YStack gap="$xs">
                <CaptionLabel>FilterChip</CaptionLabel>
                <GlassCard variant="low">
                  <XStack gap="$xs" flexWrap="wrap">
                    <FilterChip
                      active={filter === "all"}
                      onPress={() => setFilter("all")}
                    >
                      All
                    </FilterChip>
                    <FilterChip
                      active={filter === "video"}
                      onPress={() => setFilter("video")}
                    >
                      Video
                    </FilterChip>
                    <FilterChip
                      active={filter === "audio"}
                      onPress={() => setFilter("audio")}
                    >
                      Audio
                    </FilterChip>
                    <FilterChip
                      active={filter === "srt"}
                      onPress={() => setFilter("srt")}
                    >
                      SRT
                    </FilterChip>
                  </XStack>
                </GlassCard>
              </YStack>

              {/* SegmentedControl */}
              <YStack gap="$xs">
                <CaptionLabel>SegmentedControl</CaptionLabel>
                <GlassCard variant="low">
                  <SegmentedControl<SegmentedValue>
                    options={SEGMENTED_OPTIONS}
                    value={provider}
                    onValueChange={setProvider}
                  />
                </GlassCard>
              </YStack>
            </YStack>
          </XStack>
        </YStack>
      </ScrollView>
    </Stack>
  );
}
