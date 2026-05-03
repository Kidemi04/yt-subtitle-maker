"""Streaming process endpoint."""
from __future__ import annotations

import json
import queue
import threading

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from api.routes.metadata import fetch_video_metadata, _video_id_from_url
from api.schemas import ProcessRequest
from core.config import load_config
from core.pipeline import run_pipeline

router = APIRouter(prefix="/api", tags=["process"])


@router.post("/process")
def process(req: ProcessRequest):
    """Run pipeline as NDJSON stream. Each line is a ProcessEvent JSON."""
    cfg = load_config()
    q: queue.Queue = queue.Queue()
    SENTINEL = object()

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
            run_pipeline(req.url, request_dict, cfg, on_event)
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
