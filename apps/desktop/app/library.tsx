import * as React from "react";
import { Stack, XStack, YStack } from "tamagui";
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
  DisplayMd,
  TitleSm,
  BodyMd,
  BodySm,
  Caption,
  CaptionUpper,
  Code,
} from "@yt-subtitle-maker/ui";
import { useFocusEffect, useRouter } from "expo-router";
import { apiClient } from "../src/state/client";
import type { LibraryItem } from "@yt-subtitle-maker/api-client";

type FilterKind = "all" | "video" | "audio" | "srt";

const FILTERS: { label: string; value: FilterKind }[] = [
  { label: "All", value: "all" },
  { label: "Video", value: "video" },
  { label: "Audio", value: "audio" },
  { label: "SRT", value: "srt" },
];

const BACKEND_BASE_URL = "http://127.0.0.1:8000"; // Phase 11 will read from config

function absolutize(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  return `${BACKEND_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

interface PresentFile {
  kind: "video" | "audio" | "srt";
  label: string;
  filename: string;
  url: string;
}

function presentFiles(item: LibraryItem): PresentFile[] {
  const out: PresentFile[] = [];
  const f = item.files ?? {
    originalSrt: null,
    translatedSrt: null,
    audio: null,
    video: null,
  };
  const tail = (u: string | null) =>
    (u?.split("/").pop() ?? u ?? "").trim();
  if (f.video) {
    out.push({
      kind: "video",
      label: "video",
      filename: tail(f.video),
      url: absolutize(f.video) ?? f.video,
    });
  }
  if (f.audio) {
    out.push({
      kind: "audio",
      label: "audio",
      filename: tail(f.audio),
      url: absolutize(f.audio) ?? f.audio,
    });
  }
  if (f.originalSrt) {
    out.push({
      kind: "srt",
      label: "original SRT",
      filename: tail(f.originalSrt),
      url: absolutize(f.originalSrt) ?? f.originalSrt,
    });
  }
  if (f.translatedSrt) {
    out.push({
      kind: "srt",
      label: "translated SRT",
      filename: tail(f.translatedSrt),
      url: absolutize(f.translatedSrt) ?? f.translatedSrt,
    });
  }
  return out;
}

function fileKinds(item: LibraryItem): Set<"video" | "audio" | "srt"> {
  const out = new Set<"video" | "audio" | "srt">();
  if (item.files?.video) out.add("video");
  if (item.files?.audio) out.add("audio");
  if (item.files?.originalSrt || item.files?.translatedSrt) out.add("srt");
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
              position="relative"
            >
              {/* Inner accent halo to hint action */}
              <Stack
                position="absolute"
                width={32}
                height={32}
                borderRadius="$pill"
                backgroundColor="$accentSoft"
                opacity={0.6}
                style={{ filter: "blur(12px)" }}
              />
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
        title={openItem?.titleTranslated ?? openItem?.titleOriginal}
        width={640}
      >
        {openItem ? (
          <LibraryDetail
            item={openItem}
            onClose={() => setOpenItem(undefined)}
          />
        ) : null}
      </Modal>
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
  const kinds = Array.from(fileKinds(item));
  const title = item.titleTranslated ?? item.titleOriginal;
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
          {kinds.map((t) => (
            <BadgePill key={t} tone="neutral">
              {t}
            </BadgePill>
          ))}
          <Caption fontSize={11}>{formatRelative(item.createdAt)}</Caption>
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
  const files = presentFiles(item);

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
      /* backend may not support on this platform */
    }
  };

  return (
    <YStack gap="$md">
      <YStack gap="$xs">
        <BodySm color="$textSecondary">
          {item.url ?? `youtube.com/watch?v=${item.videoId}`}
        </BodySm>
        <BadgePill tone="neutral">{item.videoId}</BadgePill>
      </YStack>

      <YStack gap="$xs">
        <CaptionUpper>Files</CaptionUpper>
        {files.length === 0 ? (
          <BodySm color="$textMuted">No files in this folder.</BodySm>
        ) : (
          <YStack gap="$xs">
            {files.map((f) => (
              <FileRow key={f.url} file={f} />
            ))}
          </YStack>
        )}
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
            <PlayCircle size={14} color="$textSecondary" />
            <BodySm fontWeight="500" color="$textSecondary">
              Open folder
            </BodySm>
          </XStack>
        </ButtonSecondary>
        <ButtonSecondary onPress={onDelete} disabled={busy}>
          <BodySm fontWeight="500" color="$error">
            Delete
          </BodySm>
        </ButtonSecondary>
      </XStack>
    </YStack>
  );
}

function FileRow({ file }: { file: PresentFile }) {
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
        <CaptionUpper color="$textSecondary">{file.kind}</CaptionUpper>
      </Stack>
      <YStack flex={1} gap={2} minWidth={0}>
        <Code numberOfLines={1}>{file.filename}</Code>
        <Caption fontSize={11}>{file.label}</Caption>
      </YStack>
      <IconButton
        icon={<Download size={14} color="$textSecondary" />}
        aria-label="Download"
        size={32}
        onPress={() => {
          if (typeof window !== "undefined") {
            window.open(file.url, "_blank");
          }
        }}
      />
      <IconButton
        icon={<MoreHorizontal size={14} color="$textSecondary" />}
        aria-label="More"
        size={32}
      />
    </XStack>
  );
}
