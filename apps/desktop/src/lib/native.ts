// apps/desktop/src/lib/native.ts
// Single source of truth for "are we inside the Tauri shell?" plus the thin
// wrappers around native-only / backend-mediated affordances. Settings
// components import from here so the isTauri() guard is one line per call
// site, and so the Tauri-only `@tauri-apps/plugin-dialog` import is lazy —
// importing this module on the `pnpm web` flow must not crash.

import { apiClient } from "../state/client";

/** True inside the Tauri 2 webview; false in `pnpm web` and SSR. */
export function isTauri(): boolean {
  // Tauri v2 sets window.__TAURI_INTERNALS__ at injection time.
  // (v1 used window.__TAURI__; we no longer support v1.)
  return (
    typeof window !== "undefined" &&
    typeof (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !==
      "undefined"
  );
}

/** Open a native directory picker. Returns the chosen path, or null on cancel.
 *  Throws if called outside the Tauri runtime — callers must `isTauri()` first.
 */
export async function openDirectoryDialog(opts?: {
  defaultPath?: string;
  title?: string;
}): Promise<string | null> {
  if (!isTauri()) {
    throw new Error("openDirectoryDialog is only available in the Tauri runtime");
  }
  // Lazy-load so the `pnpm web` bundle never tries to execute the Tauri plugin.
  // We use a Function-wrapped import() to satisfy tsc under the Expo tsconfig
  // (which defaults module to CommonJS, blocking import() syntax at parse time).
  // Metro/Babel transpiles this correctly at runtime.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const { open } = await (Function('return import("@tauri-apps/plugin-dialog")')() as Promise<typeof import("@tauri-apps/plugin-dialog")>);
  const result = await open({
    directory: true,
    multiple: false,
    defaultPath: opts?.defaultPath,
    title: opts?.title,
  });
  if (result == null) return null;
  // v2 returns string for single-pick; arrays only when multiple:true.
  return typeof result === "string" ? result : result[0] ?? null;
}

/** Open a native file picker for an executable. Returns the chosen path, or
 *  null on cancel. We don't filter by extension because executables have no
 *  consistent extension on macOS / Linux (and on Windows it's `.exe`); a user
 *  who is manually pointing at a binary already knows where it lives. Throws
 *  if called outside the Tauri runtime — callers must `isTauri()` first.
 */
export async function openExecutableDialog(): Promise<string | null> {
  if (!isTauri()) {
    throw new Error("openExecutableDialog is only available in the Tauri runtime");
  }
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const { open } = await (Function('return import("@tauri-apps/plugin-dialog")')() as Promise<typeof import("@tauri-apps/plugin-dialog")>);
  const result = await open({
    directory: false,
    multiple: false,
    title: "Pick an executable",
  });
  if (result == null) return null;
  return typeof result === "string" ? result : result[0] ?? null;
}

/** Open a native file picker (JSON). Returns the chosen path, or null on cancel. */
export async function openJsonFileDialog(): Promise<string | null> {
  if (!isTauri()) {
    throw new Error("openJsonFileDialog is only available in the Tauri runtime");
  }
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const { open } = await (Function('return import("@tauri-apps/plugin-dialog")')() as Promise<typeof import("@tauri-apps/plugin-dialog")>);
  const result = await open({
    multiple: false,
    filters: [{ name: "Settings JSON", extensions: ["json"] }],
  });
  if (result == null) return null;
  return typeof result === "string" ? result : result[0] ?? null;
}

/** Ask the backend to open ~/.yt_subtitle_tool/ in the OS file manager. */
export async function openConfigFolder(): Promise<{ ok: boolean; error?: string }> {
  const baseUrl = (apiClient as unknown as { baseUrl: string }).baseUrl
    ?? "http://127.0.0.1:8000";
  const res = await fetch(`${baseUrl}/api/system/open-config-dir`, { method: "POST" });
  if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
  return res.json();
}

/** Launch mpv on the bundled clip with the saved subtitle style. */
export async function testPlayback(): Promise<{ ok: boolean; pid?: number; error?: string }> {
  const baseUrl = (apiClient as unknown as { baseUrl: string }).baseUrl
    ?? "http://127.0.0.1:8000";
  const res = await fetch(`${baseUrl}/api/system/test-playback`, { method: "POST" });
  if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
  return res.json();
}
