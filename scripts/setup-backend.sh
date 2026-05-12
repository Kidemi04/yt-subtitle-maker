#!/usr/bin/env bash
# Create the backend virtualenv and install its dependencies.
# Requires Python 3.11, 3.12, or 3.13 (NOT 3.14 — PyTorch has no 3.14 wheels yet).
# Override the interpreter with PYTHON=, e.g.  PYTHON=python3.12 scripts/setup-backend.sh
set -euo pipefail

cd "$(dirname "$0")/.."            # repo root
PYTHON="${PYTHON:-python3}"

ver="$("$PYTHON" -c 'import sys; print("%d.%d" % sys.version_info[:2])')"
case "$ver" in
  3.11|3.12|3.13) ;;
  *)
    echo "Error: Python $ver detected. Need 3.11, 3.12, or 3.13 (PyTorch lacks 3.14 wheels)." >&2
    echo "Install one and re-run, e.g.:  PYTHON=python3.12 scripts/setup-backend.sh" >&2
    exit 1
    ;;
esac

echo "Creating backend/.venv with Python $ver..."
"$PYTHON" -m venv backend/.venv
backend/.venv/bin/python -m pip install --upgrade pip
backend/.venv/bin/python -m pip install -e "backend[dev]"
echo
echo "✓ Backend venv ready at backend/.venv"
echo "  Start everything with:  pnpm dev"
