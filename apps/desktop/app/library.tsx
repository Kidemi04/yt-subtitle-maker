import * as React from "react";
import { Stack, XStack, YStack } from "tamagui";
import {
  RefreshCcw,
  Search,
  PlayCircle,
  Languages,
  Plus,
  Trash2,
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
  ButtonGhost,
  Modal,
  DisplayMd,
  DisplaySm,
  TitleLg,
  TitleSm,
  BodyMd,
  BodySm,
  Caption,
  CaptionUpper,
  Code,
} from "@yt-subtitle-maker/ui";
import { useFocusEffect, useRouter } from "expo-router";
import { apiClient } from "../src/state/client";
import type {
  LibraryItem,
  TranscribeRun,
  TranslateRun,
  VideoDetail,
} from "@yt-subtitle-maker/api-client";

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

      {/* Detail modal — fetches VideoDetail on open and renders per-run cards. */}
      <Modal
        open={!!openItem}
        onOpenChange={(open) => {
          if (!open) setOpenItem(undefined);
        }}
        title={openItem?.titleTranslated ?? openItem?.titleOriginal}
        width={720}
      >
        {openItem ? (
          <VideoDetailModal
            item={openItem}
            onClose={() => setOpenItem(undefined)}
            onDeleted={() => {
              setOpenItem(undefined);
              refresh();
            }}
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

/**
 * VideoDetailModal — replaces the legacy "Files" list with a per-run view.
 *
 * Fetches GET /api/library/{videoId} on open and renders Transcripts + Translations
 * sections. Each row plays via mpv with the exact run id and supports Delete.
 *
 * "+ New transcript" and "+ New translation" are placeholders here; Phase 10
 * wires them to NewTranscribeModal / NewTranslationModal.
 */
function VideoDetailModal({
  item,
  onClose,
  onDeleted,
}: {
  item: LibraryItem;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const router = useRouter();
  const [detail, setDetail] = React.useState<VideoDetail | null>(null);
  const [error, setError] = React.useState<string | undefined>();
  const [busy, setBusy] = React.useState(false);

  const refreshDetail = React.useCallback(async () => {
    setError(undefined);
    try {
      const d = await apiClient.fetchVideoDetail(item.videoId);
      setDetail(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [item.videoId]);

  React.useEffect(() => {
    void refreshDetail();
  }, [refreshDetail]);

  const onDeleteVideo = async () => {
    if (typeof window !== "undefined" && !window.confirm(
      `Delete the entire library entry for "${item.titleOriginal}"? This removes the audio and all SRTs.`,
    )) {
      return;
    }
    setBusy(true);
    try {
      await apiClient.deleteLibraryItem(item.videoId);
      onDeleted();
    } finally {
      setBusy(false);
    }
  };

  const onOpenFolder = async () => {
    try {
      await apiClient.openLibraryFolder(item.videoId);
    } catch {
      /* backend may not support this on the current platform */
    }
  };

  const onPlayTranscript = async (id: string) => {
    await apiClient.playMpv(item.videoId, { transcribeId: id });
  };
  const onPlayTranslation = async (id: string) => {
    await apiClient.playMpv(item.videoId, { translateId: id });
  };
  const onDeleteTranscript = async (id: string) => {
    if (typeof window !== "undefined" && !window.confirm(
      "Delete this transcript? Any translations derived from it will also be deleted.",
    )) {
      return;
    }
    await apiClient.deleteSrt(item.videoId, "transcribe", id);
    await refreshDetail();
  };
  const onDeleteTranslation = async (id: string) => {
    if (typeof window !== "undefined" && !window.confirm("Delete this translation?")) {
      return;
    }
    await apiClient.deleteSrt(item.videoId, "translate", id);
    await refreshDetail();
  };

  // Group translations by their source transcript so each transcript "owns"
  // the translations derived from it (cascade-delete is the contract).
  const translationsBySource = React.useMemo(() => {
    const map = new Map<string, TranslateRun[]>();
    for (const tr of detail?.translations ?? []) {
      const arr = map.get(tr.sourceTranscribeId) ?? [];
      arr.push(tr);
      map.set(tr.sourceTranscribeId, arr);
    }
    return map;
  }, [detail?.translations]);

  return (
    <YStack gap="$lg">
      {/* Header: thumbnail + url + meta */}
      <XStack gap="$md" alignItems="flex-start">
        <Stack
          width={192}
          height={108}
          borderRadius="$md"
          overflow="hidden"
          backgroundColor="$bgElevated"
          flexShrink={0}
          style={{
            backgroundImage: detail?.thumbnailUrl
              ? `url(${detail.thumbnailUrl})`
              : item.thumbnailUrl
                ? `url(${item.thumbnailUrl})`
                : "linear-gradient(135deg, #1a1a1d 0%, #0a0a0c 100%)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <YStack flex={1} gap="$xs" minWidth={0}>
          <TitleLg numberOfLines={2}>
            {detail?.titleTranslated ?? detail?.titleOriginal ?? item.titleOriginal}
          </TitleLg>
          <BodySm color="$textSecondary" numberOfLines={1}>
            {detail?.url ?? item.url}
          </BodySm>
          <XStack gap="$xs" flexWrap="wrap" alignItems="center">
            <BadgePill tone="neutral">{item.videoId}</BadgePill>
            {typeof detail?.durationSeconds === "number" ? (
              <Caption fontSize={11}>{formatDuration(detail.durationSeconds)}</Caption>
            ) : null}
            <Caption fontSize={11}>
              added {formatRelative(detail?.createdAt ?? item.createdAt)}
            </Caption>
          </XStack>
        </YStack>
      </XStack>

      {error ? (
        <GlassCard variant="mid">
          <BodySm color="$error">Failed to load detail: {error}</BodySm>
        </GlassCard>
      ) : null}

      {/* Transcripts section */}
      <YStack gap="$sm">
        <DisplaySm>
          Transcripts ({detail?.transcribes.length ?? 0})
        </DisplaySm>
        {detail && detail.transcribes.length === 0 ? (
          <BodySm color="$textMuted">No transcripts yet.</BodySm>
        ) : (
          <YStack gap="$xs">
            {detail?.transcribes.map((t) => (
              <TranscribeRow
                key={t.id}
                run={t}
                onPlay={() => onPlayTranscript(t.id)}
                onTranslate={() => {
                  /* Phase 10: open NewTranslationModal pre-filled with this transcribe id */
                }}
                onDelete={() => onDeleteTranscript(t.id)}
              />
            ))}
          </YStack>
        )}
        <ButtonGhost
          onPress={() => {
            /* Phase 10: open NewTranscribeModal */
          }}
          disabled
        >
          <XStack gap="$xs" alignItems="center">
            <Plus size={14} color="$textMuted" />
            <BodySm fontWeight="500" color="$textMuted">
              New transcript
            </BodySm>
          </XStack>
        </ButtonGhost>
      </YStack>

      {/* Translations section */}
      <YStack gap="$sm">
        <DisplaySm>
          Translations ({detail?.translations.length ?? 0})
        </DisplaySm>
        {detail && detail.translations.length === 0 ? (
          <BodySm color="$textMuted">
            No translations yet. Translations are derived from a transcript above.
          </BodySm>
        ) : (
          <YStack gap="$md">
            {detail?.transcribes.map((t) => {
              const group = translationsBySource.get(t.id) ?? [];
              if (group.length === 0) return null;
              return (
                <YStack key={t.id} gap="$xs">
                  <CaptionUpper>from {t.id}</CaptionUpper>
                  <YStack gap="$xs">
                    {group.map((tr) => (
                      <TranslateRow
                        key={tr.id}
                        run={tr}
                        onPlay={() => onPlayTranslation(tr.id)}
                        onDelete={() => onDeleteTranslation(tr.id)}
                      />
                    ))}
                  </YStack>
                </YStack>
              );
            })}
            {/* Orphan translations whose source transcript was deleted */}
            {(() => {
              const orphans = (detail?.translations ?? []).filter(
                (tr) =>
                  !(detail?.transcribes ?? []).some(
                    (t) => t.id === tr.sourceTranscribeId,
                  ),
              );
              if (orphans.length === 0) return null;
              return (
                <YStack gap="$xs">
                  <CaptionUpper>orphan (source deleted)</CaptionUpper>
                  <YStack gap="$xs">
                    {orphans.map((tr) => (
                      <TranslateRow
                        key={tr.id}
                        run={tr}
                        onPlay={() => onPlayTranslation(tr.id)}
                        onDelete={() => onDeleteTranslation(tr.id)}
                      />
                    ))}
                  </YStack>
                </YStack>
              );
            })()}
          </YStack>
        )}
        <ButtonGhost
          onPress={() => {
            /* Phase 10: open NewTranslationModal */
          }}
          disabled={!detail || detail.transcribes.length === 0}
        >
          <XStack gap="$xs" alignItems="center">
            <Plus size={14} color="$textMuted" />
            <BodySm fontWeight="500" color="$textMuted">
              New translation
            </BodySm>
          </XStack>
        </ButtonGhost>
      </YStack>

      {/* Footer */}
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
        <ButtonSecondary onPress={onDeleteVideo} disabled={busy}>
          <BodySm fontWeight="500" color="$error">
            Delete entire video
          </BodySm>
        </ButtonSecondary>
      </XStack>
    </YStack>
  );
}

function TranscribeRow({
  run,
  onPlay,
  onTranslate,
  onDelete,
}: {
  run: TranscribeRun;
  onPlay: () => void;
  onTranslate: () => void;
  onDelete: () => void;
}) {
  const facets = [run.engine, run.model, run.language].filter(Boolean).join(" · ");
  const meta = [
    formatDurationMs(run.durationMs),
    `${run.segmentCount} segment${run.segmentCount === 1 ? "" : "s"}`,
    formatRelative(run.createdAt),
  ]
    .filter(Boolean)
    .join(" · ");
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
      <XStack gap="$xs">
        <IconButton
          icon={<PlayCircle size={14} color="$textSecondary" />}
          aria-label="Play with this transcript"
          size={32}
          onPress={onPlay}
        />
        <IconButton
          icon={<Languages size={14} color="$textSecondary" />}
          aria-label="Translate this transcript"
          size={32}
          onPress={onTranslate}
        />
      </XStack>
      <YStack flex={1} gap={2} minWidth={0}>
        <Code numberOfLines={1}>{facets}</Code>
        <Caption fontSize={11}>{meta}</Caption>
      </YStack>
      <IconButton
        icon={<Trash2 size={14} color="$textSecondary" />}
        aria-label="Delete this transcript"
        size={32}
        onPress={onDelete}
      />
    </XStack>
  );
}

function TranslateRow({
  run,
  onPlay,
  onDelete,
}: {
  run: TranslateRun;
  onPlay: () => void;
  onDelete: () => void;
}) {
  const facets = [run.translator, run.translatorModel, run.targetLang]
    .filter(Boolean)
    .join(" · ");
  const meta = [
    formatDurationMs(run.durationMs),
    `${run.segmentCount} segment${run.segmentCount === 1 ? "" : "s"}`,
    formatRelative(run.createdAt),
  ]
    .filter(Boolean)
    .join(" · ");
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
      <IconButton
        icon={<PlayCircle size={14} color="$textSecondary" />}
        aria-label="Play with this translation"
        size={32}
        onPress={onPlay}
      />
      <YStack flex={1} gap={2} minWidth={0}>
        <Code numberOfLines={1}>{facets}</Code>
        <Caption fontSize={11}>{meta}</Caption>
      </YStack>
      <IconButton
        icon={<Trash2 size={14} color="$textSecondary" />}
        aria-label="Delete this translation"
        size={32}
        onPress={onDelete}
      />
    </XStack>
  );
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return "";
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function formatDurationMs(ms: number): string {
  if (!ms || ms < 0) return "";
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
  const minutes = Math.floor(seconds / 60);
  const remSec = Math.floor(seconds % 60);
  return `${minutes}m ${remSec}s`;
}
