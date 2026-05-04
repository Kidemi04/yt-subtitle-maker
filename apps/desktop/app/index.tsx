import * as React from "react";
import { ScrollView, Stack, Text, XStack, YStack } from "tamagui";
import {
  Film,
  Library as LibraryIcon,
  History as HistoryIcon,
  Settings as SettingsIcon,
  Play,
  FolderOpen,
  Trash2,
  Info,
} from "@tamagui/lucide-icons";
import {
  ActionSheet,
  ButtonPrimary,
  ButtonSecondary,
  GlassCard,
  Modal,
  SidebarItem,
  Toast,
  Tooltip,
} from "@yt-subtitle-maker/ui";

/**
 * Phase 6 — layout / overlay component verification surface.
 *
 * Visually exercises every component shipped from @yt-subtitle-maker/ui in
 * Phase 6 (SidebarItem, Modal, ActionSheet, Toast, Tooltip). For the
 * screenshot we open Modal + ActionSheet by default — both surfaces need to
 * be visible in the same capture, not gated behind interaction.
 *
 * Accent blobs sit behind the content so the glass `backdropFilter:
 * blur(...)` can be visually verified — a crisp blob through any glass
 * surface means blur isn't applying.
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
  // Default to OPEN so the Phase 6 screenshot shows the overlay surfaces.
  const [modalOpen, setModalOpen] = React.useState(true);
  const [sheetOpen, setSheetOpen] = React.useState(true);
  const [toastOpen, setToastOpen] = React.useState(true);
  const [successToastOpen, setSuccessToastOpen] = React.useState(true);
  const [activeNav, setActiveNav] = React.useState("generate");

  return (
    <Stack flex={1} bg="$bgBase" position="relative" overflow="hidden">
      {/* Accent blobs — give the glass surfaces something to blur. */}
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
              Phase 6 — layout & overlay
            </Text>
            <Text
              fontFamily="$body"
              fontSize={13}
              lineHeight={20}
              color="$textSecondary"
            >
              Five layout/overlay components from @yt-subtitle-maker/ui:
              SidebarItem, Modal, ActionSheet, Toast, Tooltip.
            </Text>
          </YStack>

          <XStack gap="$lg" alignItems="flex-start" flexWrap="wrap">
            {/* LEFT — Sidebar mock */}
            <YStack gap="$xs">
              <CaptionLabel>SidebarItem · 240px sidebar</CaptionLabel>
              <GlassCard variant="mid" width={240} padding="$sm">
                <YStack gap={4}>
                  <SidebarItem
                    icon={
                      <Film
                        size={16}
                        color={activeNav === "generate" ? "#fb923c" : "#a1a1a6"}
                      />
                    }
                    label="Generate"
                    active={activeNav === "generate"}
                    onPress={() => setActiveNav("generate")}
                  />
                  <SidebarItem
                    icon={
                      <LibraryIcon
                        size={16}
                        color={activeNav === "library" ? "#fb923c" : "#a1a1a6"}
                      />
                    }
                    label="Library"
                    active={activeNav === "library"}
                    onPress={() => setActiveNav("library")}
                  />
                  <SidebarItem
                    icon={
                      <HistoryIcon
                        size={16}
                        color={activeNav === "history" ? "#fb923c" : "#a1a1a6"}
                      />
                    }
                    label="History"
                    active={activeNav === "history"}
                    onPress={() => setActiveNav("history")}
                  />
                  <SidebarItem
                    icon={
                      <SettingsIcon
                        size={16}
                        color={activeNav === "settings" ? "#fb923c" : "#a1a1a6"}
                      />
                    }
                    label="Settings"
                    active={activeNav === "settings"}
                    onPress={() => setActiveNav("settings")}
                  />
                </YStack>
              </GlassCard>
            </YStack>

            {/* RIGHT — triggers + tooltip */}
            <YStack flex={1} minWidth={420} gap="$md">
              <YStack gap="$xs">
                <CaptionLabel>Modal · centered overlay</CaptionLabel>
                <GlassCard variant="low">
                  <XStack gap="$sm" alignItems="center">
                    <ButtonPrimary onPress={() => setModalOpen(true)}>
                      Open modal
                    </ButtonPrimary>
                    <SmallLabel>Click to re-open the centered modal</SmallLabel>
                  </XStack>
                </GlassCard>
              </YStack>

              <YStack gap="$xs">
                <CaptionLabel>ActionSheet · 260px width</CaptionLabel>
                <GlassCard variant="low">
                  <XStack gap="$sm" alignItems="center">
                    <ButtonSecondary onPress={() => setSheetOpen(true)}>
                      Show actions
                    </ButtonSecondary>
                    <SmallLabel>3 actions, last is destructive</SmallLabel>
                  </XStack>
                </GlassCard>
              </YStack>

              <YStack gap="$xs">
                <CaptionLabel>Tooltip · inline ⓘ explainer</CaptionLabel>
                <GlassCard variant="low">
                  <XStack gap="$sm" alignItems="center">
                    <Tooltip content="This is a Whisper engine that runs locally on your machine. Models range from 80MB (tiny) to 3GB (large-v3).">
                      <XStack
                        alignItems="center"
                        gap="$xs"
                        cursor="help"
                        paddingHorizontal="$sm"
                        paddingVertical="$xs"
                        borderRadius="$sm"
                        backgroundColor="$surfaceGlass"
                      >
                        <Info size={14} color="#a1a1a6" />
                        <Text
                          fontFamily="$body"
                          fontSize={13}
                          color="$textSecondary"
                        >
                          Hover me
                        </Text>
                      </XStack>
                    </Tooltip>
                    <SmallLabel>Glass-high surface, max-w 320</SmallLabel>
                  </XStack>
                </GlassCard>
              </YStack>

              <YStack gap="$xs">
                <CaptionLabel>Toast · bottom-center · two tones</CaptionLabel>
                <GlassCard variant="low">
                  <SmallLabel>
                    Two toasts render fixed at the bottom of the viewport
                    (neutral + success). Both have close buttons.
                  </SmallLabel>
                </GlassCard>
              </YStack>
            </YStack>
          </XStack>
        </YStack>
      </ScrollView>

      {/* Modal — open by default for screenshot */}
      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title="Library detail"
        width={520}
      >
        <YStack gap="$md">
          <Text
            fontFamily="$body"
            fontSize={14}
            lineHeight={22}
            color="$textSecondary"
          >
            Sample modal body. The Library Detail Modal (Screen 8) renders
            video metadata, file rows, processing info, and a footer with
            Open-folder + Delete actions. Phase 6 ships only the surface — the
            content composition is Phase 8+.
          </Text>
          <XStack gap="$sm" justifyContent="flex-end">
            <ButtonSecondary onPress={() => setModalOpen(false)}>
              Close
            </ButtonSecondary>
            <ButtonPrimary onPress={() => setModalOpen(false)}>
              Open folder
            </ButtonPrimary>
          </XStack>
        </YStack>
      </Modal>

      {/* ActionSheet — open by default for screenshot */}
      <ActionSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        actions={[
          {
            label: "Play",
            icon: <Play size={14} color="#a1a1a6" />,
            onPress: () => {},
          },
          {
            label: "Open folder",
            icon: <FolderOpen size={14} color="#a1a1a6" />,
            onPress: () => {},
          },
          {
            label: "Delete",
            icon: <Trash2 size={14} color="#ff5a5f" />,
            onPress: () => {},
            destructive: true,
          },
        ]}
      />

      {/* Toasts — both default-open for screenshot. The neutral toast sits
          at the default 32px from bottom; the success one stacks above it. */}
      <Toast
        open={toastOpen}
        bottom={32}
        onClose={() => setToastOpen(false)}
      >
        Saved settings
      </Toast>
      <Toast
        open={successToastOpen}
        tone="success"
        bottom={96}
        onClose={() => setSuccessToastOpen(false)}
      >
        Saved successfully · success tone
      </Toast>
    </Stack>
  );
}
