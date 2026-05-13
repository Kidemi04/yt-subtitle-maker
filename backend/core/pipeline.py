"""Pipeline orchestrator.

Single entry point `run_pipeline()` chains:
  fetch_metadata -> select_stt -> [download_audio?] -> transcribe -> translate? -> write_srt
Emits NDJSON-friendly dict events via `on_event` callback for streaming endpoints.

SRTs land in the Plan-C subdirectory layout:
    output/<Title>_<videoId>/
        <videoId>.wav
        transcripts/<transcribeId>.srt
        translations/<translateId>.srt
        _history.json   # via core.library_runs

Sidecar mutations go through `core.library_runs` so concurrent runs (e.g.
the Library re-transcribe + re-translate endpoints landing in Phase 4-5) can
share locks and stay consistent.
"""
from __future__ import annotations

import copy
import os
import re
import threading
import time
from collections.abc import Callable
from pathlib import Path

from core import library_runs
from core.config import AppConfig
from core.downloader.youtube import download_audio, safe_folder_name
from core.stt import get_provider
from core.stt.base import TranscriptionProvider, TranscriptionResult
from core.stt.yt_captions import YtCaptionsProvider
from core.translator import get_active_translator, get_translator

# yt-dlp's `_percent_str` may include ANSI color codes (e.g. "\x1b[0;94m  0.0%\x1b[0m")
# when its console output is colorized. We strip those before parsing.
_ANSI_RE = re.compile(r"\x1b\[[0-9;]*m")


def _percent_from_yt_dlp(d: dict) -> float | None:
    """Best-effort percent (0..100) from a yt-dlp progress dict.

    Prefers numeric byte counters (no formatting surprises). Falls back to
    parsing `_percent_str`, stripping ANSI codes + whitespace + the trailing %.
    Returns None when neither path yields a number — callers should treat that
    as "indeterminate" rather than crashing.
    """
    downloaded = d.get("downloaded_bytes")
    total = d.get("total_bytes") or d.get("total_bytes_estimate")
    if (
        isinstance(downloaded, (int, float))
        and isinstance(total, (int, float))
        and total > 0
    ):
        return float(downloaded) / float(total) * 100.0
    raw = d.get("_percent_str")
    if not raw:
        return None
    cleaned = _ANSI_RE.sub("", raw).strip().rstrip("%").strip()
    try:
        return float(cleaned)
    except ValueError:
        return None


class PipelineCancelled(Exception):
    """Raised when a cooperative cancel signal is observed mid-pipeline."""


def _check_cancel(cancel_event: threading.Event | None) -> None:
    if cancel_event is not None and cancel_event.is_set():
        raise PipelineCancelled("cancelled")


def _select_stt_provider(request: dict, cfg: AppConfig, url: str) -> TranscriptionProvider:
    source = request["sttSource"]
    if source == "yt_captions":
        return YtCaptionsProvider()
    if source == "auto":
        yt = YtCaptionsProvider()
        if yt.is_available(url):
            return yt
        # fall through to whisper
    engine = request.get("sttEngine") or cfg.default_stt_engine
    return get_provider(
        engine,
        model=request.get("whisperModel", cfg.default_whisper_model),
        device=request.get("whisperDevice", cfg.default_whisper_device),
    )


def _make_translator(request: dict, cfg: AppConfig):
    # Per-job override: the Generate screen can pass a specific provider plus
    # credentials. When present we honour it verbatim and skip the active-
    # translator resolution. The override-path dispatch mirrors the original
    # behaviour for the three built-in providers.
    override_provider = request.get("translatorProvider")
    if override_provider:
        if override_provider == "gemini":
            return get_translator(
                "gemini",
                api_key=request.get("translatorApiKey") or cfg.gemini_api_key,
                model=request.get("translatorModel") or cfg.gemini_model,
            )
        if override_provider == "local_openai":
            return get_translator(
                "local_openai",
                base_url=request.get("translatorBaseUrl") or cfg.local_openai_base_url,
                model=request.get("translatorModel") or cfg.local_openai_model,
                api_key=request.get("translatorApiKey") or cfg.local_openai_api_key or "lm-studio",
            )
        if override_provider == "openai":
            return get_translator(
                "openai",
                base_url=request.get("translatorBaseUrl") or cfg.openai_base_url,
                model=request.get("translatorModel") or cfg.openai_model,
                api_key=request.get("translatorApiKey") or cfg.openai_api_key,
            )
        if override_provider.startswith("custom:"):
            # Per-job override pointing at a named profile (custom_translators).
            # Reuse get_active_translator's dispatch — it already knows how to
            # look up the entry by id and build an OpenAICompatTranslator from
            # the saved credentials. Override on a shallow copy so cfg itself
            # isn't mutated.
            tmp_cfg = copy.copy(cfg)
            tmp_cfg.active_translator = override_provider
            return get_active_translator(tmp_cfg)
        raise ValueError(f"unknown translator provider: {override_provider!r}")
    # No per-job override → use the active translator from config (respects
    # gemini / local_openai / custom:<id> profiles).
    return get_active_translator(cfg)


