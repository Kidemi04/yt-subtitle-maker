"""Library endpoints: list stored media + SRT files, delete, open folder, download.

Per spec §14 #3, /api/library JSON responses MUST NOT include absolute filesystem
paths. Files are exposed via download URLs (/api/library/{video_id}/file/{name})
so V2 mobile can consume the same API over ngrok without local paths.
"""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from core.config import load_config

router = APIRouter(prefix="/api/library", tags=["library"])

VIDEO_ID_LEN = 11
SRT_AUDIO_EXTS = {".srt", ".wav", ".m4a", ".mp3", ".mp4"}


class VideoIdRequest(BaseModel):
    videoId: str


def _output_dir() -> Path:
    cfg = load_config()
    out = cfg.output_dir or "output"
    return Path(out)


def _find_folder_for(video_id: str) -> Path | None:
    """Locate the folder that ends with `_{video_id}`."""
    out = _output_dir()
    if not out.is_dir():
        return None
    suffix = f"_{video_id}"
    for entry in out.iterdir():
        if entry.is_dir() and entry.name.endswith(suffix):
            return entry
    return None


def _scan_folder(folder: Path, video_id: str) -> dict[str, Any]:
    """Build the per-item shape from a video folder."""
    files = list(folder.iterdir())
    original_srt = next((f for f in files if f.name == f"{video_id}_original.srt"), None)
    translated_srt = next(
        (f for f in files if f.name.startswith(f"{video_id}_") and f.name.endswith(".srt") and not f.name.endswith("_original.srt")),
        None,
    )
    audio = next((f for f in files if f.name.startswith(f"{video_id}.") and f.suffix in {".wav", ".m4a", ".mp3"}), None)
    video = next((f for f in files if f.name.startswith(f"{video_id}.") and f.suffix in {".mp4", ".webm", ".mkv"}), None)

    def _url(f: Path | None) -> str | None:
        return f"/api/library/{video_id}/file/{f.name}" if f else None

    # Title is the folder name with the trailing _{video_id} stripped
    title = folder.name[: -(len(video_id) + 1)] if folder.name.endswith(f"_{video_id}") else folder.name

    # If a _history.json sidecar exists (written by the pipeline), use it to
    # populate the translated title. Otherwise leave it None.
    title_translated: str | None = None
    sidecar = folder / "_history.json"
    if sidecar.is_file():
        try:
            data = json.loads(sidecar.read_text(encoding="utf-8"))
            tt = data.get("titleTranslated")
            if isinstance(tt, str) and tt:
                title_translated = tt
        except Exception:
            pass

    return {
        "videoId": video_id,
        "url": f"https://www.youtube.com/watch?v={video_id}",
        "titleOriginal": title,
        "titleTranslated": title_translated,
        "thumbnailUrl": f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg",
        "createdAt": datetime.fromtimestamp(folder.stat().st_mtime).isoformat(),
        "files": {
            "originalSrt": _url(original_srt),
            "translatedSrt": _url(translated_srt),
            "audio": _url(audio),
            "video": _url(video),
        },
    }


@router.get("")
def list_library() -> dict[str, Any]:
    """List all stored videos. Sorted newest first."""
    out = _output_dir()
    if not out.is_dir():
        return {"items": []}

    items: list[dict[str, Any]] = []
    for entry in out.iterdir():
        if not entry.is_dir():
            continue
        # Folder name ends with _{11-char video_id}
        if len(entry.name) < VIDEO_ID_LEN + 1 or entry.name[-(VIDEO_ID_LEN + 1)] != "_":
            continue
        candidate = entry.name[-VIDEO_ID_LEN:]
        # YouTube IDs are URL-safe base64-like: [0-9A-Za-z_-]
        if not all(c.isalnum() or c in "_-" for c in candidate):
            continue
        items.append(_scan_folder(entry, candidate))

    items.sort(key=lambda x: x["createdAt"], reverse=True)
    return {"items": items}


@router.get("/{video_id}/file/{filename}")
def download_file(video_id: str, filename: str):
    """Serve a file from a video's folder. Sandboxed to that folder."""
    folder = _find_folder_for(video_id)
    if folder is None:
        raise HTTPException(status_code=404, detail="video not found")

    # Sandbox: resolve and verify the file is inside the folder
    target = (folder / filename).resolve()
    folder_resolved = folder.resolve()
    try:
        target.relative_to(folder_resolved)
    except ValueError:
        raise HTTPException(status_code=400, detail="invalid filename") from None

    if not target.is_file():
        raise HTTPException(status_code=404, detail="file not found")
    return FileResponse(str(target))


