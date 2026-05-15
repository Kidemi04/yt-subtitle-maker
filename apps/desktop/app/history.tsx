import * as React from "react";
import { Stack, XStack, YStack } from "tamagui";
import {
  PlayCircle,
  RotateCcw,
  RefreshCcw,
  Info,
  MoreHorizontal,
  History as HistoryIconLucide,
} from "@tamagui/lucide-icons";
import {
  GlassCard,
  HeroCard,
  IconButton,
  FilterChip,
  BadgePill,
  ButtonPrimary,
  Dropdown,
  DisplayMd,
  TitleSm,
  BodyMd,
  BodySm,
  Caption,
  Timestamp,
} from "@yt-subtitle-maker/ui";
import { useFocusEffect, useRouter } from "expo-router";
import { apiClient } from "../src/state/client";
import { useGenerate } from "../src/state/generate";
import { useLibrary } from "../src/state/library";
import type { HistoryItem } from "@yt-subtitle-maker/api-client";

type TimeFilter = "all" | "today" | "week" | "month";
type SortOrder = "recent" | "oldest" | "title";

const TIME_FILTERS: { label: string; value: TimeFilter }[] = [
  { label: "All time", value: "all" },
  { label: "Today", value: "today" },
  { label: "This week", value: "week" },
  { label: "This month", value: "month" },
];

const SORT_OPTIONS = [
  { label: "Recent first", value: "recent" },
  { label: "Oldest first", value: "oldest" },
  { label: "Title A–Z", value: "title" },
];

