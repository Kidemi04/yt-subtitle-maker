"""Pipeline orchestrator.

Single entry point `run_pipeline()` chains:
  fetch_metadata -> select_stt -> [download_audio?] -> transcribe -> translate? -> write_srt
Emits NDJSON-friendly dict events via `on_event` callback for streaming endpoints.
"""
from __future__ import annotations

import os
from collections.abc import Callable
from pathlib import Path

from core.config import AppConfig
from core.downloader.youtube import download_audio, safe_folder_name
from core.stt import get_provider
from core.stt.base import TranscriptionProvider, TranscriptionResult
from core.stt.yt_captions import YtCaptionsProvider
from core.translator import get_translator


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


def run_pipeline(
    url: str,
    request: dict,
    cfg: AppConfig,
    on_event: Callable[[dict], None],
) -> None:
    on_event({"status": "starting", "message": "Fetching info..."})

    # We delegate metadata fetching to api/routes/process to keep pipeline.py
    # focused on the chain. Caller passes title via request['_meta_title'].
    title = request.get("_meta_title", "")
    video_id = request["_video_id"]
    folder = safe_folder_name(title, video_id, ascii_only=False)
    out_dir = os.path.join(cfg.output_dir or "output", folder)
    Path(out_dir).mkdir(parents=True, exist_ok=True)

    provider = _select_stt_provider(request, cfg, url)

    audio_path: str | None = None
    if provider.needs_audio:
        on_event({"status": "downloading", "message": "Downloading audio..."})
        audio_path, _ = download_audio(
            url, out_dir,
            cookie_browser=cfg.cookie_browser,
            cookie_profile=cfg.cookie_profile,
            cookies_txt_path=cfg.cookies_txt_path,
            progress=lambda d: on_event({
                "status": "downloading",
                "percent": float(d.get("_percent_str", "0%").strip("%")) if d.get("_percent_str") else None,
                "speed": d.get("speed"),
                "eta": d.get("eta"),
            }),
        )

    on_event({"status": "transcribing", "engine": provider.name, "progress": None})
    result: TranscriptionResult = provider.transcribe(
        audio_path=audio_path,
        url=url,
        language=request["sourceLang"],
        progress=lambda p: on_event({
            "status": "transcribing", "engine": provider.name, "progress": p,
        }),
    )

    if request.get("enableTranslation") and request.get("targetLang"):
        on_event({"status": "translating", "progress": None})
        translator = _make_translator(request, cfg)
        translator.translate_segments(
            result.segments,
            request["targetLang"],
            progress=lambda p: on_event({"status": "translating", "progress": p}),
        )

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

    on_event({
        "status": "done",
        "videoId": video_id,
        "originalSrtPath": os.path.abspath(original_path),
        "translatedSrtPath": os.path.abspath(translated_path) if translated_path else None,
        "audioPath": audio_path,
        "sttSourceUsed": result.source,
        "previewSegments": [
            {"id": s.id, "start": s.start, "end": s.end, "text": s.text, "translated": s.translated}
            for s in result.segments[:5]
        ],
    })
