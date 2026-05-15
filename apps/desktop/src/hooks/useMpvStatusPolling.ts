import { useEffect } from "react";
import { useDependencies } from "../state/dependencies";

const POLL_INTERVAL_MS = 60_000;

export function useMpvStatusPolling() {
  const refreshMpv = useDependencies((s) => s.refreshMpv);

  useEffect(() => {
    void refreshMpv();
    let timer: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (timer) return;
      timer = setInterval(() => {
        if (document.visibilityState === "visible") {
          void refreshMpv();
        }
      }, POLL_INTERVAL_MS);
    };

    const stopPolling = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshMpv();
        startPolling();
      } else {
        stopPolling();
      }
    };

    startPolling();
    document.addEventListener("visibilitychange", onVisibilityChange);

    // Tauri window focus (best-effort: import dynamically to avoid bundling outside Tauri).
    let unlistenFocus: (() => void) | null = null;
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-implied-eval
        const win = await (Function('return import("@tauri-apps/api/window")')() as Promise<typeof import("@tauri-apps/api/window")>);
        const currentWindow = (win as unknown as { getCurrentWindow?: () => unknown; getCurrent?: () => unknown }).getCurrentWindow
          ? (win as unknown as { getCurrentWindow: () => { onFocusChanged: (cb: (e: { payload: boolean }) => void) => Promise<() => void> } }).getCurrentWindow()
          : (win as unknown as { getCurrent: () => { onFocusChanged: (cb: (e: { payload: boolean }) => void) => Promise<() => void> } }).getCurrent();
        const u = await (currentWindow as { onFocusChanged: (cb: (e: { payload: boolean }) => void) => Promise<() => void> }).onFocusChanged(
          ({ payload: focused }: { payload: boolean }) => {
            if (focused) {
              void refreshMpv();
              startPolling();
            } else {
              stopPolling();
            }
          },
        );
        unlistenFocus = u;
      } catch {
        // Not running inside Tauri (web preview). Polling still works.
      }
    })();

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      unlistenFocus?.();
    };
  }, [refreshMpv]);
}
