/**
 * One-time @keyframes injection for components that need looping CSS
 * animations (pulse, indeterminate barber-pole). Tamagui's `animation`
 * preset only handles single-shot transitions — looping requires real
 * CSS keyframes.
 *
 * SSR safety: guards on `typeof document` so `tsc` + Expo's metro
 * server-render pass don't crash. The first browser-side import of a
 * component that calls `ensureKeyframes()` injects a single <style>
 * tag containing all rules; subsequent calls are no-ops via the
 * `data-yt-ui-keyframes` marker.
 *
 * Native: no-op. CSS keyframes don't exist there; the looping
 * animations gracefully degrade to static appearance, which is fine
 * for v1 (web/Tauri only).
 */

const STYLE_ID = "yt-ui-keyframes";

const KEYFRAMES_CSS = `
@keyframes yt-ui-pulse {
  0%, 100% { opacity: 0.4; }
  50%      { opacity: 1; }
}
@keyframes yt-ui-indeterminate {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(400%); }
}
@keyframes yt-ui-shimmer {
  0%   { transform: translateX(-100%); opacity: 0; }
  35%  { opacity: 1; }
  65%  { opacity: 1; }
  100% { transform: translateX(200%); opacity: 0; }
}
`;

let injected = false;

export function ensureKeyframes() {
  if (injected) return;
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) {
    injected = true;
    return;
  }
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = KEYFRAMES_CSS;
  document.head.appendChild(style);
  injected = true;
}
