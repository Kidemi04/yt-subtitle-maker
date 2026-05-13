import * as React from "react";
import { Stack, XStack, YStack } from "tamagui";
import {
  RefreshCcw,
  Search,
  Library as LibraryIconLucide,
} from "@tamagui/lucide-icons";
import {
  GlassCard,
  HeroCard,
  TextInput,
  IconButton,
  FilterChip,
  BadgePill,
  ButtonPrimary,
  ButtonSecondary,
  DisplayMd,
  TitleSm,
  BodyMd,
  BodySm,
  Caption,
} from "@yt-subtitle-maker/ui";
import { useFocusEffect, useRouter } from "expo-router";
import { apiClient } from "../src/state/client";
import { VideoDetailModal } from "../src/components/VideoDetailModal";
import type { LibraryItem } from "@yt-subtitle-maker/api-client";

type FilterKind = "all" | "video" | "audio" | "srt";

const FILTERS: { label: string; value: FilterKind }[] = [
  { label: "All", value: "all" },
  { label: "Video", value: "video" },
  { label: "Audio", value: "audio" },
  { label: "SRT", value: "srt" },
];

function fileKinds(item: LibraryItem): Set<"video" | "audio" | "srt"> {
  const out = new Set<"video" | "audio" | "srt">();
  if (item.hasVideo) out.add("video");
  if (item.audio) out.add("audio");
  if ((item.transcribesCount ?? 0) + (item.translationsCount ?? 0) > 0)
    out.add("srt");
  return out;
}

