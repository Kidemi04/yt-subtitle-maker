import { Stack, XStack, YStack } from "tamagui";
import { ArrowUpRight, Github, FileText, Bug } from "@tamagui/lucide-icons";
import {
  GlassCard,
  BadgePill,
  DisplayLg,
  TitleMd,
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

const TECH_PILLS = [
  "Tauri",
  "Expo",
  "Tamagui",
  "FastAPI",
  "yt-dlp",
  "OpenAI Whisper",
  "faster-whisper",
  "Google Gemini",
  "FFmpeg",
  "MPV",
];

// Build metadata. App version comes from package.json; backend version is fetched
// from /api/version on demand if/when wired. Build date is set at build time;
// for the dev build we render "dev" rather than guessing.
const APP_VERSION = "2.0.0-alpha";
const BUILD_DATE = "dev";
const PLATFORM_LABEL =
  typeof navigator === "undefined" ? "—" : navigator.platform || "—";

export default function About() {
  return (
    <YStack gap="$lg">
      {/* Hero — no pre-heading badge per spec ("No logo mark — heading only"). */}
      <YStack alignItems="center" gap="$xs" paddingVertical="$xl">
        <DisplayLg>YT Subtitle Maker</DisplayLg>
        <BodyMd color="$textSecondary" textAlign="center">
          A desktop-first transcription studio. Whisper or YouTube
          captions, then translation via Gemini or any local AI.
        </BodyMd>
      </YStack>

      {/* Version grid — 2×2, JetBrains Mono values per spec */}
      <GlassCard variant="mid">
        <XStack flexWrap="wrap" gap="$lg">
          <YStack gap="$xxs" flex={1} minWidth={200}>
            <CaptionUpper>App version</CaptionUpper>
            <Code>{APP_VERSION}</Code>
          </YStack>
          <YStack gap="$xxs" flex={1} minWidth={200}>
            <CaptionUpper>Backend version</CaptionUpper>
            <Code>fetched on start</Code>
          </YStack>
          <YStack gap="$xxs" flex={1} minWidth={200}>
            <CaptionUpper>Build date</CaptionUpper>
            <Code>{BUILD_DATE}</Code>
          </YStack>
          <YStack gap="$xxs" flex={1} minWidth={200}>
            <CaptionUpper>Platform</CaptionUpper>
            <Code>{PLATFORM_LABEL}</Code>
          </YStack>
        </XStack>
      </GlassCard>

      {/* Resources */}
      <GlassCard variant="mid">
        <YStack gap="$md">
          <TitleMd>Resources</TitleMd>
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
            <BadgePill key={t} tone="neutral" font="mono">
              {t}
            </BadgePill>
          ))}
        </XStack>
      </YStack>

      {/* Footer */}
      <Caption color="$textMuted" textAlign="center" marginTop="$md">
        MIT License · © 2026
      </Caption>
    </YStack>
  );
}
