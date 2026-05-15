import { useEffect } from "react";
import { useLibrary } from "../state/library";
import { apiClient } from "../state/client";
import { useDependencies } from "../state/dependencies";

function isTypingInInput(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || target.isContentEditable;
}

export function useLibraryKeyboardNav() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const state = useLibrary.getState();
      const deps = useDependencies.getState();

      // "/" focuses the search input.
      if (e.key === "/" && !isTypingInInput(e.target)) {
        const searchInput = document.querySelector<HTMLInputElement>(
          'input[placeholder^="Search title"]',
        );
        if (searchInput) {
          e.preventDefault();
          searchInput.focus();
        }
        return;
      }

      if (isTypingInInput(e.target)) return;

      const filtered = filteredItems(state);
      const currentIndex = state.selectedId
        ? filtered.findIndex((it) => it.videoId === state.selectedId)
        : -1;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = filtered[Math.min(currentIndex + 1, filtered.length - 1)];
        if (next) state.selectVideo(next.videoId);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = filtered[Math.max(currentIndex - 1, 0)];
        if (prev) state.selectVideo(prev.videoId);
      } else if (e.key === "Enter" && state.selectedId && state.detail) {
        e.preventDefault();
        if (!deps.mpv?.installed) return; // mpv-gated; ignore if missing
        const firstTranslation = state.detail.translations[0];
        const firstTranscribe = state.detail.transcribes[0];
        if (firstTranslation) {
          void apiClient.playMpv(state.selectedId, { translateId: firstTranslation.id });
        } else if (firstTranscribe) {
          void apiClient.playMpv(state.selectedId, { transcribeId: firstTranscribe.id });
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

function filteredItems(state: ReturnType<typeof useLibrary.getState>) {
  const q = state.search.trim().toLowerCase();
  if (!q) return state.items;
  return state.items.filter((item) => {
    const hay = [item.titleTranslated ?? "", item.titleOriginal ?? "", item.videoId]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}
