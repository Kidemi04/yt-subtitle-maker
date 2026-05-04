"""Video metadata endpoint."""
from __future__ import annotations

import re

import yt_dlp
from fastapi import APIRouter
from pydantic import BaseModel

from api.schemas import VideoMetadata
from core.config import load_config
from core.downloader.cookies import build_cookie_opts
from core.downloader.js_runtime import build_js_runtime_opts

router = APIRouter(prefix="/api", tags=["metadata"])


class MetadataRequest(BaseModel):
    url: str


def _video_id_from_url(url: str) -> str:
    m = re.search(r"(?:v=|/)([0-9A-Za-z_-]{11})", url)
    return m.group(1) if m else "unknown"


def fetch_video_metadata(url: str, **cookie_kwargs) -> dict:
    """Lightweight metadata fetch using yt-dlp's flat extractor."""
    cfg = load_config()
    opts: dict = {"quiet": True, "skip_download": True}
    opts.update(build_cookie_opts(**cookie_kwargs))
    opts.update(build_js_runtime_opts(cfg.js_runtime_path))
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=False)
    return {
        "title": info.get("title", ""),
        "thumbnail_url": info.get("thumbnail"),
        "duration": info.get("duration", 0),
        "channel": info.get("channel"),
    }


@router.post("/metadata", response_model=VideoMetadata)
def get_metadata(req: MetadataRequest) -> VideoMetadata:
    try:
        cfg = load_config()
        meta = fetch_video_metadata(
            req.url,
            browser=cfg.cookie_browser,
            profile=cfg.cookie_profile,
            txt_path=cfg.cookies_txt_path,
        )
        video_id = _video_id_from_url(req.url)
        thumb = meta.get("thumbnail_url")
        if video_id != "unknown" and (not thumb or "maxresdefault" in (thumb or "")):
            thumb = f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"
        return VideoMetadata(
            ok=True,
            videoId=video_id,
            titleOriginal=meta["title"],
            thumbnailUrl=thumb,
            durationSeconds=meta.get("duration") or 0,
            channel=meta.get("channel"),
        )
    except Exception as e:
        return VideoMetadata(ok=False, error=str(e))
