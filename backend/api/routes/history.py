"""History endpoint.

Synthesizes a per-video history list from the same output dir the library
endpoint scans. Sidecar (`_history.json`) is the source of truth — read via
`core.library_runs.read_sidecar` which tolerates legacy single-job sidecars
and folders without one at all.

Each video collapses to ONE row (existing UX). When a video has multiple
transcribe/translate runs, `sttEngineUsed` reflects the most recent transcribe
and `processingDurationMs` is the SUM across all runs. `transcribesCount` and
`translationsCount` are surfaced so the frontend can show a "3 transcripts ·
2 translations" badge.
"""
from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter

from core import library_runs
from core.config import load_config

router = APIRouter(prefix="/api", tags=["history"])

VIDEO_ID_LEN = 11


def _output_dir() -> Path:
    cfg = load_config()
    out = cfg.output_dir or "output"
    return Path(out)


def _build_history_item(folder: Path, video_id: str) -> dict[str, Any]:
    sidecar = library_runs.read_sidecar(folder)
    transcribes = sidecar.get("transcribes") or []
    translations = sidecar.get("translations") or []

    latest_transcribe = transcribes[-1] if transcribes else None
    latest_translation = translations[-1] if translations else None

    duration_total = sum(int(t.get("durationMs", 0) or 0) for t in transcribes) + sum(
        int(t.get("durationMs", 0) or 0) for t in translations
    )

    return {
        "videoId": sidecar.get("videoId") or video_id,
        "url": sidecar.get("url") or f"https://www.youtube.com/watch?v={video_id}",
        "titleOriginal": sidecar.get("titleOriginal") or "",
        "titleTranslated": sidecar.get("titleTranslated"),
        "targetLang": latest_translation.get("targetLang") if latest_translation else None,
        "sttEngineUsed": (
            latest_transcribe.get("engine") if latest_transcribe else "unknown"
        ),
        "subtitlePath": None,
        "audioPath": None,
        "videoPath": None,
        "thumbnailUrl": sidecar.get("thumbnailUrl")
            or f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg",
        "createdAt": sidecar.get("createdAt")
            or datetime.fromtimestamp(folder.stat().st_mtime, tz=UTC).isoformat(),
        "processingDurationMs": duration_total,
        "transcribesCount": len(transcribes),
        "translationsCount": len(translations),
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
        if len(entry.name) < VIDEO_ID_LEN + 1 or entry.name[-(VIDEO_ID_LEN + 1)] != "_":
            continue
        candidate = entry.name[-VIDEO_ID_LEN:]
        if not all(c.isalnum() or c in "_-" for c in candidate):
            continue
        items.append(_build_history_item(entry, candidate))

    items.sort(key=lambda x: x["createdAt"], reverse=True)
    return {"items": items}
