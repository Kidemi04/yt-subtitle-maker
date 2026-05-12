#!/usr/bin/env bash
# `pnpm dev` — split-window dev launcher (macOS / Terminal.app), WEB flow.
#
# Opens two new Terminal windows:
#   • "yt backend" — uvicorn api.main:app --reload   (the FastAPI backend, :8000)
#   • "yt web"     — expo start --web                 (the React UI dev server, :8081)
# then you open http://localhost:8081 in a browser. NO native Tauri window —
# fast reload, browser devtools, no Rust recompile.
#
# Want the real desktop app window instead? Run:  pnpm -F desktop tauri:dev
# The packaged app is unaffected — its release build spawns + supervises its own
# bundled backend; this script is dev-only.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [ ! -x "$REPO_ROOT/backend/.venv/bin/python" ]; then
  echo "✗ backend/.venv not found. Run:  scripts/setup-backend.sh" >&2
  exit 1
fi

# Bake the PATH from the terminal you ran `pnpm dev` in into the spawned windows
# (a Terminal-launched shell may not otherwise have pnpm / brew on PATH).
BAKED_PATH="$PATH"
CMD_BACKEND="/tmp/yt-subtitle-dev-backend.command"
CMD_WEB="/tmp/yt-subtitle-dev-web.command"

cat > "$CMD_BACKEND" <<EOF
#!/bin/bash
printf '\033]0;yt backend\007'
export PATH="$BAKED_PATH"
[ -f "\$HOME/.cargo/env" ] && . "\$HOME/.cargo/env"
cd "$REPO_ROOT/backend"
echo "── yt-subtitle-maker · backend (uvicorn --reload, http://127.0.0.1:8000) ──"
echo
"$REPO_ROOT/backend/.venv/bin/python" -m uvicorn api.main:app --host 127.0.0.1 --port 8000 --reload
echo
echo "[backend stopped — close this window, or use it as a shell]"
exec "\${SHELL:-/bin/zsh}" -l
EOF

cat > "$CMD_WEB" <<EOF
#!/bin/bash
printf '\033]0;yt web\007'
export PATH="$BAKED_PATH"
cd "$REPO_ROOT/apps/desktop"
echo "── yt-subtitle-maker · web UI (Expo, http://localhost:8081) ──"
echo
pnpm web
echo
echo "[web server stopped — close this window, or use it as a shell]"
exec "\${SHELL:-/bin/zsh}" -l
EOF

chmod +x "$CMD_BACKEND" "$CMD_WEB"

open_window() {  # $1 = path to a .command file
  if ! osascript -e "tell application \"Terminal\" to do script \"$1\"" >/dev/null 2>&1; then
    echo "✗ Couldn't open a Terminal window (osascript failed)." >&2
    echo "  If macOS prompted for Automation permission, allow it" >&2
    echo "  (System Settings → Privacy & Security → Automation → Terminal) and re-run." >&2
    echo "  Or just run this yourself in a new terminal:" >&2
    echo "    $1" >&2
    return 1
  fi
}

# --- backend window (skip if something already holds :8000, e.g. a stale --reload worker) ---
if lsof -nP -iTCP:8000 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "⚠ Something is already listening on 127.0.0.1:8000 — not opening a backend window."
  echo "  The web UI will talk to it. If it's a stale leftover, free the port with:"
  echo "    kill \$(lsof -ti tcp:8000)"
else
  echo "Opening backend window…"
  open_window "$CMD_BACKEND" || exit 1
  printf "Waiting for backend on :8000 "
  for _ in $(seq 1 30); do
    if curl -fs -o /dev/null "http://127.0.0.1:8000/" 2>/dev/null; then echo "— up."; break; fi
    printf "."
    sleep 0.5
  done
  echo
fi

echo "Opening web UI window…"
open_window "$CMD_WEB" || exit 1

cat <<'MSG'

Dev environment (two Terminal windows):
  • "yt backend" — uvicorn --reload  →  http://127.0.0.1:8000   (Ctrl-C to stop)
  • "yt web"     — Expo dev server    →  http://localhost:8081   (Ctrl-C to stop)

Open  http://localhost:8081  in your browser. No native app window.
(For the real desktop app window:  pnpm -F desktop tauri:dev)
MSG
