"""PyInstaller entrypoint for the bundled backend.

Built into the `yt-subtitle-backend` executable by `packaging/backend.spec`.
Equivalent to `uvicorn api.main:app --host 127.0.0.1 --port 8000` but as a
frozen binary with no reloader.
"""
from __future__ import annotations

import uvicorn

from api.main import app

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
