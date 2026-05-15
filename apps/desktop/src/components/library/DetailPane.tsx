import { useState } from "react";
import { Trash2 } from "@tamagui/lucide-icons";
import { ScrollView, Stack, XStack, YStack } from "tamagui";
import { BodySm, ButtonSecondary, GlassCard } from "@yt-subtitle-maker/ui";
import { useLibrary } from "../../state/library";
import { useDependencies } from "../../state/dependencies";
import { apiClient } from "../../state/client";
import { DetailHeader } from "./DetailHeader";
import { TranscriptsSection } from "./TranscriptsSection";
import { TranslationsSection } from "./TranslationsSection";
import { EmptyRightPane } from "./EmptyRightPane";
import { InstallMpvDialog } from "../dependencies/InstallMpvDialog";
import { NewTranscribeModal } from "../NewTranscribeModal";
import { NewTranslationModal } from "../NewTranslationModal";

/**
 * DetailPane — right-pane container that renders the selected video's
 * full detail (header + transcripts + translations + delete footer), or
 * an empty/skeleton state. Owns the two action modals
 * (`NewTranscribeModal`, `NewTranslationModal`) and gates Play actions
 * on mpv being installed — if it isn't, opens `InstallMpvDialog` and
 * replays the queued play action on successful install.
 *
 * The plan's `ButtonDestructive` doesn't exist; we approximate it with
 * `ButtonSecondary` + `borderColor="$error"` + a leading `Trash2` icon,
 * matching how Re-transcribe / Re-translate are styled in Task 11.
 */
export function DetailPane() {
  const items = useLibrary((s) => s.items);
  const selectedId = useLibrary((s) => s.selectedId);
  const detail = useLibrary((s) => s.detail);
  const loadingDetail = useLibrary((s) => s.loadingDetail);
  const deleteVideo = useLibrary((s) => s.deleteVideo);
  const refreshDetail = useLibrary((s) => s.refreshDetail);

  const mpv = useDependencies((s) => s.mpv);

  const [installOpen, setInstallOpen] = useState(false);
  // Stored as a thunk inside another thunk so React's setState doesn't
  // immediately invoke the action when we set it (functional updates).
  const [pendingPlay, setPendingPlay] = useState<null | (() => Promise<void>)>(
    null,
  );
  const [newTranscribeOpen, setNewTranscribeOpen] = useState(false);
  const [newTranslationOpen, setNewTranslationOpen] = useState(false);
  const [translationSourceId, setTranslationSourceId] = useState<
    string | undefined
  >();

  if (!selectedId) {
    return <EmptyRightPane libraryEmpty={items.length === 0} />;
  }

  const playGated = (action: () => Promise<void>) => {
    if (mpv?.installed) {
      void action();
    } else {
      setPendingPlay(() => action);
      setInstallOpen(true);
    }
  };

  const handlePlayTranscript = (transcribeId: string) => {
    playGated(() =>
      apiClient.playMpv(selectedId, { transcribeId }).then(() => undefined),
    );
  };
  const handlePlayTranslation = (translateId: string) => {
    playGated(() =>
      apiClient.playMpv(selectedId, { translateId }).then(() => undefined),
    );
  };

  const handleReTranslateFrom = (transcribeId: string) => {
    setTranslationSourceId(transcribeId);
    setNewTranslationOpen(true);
  };

  if (!detail && loadingDetail) {
    return (
      <YStack flex={1} padding="$lg" minWidth={0}>
        <GlassCard variant="low" flex={1} gap="$md">
          <Stack height={90} borderRadius="$sm" backgroundColor="$surfaceGlass" />
          <Stack height={120} borderRadius="$sm" backgroundColor="$surfaceGlass" />
          <Stack height={120} borderRadius="$sm" backgroundColor="$surfaceGlass" />
        </GlassCard>
      </YStack>
    );
  }

  if (!detail) {
    return <EmptyRightPane libraryEmpty={items.length === 0} />;
  }

  return (
    <YStack flex={1} minWidth={0} padding="$lg">
      <GlassCard variant="mid" flex={1} padding="$lg" gap="$lg" minWidth={0}>
        <DetailHeader detail={detail} />

        <ScrollView flex={1}>
          <YStack gap="$lg" paddingBottom="$md">
            <TranscriptsSection
              videoId={selectedId}
              transcribes={detail.transcribes}
              onPlayTranscript={handlePlayTranscript}
              onReTranscribe={() => setNewTranscribeOpen(true)}
              onReTranslateFrom={handleReTranslateFrom}
            />
            <TranslationsSection
              videoId={selectedId}
              transcribes={detail.transcribes}
              translations={detail.translations}
              onPlayTranslation={handlePlayTranslation}
              onReTranslate={() => {
                setTranslationSourceId(undefined);
                setNewTranslationOpen(true);
              }}
            />
          </YStack>
        </ScrollView>

        <XStack
          marginTop="$md"
          paddingTop="$md"
          borderTopWidth={1}
          borderTopColor="$borderSubtle"
          justifyContent="flex-end"
        >
          <ButtonSecondary
            onPress={() => {
              if (
                window.confirm(
                  "Delete this video and all its transcripts/translations?",
                )
              ) {
                void deleteVideo(selectedId);
              }
            }}
            height={32}
            paddingHorizontal="$sm"
            borderColor="$error"
          >
            <XStack gap="$xs" alignItems="center">
              <Trash2 size={14} color="$error" />
              <BodySm fontWeight="500" color="$error">
                Delete entire video
              </BodySm>
            </XStack>
          </ButtonSecondary>
        </XStack>
      </GlassCard>

      <NewTranscribeModal
        open={newTranscribeOpen}
        onOpenChange={setNewTranscribeOpen}
        videoId={selectedId}
        onComplete={() => void refreshDetail()}
      />
      <NewTranslationModal
        open={newTranslationOpen}
        onOpenChange={setNewTranslationOpen}
        videoId={selectedId}
        transcribes={detail.transcribes}
        initialSourceTranscribeId={translationSourceId}
        onComplete={() => void refreshDetail()}
      />
      <InstallMpvDialog
        open={installOpen}
        onOpenChange={setInstallOpen}
        onInstalled={() => {
          const action = pendingPlay;
          setPendingPlay(null);
          if (action) void action();
        }}
      />
    </YStack>
  );
}