@router.post("/delete")
def delete_video(req: VideoIdRequest) -> dict[str, Any]:
    folder = _find_folder_for(req.videoId)
    if folder is None:
        raise HTTPException(status_code=404, detail=f"video not found: {req.videoId}")
    shutil.rmtree(folder)
    return {"ok": True}


@router.post("/open-folder")
def open_folder(req: VideoIdRequest) -> dict[str, Any]:
    folder = _find_folder_for(req.videoId)
    if folder is None:
        raise HTTPException(status_code=404, detail=f"video not found: {req.videoId}")

    path_str = str(folder.resolve())
    if sys.platform == "win32":
        subprocess.Popen(["explorer", path_str])
    elif sys.platform == "darwin":
        subprocess.Popen(["open", path_str])
    else:
        subprocess.Popen(["xdg-open", path_str])
    return {"ok": True}


# Media extensions used for the on-disk fallback when no network is available.
# Video preferred; audio second.
_VIDEO_EXTS = (".mp4", ".webm", ".mkv")
_AUDIO_EXTS = (".wav", ".m4a", ".mp3")


def _pick_subtitle(folder: Path) -> Path | None:
    """Translated SRT preferred (that's what the user actually wants to read);
    fall back to the original SRT if no translation exists."""
    srts = [f for f in folder.iterdir() if f.is_file() and f.suffix.lower() == ".srt"]
    return (
        next((f for f in srts if not f.name.endswith("_original.srt")), None)
        or next((f for f in srts if f.name.endswith("_original.srt")), None)
    )


def _pick_local_media(folder: Path) -> Path | None:
    """Find a local video or audio file in the folder. Used as a fallback
    only — by default we prefer streaming the actual YouTube video."""
    files = list(folder.iterdir())
    video = next(
        (f for f in files if f.is_file() and f.suffix.lower() in _VIDEO_EXTS),
        None,
    )
    if video is not None:
        return video
    return next(
        (f for f in files if f.is_file() and f.suffix.lower() in _AUDIO_EXTS),
        None,
    )


@router.post("/play-mpv")
def play_mpv(req: VideoIdRequest) -> dict[str, Any]:
    """Launch mpv to play the video with the local subtitle overlaid.

    By default mpv streams the YouTube video directly via its built-in yt-dlp
    integration so the user gets the actual VIDEO (not just the .wav audio
    that the pipeline downloaded for transcription). The translated/original
    SRT from the library folder is overlaid via `--sub-file=`.

    Falls back to the local media file when:
      - the folder has a downloaded video file (offline-friendly)
      - or we just need *something* to play

    `--force-window=immediate` ensures the player window appears even when
    streaming initialization is slow — without this, audio-only fallbacks
    on Windows can launch mpv as a hidden process.

    Returns `{ok:false, error:"..."}` (HTTP 200) for soft failures the
    frontend can surface inline; HTTP 404 only when the library entry
    itself is missing.
    """
    folder = _find_folder_for(req.videoId)
    if folder is None:
        raise HTTPException(status_code=404, detail=f"video not found: {req.videoId}")

    cfg = load_config()
    mpv_exe = cfg.mpv_path if cfg.mpv_path and shutil.which(cfg.mpv_path) else shutil.which("mpv")
    if not mpv_exe:
        return {
            "ok": False,
            "error": "mpv not found. Install mpv or set its path in Settings → Advanced.",
        }

    sub = _pick_subtitle(folder)

    # Prefer streaming the actual YouTube video (gives the user real picture).
    # Fall back to a local media file if one exists (works offline).
    youtube_url = f"https://www.youtube.com/watch?v={req.videoId}"
    local_media = _pick_local_media(folder)
    media_arg: str = youtube_url
    media_label = f"youtube:{req.videoId}"
    if local_media is not None and local_media.suffix.lower() in _VIDEO_EXTS:
        # User has the actual video file on disk — use it (faster, offline-OK).
        media_arg = str(local_media)
        media_label = local_media.name

    cmd = [
        mpv_exe,
        media_arg,
        "--force-window=immediate",  # guarantees a visible window
    ]
    if sub is not None:
        cmd.append(f"--sub-file={sub}")

    try:
        subprocess.Popen(cmd, cwd=str(folder))
    except Exception as e:  # noqa: BLE001 — surface whatever Popen raised
        return {"ok": False, "error": f"failed to launch mpv: {e}"}

    return {
        "ok": True,
        "media": media_label,
        "subtitle": sub.name if sub else None,
    }
