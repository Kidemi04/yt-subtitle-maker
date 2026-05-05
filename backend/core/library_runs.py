"""Sidecar registry for multi-SRT runs per video (Plan C subdirectory layout).

Folder layout (new shape):
    output/
      <Title>_<videoId>/
        <videoId>.wav
        transcripts/<transcribeId>.srt
        translations/<translateId>.srt
        _history.json   # registry — see schema in docs/superpowers/plans/2026-05-05-multi-srt-runs.md

This module owns everything that touches `_history.json`. Library/history/process
routes go through these helpers so the sidecar shape stays consistent and
concurrent writes are serialized via a per-folder Lock.

Backwards-compat: legacy folders have flat `<videoId>_original.srt` +
`<videoId>_<lang>.srt` plus an old single-job sidecar. `read_sidecar()`
synthesizes the new shape on the fly. `migrate_legacy_folder()` performs an
in-place migration when a NEW run is about to land in such a folder.
"""
from __future__ import annotations

import json
import re
import threading
from collections import defaultdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

# Per-folder write locks. Keyed by absolute folder path string.
# Multiple POSTs against the same video (e.g. transcribe + translate) need to
# not corrupt the sidecar; we serialize sidecar mutations under this lock.
_folder_locks: dict[str, threading.Lock] = defaultdict(threading.Lock)
_folder_locks_guard = threading.Lock()


def _lock_for(folder: Path) -> threading.Lock:
    key = str(folder.resolve())
    with _folder_locks_guard:
        return _folder_locks[key]


# ---------------------------------------------------------------------------
# ID conventions
# ---------------------------------------------------------------------------

def _slug(value: str) -> str:
    """Hyphenate non-alphanumeric runs and lowercase. e.g.
    `gemini-2.5-flash-lite` → `gemini-2-5-flash-lite`.
    """
    return re.sub(r"[^a-zA-Z0-9]+", "-", value).strip("-").lower()


def transcribe_id(engine: str, model: str | None, language: str) -> str:
    """Stable, deterministic id for a transcribe run.

    yt_captions has no model component:
        yt_captions-en

    Whisper-family engines:
        openai-whisper-turbo-en
    """
    if engine == "yt_captions":
        return f"yt_captions-{language}"
    model_part = model or "default"
    return f"{engine}-{model_part}-{language}"


def translate_id(
    source_transcribe_id: str,
    translator: str,
    translator_model: str,
    target_lang: str,
) -> str:
    """Stable id for a translation run, derived from its source transcript.

    Example: `openai-whisper-turbo-en__gemini-gemini-2-5-flash-lite__zh`
    """
    return f"{source_transcribe_id}__{translator}-{_slug(translator_model)}__{target_lang}"


# ---------------------------------------------------------------------------
# Folder layout detection
# ---------------------------------------------------------------------------

def folder_layout(folder: Path) -> dict[str, Any]:
    """Inspect a video folder and report whether it's already on the new
    subdirectory layout or still flat (legacy).

    Returns:
        {
          "kind": "new" | "legacy" | "empty",
          "transcripts_dir": Path,
          "translations_dir": Path,
          "legacy_original": Path | None,    # <videoId>_original.srt
          "legacy_translations": list[Path], # <videoId>_<lang>.srt files
          "audio": Path | None,
        }
    """
    transcripts_dir = folder / "transcripts"
    translations_dir = folder / "translations"
    has_subdirs = transcripts_dir.is_dir() or translations_dir.is_dir()

    video_id = _video_id_from_folder(folder)
    legacy_original: Path | None = None
    legacy_translations: list[Path] = []
    audio: Path | None = None

    if folder.is_dir() and video_id:
        for entry in folder.iterdir():
            if not entry.is_file():
                continue
            name = entry.name
            if name == f"{video_id}_original.srt":
                legacy_original = entry
            elif (
                name.startswith(f"{video_id}_")
                and name.endswith(".srt")
                and name != f"{video_id}_original.srt"
            ):
                legacy_translations.append(entry)
            elif name.startswith(f"{video_id}.") and entry.suffix.lower() in {
                ".wav",
                ".m4a",
                ".mp3",
            }:
                audio = entry

    if has_subdirs:
        kind = "new"
    elif legacy_original or legacy_translations:
        kind = "legacy"
    else:
        kind = "empty"

    return {
        "kind": kind,
        "transcripts_dir": transcripts_dir,
        "translations_dir": translations_dir,
        "legacy_original": legacy_original,
        "legacy_translations": legacy_translations,
        "audio": audio,
    }


