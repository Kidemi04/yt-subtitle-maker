"""Dependency check + install endpoints (Whisper model download, ffmpeg/mpv probe)."""
from __future__ import annotations

import json
import queue
import threading
from typing import Any

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from core.dependency_manager import (
    MODELS_URLS,
    check_ffmpeg,
    check_mpv,
    check_whisper_model,
    download_whisper_model_generator,
)

router = APIRouter(prefix="/api/dependencies", tags=["dependencies"])


class InstallRequest(BaseModel):
    model: str
    engine: str | None = None


@router.get("")
def get_dependencies(engine: str | None = Query(default=None)) -> dict[str, Any]:
    """Return install state of every known Whisper model + ffmpeg/mpv presence.

    Optional ``?engine=`` query param. Absent or ``"openai-whisper"`` → today's
    behaviour. Any planned-but-not-yet-available engine → ``{"ok": False, ...}``.
    Unknown engine values are also rejected with the same error style.
    """
    if engine is not None and engine != "openai-whisper":
        return {
            "ok": False,
            "error": (
                f"engine {engine!r} is not yet available on this installation. "
                "Only 'openai-whisper' models can be checked or downloaded right now."
            ),
        }
    return {
        "models": {name: check_whisper_model(name) for name in MODELS_URLS},
        "ffmpegAvailable": check_ffmpeg(),
        "mpvAvailable": check_mpv(),
    }


@router.post("/install")
def install_model(req: InstallRequest):
    """Stream NDJSON progress events while downloading a Whisper model.

    Optional ``engine`` field in body. Absent or ``"openai-whisper"`` → today's
    behaviour. Any planned-but-not-yet-available engine → ``{"ok": False, ...}``.

    Event shape per line:
      {"status": "downloading", "downloaded": int, "total": int, "speed": float, "percent": float}
      {"status": "done", "model": str, "path": str}
      {"status": "error", "error": str, "recoverable": false}
    """
    if req.engine is not None and req.engine != "openai-whisper":
        return {
            "ok": False,
            "error": (
                f"engine {req.engine!r} is not yet available on this installation. "
                "Only 'openai-whisper' models can be downloaded right now."
            ),
        }

    if req.model not in MODELS_URLS:
        return {
            "ok": False,
            "error": f"Unknown model: {req.model!r}. Known: {list(MODELS_URLS.keys())}",
        }

    q: queue.Queue = queue.Queue()
    SENTINEL = object()

    def runner() -> None:
        try:
            for downloaded, total, speed in download_whisper_model_generator(req.model):
                percent = (downloaded / total * 100.0) if total > 0 else 0.0
                q.put({
                    "status": "downloading",
                    "downloaded": downloaded,
                    "total": total,
                    "speed": speed,
                    "percent": percent,
                })
            q.put({"status": "done", "model": req.model})
        except Exception as e:
            q.put({"status": "error", "error": str(e), "recoverable": False})
        finally:
            q.put(SENTINEL)

    threading.Thread(target=runner, daemon=True).start()

    def gen():
        while True:
            evt = q.get()
            if evt is SENTINEL:
                break
            yield json.dumps(evt) + "\n"

    return StreamingResponse(gen(), media_type="application/x-ndjson")