function formatRelative(iso: string | undefined): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const delta = Date.now() - then;
  const minutes = Math.floor(delta / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function Library() {
  const router = useRouter();
  const [items, setItems] = React.useState<LibraryItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>();
  const [filter, setFilter] = React.useState<FilterKind>("all");
  const [search, setSearch] = React.useState("");
  const [openItem, setOpenItem] = React.useState<LibraryItem | undefined>();

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const res = await apiClient.fetchLibrary();
      setItems(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-fetch every time this route is focused so a freshly-finished job
  // appears without a manual page refresh.
  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const filtered = items.filter((item) => {
    const kinds = fileKinds(item);
    if (filter !== "all" && !kinds.has(filter)) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const hay = [
        item.titleTranslated,
        item.titleOriginal,
        item.videoId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <YStack gap="$lg">
      {/* Header */}
      <XStack alignItems="center" justifyContent="space-between" gap="$md">
        <YStack gap="$xs" flex={1}>
          <DisplayMd>Your library</DisplayMd>
          <BodySm color="$textSecondary">
            {items.length} item{items.length === 1 ? "" : "s"} ·{" "}
            {filtered.length} shown
          </BodySm>
        </YStack>
        <IconButton
          icon={<RefreshCcw size={16} color="$textSecondary" />}
          aria-label="Refresh library"
          onPress={refresh}
        />
      </XStack>

      {/* Filter + search */}
      <GlassCard variant="low">
        <XStack gap="$sm" alignItems="center" flexWrap="wrap">
          <XStack gap="$xs">
            {FILTERS.map((f) => (
              <FilterChip
                key={f.value}
                active={filter === f.value}
                onPress={() => setFilter(f.value)}
              >
                {f.label}
              </FilterChip>
            ))}
          </XStack>
          <XStack flex={1} minWidth={240} alignItems="center" position="relative">
            <Stack position="absolute" left={14} zIndex={1}>
              <Search size={14} color="$textMuted" />
            </Stack>
            <TextInput
              flex={1}
              paddingLeft={36}
              value={search}
              onChangeText={setSearch}
              placeholder="Search title or video id"
            />
          </XStack>
        </XStack>
      </GlassCard>

      {/* Body */}
      {error ? (
        <GlassCard variant="mid">
          <BodySm color="$error">
            Couldn't reach the backend: {error}
          </BodySm>
        </GlassCard>
      ) : null}

      {!loading && filtered.length === 0 ? (
        <HeroCard variant="mid">
          <YStack alignItems="center" gap="$md" paddingVertical="$lg">
            <Stack
              width={120}
              height={120}
              borderRadius="$xl"
              alignItems="center"
              justifyContent="center"
              backgroundColor="$surfaceGlass"
              borderWidth={1}
              borderColor="$borderSubtle"
              opacity={0.5}
            >
              <LibraryIconLucide size={48} color="$textMuted" />
            </Stack>
            <YStack alignItems="center" gap="$xs" maxWidth={360}>
              <DisplayMd textAlign="center">
                {items.length === 0 ? "No files yet" : "Nothing matches"}
              </DisplayMd>
              <BodyMd color="$textSecondary" textAlign="center">
                {items.length === 0
                  ? "Generate some subtitles and they'll show up here."
                  : "Try clearing the filter or search to see everything."}
              </BodyMd>
            </YStack>
            {items.length === 0 ? (
              <ButtonPrimary
                onPress={() => router.push("/")}
                height={48}
              >
                Open Generate
              </ButtonPrimary>
            ) : (
              <ButtonSecondary
                onPress={() => {
                  setFilter("all");
                  setSearch("");
                }}
              >
                Clear filters
              </ButtonSecondary>
            )}
          </YStack>
        </HeroCard>
      ) : null}

      {/* Grid */}
      {filtered.length > 0 ? (
        <XStack flexWrap="wrap" gap="$md">
          {filtered.map((item) => (
            <LibraryCard
              key={item.videoId}
              item={item}
              onPress={() => setOpenItem(item)}
            />
          ))}
        </XStack>
      ) : null}

      {/* Detail modal — fetches VideoDetail on open and renders per-run cards. */}
      {openItem ? (
        <VideoDetailModal
          open={!!openItem}
          onOpenChange={(open) => {
            if (!open) setOpenItem(undefined);
          }}
          videoId={openItem.videoId}
          fallbackTitle={openItem.titleTranslated ?? openItem.titleOriginal}
          fallbackThumbnailUrl={openItem.thumbnailUrl}
          fallbackUrl={openItem.url}
          fallbackCreatedAt={openItem.createdAt}
          onDeleted={() => {
            setOpenItem(undefined);
            refresh();
          }}
        />
      ) : null}
    </YStack>
  );
}

function LibraryCard({
  item,
  onPress,
}: {
  item: LibraryItem;
  onPress: () => void;
}) {
  const title = item.titleTranslated ?? item.titleOriginal;
  const tCount = item.transcribesCount ?? 0;
  const trCount = item.translationsCount ?? 0;
  return (
    <Stack
      width={216}
      borderRadius="$lg"
      overflow="hidden"
      backgroundColor="$surfaceGlassMid"
      borderColor="$borderSubtle"
      borderWidth={1}
      cursor="pointer"
      onPress={onPress}
      hoverStyle={{ y: -2, borderColor: "$borderStrong" }}
      animation="quick"
    >
      <Stack
        height={122}
        backgroundColor="$bgElevated"
        position="relative"
        style={{
          backgroundImage: item.thumbnailUrl
            ? `url(${item.thumbnailUrl})`
            : "linear-gradient(135deg, #1a1a1d 0%, #0a0a0c 100%)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <YStack padding="$md" gap="$xs">
        <TitleSm numberOfLines={2}>{title}</TitleSm>
        {item.titleTranslated && item.titleOriginal !== item.titleTranslated ? (
          <BodySm color="$textSecondary" numberOfLines={1}>
            {item.titleOriginal}
          </BodySm>
        ) : null}
        <XStack gap="$xs" flexWrap="wrap" alignItems="center">
          {tCount > 0 ? (
            <BadgePill tone="neutral">
              {tCount} transcript{tCount === 1 ? "" : "s"}
            </BadgePill>
          ) : null}
          {trCount > 0 ? (
            <BadgePill tone="accent">
              {trCount} translation{trCount === 1 ? "" : "s"}
            </BadgePill>
          ) : null}
          {tCount === 0 && trCount === 0 && item.audio ? (
            <BadgePill tone="neutral">audio only</BadgePill>
          ) : null}
          <Caption fontSize={11}>{formatRelative(item.createdAt)}</Caption>
        </XStack>
      </YStack>
    </Stack>
  );
}

