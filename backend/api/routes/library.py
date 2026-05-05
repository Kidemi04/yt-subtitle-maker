"""Library endpoints: list stored media + SRT files, delete, open folder, download.

Per spec §14 #3, /api/library JSON responses MUST NOT include absolute filesystem
paths. Files are exposed via download URLs (/api/library/{video_id}/file/{name})
so V2 mobile can consume the same API over ngrok without local paths.
"""
from __future__ import annotations

import json
import os
import queue
import shutil
import subprocess
import sys
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

from api import jobs
from core import library_runs
from core.config import load_config
from core.downloader.js_runtime import detect_js_runtime
from core.pipeline import PipelineCancelled

router = APIRouter(prefix="/api/library", tags=["library"])

VIDEO_ID_LEN = 11
SRT_AUDIO_EXTS = {".srt", ".wav", ".m4a", ".mp3", ".mp4"}


class VideoIdRequest(BaseModel):
    videoId: str


class PlayMpvRequest(BaseModel):
    videoId: str
    # Which SRT to overlay. "translated" (default) prefers the translated SRT
    # and falls back to the original if no translation exists. "original"
    # forces the source-language transcript. "none" disables subtitle overlay.
    subtitlePreference: Literal["translated", "original", "none"] | None = None


class DeleteSrtRequest(BaseModel):
    id: str
    kind: Literal["transcribe", "translate"]


class LibraryTranscribeRequest(BaseModel):
    """Body for POST /api/library/{videoId}/transcribe.

    `sttEngine` is the explicit engine ("openai-whisper" or "yt_captions").
    Frontend resolves "auto" before calling.
    """
    sttEngine: str
    whisperModel: str | None = None
    whisperDevice: str | None = None
    vadEnabled: bool = False
    sourceLang: str


class LibraryTranslateRequest(BaseModel):
    """Body for POST /api/library/{videoId}/translate."""
    sourceTranscribeId: str
    targetLang: str
    translatorProvider: Literal["gemini", "local_openai", "openai"] | None = None
    translatorModel: str | None = None
    translatorBaseUrl: str | None = None
    translatorApiKey: str | None = None


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


@router.get("/{video_id}/file/{filename:path}")
def download_file(video_id: str, filename: str):
    """Serve a file from a video's folder (or its transcripts/ / translations/
    subdirs). Sandboxed: any attempt to resolve outside the folder is rejected.
    """
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


def _file_url(video_id: str, folder: Path, filename: str, subdir: str) -> str | None:
    """Build a download URL for a sidecar entry.

    Tries the new layout (`<subdir>/<filename>`) first, then falls back to the
    folder root for legacy entries that haven't been migrated yet.
    """
    if (folder / subdir / filename).is_file():
        return f"/api/library/{video_id}/file/{subdir}/{filename}"
    if (folder / filename).is_file():
        return f"/api/library/{video_id}/file/{filename}"
    return None


def _audio_url(video_id: str, folder: Path) -> str | None:
    for ext in (".wav", ".m4a", ".mp3"):
        f = folder / f"{video_id}{ext}"
        if f.is_file():
            return f"/api/library/{video_id}/file/{f.name}"
    return None


def _has_video_file(video_id: str, folder: Path) -> bool:
    return any(
        (folder / f"{video_id}{ext}").is_file()
        for ext in (".mp4", ".webm", ".mkv")
    )


