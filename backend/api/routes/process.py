"""Streaming process endpoint."""
from __future__ import annotations

import json
import queue
import threading

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from api import jobs
from api.routes.metadata import _video_id_from_url, fetch_video_metadata
from api.schemas import ProcessRequest
from core.config import load_config
from core.pipeline import PipelineCancelled, run_pipeline

router = APIRouter(prefix="/api", tags=["process"])


@router.post("/process")
def process(req: ProcessRequest):
    """Run pipeline as NDJSON stream. Each line is a ProcessEvent JSON."""
    cfg = load_config()
    q: queue.Queue = queue.Queue()
    SENTINEL = object()

    try:
        cancel_event = jobs.claim_slot()
    except jobs.JobBusy as e:
        # 409 rather than a stream: there is no job to report progress for.
        raise HTTPException(status_code=409, detail=str(e)) from e

    def on_event(evt: dict) -> None:
        q.put(evt)

    def runner() -> None:
        try:
            # Metadata is fetched *inside* the thread so its failures become
            # stream events. Fetching it in the request handler meant the most
            # common error of all — a bad, private, or region-blocked URL —
            # produced a bare HTTP 500 with a text/plain body instead of the
            # NDJSON the client is reading, and leaked the job slot (the
            # `finally` below never ran), after which /process/cancel would
            # cheerfully report success with nothing running.
            meta = fetch_video_metadata(
                req.url,
                browser=cfg.cookie_browser,
                profile=cfg.cookie_profile,
                txt_path=cfg.cookies_txt_path,
            )
            request_dict = req.model_dump()
            request_dict["_meta_title"] = meta.get("title", "")
            request_dict["_meta_thumbnail_url"] = meta.get("thumbnail_url")
            request_dict["_meta_channel"] = meta.get("channel")
            request_dict["_meta_duration"] = meta.get("duration")
            request_dict["_video_id"] = _video_id_from_url(req.url)

            run_pipeline(req.url, request_dict, cfg, on_event, cancel_event=cancel_event)
        except PipelineCancelled:
            # Emit a structurally-compatible "error" event so the existing
            # frontend handler treats this as a clean termination rather than
            # a true error. `recoverable: True` keeps the UI offering a retry.
            q.put({"status": "error", "error": "cancelled", "recoverable": True})
        except Exception as e:
            q.put({"status": "error", "error": str(e), "recoverable": False})
        finally:
            jobs.release_slot(cancel_event)
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
    """Set the cancel flag on the in-flight job (process / transcribe /
    translate — all three share one slot). The pipeline polls this flag at
    every phase boundary and raises PipelineCancelled when set, which the
    runner converts to a clean stream termination.
    """
    return jobs.cancel_active()