def _seed_metadata(
    folder: Path,
    *,
    video_id: str,
    url: str,
    title_original: str,
    thumbnail_url: str | None,
    channel: str | None,
    duration_seconds: int | None,
) -> None:
    """Lazy-migrate the folder if needed, then write top-level video metadata."""
    library_runs.migrate_legacy_folder(folder)
    library_runs.update_metadata(
        folder,
        url=url,
        title_original=title_original,
        thumbnail_url=thumbnail_url
            or f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg",
        channel=channel,
        duration_seconds=duration_seconds,
    )


def run_pipeline(
    url: str,
    request: dict,
    cfg: AppConfig,
    on_event: Callable[[dict], None],
    cancel_event: threading.Event | None = None,
) -> None:
    start_time = time.monotonic()
    on_event({"status": "starting", "message": "Fetching info..."})
    _check_cancel(cancel_event)

    # We delegate metadata fetching to api/routes/process to keep pipeline.py
    # focused on the chain. Caller passes title via request['_meta_title'].
    title = request.get("_meta_title", "")
    video_id = request["_video_id"]
    folder_name = safe_folder_name(title, video_id, ascii_only=False)
    folder = Path(cfg.output_dir or "output", folder_name)
    folder.mkdir(parents=True, exist_ok=True)

    _seed_metadata(
        folder,
        video_id=video_id,
        url=url,
        title_original=title,
        thumbnail_url=request.get("_meta_thumbnail_url"),
        channel=request.get("_meta_channel"),
        duration_seconds=request.get("_meta_duration"),
    )

    # Download-only short circuit: skip STT + translation entirely. The
    # frontend's "Just download, no subtitles" toggle hits this path.
    if request.get("downloadOnly"):
        on_event({"status": "downloading", "message": "Downloading audio..."})

        def _dl_only_progress(d: dict) -> None:
            _check_cancel(cancel_event)
            on_event({
                "status": "downloading",
                "percent": _percent_from_yt_dlp(d),
                "speed": d.get("speed"),
                "eta": d.get("eta"),
            })

        audio_path, _ = download_audio(
            url, str(folder),
            cookie_browser=cfg.cookie_browser,
            cookie_profile=cfg.cookie_profile,
            cookies_txt_path=cfg.cookies_txt_path,
            progress=_dl_only_progress,
        )
        _check_cancel(cancel_event)

        duration_ms = int((time.monotonic() - start_time) * 1000)
        on_event({
            "status": "done",
            "videoId": video_id,
            "originalSrtPath": "",
            "translatedSrtPath": None,
            "audioPath": audio_path,
            "sttSourceUsed": "download_only",
            "durationMs": duration_ms,
            "previewSegments": [],
        })
        return

    provider = _select_stt_provider(request, cfg, url)
    _check_cancel(cancel_event)

    audio_path: str | None = None
    if provider.needs_audio:
        on_event({"status": "downloading", "message": "Downloading audio..."})

        def _dl_progress(d: dict) -> None:
            _check_cancel(cancel_event)
            on_event({
                "status": "downloading",
                "percent": _percent_from_yt_dlp(d),
                "speed": d.get("speed"),
                "eta": d.get("eta"),
            })

        audio_path, _ = download_audio(
            url, str(folder),
            cookie_browser=cfg.cookie_browser,
            cookie_profile=cfg.cookie_profile,
            cookies_txt_path=cfg.cookies_txt_path,
            progress=_dl_progress,
        )
        _check_cancel(cancel_event)

    transcribe_started = time.monotonic()
    on_event({"status": "transcribing", "engine": provider.name, "progress": None})
    _check_cancel(cancel_event)

    def _stt_progress(p):
        _check_cancel(cancel_event)
        on_event({"status": "transcribing", "engine": provider.name, "progress": p})

    result: TranscriptionResult = provider.transcribe(
        audio_path=audio_path,
        url=url,
        language=request["sourceLang"],
        progress=_stt_progress,
    )
    _check_cancel(cancel_event)
    transcribe_duration_ms = int((time.monotonic() - transcribe_started) * 1000)

    # Write transcript SRT into transcripts/<id>.srt
    transcribe_engine = (
        "yt_captions" if provider.name == "yt_captions" else provider.name
    )
    transcribe_model = (
        None
        if transcribe_engine == "yt_captions"
        else request.get("whisperModel") or cfg.default_whisper_model
    )
    t_id = library_runs.transcribe_id(
        transcribe_engine, transcribe_model, request["sourceLang"]
    )
    transcripts_dir = folder / "transcripts"
    transcripts_dir.mkdir(parents=True, exist_ok=True)
    transcript_filename = f"{t_id}.srt"
    transcript_path = transcripts_dir / transcript_filename

    from core.subtitles import write_srt  # legacy module; kept as-is, refactor optional
    write_srt(
        [{"id": s.id, "start": s.start, "end": s.end, "text": s.text} for s in result.segments],
        str(transcript_path),
        field="text",
    )
    library_runs.append_transcribe(
        folder,
        {
            "id": t_id,
            "engine": transcribe_engine,
            "model": transcribe_model,
            "device": (
                None
                if transcribe_engine == "yt_captions"
                else request.get("whisperDevice") or cfg.default_whisper_device
            ),
            "vadEnabled": (
                None if transcribe_engine == "yt_captions" else bool(request.get("vadEnabled"))
            ),
            "language": request["sourceLang"],
            "filename": transcript_filename,
            "createdAt": library_runs._now_iso(),
            "durationMs": transcribe_duration_ms,
            "segmentCount": len(result.segments),
        },
    )

    translated_path: Path | None = None
    if request.get("enableTranslation") and request.get("targetLang"):
        translate_started = time.monotonic()
        on_event({"status": "translating", "progress": None})
        _check_cancel(cancel_event)
        translator = _make_translator(request, cfg)

        def _tx_progress(p):
            _check_cancel(cancel_event)
            on_event({"status": "translating", "progress": p})

        translator.translate_segments(
            result.segments,
            request["targetLang"],
            progress=_tx_progress,
        )
        _check_cancel(cancel_event)
        translate_duration_ms = int((time.monotonic() - translate_started) * 1000)

        translator_provider = request.get("translatorProvider") or cfg.translator_provider
        translator_model = _translator_model_for(translator_provider, request, cfg)
        tr_id = library_runs.translate_id(
            t_id, translator_provider, translator_model, request["targetLang"]
        )
        translations_dir = folder / "translations"
        translations_dir.mkdir(parents=True, exist_ok=True)
        translated_filename = f"{tr_id}.srt"
        translated_path = translations_dir / translated_filename
        write_srt(
            [
                {"id": s.id, "start": s.start, "end": s.end, "translated": s.translated or ""}
                for s in result.segments
            ],
            str(translated_path),
            field="translated",
        )
        library_runs.append_translation(
            folder,
            {
                "id": tr_id,
                "sourceTranscribeId": t_id,
                "translator": translator_provider,
                "translatorModel": translator_model,
                "targetLang": request["targetLang"],
                "filename": translated_filename,
                "createdAt": library_runs._now_iso(),
                "durationMs": translate_duration_ms,
                "segmentCount": len(result.segments),
            },
        )

    duration_ms = int((time.monotonic() - start_time) * 1000)

    on_event({
        "status": "done",
        "videoId": video_id,
        "originalSrtPath": os.path.abspath(str(transcript_path)),
        "translatedSrtPath": os.path.abspath(str(translated_path)) if translated_path else None,
        "audioPath": audio_path,
        "sttSourceUsed": result.source,
        "durationMs": duration_ms,
        "transcribeId": t_id,
        "translateId": (
            library_runs.translate_id(
                t_id,
                request.get("translatorProvider") or cfg.translator_provider,
                _translator_model_for(
                    request.get("translatorProvider") or cfg.translator_provider, request, cfg
                ),
                request["targetLang"],
            )
            if translated_path
            else None
        ),
        "previewSegments": [
            {"id": s.id, "start": s.start, "end": s.end, "text": s.text, "translated": s.translated}
            for s in result.segments[:5]
        ],
    })


def _translator_model_for(provider: str, request: dict, cfg: AppConfig) -> str:
    """Resolve the model string actually used for a translator provider."""
    if provider == "gemini":
        return request.get("translatorModel") or cfg.gemini_model
    if provider == "local_openai":
        return request.get("translatorModel") or cfg.local_openai_model
    if provider == "openai":
        return request.get("translatorModel") or cfg.openai_model
    return request.get("translatorModel") or "unknown"