@router.get("/{video_id}")
def get_video_detail(video_id: str) -> dict[str, Any]:
    """Full detail for a single video: metadata + every transcribe/translation run."""
    folder = _find_folder_for(video_id)
    if folder is None:
        raise HTTPException(status_code=404, detail=f"video not found: {video_id}")

    sidecar = library_runs.read_sidecar(folder)

    transcribes_with_url = []
    for t in sidecar.get("transcribes", []):
        entry = dict(t)
        entry["url"] = _file_url(video_id, folder, t["filename"], "transcripts")
        transcribes_with_url.append(entry)

    translations_with_url = []
    for tr in sidecar.get("translations", []):
        entry = dict(tr)
        entry["url"] = _file_url(video_id, folder, tr["filename"], "translations")
        translations_with_url.append(entry)

    return {
        "videoId": sidecar.get("videoId") or video_id,
        "url": sidecar.get("url") or f"https://www.youtube.com/watch?v={video_id}",
        "titleOriginal": sidecar.get("titleOriginal", ""),
        "titleTranslated": sidecar.get("titleTranslated"),
        "thumbnailUrl": sidecar.get("thumbnailUrl")
            or f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg",
        "channel": sidecar.get("channel"),
        "durationSeconds": sidecar.get("durationSeconds"),
        "createdAt": sidecar.get("createdAt") or datetime.fromtimestamp(folder.stat().st_mtime).isoformat(),
        "updatedAt": sidecar.get("updatedAt") or sidecar.get("createdAt") or "",
        "audio": _audio_url(video_id, folder),
        "hasVideo": _has_video_file(video_id, folder),
        "transcribes": transcribes_with_url,
        "translations": translations_with_url,
    }


@router.post("/{video_id}/delete-srt")
def delete_srt(video_id: str, req: DeleteSrtRequest) -> dict[str, Any]:
    """Delete one transcript or translation by id.

    For `kind == "transcribe"`, child translations are cascade-deleted.
    """
    folder = _find_folder_for(video_id)
    if folder is None:
        raise HTTPException(status_code=404, detail=f"video not found: {video_id}")

    deleted = library_runs.remove_entry(folder, req.kind, req.id)
    return {
        "ok": True,
        "deleted": [p.name for p in deleted],
    }


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


def _pick_subtitle(
    folder: Path, preference: str | None = "translated"
) -> Path | None:
    """Pick which SRT (if any) to overlay in mpv based on user preference.

    "translated" → translated SRT first, original as fallback (default).
    "original"   → original (source-language) SRT only, no fallback.
    "none"       → return None (caller skips the --sub-files-append flag).
    """
    if preference == "none":
        return None
    srts = [f for f in folder.iterdir() if f.is_file() and f.suffix.lower() == ".srt"]
    translated = next(
        (f for f in srts if not f.name.endswith("_original.srt")), None,
    )
    original = next(
        (f for f in srts if f.name.endswith("_original.srt")), None,
    )
    if preference == "original":
        return original
    # Default: translated preferred, original as fallback.
    return translated or original


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


def _resolve_ytdlp_for_mpv() -> str | None:
    """Find a yt-dlp executable mpv can shell out to.

    mpv's built-in `ytdl_hook` looks for `yt-dlp` (or `youtube-dl`) on PATH.
    When the backend runs under a Python venv (`pip install yt-dlp`), the
    binary lives at `<venv>/Scripts/yt-dlp.exe` — invisible to mpv unless
    we tell it explicitly via `--script-opts=ytdl_hook-ytdl_path=<path>`.
    """
    found = shutil.which("yt-dlp") or shutil.which("youtube-dl")
    if found:
        return found
    # Fallback: same Python venv that runs the backend has it as a script.
    py_dir = os.path.dirname(sys.executable)
    candidates = [
        os.path.join(py_dir, "Scripts", "yt-dlp.exe"),  # Windows venv
        os.path.join(py_dir, "Scripts", "yt-dlp"),
        os.path.join(py_dir, "bin", "yt-dlp"),  # Unix venv
        os.path.join(py_dir, "yt-dlp"),
        os.path.join(py_dir, "yt-dlp.exe"),
    ]
    for c in candidates:
        if os.path.isfile(c):
            return c
    return None


