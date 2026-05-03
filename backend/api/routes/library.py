"""Library endpoints: list stored media + SRT files, delete, open folder, download.

Per spec §14 #3, /api/library JSON responses MUST NOT include absolute filesystem
paths. Files are exposed via download URLs (/api/library/{video_id}/file/{name})
so V2 mobile can consume the same API over ngrok without local paths.
"""
from __future__ import annotations

import os
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

    return {
        "videoId": video_id,
        "url": f"https://www.youtube.com/watch?v={video_id}",
        "titleOriginal": title,
        "titleTranslated": None,
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
