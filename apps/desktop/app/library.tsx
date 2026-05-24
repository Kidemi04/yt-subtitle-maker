import { useCallback, useEffect, useState } from "react";
import { ArrowLeft } from "@tamagui/lucide-icons";
import { useFocusEffect } from "expo-router";
import { XStack, YStack, Stack } from "tamagui";
import { IconButton } from "@yt-subtitle-maker/ui";
import { LibraryPane } from "../src/components/library/LibraryPane";
import { DetailPane } from "../src/components/library/DetailPane";
import { useLibrary } from "../src/state/library";
import { useMpvStatusPolling } from "../src/hooks/useMpvStatusPolling";
import { useLibraryKeyboardNav } from "../src/hooks/useLibraryKeyboardNav";

const NARROW_BREAKPOINT = 720;

function useViewportIsNarrow() {
  const [isNarrow, setIsNarrow] = useState(
    typeof window !== "undefined" ? window.innerWidth <= NARROW_BREAKPOINT : false,
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setIsNarrow(window.innerWidth <= NARROW_BREAKPOINT);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return isNarrow;
}

export default function LibraryRoute() {
  const fetchList = useLibrary((s) => s.fetchList);
  const selectedId = useLibrary((s) => s.selectedId);
  const selectVideo = useLibrary((s) => s.selectVideo);
  const isNarrow = useViewportIsNarrow();

  useFocusEffect(
    useCallback(() => {
      void fetchList();
    }, [fetchList]),
  );

  useMpvStatusPolling();
  useLibraryKeyboardNav();

  if (isNarrow) {
    return (
      <YStack flex={1}>
        {selectedId ? (
          <YStack flex={1}>
            <XStack padding="$sm" borderBottomWidth={1} borderBottomColor="$borderSubtle">
              <IconButton
                size={44}
                icon={<ArrowLeft size={16} color="#6c6a64" />}
                aria-label="Back to library"
                onPress={() => selectVideo(null)}
              />
            </XStack>
            <DetailPane />
          </YStack>
        ) : (
          <LibraryPane />
        )}
      </YStack>
    );
  }

  return (
    <XStack flex={1}>
      <LibraryPane />
      <Stack flex={1} minWidth={0}>
        <DetailPane />
      </Stack>
    </XStack>
  );
}
