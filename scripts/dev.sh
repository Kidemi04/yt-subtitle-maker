#!/usr/bin/env bash
# `pnpm dev` — split-window dev launcher (macOS / Terminal.app).
#
# Opens two new Terminal windows:
#   • "yt backend"  — uvicorn api.main:app --reload  (the FastAPI backend)
#   • "yt frontend" — `tauri dev`  (the Tauri shell + Expo/Metro bundler + the app window)
# so each side's logs are in its own scrollback and you can restart either one
# without touching the other. The backend keeps running if you Ctrl-C / restart
# the frontend.
#
# The Tauri Rust code notices a backend already listening on :8000 and attaches
# to it instead of spawning a duplicate (see apps/desktop/src-tauri/src/lib.rs).
#
# The packaged app is unaffected — its release build still spawns and supervises
# its own bundled backend. For the old single-terminal dev mode, run
# `pnpm -F desktop tauri:dev` directly.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [ ! -x "$REPO_ROOT/backend/.venv/bin/python" ]; then
  echo "✗ backend/.venv not found. Run:  scripts/setup-backend.sh" >&2
  exit 1
fi

# Bake the PATH from the terminal you ran `pnpm dev` in into the spawned
# windows (a Terminal-launched shell may not otherwise have pnpm / cargo / brew
# on PATH depending on your rc files).
BAKED_PATH="$PATH"
CMD_BACKEND="/tmp/yt-subtitle-dev-backend.command"
CMD_FRONTEND="/tmp/yt-subtitle-dev-frontend.command"

cat > "$CMD_BACKEND" <<EOF
#!/bin/bash
printf '\033]0;yt backend\007'
export PATH="$BAKED_PATH"
[ -f "\$HOME/.cargo/env" ] && . "\$HOME/.cargo/env"
cd "$REPO_ROOT/backend"
echo "── yt-subtitle-maker · backend (uvicorn --reload, :8000) ──"
echo
"$REPO_ROOT/backend/.venv/bin/python" -m uvicorn api.main:app --host 127.0.0.1 --port 8000 --reload
echo
echo "[backend stopped — close this window, or use it as a shell]"
exec "\${SHELL:-/bin/zsh}" -l
EOF

cat > "$CMD_FRONTEND" <<EOF
#!/bin/bash
printf '\033]0;yt frontend\007'
export PATH="$BAKED_PATH"
[ -f "\$HOME/.cargo/env" ] && . "\$HOME/.cargo/env"
cd "$REPO_ROOT/apps/desktop"
echo "── yt-subtitle-maker · frontend (Tauri shell + Expo) ──"
echo
pnpm tauri:dev
echo
echo "[frontend stopped — close this window, or use it as a shell]"
exec "\${SHELL:-/bin/zsh}" -l
EOF

chmod +x "$CMD_BACKEND" "$CMD_FRONTEND"

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

echo "Opening backend window…"
open_window "$CMD_BACKEND" || exit 1

printf "Waiting for backend on :8000 "
for _ in $(seq 1 30); do
  if curl -fs -o /dev/null "http://127.0.0.1:8000/" 2>/dev/null; then echo "— up."; break; fi
  printf "."
  sleep 0.5
done
echo

echo "Opening frontend window…"
open_window "$CMD_FRONTEND" || exit 1

cat <<'MSG'

Two Terminal windows opened:
  • "yt backend"  — uvicorn --reload    (Ctrl-C there to stop the backend)
  • "yt frontend" — Tauri shell + Expo  (Ctrl-C / quit the app to stop it)
They run independently — restart the frontend without losing the backend.
MSG
