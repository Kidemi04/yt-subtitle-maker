"""Cookie source builder for yt-dlp.

yt-dlp accepts either a browser name (`cookiesfrombrowser`) or a Netscape
cookies.txt path (`cookiefile`). Browser is preferred when both are set.
"""
from __future__ import annotations


def build_cookie_opts(browser: str, profile: str, txt_path: str) -> dict:
    """Translate user-facing cookie config into yt-dlp opts."""
    if browser:
        if profile:
            return {"cookiesfrombrowser": (browser, profile)}
        return {"cookiesfrombrowser": (browser,)}
    if txt_path:
        return {"cookiefile": txt_path}
    return {}
