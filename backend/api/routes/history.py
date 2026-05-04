"""History endpoint.

Synthesizes a per-video history list from the same output dir the library
endpoint scans. If a `_history.json` sidecar exists in the folder (written by
core/pipeline.py at the end of a successful run), we use it as the source of
truth. Otherwise we synthesize a minimal record from the folder name + mtime.
"""
from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter

from core.config import load_config

router = APIRouter(prefix="/api", tags=["history"])

VIDEO_ID_LEN = 11


def _output_dir() -> Path:
    cfg = load_config()
    out = cfg.output_dir or "output"
    return Path(out)


def _read_sidecar(folder: Path) -> dict | None:
    sidecar = folder / "_history.json"
    if not sidecar.is_file():
        return None
    try:
        return json.loads(sidecar.read_text(encoding="utf-8"))
    except Exception:
        return None


def _synthesize(folder: Path, video_id: str) -> dict[str, Any]:
    """Build a HistoryItem when no sidecar is present."""
    title = folder.name[: -(len(video_id) + 1)] if folder.name.endswith(f"_{video_id}") else folder.name
    created_at = datetime.fromtimestamp(folder.stat().st_mtime, tz=UTC).isoformat()
    return {
        "videoId": video_id,
        "url": f"https://www.youtube.com/watch?v={video_id}",
        "titleOriginal": title,
        "titleTranslated": None,
        "targetLang": None,
        "sttEngineUsed": "unknown",
        "subtitlePath": None,
        "audioPath": None,
        "videoPath": None,
        "thumbnailUrl": f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg",
        "createdAt": created_at,
        "processingDurationMs": 0,
    }


def _from_sidecar(folder: Path, video_id: str, sidecar: dict) -> dict[str, Any]:
    """Build a HistoryItem from a sidecar dict, filling missing fields."""
    return {
        "videoId": sidecar.get("videoId") or video_id,
        "url": sidecar.get("url") or f"https://www.youtube.com/watch?v={video_id}",
        "titleOriginal": sidecar.get("titleOriginal", ""),
        "titleTranslated": sidecar.get("titleTranslated"),
        "targetLang": sidecar.get("targetLang"),
        "sttEngineUsed": sidecar.get("sttEngineUsed", "unknown"),
        "subtitlePath": None,
        "audioPath": None,
        "videoPath": None,
        "thumbnailUrl": sidecar.get("thumbnailUrl") or f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg",
        "createdAt": sidecar.get("createdAt")
            or datetime.fromtimestamp(folder.stat().st_mtime, tz=UTC).isoformat(),
        "processingDurationMs": int(sidecar.get("processingDurationMs", 0) or 0),
    }


@router.get("/history")
def list_history() -> dict[str, Any]:
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
        if not all(c.isalnum() or c in "_-" for c in candidate):
            continue
        sidecar = _read_sidecar(entry)
        if sidecar is not None:
            items.append(_from_sidecar(entry, candidate, sidecar))
        else:
            items.append(_synthesize(entry, candidate))

    items.sort(key=lambda x: x["createdAt"], reverse=True)
    return {"items": items}
