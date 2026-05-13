/**
 * VideoDetailModal — full per-video detail view used by the Library grid AND
 * the History row.
 *
 * Owns the Modal wrapper itself so callers don't need to repeat
 * `<Modal open={...}>...</Modal>` plumbing. Fetches GET /api/library/{videoId}
 * on open; renders Transcripts + Translations sections with per-run Play and
 * Delete; offers New transcript / New translation entry points; cascade-
 * delete is enforced server-side and reflected via re-fetch.
 *
 * Fallback display fields (title/thumbnail/url) are accepted because the
 * caller usually already has them from the list/history endpoint and we
 * want the modal to render something during the brief fetch.
 */
import * as React from "react";
import { Stack, XStack, YStack } from "tamagui";
import {
  PlayCircle,
  Languages,
  Plus,
  Trash2,
} from "@tamagui/lucide-icons";
import {
  GlassCard,
  Modal,
  ConfirmDialog,
  IconButton,
  ButtonSecondary,
  ButtonGhost,
  BadgePill,
  DisplaySm,
  TitleLg,
  BodySm,
  Caption,
  CaptionUpper,
} from "@yt-subtitle-maker/ui";
import { useRouter } from "expo-router";
import type {
  TranscribeRun,
  TranslateRun,
  VideoDetail,
} from "@yt-subtitle-maker/api-client";
import { apiClient } from "../state/client";
import { NewTranscribeModal } from "./NewTranscribeModal";
import { NewTranslationModal } from "./NewTranslationModal";
import { humanEngine, humanTranslator } from "../constants";

export interface VideoDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoId: string;
  /** Shown until VideoDetail is fetched. */
  fallbackTitle?: string;
  fallbackThumbnailUrl?: string;
  fallbackUrl?: string;
  fallbackCreatedAt?: string;
  /** Called after the user deletes the entire library entry from this modal. */
  onDeleted?: () => void;
}

