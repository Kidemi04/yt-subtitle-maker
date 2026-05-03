import os
from typing import Optional, Dict
from yt_dlp import YoutubeDL

def fetch_video_metadata(youtube_url: str, cookie_browser: str = "", cookies_txt_path: str = "", cookie_profile: str = "") -> Dict[str, Optional[str]]:
    """
    Fetch basic metadata for a YouTube video.

    Returns a dict like:
    {
        "title": "Video Title",
        "thumbnail_url": "https://...",
    }

    On error, return None for the fields or raise a clear exception.
    """
    def _build_opts(with_cookies: bool):
        opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
        }
        if with_cookies:
            if cookie_browser:
                from core.audio_downloader import _build_cookie_opts
                opts.update(_build_cookie_opts(cookie_browser, cookies_txt_path, cookie_profile))
            elif cookies_txt_path and os.path.isfile(cookies_txt_path):
                opts['cookiefile'] = cookies_txt_path
        return opts

    def _do_fetch(opts):
        with YoutubeDL(opts) as ydl:
            info = ydl.extract_info(youtube_url, download=False)
            if not info:
                raise Exception("No video information found.")
            return {
                "title": info.get("title"),
                "thumbnail_url": info.get("thumbnail"),
                "duration": info.get("duration"),
            }

    has_cookies = bool(cookie_browser or (cookies_txt_path and os.path.isfile(cookies_txt_path)))

    try:
        return _do_fetch(_build_opts(with_cookies=has_cookies))
    except Exception as e:
        # If cookies caused the failure, retry without them
        if has_cookies:
            try:
                return _do_fetch(_build_opts(with_cookies=False))
            except Exception as e2:
                raise Exception(f"Failed to fetch metadata: {str(e2)}")
        raise Exception(f"Failed to fetch metadata: {str(e)}")
