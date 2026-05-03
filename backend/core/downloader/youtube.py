"""YouTube audio/video download via yt-dlp."""
from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Callable

import yt_dlp

from core.downloader.cookies import build_cookie_opts

# Filesystem-unsafe characters on Windows (the strictest target). We strip these.
_UNSAFE = re.compile(r'[<>:"/\\|?*\x00-\x1f]')
_WHITESPACE = re.compile(r"\s+")
_MAX_FOLDER_LEN = 200


def safe_folder_name(title: str, video_id: str, ascii_only: bool = False) -> str:
    """Sanitize a video title for use as a folder name.

    The video_id is always appended so that even after aggressive sanitization
    the folder is unique and recoverable.

    Args:
        title: original title from yt-dlp metadata (may include Unicode, slashes, etc.)
        video_id: 11-char YouTube video ID
        ascii_only: if True, drop all non-ASCII chars (safest, but loses Chinese titles)
    """
    cleaned = _UNSAFE.sub("_", title)
    cleaned = _WHITESPACE.sub("_", cleaned).strip("_")
    if ascii_only:
        cleaned = cleaned.encode("ascii", errors="ignore").decode("ascii")
    suffix = f"_{video_id}"
    # Cap at MAX-len to keep total within Windows MAX_PATH headroom
    head_budget = _MAX_FOLDER_LEN - len(suffix)
    if len(cleaned) > head_budget:
        cleaned = cleaned[:head_budget]
    name = (cleaned + suffix).strip("_")
    return name or video_id


def download_audio(
    url: str,
    out_dir: str,
    cookie_browser: str = "",
    cookie_profile: str = "",
    cookies_txt_path: str = "",
    progress: Callable[[dict], None] | None = None,
) -> tuple[str, float]:
    """Download YouTube audio. Returns (audio_path, duration_seconds).

    The output is post-processed to 16kHz mono WAV via ffmpeg (Whisper's
    expected sample rate; matches part of the v1.5 hardening fix list).
    """
    Path(out_dir).mkdir(parents=True, exist_ok=True)

    progress_holder: dict = {}

    def _hook(d: dict) -> None:
        if progress and d.get("status") == "downloading":
            progress(d)
        if d.get("status") == "finished":
            progress_holder["filename"] = d["filename"]

    opts: dict = {
        "format": "bestaudio/best",
        "outtmpl": str(Path(out_dir) / "%(id)s.%(ext)s"),
        "quiet": True,
        "no_warnings": True,
        "progress_hooks": [_hook],
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "wav",
                "preferredquality": "0",
            },
            # Force 16kHz mono — matches Whisper's expected sample rate.
            # This is part of the v1.5 hardening: bad sample rates caused
            # the timestamp drift symptom in the regression report.
            {
                "key": "FFmpegMetadata",
            },
        ],
        # Convert to 16kHz mono via FFmpeg postprocessor args
        "postprocessor_args": ["-ar", "16000", "-ac", "1"],
    }
    opts.update(build_cookie_opts(cookie_browser, cookie_profile, cookies_txt_path))

    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=True)
        duration = float(info.get("duration", 0.0))

    # After postprocessor, the file is .wav
    base = progress_holder.get("filename", "")
    base_no_ext = os.path.splitext(base)[0]
    wav_path = base_no_ext + ".wav"
    if not os.path.exists(wav_path):
        # Some yt-dlp builds keep original ext path; pick first matching
        candidates = list(Path(out_dir).glob(f"{info['id']}.*"))
        if candidates:
            wav_path = str(candidates[0])
    return wav_path, duration