@router.post("/play-mpv")
def play_mpv(req: PlayMpvRequest) -> dict[str, Any]:
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

    sub = _pick_subtitle(folder, req.subtitlePreference)

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
        # Two-arg form (`--option value`) instead of `--option=value` so paths
        # with `=`, spaces, or non-ASCII chars in the folder name don't trip
        # mpv's option parser. Pass the basename + sub-file-paths so mpv
        # resolves it in the video's folder regardless of cwd quirks.
        cmd.extend(["--sub-files-append", sub.name])
        cmd.extend(["--sub-file-paths", str(folder)])
        cmd.append("--sub-auto=exact")  # actually load the sub we attached

    # When we're streaming from YouTube, wire mpv to the same yt-dlp + JS
    # runtime our backend uses. Without this, mpv finds no `yt-dlp.exe` on
    # PATH (it's in the venv) and hits the same n-challenge that requires
    # the EJS solver — both fail silently to a black screen with -/0 streams.
    if media_arg == youtube_url:
        ytdlp_exe = _resolve_ytdlp_for_mpv()
        if ytdlp_exe:
            cmd.append(f"--script-opts=ytdl_hook-ytdl_path={ytdlp_exe}")
        # Forward our js-runtime + remote-components into mpv's yt-dlp call
        # via --ytdl-raw-options. Underscores are converted to hyphens for
        # the CLI form ("js-runtimes" not "js_runtimes").
        js_spec = detect_js_runtime(cfg.js_runtime_path)
        if js_spec:
            # Strip the "name:" prefix; mpv's --ytdl-raw-options expects
            # the same shape as the yt-dlp CLI flag value.
            cmd.append(f"--ytdl-raw-options-append=js-runtimes={js_spec}")
        cmd.append(
            "--ytdl-raw-options-append=remote-components=ejs:github,ejs:npm",
        )

    try:
        subprocess.Popen(cmd, cwd=str(folder))
    except Exception as e:  # noqa: BLE001 — surface whatever Popen raised
        return {"ok": False, "error": f"failed to launch mpv: {e}"}

    return {
        "ok": True,
        "media": media_label,
        "subtitle": sub.name if sub else None,
    }


# ---------------------------------------------------------------------------
# Re-transcribe — runs another STT on the existing audio file
# ---------------------------------------------------------------------------

def _find_existing_audio(folder: Path, video_id: str) -> Path | None:
    for ext in (".wav", ".m4a", ".mp3"):
        p = folder / f"{video_id}{ext}"
        if p.is_file():
            return p
    return None


