"""Streaming process endpoint."""
from __future__ import annotations

import json
import queue
import threading

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from api.routes.metadata import _video_id_from_url, fetch_video_metadata
from api.schemas import ProcessRequest
from core.config import load_config
from core.pipeline import PipelineCancelled, run_pipeline

router = APIRouter(prefix="/api", tags=["process"])

# Single in-flight job slot. V1 only supports one process at a time; if a new
# job arrives while one is running, the old slot is replaced and the older job
# is effectively orphaned (won't be cancellable from the new POST /cancel call).
_active_cancel: dict[str, threading.Event | None] = {"event": None}


@router.post("/process")
def process(req: ProcessRequest):
    """Run pipeline as NDJSON stream. Each line is a ProcessEvent JSON."""
    cfg = load_config()
    q: queue.Queue = queue.Queue()
    SENTINEL = object()

    cancel_event = threading.Event()
    _active_cancel["event"] = cancel_event

    # Pre-fetch metadata so pipeline can name folder by title
    meta = fetch_video_metadata(
        req.url,
        browser=cfg.cookie_browser,
        profile=cfg.cookie_profile,
        txt_path=cfg.cookies_txt_path,
    )
    video_id = _video_id_from_url(req.url)
    request_dict = req.model_dump()
    request_dict["_meta_title"] = meta.get("title", "")
    request_dict["_video_id"] = video_id

    def on_event(evt: dict) -> None:
        q.put(evt)

    def runner() -> None:
        try:
            run_pipeline(req.url, request_dict, cfg, on_event, cancel_event=cancel_event)
        except PipelineCancelled:
            # Emit a structurally-compatible "error" event so the existing
            # frontend handler treats this as a clean termination rather than
            # a true error. `recoverable: True` keeps the UI offering a retry.
            q.put({"status": "error", "error": "cancelled", "recoverable": True})
        except Exception as e:
            q.put({"status": "error", "error": str(e), "recoverable": False})
        finally:
            # Clear the slot so /process/cancel correctly reports "no active job"
            # after this run finishes. Guard against a newer job already taking
            # the slot — only clear if we still own it.
            if _active_cancel.get("event") is cancel_event:
                _active_cancel["event"] = None
            q.put(SENTINEL)

    threading.Thread(target=runner, daemon=True).start()

    def gen():
        while True:
            evt = q.get()
            if evt is SENTINEL:
                break
            yield json.dumps(evt) + "\n"

    return StreamingResponse(gen(), media_type="application/x-ndjson")


@router.post("/process/cancel")
def cancel_process() -> dict:
    """Set the cancel flag on the in-flight pipeline job, if any.

    The pipeline polls this flag at every phase boundary + progress callback
    and raises PipelineCancelled when set, which the runner converts to a
    clean stream termination.
    """
    evt = _active_cancel.get("event")
    if evt is None:
        return {"ok": False, "error": "no active job"}
    evt.set()
    return {"ok": True}
