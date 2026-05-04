"""Cookie verification endpoint.

Spec §6.2: "Try a small download to verify cookies". We do a metadata-only
extract (no actual download) against a stable public video. If yt-dlp can
extract a title without raising, the cookie config is at least syntactically
valid; for public videos this works even with no cookies (which is fine — the
purpose is to surface configuration errors like a stale cookies.txt path or
unsupported browser name).
"""
from __future__ import annotations

import yt_dlp
from fastapi import APIRouter

from core.config import load_config
from core.downloader.cookies import build_cookie_opts

router = APIRouter(prefix="/api", tags=["cookies"])

# Stable public video used as a smoke target. Long-lived, low-risk pick.
_TEST_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"


@router.post("/test-cookies")
def test_cookies() -> dict:
    cfg = load_config()
    try:
        opts: dict = {"quiet": True, "skip_download": True}
        opts.update(build_cookie_opts(
            browser=cfg.cookie_browser,
            profile=cfg.cookie_profile,
            txt_path=cfg.cookies_txt_path,
        ))
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(_TEST_URL, download=False)
        return {
            "ok": bool(info and info.get("title")),
            "title": info.get("title", "") if info else "",
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}