VIDEO_ID_LEN = 11


def _video_id_from_folder(folder: Path) -> str | None:
    """Extract the videoId suffix from a folder name like `Title_<11char>`."""
    name = folder.name
    if len(name) < VIDEO_ID_LEN + 1 or name[-(VIDEO_ID_LEN + 1)] != "_":
        return None
    candidate = name[-VIDEO_ID_LEN:]
    if not all(c.isalnum() or c in "_-" for c in candidate):
        return None
    return candidate


def _title_from_folder(folder: Path, video_id: str) -> str:
    name = folder.name
    return name[: -(VIDEO_ID_LEN + 1)] if name.endswith(f"_{video_id}") else name


# ---------------------------------------------------------------------------
# Sidecar I/O
# ---------------------------------------------------------------------------

def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _empty_sidecar(folder: Path, video_id: str) -> dict[str, Any]:
    title = _title_from_folder(folder, video_id)
    now = _now_iso()
    return {
        "videoId": video_id,
        "url": f"https://www.youtube.com/watch?v={video_id}",
        "titleOriginal": title,
        "titleTranslated": None,
        "thumbnailUrl": f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg",
        "channel": None,
        "durationSeconds": None,
        "createdAt": now,
        "updatedAt": now,
        "transcribes": [],
        "translations": [],
    }


def _is_legacy_sidecar(data: dict[str, Any]) -> bool:
    """An old single-job sidecar has `sttEngineUsed` and lacks `transcribes`."""
    return "transcribes" not in data and "sttEngineUsed" in data


def _synthesize_from_legacy(
    folder: Path, video_id: str, layout: dict[str, Any], legacy: dict[str, Any] | None
) -> dict[str, Any]:
    """Build a new-shape sidecar dict (in memory) from a legacy folder.

    Does NOT touch disk. Used by `read_sidecar()` so frontends always see the
    new shape even before a migration happens.
    """
    title = _title_from_folder(folder, video_id)
    created = (legacy or {}).get("createdAt") or _now_iso()
    duration_ms = int((legacy or {}).get("processingDurationMs") or 0)
    stt_engine = (legacy or {}).get("sttEngineUsed") or "unknown"

    transcribes: list[dict[str, Any]] = []
    translations: list[dict[str, Any]] = []

    if layout["legacy_original"] is not None:
        transcribes.append(
            {
                "id": "legacy",
                "engine": stt_engine,
                "model": None,
                "device": None,
                "vadEnabled": None,
                "language": "unknown",
                "filename": layout["legacy_original"].name,
                "createdAt": created,
                "durationMs": duration_ms,
                "segmentCount": 0,
            }
        )

    target_lang = (legacy or {}).get("targetLang")
    for f in layout["legacy_translations"]:
        # filename pattern: <videoId>_<lang>.srt
        # Pull lang token from filename if sidecar didn't supply one.
        lang = target_lang
        if not lang:
            stem = f.stem  # <videoId>_<lang>
            lang = stem[len(video_id) + 1 :] if stem.startswith(f"{video_id}_") else "unknown"
        translations.append(
            {
                "id": f"legacy-{lang}",
                "sourceTranscribeId": "legacy",
                "translator": "unknown",
                "translatorModel": "unknown",
                "targetLang": lang,
                "filename": f.name,
                "createdAt": created,
                "durationMs": duration_ms,
                "segmentCount": 0,
            }
        )

    return {
        "videoId": video_id,
        "url": (legacy or {}).get("url") or f"https://www.youtube.com/watch?v={video_id}",
        "titleOriginal": (legacy or {}).get("titleOriginal") or title,
        "titleTranslated": (legacy or {}).get("titleTranslated"),
        "thumbnailUrl": (legacy or {}).get("thumbnailUrl")
            or f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg",
        "channel": (legacy or {}).get("channel"),
        "durationSeconds": (legacy or {}).get("durationSeconds"),
        "createdAt": created,
        "updatedAt": created,
        "transcribes": transcribes,
        "translations": translations,
    }


