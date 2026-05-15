import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { LibraryItem, VideoDetail } from "@yt-subtitle-maker/api-client";
import { apiClient } from "./client";

export type LibraryView = "rows" | "cards";

interface LibraryState {
  // server data
  items: LibraryItem[];
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  detail: VideoDetail | null;
  loadingDetail: boolean;

  // UI state
  view: LibraryView;
  search: string;

  // actions
  fetchList: () => Promise<void>;
  selectVideo: (videoId: string | null) => void;
  refreshDetail: () => Promise<void>;
  setView: (view: LibraryView) => void;
  setSearch: (search: string) => void;
  deleteTranscript: (transcribeId: string) => Promise<void>;
  deleteTranslation: (translateId: string) => Promise<void>;
  deleteVideo: (videoId: string) => Promise<void>;
}

// Debounce detail fetches so rapid keyboard navigation doesn't thrash the backend.
let detailFetchTimer: ReturnType<typeof setTimeout> | null = null;

export const useLibrary = create<LibraryState>()(
  persist(
    (set, get) => ({
      items: [],
      loading: false,
      error: null,
      selectedId: null,
      detail: null,
      loadingDetail: false,
      view: "rows",
      search: "",

      fetchList: async () => {
        set({ loading: true, error: null });
        try {
          const res = await apiClient.fetchLibrary();
          set({ items: res.items, loading: false });
          // Auto-select most recent if nothing selected and we're on a wide viewport.
          const state = get();
          const wideViewport = typeof window !== "undefined" && window.innerWidth > 720;
          if (!state.selectedId && res.items.length > 0 && wideViewport) {
            state.selectVideo(res.items[0].videoId);
          }
        } catch (e) {
          set({ loading: false, error: (e as Error).message });
        }
      },

      selectVideo: (videoId) => {
        if (get().selectedId === videoId) return;
        set({ selectedId: videoId, detail: null });
        if (detailFetchTimer) clearTimeout(detailFetchTimer);
        if (!videoId) return;
        detailFetchTimer = setTimeout(() => {
          void get().refreshDetail();
        }, 100);
      },

      refreshDetail: async () => {
        const videoId = get().selectedId;
        if (!videoId) return;
        set({ loadingDetail: true });
        try {
          const detail = await apiClient.fetchVideoDetail(videoId);
          // Guard against stale responses if the user already moved on.
          if (get().selectedId !== videoId) return;
          set({ detail, loadingDetail: false });
        } catch (e) {
          if (get().selectedId !== videoId) return;
          set({ loadingDetail: false, error: (e as Error).message });
        }
      },

      setView: (view) => set({ view }),
      setSearch: (search) => set({ search }),

      deleteTranscript: async (transcribeId) => {
        const videoId = get().selectedId;
        if (!videoId) return;
        await apiClient.deleteSrt(videoId, "transcribe", transcribeId);
        await get().refreshDetail();
      },

      deleteTranslation: async (translateId) => {
        const videoId = get().selectedId;
        if (!videoId) return;
        await apiClient.deleteSrt(videoId, "translate", translateId);
        await get().refreshDetail();
      },

      deleteVideo: async (videoId) => {
        await apiClient.deleteLibraryItem(videoId);
        const { items, selectedId } = get();
        const remaining = items.filter((item) => item.videoId !== videoId);
        set({
          items: remaining,
          selectedId: selectedId === videoId ? null : selectedId,
          detail: selectedId === videoId ? null : get().detail,
        });
      },
    }),
    {
      name: "library-ui",
      partialize: (state) => ({ view: state.view }),
    },
  ),
);