@router.post("/{video_id}/transcribe")
def transcribe_existing(video_id: str, req: LibraryTranscribeRequest):
    """Re-run STT on the audio.wav already in this video's folder.

    Returns NDJSON stream like /api/process. The audio file is reused — we
    never re-download. yt_captions providers don't need audio and are also
    supported.
    """
    folder = _find_folder_for(video_id)
    if folder is None:
        raise HTTPException(status_code=404, detail=f"video not found: {video_id}")

    cfg = load_config()
    library_runs.migrate_legacy_folder(folder)

    # Load sidecar to recover the original URL (yt_captions needs it).
    sidecar = library_runs.read_sidecar(folder)
    url = sidecar.get("url") or f"https://www.youtube.com/watch?v={video_id}"

    audio_path: Path | None = None
    if req.sttEngine != "yt_captions":
        audio_path = _find_existing_audio(folder, video_id)
        if audio_path is None:
            return {
                "ok": False,
                "error": "no audio file in folder; download a fresh job first",
            }

    cancel_event = jobs.claim_slot()
    q: queue.Queue = queue.Queue()
    SENTINEL = object()

    def runner() -> None:
        try:
            # Lazy import keeps test patching points consistent with /api/process.
            from core.stt import get_provider
            from core.stt.yt_captions import YtCaptionsProvider
            from core.subtitles import write_srt

            engine = req.sttEngine
            if engine == "yt_captions":
                provider = YtCaptionsProvider()
                model_used = None
                device_used = None
                vad_used = None
            else:
                model_used = req.whisperModel or cfg.default_whisper_model
                device_used = req.whisperDevice or cfg.default_whisper_device
                vad_used = bool(req.vadEnabled)
                provider = get_provider(engine, model=model_used, device=device_used)

            if cancel_event.is_set():
                raise PipelineCancelled("cancelled")

            start = time.monotonic()
            q.put({"status": "transcribing", "engine": provider.name, "progress": None})

            def stt_progress(p: float) -> None:
                if cancel_event.is_set():
                    raise PipelineCancelled("cancelled")
                q.put({"status": "transcribing", "engine": provider.name, "progress": p})

            result = provider.transcribe(
                audio_path=str(audio_path) if audio_path else None,
                url=url,
                language=req.sourceLang,
                progress=stt_progress,
            )
            if cancel_event.is_set():
                raise PipelineCancelled("cancelled")
            duration_ms = int((time.monotonic() - start) * 1000)

            t_id = library_runs.transcribe_id(engine, model_used, req.sourceLang)
            transcripts_dir = folder / "transcripts"
            transcripts_dir.mkdir(parents=True, exist_ok=True)
            filename = f"{t_id}.srt"
            srt_path = transcripts_dir / filename
            write_srt(
                [
                    {"id": s.id, "start": s.start, "end": s.end, "text": s.text}
                    for s in result.segments
                ],
                str(srt_path),
                field="text",
            )
            library_runs.append_transcribe(
                folder,
                {
                    "id": t_id,
                    "engine": engine,
                    "model": model_used,
                    "device": device_used,
                    "vadEnabled": vad_used,
                    "language": req.sourceLang,
                    "filename": filename,
                    "createdAt": library_runs._now_iso(),
                    "durationMs": duration_ms,
                    "segmentCount": len(result.segments),
                },
            )

            q.put({
                "status": "done",
                "videoId": video_id,
                "transcribeId": t_id,
                "filename": filename,
                "url": f"/api/library/{video_id}/file/transcripts/{filename}",
                "durationMs": duration_ms,
                "segmentCount": len(result.segments),
                "previewSegments": [
                    {"id": s.id, "start": s.start, "end": s.end, "text": s.text}
                    for s in result.segments[:5]
                ],
            })
        except PipelineCancelled:
            q.put({"status": "error", "error": "cancelled", "recoverable": True})
        except Exception as e:  # noqa: BLE001
            q.put({"status": "error", "error": str(e), "recoverable": False})
        finally:
            jobs.release_slot(cancel_event)
            q.put(SENTINEL)

    threading.Thread(target=runner, daemon=True).start()

    def gen():
        while True:
            evt = q.get()
            if evt is SENTINEL:
                break
            yield json.dumps(evt) + "\n"

    return StreamingResponse(gen(), media_type="application/x-ndjson")


# ---------------------------------------------------------------------------
# Re-translate — re-run translator on an existing transcript
# ---------------------------------------------------------------------------

def _build_translator(provider: str, req: LibraryTranslateRequest, cfg):
    """Build a TranslationProvider from request + config defaults.

    Mirrors the resolution logic in core.pipeline._make_translator: request
    fields override, otherwise fall back to the saved AppConfig values.
    """
    from core.translator import get_translator

    if provider == "gemini":
        return get_translator(
            "gemini",
            api_key=req.translatorApiKey or cfg.gemini_api_key,
            model=req.translatorModel or cfg.gemini_model,
        )
    if provider == "local_openai":
        return get_translator(
            "local_openai",
            base_url=req.translatorBaseUrl or cfg.local_openai_base_url,
            model=req.translatorModel or cfg.local_openai_model,
            api_key=req.translatorApiKey or cfg.local_openai_api_key or "lm-studio",
        )
    if provider == "openai":
        return get_translator(
            "openai",
            base_url=req.translatorBaseUrl or cfg.openai_base_url,
            model=req.translatorModel or cfg.openai_model,
            api_key=req.translatorApiKey or cfg.openai_api_key,
        )
    raise ValueError(f"unknown translator provider: {provider!r}")


def _resolve_translator_model(provider: str, req: LibraryTranslateRequest, cfg) -> str:
    if provider == "gemini":
        return req.translatorModel or cfg.gemini_model
    if provider == "local_openai":
        return req.translatorModel or cfg.local_openai_model
    if provider == "openai":
        return req.translatorModel or cfg.openai_model
    return req.translatorModel or "unknown"


def _find_transcript_path(folder: Path, source_id: str) -> Path | None:
    """Locate the SRT for a transcribe id. Tries new layout first, then root
    (for legacy entries that haven't been lazy-migrated yet).
    """
    p = folder / "transcripts" / f"{source_id}.srt"
    if p.is_file():
        return p
    if source_id == "legacy":
        legacy = list(folder.glob("*_original.srt"))
        if legacy:
            return legacy[0]
    return None


