import { create } from "zustand";

export type LogLevel = "error" | "warning" | "info" | "debug";

export interface LogEntry {
  id: number;
  ts: number;          // epoch ms
  level: LogLevel;
  message: string;
}

interface LogsState {
  entries: LogEntry[];
  filter: LogLevel | "all";
  drawerOpen: boolean;
  push: (level: LogLevel, message: string) => void;
  clear: () => void;
  setFilter: (f: LogLevel | "all") => void;
  setDrawerOpen: (open: boolean) => void;
  toggleDrawer: () => void;
}

let nextId = 1;

export const useLogs = create<LogsState>((set) => ({
  entries: [
    {
      id: nextId++,
      ts: Date.now() - 30000,
      level: "info" as const,
      message: "Frontend booted · Tamagui + Expo SDK 51 + Tauri 2",
    },
    {
      id: nextId++,
      ts: Date.now() - 24000,
      level: "info" as const,
      message: "Connected to backend at 127.0.0.1:8000",
    },
    {
      id: nextId++,
      ts: Date.now() - 12000,
      level: "debug" as const,
      message: "Whisper model installed: turbo (~1.5 GB)",
    },
  ],
  filter: "all",
  drawerOpen: false,
  push(level, message) {
    set((s) => ({
      entries: [
        ...s.entries,
        { id: nextId++, ts: Date.now(), level, message },
      ].slice(-500),
    }));
  },
  clear() {
    set({ entries: [] });
  },
  setFilter(filter) {
    set({ filter });
  },
  setDrawerOpen(open) {
    set({ drawerOpen: open });
  },
  toggleDrawer() {
    set((s) => ({ drawerOpen: !s.drawerOpen }));
  },
}));
