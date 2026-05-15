import { create } from "zustand";
import type { MpvStatus, InstallMpvEvent } from "@yt-subtitle-maker/api-client";
import { InstallMpvUnsupportedError } from "@yt-subtitle-maker/api-client";
import { apiClient } from "./client";

interface InstallProgress {
  phase: InstallMpvEvent["phase"];
  bytesReceived?: number;
  bytesTotal?: number;
  message?: string;
}

interface DependenciesState {
  mpv: MpvStatus | null;
  loadingMpv: boolean;
  installProgress: InstallProgress | null;
  installError: string | null;
  unsupportedManualUrl: string | null;

  refreshMpv: () => Promise<void>;
  installMpv: () => Promise<boolean>; // resolves true on success
}

export const useDependencies = create<DependenciesState>((set, get) => ({
  mpv: null,
  loadingMpv: false,
  installProgress: null,
  installError: null,
  unsupportedManualUrl: null,

  refreshMpv: async () => {
    set({ loadingMpv: true });
    try {
      const mpv = await apiClient.fetchMpvStatus();
      set({ mpv, loadingMpv: false });
    } catch {
      set({ loadingMpv: false }); // keep last known value
    }
  },

  installMpv: async () => {
    set({ installProgress: null, installError: null, unsupportedManualUrl: null });
    try {
      for await (const evt of apiClient.installMpv()) {
        if (evt.phase === "error") {
          set({ installError: evt.message, installProgress: null });
          return false;
        }
        const next: InstallProgress = { phase: evt.phase };
        if (evt.phase === "downloading") {
          next.bytesReceived = evt.bytesReceived;
          next.bytesTotal = evt.bytesTotal;
        } else if ("message" in evt) {
          next.message = evt.message;
        }
        set({ installProgress: next });
      }
      // After the stream ends, refresh status to pick up the new bundled binary.
      await get().refreshMpv();
      set({ installProgress: null });
      return true;
    } catch (e) {
      if (e instanceof InstallMpvUnsupportedError) {
        set({ unsupportedManualUrl: e.manualUrl, installProgress: null });
        return false;
      }
      set({ installError: (e as Error).message, installProgress: null });
      return false;
    }
  },
}));