@router.post("/{video_id}/translate")
def translate_existing(video_id: str, req: LibraryTranslateRequest):
    """Re-translate an existing transcript into another target language.

    Reads `transcripts/<sourceTranscribeId>.srt`, runs translator, writes
    `translations/<id>.srt`, appends sidecar.
    """
    folder = _find_folder_for(video_id)
    if folder is None:
        raise HTTPException(status_code=404, detail=f"video not found: {video_id}")

    cfg = load_config()
    library_runs.migrate_legacy_folder(folder)

    transcript_path = _find_transcript_path(folder, req.sourceTranscribeId)
    if transcript_path is None:
        return {
            "ok": False,
            "error": f"transcript not found: {req.sourceTranscribeId}",
        }

    provider_name = req.translatorProvider or cfg.translator_provider
    translator_model = _resolve_translator_model(provider_name, req, cfg)

    cancel_event = jobs.claim_slot()
    q: queue.Queue = queue.Queue()
    SENTINEL = object()

    def runner() -> None:
        try:
            from core.subtitles import read_srt, write_srt

            translator = _build_translator(provider_name, req, cfg)
            segments = read_srt(str(transcript_path))
            if not segments:
                raise ValueError("source transcript has no segments")

            if cancel_event.is_set():
                raise PipelineCancelled("cancelled")

            start = time.monotonic()
            q.put({"status": "translating", "progress": None})

            def tx_progress(p: float) -> None:
                if cancel_event.is_set():
                    raise PipelineCancelled("cancelled")
                q.put({"status": "translating", "progress": p})

            translator.translate_segments(segments, req.targetLang, progress=tx_progress)
            if cancel_event.is_set():
                raise PipelineCancelled("cancelled")
            duration_ms = int((time.monotonic() - start) * 1000)

            tr_id = library_runs.translate_id(
                req.sourceTranscribeId, provider_name, translator_model, req.targetLang
            )
            translations_dir = folder / "translations"
            translations_dir.mkdir(parents=True, exist_ok=True)
            filename = f"{tr_id}.srt"
            srt_path = translations_dir / filename
            write_srt(
                [
                    {
                        "id": s.id,
                        "start": s.start,
                        "end": s.end,
                        "translated": s.translated or "",
                    }
                    for s in segments
                ],
                str(srt_path),
                field="translated",
            )
            library_runs.append_translation(
                folder,
                {
                    "id": tr_id,
                    "sourceTranscribeId": req.sourceTranscribeId,
                    "translator": provider_name,
                    "translatorModel": translator_model,
                    "targetLang": req.targetLang,
                    "filename": filename,
                    "createdAt": library_runs._now_iso(),
                    "durationMs": duration_ms,
                    "segmentCount": len(segments),
                },
            )

            q.put({
                "status": "done",
                "videoId": video_id,
                "translateId": tr_id,
                "sourceTranscribeId": req.sourceTranscribeId,
                "filename": filename,
                "url": f"/api/library/{video_id}/file/translations/{filename}",
                "durationMs": duration_ms,
                "segmentCount": len(segments),
                "previewSegments": [
                    {
                        "id": s.id,
                        "start": s.start,
                        "end": s.end,
                        "text": s.text,
                        "translated": s.translated,
                    }
                    for s in segments[:5]
                ],
            })
        except PipelineCancelled:
            q.put({"status": "error", "error": "cancelled", "recoverable": True})
        except Exception as e:  # noqa: BLE001
            q.put({"status": "error", "error": str(e), "recoverable": False})
        finally:
            jobs.release_slot(cancel_event)
            q.put(SENTINEL)

    threading.Thread(target=runner, daemon=True).start()

    def gen():
        while True:
            evt = q.get()
            if evt is SENTINEL:
                break
            yield json.dumps(evt) + "\n"

    return StreamingResponse(gen(), media_type="application/x-ndjson")
