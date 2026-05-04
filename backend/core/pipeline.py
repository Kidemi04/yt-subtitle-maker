"""Pipeline orchestrator.

Single entry point `run_pipeline()` chains:
  fetch_metadata -> select_stt -> [download_audio?] -> transcribe -> translate? -> write_srt
Emits NDJSON-friendly dict events via `on_event` callback for streaming endpoints.
"""
from __future__ import annotations

import contextlib
import json
import os
import re
import threading
import time
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path

from core.config import AppConfig
from core.downloader.youtube import download_audio, safe_folder_name
from core.stt import get_provider
from core.stt.base import TranscriptionProvider, TranscriptionResult
from core.stt.yt_captions import YtCaptionsProvider
from core.translator import get_translator

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
    provider = request.get("translatorProvider") or cfg.translator_provider
    if provider == "gemini":
        return get_translator(
            "gemini",
            api_key=request.get("translatorApiKey") or cfg.gemini_api_key,
            model=request.get("translatorModel") or cfg.gemini_model,
        )
    if provider == "local_openai":
        return get_translator(
            "local_openai",
            base_url=request.get("translatorBaseUrl") or cfg.local_openai_base_url,
            model=request.get("translatorModel") or cfg.local_openai_model,
            api_key=request.get("translatorApiKey") or cfg.local_openai_api_key or "lm-studio",
        )
    if provider == "openai":
        return get_translator(
            "openai",
            base_url=request.get("translatorBaseUrl") or cfg.openai_base_url,
            model=request.get("translatorModel") or cfg.openai_model,
            api_key=request.get("translatorApiKey") or cfg.openai_api_key,
        )
    raise ValueError(f"unknown translator provider: {provider!r}")


def _write_history_sidecar(
    out_dir: str,
    *,
    video_id: str,
    url: str,
    title_original: str,
    title_translated: str | None,
    target_lang: str | None,
    stt_engine_used: str,
    duration_ms: int,
) -> None:
    """Persist a per-video sidecar that GET /api/history reads."""
    sidecar = {
        "videoId": video_id,
        "url": url,
        "titleOriginal": title_original,
        "titleTranslated": title_translated,
        "targetLang": target_lang,
        "sttEngineUsed": stt_engine_used,
        "createdAt": datetime.now(UTC).isoformat(),
        "processingDurationMs": duration_ms,
        "thumbnailUrl": f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg",
    }
    # Sidecar is best-effort; never fail the pipeline because of it.
    with contextlib.suppress(Exception):
        Path(out_dir, "_history.json").write_text(
            json.dumps(sidecar, ensure_ascii=False, indent=2),
            encoding="utf-8",
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
    folder = safe_folder_name(title, video_id, ascii_only=False)
    out_dir = os.path.join(cfg.output_dir or "output", folder)
    Path(out_dir).mkdir(parents=True, exist_ok=True)

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
            url, out_dir,
            cookie_browser=cfg.cookie_browser,
            cookie_profile=cfg.cookie_profile,
            cookies_txt_path=cfg.cookies_txt_path,
            progress=_dl_only_progress,
        )
        _check_cancel(cancel_event)

        duration_ms = int((time.monotonic() - start_time) * 1000)
        _write_history_sidecar(
            out_dir,
            video_id=video_id,
            url=url,
            title_original=title,
            title_translated=None,
            target_lang=None,
            stt_engine_used="download_only",
            duration_ms=duration_ms,
        )
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
            url, out_dir,
            cookie_browser=cfg.cookie_browser,
            cookie_profile=cfg.cookie_profile,
            cookies_txt_path=cfg.cookies_txt_path,
            progress=_dl_progress,
        )
        _check_cancel(cancel_event)

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

    if request.get("enableTranslation") and request.get("targetLang"):
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

    # Write SRTs
    from core.subtitles import write_srt  # legacy module; kept as-is, refactor optional
    original_path = os.path.join(out_dir, f"{video_id}_original.srt")
    write_srt(
        [{"id": s.id, "start": s.start, "end": s.end, "text": s.text} for s in result.segments],
        original_path,
        field="text",
    )
    translated_path = None
    if request.get("enableTranslation") and request.get("targetLang"):
        translated_path = os.path.join(out_dir, f"{video_id}_{request['targetLang']}.srt")
        write_srt(
            [
                {"id": s.id, "start": s.start, "end": s.end, "translated": s.translated or ""}
                for s in result.segments
            ],
            translated_path,
            field="translated",
        )

    duration_ms = int((time.monotonic() - start_time) * 1000)

    _write_history_sidecar(
        out_dir,
        video_id=video_id,
        url=url,
        title_original=title,
        # title-translator feature isn't wired in V1; sidecar leaves this null.
        title_translated=None,
        target_lang=request.get("targetLang"),
        stt_engine_used=result.source or provider.name,
        duration_ms=duration_ms,
    )

    on_event({
        "status": "done",
        "videoId": video_id,
        "originalSrtPath": os.path.abspath(original_path),
        "translatedSrtPath": os.path.abspath(translated_path) if translated_path else None,
        "audioPath": audio_path,
        "sttSourceUsed": result.source,
        "durationMs": duration_ms,
        "previewSegments": [
            {"id": s.id, "start": s.start, "end": s.end, "text": s.text, "translated": s.translated}
            for s in result.segments[:5]
        ],
    })