def read_sidecar(folder: Path) -> dict[str, Any]:
    """Tolerantly read `_history.json`, always returning a new-shape dict.

    - Missing sidecar → synthesize from folder contents (legacy SRTs picked up).
    - Legacy single-job sidecar → synthesize new shape (without touching disk).
    - New-shape sidecar → return as-is (with missing keys defaulted).
    """
    video_id = _video_id_from_folder(folder)
    if not video_id:
        # Best effort: caller passed a folder that doesn't match the layout.
        return {
            "videoId": "",
            "url": "",
            "titleOriginal": folder.name,
            "titleTranslated": None,
            "thumbnailUrl": None,
            "channel": None,
            "durationSeconds": None,
            "createdAt": _now_iso(),
            "updatedAt": _now_iso(),
            "transcribes": [],
            "translations": [],
        }

    layout = folder_layout(folder)
    sidecar_path = folder / "_history.json"
    raw: dict[str, Any] | None = None
    if sidecar_path.is_file():
        try:
            raw = json.loads(sidecar_path.read_text(encoding="utf-8"))
        except Exception:
            raw = None

    if raw is None:
        return _synthesize_from_legacy(folder, video_id, layout, None)

    if _is_legacy_sidecar(raw):
        return _synthesize_from_legacy(folder, video_id, layout, raw)

    # New-shape: ensure required keys exist + arrays are lists.
    base = _empty_sidecar(folder, video_id)
    base.update(raw)
    base["transcribes"] = list(raw.get("transcribes") or [])
    base["translations"] = list(raw.get("translations") or [])
    return base


