import * as React from "react";
import { Stack, Text, XStack, YStack } from "tamagui";
import {
  RefreshCcw,
  Search,
  PlayCircle,
  Download,
  MoreHorizontal,
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
  Modal,
} from "@yt-subtitle-maker/ui";
import { useRouter } from "expo-router";
import { apiClient } from "../src/state/client";
import type { LibraryItem, LibraryFile } from "@yt-subtitle-maker/api-client";

type FilterKind = "all" | "video" | "audio" | "srt";

const FILTERS: { label: string; value: FilterKind }[] = [
  { label: "All", value: "all" },
  { label: "Video", value: "video" },
  { label: "Audio", value: "audio" },
  { label: "SRT", value: "srt" },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDuration(s: number | undefined): string {
  if (!s) return "";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function itemHasFile(item: LibraryItem, kind: LibraryFile["kind"]): boolean {
  return item.files.some((f) => f.kind === kind);
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

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = items.filter((item) => {
    if (filter !== "all" && !itemHasFile(item, filter)) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const hay = [item.title, item.channel, item.videoId]
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
          <Text
            fontFamily="$display"
            fontSize={32}
            letterSpacing={-0.8}
            color="$textPrimary"
          >
            Your library
          </Text>
          <Text fontFamily="$body" fontSize={13} color="$textSecondary">
            {items.length} item{items.length === 1 ? "" : "s"} ·{" "}
            {filtered.length} shown
          </Text>
        </YStack>
        <IconButton
          icon={<RefreshCcw size={16} color="#a1a1a6" />}
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
              <Search size={14} color="#6e6e73" />
            </Stack>
            <TextInput
              flex={1}
              paddingLeft={36}
              value={search}
              onChangeText={setSearch}
              placeholder="Search title, channel, or video id"
            />
          </XStack>
        </XStack>
      </GlassCard>

      {/* Body */}
      {error ? (
        <GlassCard variant="mid">
          <Text fontFamily="$body" fontSize={13} color="$error">
            Couldn't reach the backend: {error}
          </Text>
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
              opacity={0.5}
              backgroundColor="$surfaceGlass"
            >
              <LibraryIconLucide size={48} color="#6e6e73" />
            </Stack>
            <YStack alignItems="center" gap="$xs" maxWidth={360}>
              <Text
                fontFamily="$display"
                fontSize={28}
                letterSpacing={-0.5}
                color="$textPrimary"
                textAlign="center"
              >
                {items.length === 0 ? "No files yet" : "Nothing matches"}
              </Text>
              <Text
                fontFamily="$body"
                fontSize={14}
                lineHeight={22}
                color="$textSecondary"
                textAlign="center"
              >
                {items.length === 0
                  ? "Generate some subtitles and they'll show up here."
                  : "Try clearing the filter or search to see everything."}
              </Text>
            </YStack>
            {items.length === 0 ? (
              <ButtonPrimary onPress={() => router.push("/")}>
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

      {/* Detail modal */}
      <Modal
        open={!!openItem}
        onOpenChange={(open) => {
          if (!open) setOpenItem(undefined);
        }}
        title={openItem?.title}
        width={640}
      >
        {openItem ? <LibraryDetail item={openItem} onClose={() => setOpenItem(undefined)} /> : null}
      </Modal>
    </YStack>
  );
}

function LibraryCard({ item, onPress }: { item: LibraryItem; onPress: () => void }) {
  const tags = Array.from(new Set(item.files.map((f) => f.kind)));
  const langs = Array.from(
    new Set(item.files.map((f) => f.language).filter(Boolean) as string[]),
  );
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
      >
        {item.durationSeconds ? (
          <Stack
            position="absolute"
            bottom={8}
            right={8}
            paddingHorizontal="$xs"
            paddingVertical={2}
            borderRadius="$sm"
            backgroundColor="rgba(0,0,0,0.72)"
          >
            <Text
              fontFamily="$mono"
              fontSize={11}
              fontWeight="500"
              color="$textPrimary"
              style={{ fontFeatureSettings: "'tnum'" }}
            >
              {formatDuration(item.durationSeconds)}
            </Text>
          </Stack>
        ) : null}
      </Stack>
      <YStack padding="$md" gap="$xs">
        <Text
          fontFamily="$body"
          fontSize={13}
          fontWeight="600"
          color="$textPrimary"
          numberOfLines={2}
        >
          {item.title}
        </Text>
        {item.channel ? (
          <Text fontFamily="$body" fontSize={12} color="$textSecondary" numberOfLines={1}>
            {item.channel}
          </Text>
        ) : null}
        <XStack gap="$xs" flexWrap="wrap">
          {tags.map((t) => (
            <BadgePill key={t} tone="neutral">
              {t}
            </BadgePill>
          ))}
          {langs.slice(0, 2).map((l) => (
            <BadgePill key={l} tone="accent">
              {l}
            </BadgePill>
          ))}
        </XStack>
      </YStack>
    </Stack>
  );
}

function LibraryDetail({
  item,
  onClose,
}: {
  item: LibraryItem;
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  const onDelete = async () => {
    setBusy(true);
    try {
      await apiClient.deleteLibraryItem(item.videoId);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const onOpenFolder = async () => {
    try {
      await apiClient.openLibraryFolder(item.videoId);
    } catch {
      /* no-op — backend may not support on this platform */
    }
  };

  return (
    <YStack gap="$md">
      <YStack gap="$xs">
        <Text
          fontFamily="$body"
          fontSize={13}
          color="$textSecondary"
        >
          {item.channel ?? "Unknown channel"} · {formatDuration(item.durationSeconds)}
        </Text>
        <BadgePill tone="neutral">{item.videoId}</BadgePill>
      </YStack>

      <YStack gap="$xs">
        <Text
          fontFamily="$body"
          fontSize={11}
          fontWeight="600"
          letterSpacing={1.5}
          textTransform="uppercase"
          color="$textMuted"
        >
          Files
        </Text>
        <YStack gap="$xs">
          {item.files.map((f, i) => (
            <FileRow key={`${f.kind}-${f.filename}-${i}`} file={f} />
          ))}
        </YStack>
      </YStack>

      <XStack gap="$xs" justifyContent="flex-end" flexWrap="wrap">
        <ButtonSecondary
          onPress={() => {
            router.push("/");
            onClose();
          }}
        >
          Reload in Generate
        </ButtonSecondary>
        <ButtonSecondary onPress={onOpenFolder}>
          <XStack gap="$xs" alignItems="center">
            <PlayCircle size={14} color="#a1a1a6" />
            <Text
              fontFamily="$body"
              fontSize={13}
              fontWeight="500"
              color="$textSecondary"
            >
              Open folder
            </Text>
          </XStack>
        </ButtonSecondary>
        <ButtonSecondary onPress={onDelete} disabled={busy}>
          <Text
            fontFamily="$body"
            fontSize={13}
            fontWeight="500"
            color="$error"
          >
            Delete
          </Text>
        </ButtonSecondary>
      </XStack>
    </YStack>
  );
}

function FileRow({ file }: { file: LibraryFile }) {
  return (
    <XStack
      alignItems="center"
      gap="$sm"
      padding="$sm"
      borderRadius="$md"
      backgroundColor="$surfaceGlass"
      borderWidth={1}
      borderColor="$borderSubtle"
    >
      <Stack
        width={36}
        height={36}
        borderRadius="$sm"
        backgroundColor="$bgElevated"
        alignItems="center"
        justifyContent="center"
      >
        <Text
          fontFamily="$body"
          fontSize={11}
          fontWeight="600"
          color="$textSecondary"
          textTransform="uppercase"
        >
          {file.kind}
        </Text>
      </Stack>
      <YStack flex={1} gap={2}>
        <Text
          fontFamily="$mono"
          fontSize={12}
          color="$textPrimary"
          numberOfLines={1}
        >
          {file.filename}
        </Text>
        <XStack gap="$xs">
          {file.language ? (
            <Text fontFamily="$body" fontSize={11} color="$textMuted">
              {file.language}
            </Text>
          ) : null}
          <Text fontFamily="$body" fontSize={11} color="$textMuted">
            {formatBytes(file.sizeBytes)}
          </Text>
        </XStack>
      </YStack>
      <IconButton
        icon={<Download size={14} color="#a1a1a6" />}
        aria-label="Download"
        size={32}
        onPress={() => {
          if (typeof window !== "undefined") {
            window.open(file.downloadUrl, "_blank");
          }
        }}
      />
      <IconButton
        icon={<MoreHorizontal size={14} color="#a1a1a6" />}
        aria-label="More"
        size={32}
      />
    </XStack>
  );
}
