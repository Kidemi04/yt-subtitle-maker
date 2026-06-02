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
    STT_ENGINE_ADDONS,
    IntegrityError,
    UnsupportedPlatformError,
    check_ffmpeg,
    check_mpv,
    check_mpv_status,
    check_stt_engine_addon,
    install_mpv_generator,
    install_stt_engine_addon_generator,
)
from core.stt import model_catalog

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
    engine_id = engine or "openai-whisper"
    try:
        models = model_catalog.engine_model_state(engine_id)
    except ValueError as exc:
        return {"ok": False, "error": str(exc)}
    return {
        "models": models,
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
    engine_id = req.engine or "openai-whisper"
    if engine_id not in model_catalog.IMPLEMENTED_ENGINES:
        return {"ok": False, "error": f"unknown engine: {engine_id!r}"}

    if req.model not in model_catalog.MODEL_VARIETIES:
        return {
            "ok": False,
            "error": f"Unknown model: {req.model!r}. Known: {model_catalog.MODEL_VARIETIES}",
        }

    q: queue.Queue = queue.Queue()
    SENTINEL = object()

    def runner() -> None:
        try:
            last_path = None
            for downloaded, total, speed, path in model_catalog.download_engine_model_generator(
                engine_id,
                req.model,
            ):
                last_path = path
                percent = (downloaded / total * 100.0) if total > 0 else 0.0
                q.put({
                    "status": "downloading",
                    "downloaded": downloaded,
                    "total": total,
                    "speed": speed,
                    "percent": percent,
                })
            done = {"status": "done", "model": req.model, "engine": engine_id}
            if last_path:
                done["path"] = str(last_path)
            q.put(done)
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