function formatRelative(iso: string): string {
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

function formatElapsed(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function withinTime(item: HistoryItem, range: TimeFilter): boolean {
  if (range === "all") return true;
  const then = new Date(item.createdAt).getTime();
  if (Number.isNaN(then)) return false;
  const ageMs = Date.now() - then;
  if (range === "today") return ageMs < 24 * 60 * 60 * 1000;
  if (range === "week") return ageMs < 7 * 24 * 60 * 60 * 1000;
  if (range === "month") return ageMs < 30 * 24 * 60 * 60 * 1000;
  return true;
}

export default function History() {
  const router = useRouter();
  const selectVideo = useLibrary((s) => s.selectVideo);
  const [items, setItems] = React.useState<HistoryItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>();
  const [time, setTime] = React.useState<TimeFilter>("all");
  const [sort, setSort] = React.useState<SortOrder>("recent");

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const res = await apiClient.fetchHistory();
      setItems(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-fetch every time this route is focused — finishing a job in
  // Generate then tabbing back to History should show the new item
  // immediately, not wait for a full app reload.
  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const filtered = items
    .filter((it) => withinTime(it, time))
    .slice()
    .sort((a, b) => {
      if (sort === "title") {
        return (a.titleTranslated ?? a.titleOriginal).localeCompare(
          b.titleTranslated ?? b.titleOriginal,
        );
      }
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      return sort === "recent" ? tb - ta : ta - tb;
    });

  return (
    <YStack gap="$lg">
      <XStack alignItems="center" justifyContent="space-between" gap="$md">
        <YStack gap="$xs" flex={1}>
          <DisplayMd>Past sessions</DisplayMd>
          <BodySm color="$textSecondary">
            {loading
              ? "Refreshing…"
              : `${items.length} session${items.length === 1 ? "" : "s"} · click to reload settings into Generate.`}
          </BodySm>
        </YStack>
        <IconButton
          icon={<RefreshCcw size={16} color="$textSecondary" />}
          aria-label="Refresh history"
          onPress={refresh}
        />
      </XStack>

      <GlassCard variant="low">
        <XStack gap="$sm" alignItems="center" flexWrap="wrap">
          <XStack gap="$xs">
            {TIME_FILTERS.map((f) => (
              <FilterChip
                key={f.value}
                active={time === f.value}
                onPress={() => setTime(f.value)}
              >
                {f.label}
              </FilterChip>
            ))}
          </XStack>
          <Stack flex={1} />
          <Dropdown
            value={sort}
            onValueChange={(v) => setSort(v as SortOrder)}
            options={SORT_OPTIONS}
            width={180}
            aria-label="Sort"
          />
        </XStack>
      </GlassCard>

      {error ? (
        <GlassCard variant="mid">
          <BodySm color="$error">Couldn't load history: {error}</BodySm>
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
              <Stack
                position="absolute"
                width={32}
                height={32}
                borderRadius="$pill"
                backgroundColor="$accentSoft"
                opacity={0.6}
                style={{ filter: "blur(12px)" }}
              />
              <HistoryIconLucide size={48} color="$textMuted" />
            </Stack>
            <DisplayMd textAlign="center">No history yet</DisplayMd>
            <BodyMd color="$textSecondary" textAlign="center">
              Once you finish a transcription it'll show up here.
            </BodyMd>
            <ButtonPrimary onPress={() => router.push("/")}>
              Open Generate
            </ButtonPrimary>
          </YStack>
        </HeroCard>
      ) : null}

      {filtered.length > 0 ? (
        <YStack gap="$xs">
          {filtered.map((item) => (
            <HistoryRow
              key={item.videoId + item.createdAt}
              item={item}
              onOpenDetail={() => {
                selectVideo(item.videoId);
                router.push("/library");
              }}
            />
          ))}
        </YStack>
      ) : null}
    </YStack>
  );
}

function HistoryRow({
  item,
  onOpenDetail,
}: {
  item: HistoryItem;
  onOpenDetail: () => void;
}) {
  const router = useRouter();
  const setUrl = useGenerate((s) => s.setUrl);
  const loadMetadata = useGenerate((s) => s.loadMetadata);

  // Reload = drop the URL into the Generate store and trigger metadata
  // fetch, then navigate. The user lands on Generate with the video
  // preview already loaded — they pick a new translator/whisper engine
  // (via the inline switchers) and click Generate to re-run.
  // IconButton's onPress signature is `() => void` — it doesn't pass through
  // the underlying event, so stopPropagation can't be wired here. We instead
  // limit the row's "open detail" click target to the thumbnail + title
  // region so the action IconButtons live outside it (see render below).
  const onReload = () => {
    setUrl(item.url);
    void loadMetadata();
    router.push("/");
  };

  const onPlay = async () => {
    try {
      await apiClient.playMpv(item.videoId, {
        subtitlePreference:
          item.titleTranslated || item.targetLang ? "translated" : "original",
      });
    } catch {
      /* surfaced via mpv's window or noop on transient network */
    }
  };

  const onOpenFolder = async () => {
    try {
      await apiClient.openLibraryFolder(item.videoId);
    } catch {
      /* backend may not support on this platform */
    }
  };

  const tCount = item.transcribesCount ?? 0;
  const trCount = item.translationsCount ?? 0;
  const countsLabel =
    tCount + trCount === 0
      ? null
      : trCount > 0
        ? `${tCount} transcript${tCount === 1 ? "" : "s"} · ${trCount} translation${trCount === 1 ? "" : "s"}`
        : `${tCount} transcript${tCount === 1 ? "" : "s"}`;

  return (
    <XStack
      gap="$md"
      alignItems="center"
      padding="$md"
      paddingHorizontal="$lg"
      borderRadius="$lg"
      backgroundColor="$surfaceGlassMid"
      borderColor="$borderSubtle"
      borderWidth={1}
      hoverStyle={{ y: -1, borderColor: "$borderStrong" }}
      animation="quick"
    >
      {/* Click target = thumbnail + title only; action buttons sit OUTSIDE
          this region so their onPress doesn't risk bubbling up to the row.
          (Tamagui IconButton's onPress is `() => void` and gives no event
          for stopPropagation, so we isolate physically instead.) */}
      <XStack
        flex={1}
        gap="$md"
        alignItems="center"
        cursor="pointer"
        onPress={onOpenDetail}
        minWidth={0}
      >
        <Stack
          width={80}
          height={48}
          borderRadius="$sm"
          backgroundColor="$bgElevated"
          flexShrink={0}
          style={{
            backgroundImage: item.thumbnailUrl
              ? `url(${item.thumbnailUrl})`
              : "linear-gradient(135deg, #1a1a1d 0%, #0a0a0c 100%)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />

        <YStack flex={1} gap={2} minWidth={0}>
          <TitleSm numberOfLines={1}>
            {item.titleTranslated ?? item.titleOriginal}
          </TitleSm>
          {item.titleTranslated ? (
            <BodySm color="$textSecondary" numberOfLines={1}>
              {item.titleOriginal}
            </BodySm>
          ) : null}
          <XStack gap="$xs" marginTop={4} flexWrap="wrap" alignItems="center">
            {countsLabel ? (
              <BadgePill tone={trCount > 0 ? "accent" : "neutral"}>
                {countsLabel}
              </BadgePill>
            ) : (
              <BadgePill tone="neutral">{item.sttEngineUsed}</BadgePill>
            )}
            <Caption fontSize={11}>{formatRelative(item.createdAt)}</Caption>
          </XStack>
        </YStack>
      </XStack>

      <Timestamp fontSize={12}>{formatElapsed(item.processingDurationMs)}</Timestamp>

      <XStack gap="$xs">
        <IconButton
          icon={<Info size={14} color="$textSecondary" />}
          aria-label="Open detail"
          size={32}
          onPress={onOpenDetail}
        />
        <IconButton
          icon={<PlayCircle size={14} color="$accent" />}
          aria-label="Play with mpv"
          size={32}
          onPress={onPlay}
        />
        <IconButton
          icon={<RotateCcw size={14} color="$textSecondary" />}
          aria-label="Re-run in Generate (pre-fills URL so you can change model + re-translate or re-transcribe)"
          size={32}
          onPress={onReload}
        />
        <IconButton
          icon={<MoreHorizontal size={14} color="$textSecondary" />}
          aria-label="Open folder"
          size={32}
          onPress={onOpenFolder}
        />
      </XStack>
    </XStack>
  );
}
