import { useState } from "react";
import { Trash2 } from "@tamagui/lucide-icons";
import { ScrollView, Stack, XStack, YStack } from "tamagui";
import { BodySm, ButtonSecondary } from "@yt-subtitle-maker/ui";
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
 * DetailPane — chromeless editorial container for the right pane.
 *
 * No outer GlassCard — the content (hero header + section blocks) carries
 * its own visual weight. The header sits flush with the pane padding;
 * a thin hairline separates it from the section stack; the destructive
 * "Delete entire video" button is right-aligned and sticky to the bottom.
 *
 * Owns the two action modals (`NewTranscribeModal`, `NewTranslationModal`)
 * and gates Play actions on mpv being installed.
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
      <YStack flex={1} padding="$lg" gap="$lg" minWidth={0}>
        <Stack height={124} borderRadius="$sm" backgroundColor="$surfaceGlass" />
        <Stack
          height={1}
          backgroundColor="$borderSubtle"
        />
        <Stack height={120} borderRadius="$sm" backgroundColor="$surfaceGlass" />
        <Stack height={120} borderRadius="$sm" backgroundColor="$surfaceGlass" />
      </YStack>
    );
  }

  if (!detail) {
    return <EmptyRightPane libraryEmpty={items.length === 0} />;
  }

  return (
    <YStack flex={1} minWidth={0} padding="$lg" backgroundColor="$bgBase">
      <DetailHeader detail={detail} />

      <Stack
        height={1}
        backgroundColor="$borderSubtle"
        marginTop="$lg"
        marginBottom="$lg"
      />

      <ScrollView flex={1}>
        <YStack gap="$xl" paddingBottom="$lg">
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
          backgroundColor="transparent"
          borderColor="$borderSubtle"
          hoverStyle={{ borderColor: "$error", backgroundColor: "transparent" }}
        >
          <XStack gap="$xs" alignItems="center">
            <Trash2 size={13} color="$error" />
            <BodySm fontWeight="500" color="$error">
              Delete entire video
            </BodySm>
          </XStack>
        </ButtonSecondary>
      </XStack>

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
