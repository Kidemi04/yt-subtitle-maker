"""Dependency check + install endpoints (Whisper model download, ffmpeg/mpv probe)."""
from __future__ import annotations

import json
import queue
import threading
from typing import Any

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

from core.dependency_manager import (
    MODELS_URLS,
    IntegrityError,
    STT_ENGINE_ADDONS,
    UnsupportedPlatformError,
    check_ffmpeg,
    check_mpv,
    check_mpv_status,
    check_stt_engine_addon,
    check_whisper_model,
    download_whisper_model_generator,
    install_stt_engine_addon_generator,
    install_mpv_generator,
)

router = APIRouter(prefix="/api/dependencies", tags=["dependencies"])


class InstallRequest(BaseModel):
    model: str
    engine: str | None = None


class InstallEngineRequest(BaseModel):
    engine: str


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
        "mpvStatus": check_mpv_status(),
    }


@router.get("/mpv-status")
def get_mpv_status() -> dict[str, Any]:
    """Return only the mpv detection block — cheaper than /api/dependencies for polling."""
    return check_mpv_status()


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


@router.post("/install-engine")
def install_engine(req: InstallEngineRequest):
    """Stream NDJSON progress while installing an optional STT add-on package."""
    if req.engine not in STT_ENGINE_ADDONS:
        return {
            "ok": False,
            "error": (
                f"Unknown add-on engine: {req.engine!r}. "
                f"Known: {list(STT_ENGINE_ADDONS.keys())}"
            ),
        }

    if check_stt_engine_addon(req.engine):
        addon = STT_ENGINE_ADDONS[req.engine]
        return StreamingResponse(
            iter(
                [
                    json.dumps(
                        {
                            "status": "done",
                            "engine": req.engine,
                            "packageName": addon["package"],
                        }
                    )
                    + "\n"
                ]
            ),
            media_type="application/x-ndjson",
        )

    q: queue.Queue = queue.Queue()
    SENTINEL = object()

    def runner() -> None:
        try:
            for evt in install_stt_engine_addon_generator(req.engine):
                q.put(evt)
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


@router.post("/install-mpv")
def install_mpv():
    """Stream NDJSON events while downloading and installing the bundled mpv binary.

    Event shape per line (see install_mpv_generator):
        {"phase": "resolving", "message": str}
        {"phase": "downloading", "bytesReceived": int, "bytesTotal": int}
        {"phase": "verifying", "message": str}
        {"phase": "extracting", "message": str}
        {"phase": "done", "path": str, "version": str | None}
        {"phase": "error", "message": str}

    Returns HTTP 400 with {"supported": false, "manualUrl": ...} on unsupported platforms.
    """
    try:
        # Touch the generator once to surface unsupported-platform / pre-stream errors as HTTP 400.
        gen_iter = install_mpv_generator()
        first = next(gen_iter)
    except UnsupportedPlatformError:
        return JSONResponse(
            status_code=400,
            content={"supported": False, "manualUrl": "https://mpv.io/installation/"},
        )
    except StopIteration:
        return JSONResponse(status_code=500, content={"error": "generator yielded nothing"})

    q: queue.Queue = queue.Queue()
    SENTINEL = object()

    def runner() -> None:
        try:
            q.put(first)
            for evt in gen_iter:
                q.put(evt)
        except IntegrityError as e:
            q.put({"phase": "error", "message": f"integrity check failed: {e}"})
        except Exception as e:
            q.put({"phase": "error", "message": str(e)})
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