export function VideoDetailModal({
  open,
  onOpenChange,
  videoId,
  fallbackTitle,
  fallbackThumbnailUrl,
  fallbackUrl,
  fallbackCreatedAt,
  onDeleted,
}: VideoDetailModalProps) {
  const router = useRouter();
  const [detail, setDetail] = React.useState<VideoDetail | null>(null);
  const [error, setError] = React.useState<string | undefined>();
  const [busy, setBusy] = React.useState(false);
  const [newTranscribeOpen, setNewTranscribeOpen] = React.useState(false);
  const [newTranslationOpen, setNewTranslationOpen] = React.useState(false);
  const [translationSourceId, setTranslationSourceId] = React.useState<
    string | undefined
  >(undefined);

  // Single state for any pending destructive confirmation. The native
  // window.confirm() leaked OS chrome (PRODUCT.md anti-reference #3); we
  // now use one ConfirmDialog mounted at the bottom of the tree.
  type PendingDelete =
    | { kind: "video" }
    | { kind: "transcript"; id: string }
    | { kind: "translation"; id: string }
    | null;
  const [pendingDelete, setPendingDelete] = React.useState<PendingDelete>(null);

  const refreshDetail = React.useCallback(async () => {
    setError(undefined);
    try {
      const d = await apiClient.fetchVideoDetail(videoId);
      setDetail(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [videoId]);

  React.useEffect(() => {
    if (!open) return;
    void refreshDetail();
  }, [open, refreshDetail]);

  const onClose = () => onOpenChange(false);

  const onOpenFolder = async () => {
    try {
      await apiClient.openLibraryFolder(videoId);
    } catch {
      /* backend may not support this on the current platform */
    }
  };

  const onPlayTranscript = async (id: string) => {
    await apiClient.playMpv(videoId, { transcribeId: id });
  };
  const onPlayTranslation = async (id: string) => {
    await apiClient.playMpv(videoId, { translateId: id });
  };

  const performPendingDelete = async () => {
    if (!pendingDelete) return;
    if (pendingDelete.kind === "video") {
      setBusy(true);
      try {
        await apiClient.deleteLibraryItem(videoId);
        onClose();
        onDeleted?.();
      } finally {
        setBusy(false);
      }
    } else if (pendingDelete.kind === "transcript") {
      await apiClient.deleteSrt(videoId, "transcribe", pendingDelete.id);
      await refreshDetail();
    } else if (pendingDelete.kind === "translation") {
      await apiClient.deleteSrt(videoId, "translate", pendingDelete.id);
      await refreshDetail();
    }
  };

  const onDeleteVideo = () => setPendingDelete({ kind: "video" });
  const onDeleteTranscript = (id: string) =>
    setPendingDelete({ kind: "transcript", id });
  const onDeleteTranslation = (id: string) =>
    setPendingDelete({ kind: "translation", id });

  const pendingDeleteCopy = (() => {
    if (!pendingDelete) return { title: "", message: "" };
    if (pendingDelete.kind === "video") {
      return {
        title: "Delete the entire library entry?",
        message: `"${
          detail?.titleOriginal ?? fallbackTitle ?? videoId
        }" — this removes the audio and all SRTs. Cannot be undone.`,
      };
    }
    if (pendingDelete.kind === "transcript") {
      return {
        title: "Delete this transcript?",
        message:
          "Any translations derived from it will also be deleted. Cannot be undone.",
      };
    }
    return {
      title: "Delete this translation?",
      message: "The translated SRT will be removed. Cannot be undone.",
    };
  })();

  const translationsBySource = React.useMemo(() => {
    const map = new Map<string, TranslateRun[]>();
    for (const tr of detail?.translations ?? []) {
      const arr = map.get(tr.sourceTranscribeId) ?? [];
      arr.push(tr);
      map.set(tr.sourceTranscribeId, arr);
    }
    return map;
  }, [detail?.translations]);

  const titleForHeader =
    detail?.titleTranslated ?? detail?.titleOriginal ?? fallbackTitle ?? videoId;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={titleForHeader}
      width={640}
    >
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
                : fallbackThumbnailUrl
                  ? `url(${fallbackThumbnailUrl})`
                  : "linear-gradient(135deg, #1a1a1d 0%, #0a0a0c 100%)",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          <YStack flex={1} gap="$xs" minWidth={0}>
            <TitleLg numberOfLines={2}>{titleForHeader}</TitleLg>
            <BodySm color="$textSecondary" numberOfLines={1}>
              {detail?.url ?? fallbackUrl ?? `https://www.youtube.com/watch?v=${videoId}`}
            </BodySm>
            <XStack gap="$xs" flexWrap="wrap" alignItems="center">
              <BadgePill tone="neutral">{videoId}</BadgePill>
              {typeof detail?.durationSeconds === "number" ? (
                <Caption fontSize={11}>
                  {formatDuration(detail.durationSeconds)}
                </Caption>
              ) : null}
              <Caption fontSize={11}>
                added {formatRelative(detail?.createdAt ?? fallbackCreatedAt)}
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
                    setTranslationSourceId(t.id);
                    setNewTranslationOpen(true);
                  }}
                  onDelete={() => onDeleteTranscript(t.id)}
                />
              ))}
            </YStack>
          )}
          <ButtonGhost onPress={() => setNewTranscribeOpen(true)}>
            <XStack gap="$xs" alignItems="center">
              <Plus size={14} color="$textSecondary" />
              <BodySm fontWeight="500" color="$textSecondary">
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
                const sourceLabel = [
                  humanEngine(t.engine),
                  t.model,
                  t.language,
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <YStack key={t.id} gap="$xs">
                    <CaptionUpper>from · {sourceLabel}</CaptionUpper>
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
                    <CaptionUpper>source transcript deleted</CaptionUpper>
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
              setTranslationSourceId(undefined);
              setNewTranslationOpen(true);
            }}
            disabled={!detail || detail.transcribes.length === 0}
          >
            <XStack gap="$xs" alignItems="center">
              <Plus size={14} color="$textSecondary" />
              <BodySm fontWeight="500" color="$textSecondary">
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

        <NewTranscribeModal
          open={newTranscribeOpen}
          onOpenChange={setNewTranscribeOpen}
          videoId={videoId}
          onComplete={() => void refreshDetail()}
        />
        <NewTranslationModal
          open={newTranslationOpen}
          onOpenChange={setNewTranslationOpen}
          videoId={videoId}
          transcribes={detail?.transcribes ?? []}
          initialSourceTranscribeId={translationSourceId}
          onComplete={() => void refreshDetail()}
        />
        <ConfirmDialog
          open={pendingDelete !== null}
          onOpenChange={(open) => {
            if (!open) setPendingDelete(null);
          }}
          title={pendingDeleteCopy.title}
          message={pendingDeleteCopy.message}
          confirmLabel="Delete"
          onConfirm={() => {
            void performPendingDelete();
          }}
        />
      </YStack>
    </Modal>
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
  const facets = [humanEngine(run.engine), run.model, run.language]
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
        <BodySm numberOfLines={1}>{facets}</BodySm>
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
  const facets = [
    humanTranslator(run.translator),
    run.translatorModel,
    run.targetLang,
  ]
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
      backgroundColor="$accentSoft"
      borderWidth={1}
      borderColor="$accentDim"
    >
      <IconButton
        icon={<PlayCircle size={14} color="$accent" />}
        aria-label="Play with this translation"
        size={32}
        onPress={onPlay}
      />
      <YStack flex={1} gap={2} minWidth={0}>
        <BodySm numberOfLines={1} color="$textPrimary">
          {facets}
        </BodySm>
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
