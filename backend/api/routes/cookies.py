"""Cookie verification endpoint.

Spec §6.2: "Try a small download to verify cookies". We do a metadata-only
extract (no actual download) against a stable public video. If yt-dlp can
extract a title without raising, the cookie config is at least syntactically
valid; for public videos this works even with no cookies (which is fine — the
purpose is to surface configuration errors like a stale cookies.txt path or
unsupported browser name).

Body shape:
  Optional `{cookieBrowser?, cookieProfile?, cookiesTxtPath?}` so the
  Settings page can test the DRAFT (not the saved) config — otherwise the
  user has to Save first to test, which silently writes a broken config.
  Any field omitted/None falls back to the saved cfg value.

Response shape:
  {
    "ok": bool,
    "title": str,                 # empty when extraction failed
    "cookiesAttached": bool,      # cookies were structurally applied to yt-dlp
    "cookieSource": str,          # "browser:firefox", "txt:/path", "none"
    "error": str?,                # only on failure
  }

`cookiesAttached: false` + `ok: true` means the test only verified that yt-dlp
itself works against the public URL — it does NOT prove cookies will work for
restricted content. Frontend uses this to disambiguate "no cookies sent" from
"cookies attached cleanly".
"""
from __future__ import annotations

import yt_dlp
from fastapi import APIRouter, Body
from pydantic import BaseModel

from core.config import load_config
from core.downloader.cookies import build_cookie_opts
from core.downloader.js_runtime import build_js_runtime_opts

router = APIRouter(prefix="/api", tags=["cookies"])

# Stable public video used as a smoke target. Long-lived, low-risk pick.
_TEST_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"


class TestCookiesRequest(BaseModel):
    cookieBrowser: str | None = None
    cookieProfile: str | None = None
    cookiesTxtPath: str | None = None


def _describe_source(opts: dict) -> tuple[bool, str]:
    """Inspect built yt-dlp opts to report what cookie source was attached."""
    if "cookiesfrombrowser" in opts:
        spec = opts["cookiesfrombrowser"]
        browser = spec[0] if isinstance(spec, tuple) else str(spec)
        profile = spec[1] if isinstance(spec, tuple) and len(spec) > 1 else ""
        label = f"browser:{browser}"
        if profile:
            label += f"/{profile}"
        return True, label
    if "cookiefile" in opts:
        return True, f"txt:{opts['cookiefile']}"
    return False, "none"


@router.post("/test-cookies")
def test_cookies(
    req: TestCookiesRequest = Body(default_factory=TestCookiesRequest),  # noqa: B008
) -> dict:
    cfg = load_config()
    browser = req.cookieBrowser if req.cookieBrowser is not None else cfg.cookie_browser
    profile = req.cookieProfile if req.cookieProfile is not None else cfg.cookie_profile
    txt_path = (
        req.cookiesTxtPath if req.cookiesTxtPath is not None else cfg.cookies_txt_path
    )

    cookie_opts = build_cookie_opts(browser=browser, profile=profile, txt_path=txt_path)
    cookies_attached, cookie_source = _describe_source(cookie_opts)

    try:
        opts: dict = {"quiet": True, "skip_download": True, **cookie_opts}
        opts.update(build_js_runtime_opts(cfg.js_runtime_path))
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(_TEST_URL, download=False)
        return {
            "ok": bool(info and info.get("title")),
            "title": info.get("title", "") if info else "",
            "cookiesAttached": cookies_attached,
            "cookieSource": cookie_source,
        }
    except Exception as e:
        return {
            "ok": False,
            "error": str(e),
            "cookiesAttached": cookies_attached,
            "cookieSource": cookie_source,
        }