def write_sidecar(folder: Path, sidecar: dict[str, Any]) -> None:
    """Persist a new-shape sidecar atomically. Always sets `updatedAt`."""
    sidecar["updatedAt"] = _now_iso()
    folder.mkdir(parents=True, exist_ok=True)
    target = folder / "_history.json"
    tmp = folder / "_history.json.tmp"
    tmp.write_text(
        json.dumps(sidecar, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    tmp.replace(target)


# ---------------------------------------------------------------------------
# Lazy migration
# ---------------------------------------------------------------------------

def migrate_legacy_folder(folder: Path) -> dict[str, Any]:
    """Move legacy flat SRTs into transcripts/ + translations/, rewrite sidecar.

    Idempotent: returns the new-shape sidecar whether or not migration was
    needed. Lock is held for the whole operation to keep it atomic w.r.t.
    other sidecar mutations on the same folder.
    """
    with _lock_for(folder):
        layout = folder_layout(folder)
        # If already on new shape and there are no stray legacy SRTs left, just
        # return the sidecar as-is.
        if (
            layout["kind"] == "new"
            and not layout["legacy_original"]
            and not layout["legacy_translations"]
        ):
            return read_sidecar(folder)

        video_id = _video_id_from_folder(folder)
        if not video_id:
            return read_sidecar(folder)

        sidecar = read_sidecar(folder)  # synthesizes from legacy

        layout["transcripts_dir"].mkdir(parents=True, exist_ok=True)
        layout["translations_dir"].mkdir(parents=True, exist_ok=True)

        # Move legacy original SRT into transcripts/ as `legacy.srt`. Update
        # the matching sidecar entry's filename.
        if layout["legacy_original"]:
            new_path = layout["transcripts_dir"] / "legacy.srt"
            if not new_path.exists():
                layout["legacy_original"].replace(new_path)
            else:
                # Rare: caller already created a matching file; drop legacy.
                layout["legacy_original"].unlink(missing_ok=True)
            for t in sidecar["transcribes"]:
                if t.get("id") == "legacy":
                    t["filename"] = "legacy.srt"

        # Move legacy translations into translations/ as `legacy-<lang>.srt`.
        for f in layout["legacy_translations"]:
            stem = f.stem
            lang = stem[len(video_id) + 1 :] if stem.startswith(f"{video_id}_") else "unknown"
            target_name = f"legacy-{lang}.srt"
            new_path = layout["translations_dir"] / target_name
            if not new_path.exists():
                f.replace(new_path)
            else:
                f.unlink(missing_ok=True)
            for tr in sidecar["translations"]:
                if tr.get("id") == f"legacy-{lang}":
                    tr["filename"] = target_name

        write_sidecar(folder, sidecar)
        return sidecar


# ---------------------------------------------------------------------------
# Append helpers
# ---------------------------------------------------------------------------

def append_transcribe(folder: Path, entry: dict[str, Any]) -> dict[str, Any]:
    """Append (or replace, idempotently by id) a transcribe run."""
    with _lock_for(folder):
        sidecar = read_sidecar(folder)
        existing = [t for t in sidecar["transcribes"] if t.get("id") != entry["id"]]
        existing.append(entry)
        sidecar["transcribes"] = existing
        write_sidecar(folder, sidecar)
        return sidecar


def append_translation(folder: Path, entry: dict[str, Any]) -> dict[str, Any]:
    """Append (or replace, idempotently by id) a translation run."""
    with _lock_for(folder):
        sidecar = read_sidecar(folder)
        existing = [t for t in sidecar["translations"] if t.get("id") != entry["id"]]
        existing.append(entry)
        sidecar["translations"] = existing
        write_sidecar(folder, sidecar)
        return sidecar


def remove_entry(folder: Path, kind: str, run_id: str) -> list[Path]:
    """Remove a transcribe or translation entry from the sidecar.

    For `kind == "transcribe"`, also cascade-deletes any translations whose
    `sourceTranscribeId` matches `run_id`. Returns the list of file paths
    that were deleted (callers can use this for logging / verification).
    """
    if kind not in ("transcribe", "translate"):
        raise ValueError(f"unknown kind: {kind!r}")

    deleted: list[Path] = []
    with _lock_for(folder):
        sidecar = read_sidecar(folder)
        if kind == "transcribe":
            keep_t: list[dict[str, Any]] = []
            for t in sidecar["transcribes"]:
                if t.get("id") == run_id:
                    p = folder / "transcripts" / t["filename"]
                    # Legacy entries may still live at the folder root.
                    if not p.is_file():
                        p = folder / t["filename"]
                    if p.is_file():
                        p.unlink()
                        deleted.append(p)
                else:
                    keep_t.append(t)
            sidecar["transcribes"] = keep_t

            keep_tr: list[dict[str, Any]] = []
            for tr in sidecar["translations"]:
                if tr.get("sourceTranscribeId") == run_id:
                    p = folder / "translations" / tr["filename"]
                    if not p.is_file():
                        p = folder / tr["filename"]
                    if p.is_file():
                        p.unlink()
                        deleted.append(p)
                else:
                    keep_tr.append(tr)
            sidecar["translations"] = keep_tr
        else:  # translate
            keep_tr: list[dict[str, Any]] = []
            for tr in sidecar["translations"]:
                if tr.get("id") == run_id:
                    p = folder / "translations" / tr["filename"]
                    if not p.is_file():
                        p = folder / tr["filename"]
                    if p.is_file():
                        p.unlink()
                        deleted.append(p)
                else:
                    keep_tr.append(tr)
            sidecar["translations"] = keep_tr

        write_sidecar(folder, sidecar)
    return deleted


def update_metadata(
    folder: Path,
    *,
    url: str | None = None,
    title_original: str | None = None,
    title_translated: str | None = None,
    thumbnail_url: str | None = None,
    channel: str | None = None,
    duration_seconds: int | None = None,
) -> dict[str, Any]:
    """Update top-level video metadata fields. Pass None to leave a field as-is."""
    with _lock_for(folder):
        sidecar = read_sidecar(folder)
        if url is not None:
            sidecar["url"] = url
        if title_original is not None:
            sidecar["titleOriginal"] = title_original
        if title_translated is not None:
            sidecar["titleTranslated"] = title_translated
        if thumbnail_url is not None:
            sidecar["thumbnailUrl"] = thumbnail_url
        if channel is not None:
            sidecar["channel"] = channel
        if duration_seconds is not None:
            sidecar["durationSeconds"] = duration_seconds
        write_sidecar(folder, sidecar)
        return sidecar
