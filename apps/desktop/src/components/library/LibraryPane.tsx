import { useMemo } from "react";
import { LayoutGrid, List, RefreshCw, Search, X } from "@tamagui/lucide-icons";
import { Input, ScrollView, Stack, XStack, YStack } from "tamagui";
import {
  BodyMd,
  BodySm,
  Caption,
  ButtonSecondary,
  IconButton,
  TitleLg,
} from "@yt-subtitle-maker/ui";
import { useLibrary } from "../../state/library";
import { LibraryRow } from "./LibraryRow";
import { LibraryCardCompact } from "./LibraryCardCompact";

const PANE_WIDTH = 360;

export function LibraryPane() {
  const items = useLibrary((s) => s.items);
  const loading = useLibrary((s) => s.loading);
  const error = useLibrary((s) => s.error);
  const selectedId = useLibrary((s) => s.selectedId);
  const detail = useLibrary((s) => s.detail);
  const view = useLibrary((s) => s.view);
  const search = useLibrary((s) => s.search);
  const setView = useLibrary((s) => s.setView);
  const setSearch = useLibrary((s) => s.setSearch);
  const selectVideo = useLibrary((s) => s.selectVideo);
  const fetchList = useLibrary((s) => s.fetchList);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const hay = [
        item.titleTranslated ?? "",
        item.titleOriginal ?? "",
        item.videoId,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [items, search]);

  return (
    <YStack
      width={PANE_WIDTH}
      maxWidth={PANE_WIDTH}
      flexShrink={0}
      borderRightWidth={1}
      borderRightColor="$borderSubtle"
      backgroundColor="$bgElevated"
    >
      {/* Sticky header */}
      <YStack padding="$md" gap="$sm" borderBottomWidth={1} borderBottomColor="$borderSubtle">
        <XStack alignItems="center" justifyContent="space-between">
          <TitleLg>Library</TitleLg>
          <XStack gap="$xs" alignItems="center">
            <Caption color="$textMuted">{items.length} videos</Caption>
            <IconButton
              size={32}
              icon={<RefreshCw size={14} color="#a1a1a6" />}
              aria-label="Refresh"
              onPress={() => void fetchList()}
            />
          </XStack>
        </XStack>

        <XStack
          alignItems="center"
          gap="$xs"
          paddingHorizontal="$sm"
          paddingVertical={6}
          backgroundColor="$surfaceGlass"
          borderRadius="$md"
          borderWidth={1}
          borderColor="$borderSubtle"
        >
          <Search size={14} color="#6e6e73" />
          <Input
            flex={1}
            unstyled
            placeholder="Search title or video ID…"
            value={search}
            onChangeText={setSearch}
            color="$textPrimary"
            paddingHorizontal="$xs"
          />
          {search ? (
            <IconButton
              size={32}
              icon={<X size={12} color="#a1a1a6" />}
              aria-label="Clear search"
              onPress={() => setSearch("")}
            />
          ) : null}
        </XStack>

        <XStack gap={4}>
          <ButtonSecondary
            onPress={() => setView("rows")}
            aria-pressed={view === "rows"}
            backgroundColor={view === "rows" ? "$surfaceGlassMid" : undefined}
            height={32}
            paddingHorizontal="$sm"
          >
            ☰ Rows
          </ButtonSecondary>
          <ButtonSecondary
            onPress={() => setView("cards")}
            aria-pressed={view === "cards"}
            backgroundColor={view === "cards" ? "$surfaceGlassMid" : undefined}
            height={32}
            paddingHorizontal="$sm"
          >
            ⊞ Cards
          </ButtonSecondary>
        </XStack>
      </YStack>

      {error ? (
        <YStack
          margin="$sm"
          padding="$sm"
          borderRadius="$sm"
          borderWidth={1}
          borderColor="$error"
          backgroundColor="$bgElevated"
        >
          <BodySm color="$error">Failed to load library: {error}</BodySm>
        </YStack>
      ) : null}

      <ScrollView flex={1}>
        {loading && items.length === 0 ? (
          <YStack padding="$md">
            <BodySm color="$textMuted">Loading…</BodySm>
          </YStack>
        ) : filtered.length === 0 && search ? (
          <YStack padding="$md" gap="$sm">
            <BodyMd color="$textSecondary">No matches for "{search}"</BodyMd>
            <ButtonSecondary onPress={() => setSearch("")} height={32} paddingHorizontal="$sm">
              Clear search
            </ButtonSecondary>
          </YStack>
        ) : view === "rows" ? (
          <YStack>
            {filtered.map((item) => (
              <LibraryRow
                key={item.videoId}
                item={item}
                selected={item.videoId === selectedId}
                detail={item.videoId === selectedId ? detail : null}
                onPress={() => selectVideo(item.videoId)}
              />
            ))}
          </YStack>
        ) : (
          <XStack flexWrap="wrap" gap="$sm" padding="$sm">
            {filtered.map((item) => (
              <LibraryCardCompact
                key={item.videoId}
                item={item}
                selected={item.videoId === selectedId}
                onPress={() => selectVideo(item.videoId)}
              />
            ))}
          </XStack>
        )}
      </ScrollView>
    </YStack>
  );
}
