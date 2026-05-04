import { Stack, XStack, YStack } from "tamagui";
import { ArrowUpRight, Github, FileText, Bug } from "@tamagui/lucide-icons";
import {
  GlassCard,
  BadgeAccent,
  BadgePill,
  DisplayLg,
  TitleSm,
  BodyMd,
  Caption,
  CaptionUpper,
  Code,
} from "@yt-subtitle-maker/ui";

interface ResourceLink {
  href: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
}

const RESOURCES: ResourceLink[] = [
  {
    href: "#",
    label: "Open repo on GitHub",
    description: "Source, issues, discussions.",
    icon: Github,
  },
  {
    href: "#",
    label: "Read the spec",
    description: "Design, contract, screen recipes.",
    icon: FileText,
  },
  {
    href: "#",
    label: "Report an issue",
    description: "File a bug or request a feature.",
    icon: Bug,
  },
];

const TECH_PILLS = ["Tauri", "Expo", "Tamagui", "FastAPI", "yt-dlp", "OpenAI Whisper"];

export default function About() {
  return (
    <YStack gap="$lg">
      {/* Hero */}
      <YStack gap="$xs">
        <XStack>
          <BadgeAccent>v2.0 · alpha</BadgeAccent>
        </XStack>
        <DisplayLg>YT Subtitle Maker</DisplayLg>
        <BodyMd color="$textSecondary">
          A desktop-first transcription studio. Whisper or YouTube
          captions, then translation via Gemini or any local AI.
        </BodyMd>
      </YStack>

      {/* Stack */}
      <GlassCard variant="mid">
        <YStack gap="$md">
          <CaptionUpper>Stack</CaptionUpper>
          <XStack gap="$xl" flexWrap="wrap">
            <YStack gap="$xxs" flex={1} minWidth={220}>
              <CaptionUpper>Frontend</CaptionUpper>
              <Code>Tauri 2 · Expo 51 · Tamagui 1.115</Code>
            </YStack>
            <YStack gap="$xxs" flex={1} minWidth={220}>
              <CaptionUpper>Backend</CaptionUpper>
              <Code>FastAPI · faster-whisper · Gemini</Code>
            </YStack>
          </XStack>
        </YStack>
      </GlassCard>

      {/* Resources */}
      <GlassCard variant="mid">
        <YStack gap="$md">
          <CaptionUpper>Resources</CaptionUpper>
          <YStack gap="$xs">
            {RESOURCES.map((r) => {
              const Icon = r.icon;
              return (
                <XStack
                  key={r.label}
                  alignItems="center"
                  gap="$sm"
                  padding="$sm"
                  borderRadius="$md"
                  backgroundColor="$surfaceGlass"
                  borderWidth={1}
                  borderColor="$borderSubtle"
                  cursor="pointer"
                  hoverStyle={{ borderColor: "$borderStrong" }}
                  animation="quick"
                  // TODO: wire real URLs once we have a public repo + spec link.
                  onPress={() => {
                    if (typeof window !== "undefined" && r.href !== "#") {
                      window.open(r.href, "_blank");
                    }
                  }}
                >
                  <Stack
                    width={36}
                    height={36}
                    borderRadius="$sm"
                    backgroundColor="$accentSoft"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Icon size={16} color="$accent" />
                  </Stack>
                  <YStack flex={1} gap={2}>
                    <TitleSm color="$accent">{r.label}</TitleSm>
                    <Caption>{r.description}</Caption>
                  </YStack>
                  <ArrowUpRight size={16} color="$textMuted" />
                </XStack>
              );
            })}
          </YStack>
        </YStack>
      </GlassCard>

      {/* Tech credits */}
      <YStack gap="$xs">
        <CaptionUpper>Built with</CaptionUpper>
        <XStack gap="$xs" flexWrap="wrap">
          {TECH_PILLS.map((t) => (
            <BadgePill key={t} tone="neutral">
              {t}
            </BadgePill>
          ))}
        </XStack>
      </YStack>

      {/* Footer */}
      <Caption color="$textMuted" textAlign="center" marginTop="$md">
        MIT licensed · Made by Kelvin
      </Caption>
    </YStack>
  );
}
