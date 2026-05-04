"""YouTube auto-caption provider.

Uses yt-dlp to fetch the video's auto-generated captions if available.
Free, instant, no GPU. Quality is decent for popular languages, mediocre for
small languages — we'd rather try this first and fall back to Whisper than
make the user wait 5 minutes for a Whisper run when YT already has captions.
"""
from __future__ import annotations

import re
import tempfile
from collections.abc import Callable
from pathlib import Path

import yt_dlp

from core.config import load_config
from core.downloader.js_runtime import build_js_runtime_opts
from core.stt.base import TranscriptionResult, TranscriptionSegment


class YtCaptionsProvider:
    name = "yt_captions"
    needs_audio = False

    def is_available(self, url: str | None = None) -> bool:
        """Check if the video has auto-captions without downloading them."""
        if not url:
            return False
        try:
            opts: dict = {"quiet": True, "skip_download": True}
            opts.update(build_js_runtime_opts(load_config().js_runtime_path))
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(url, download=False)
                automatic = info.get("automatic_captions", {}) or {}
                manual = info.get("subtitles", {}) or {}
                return bool(automatic or manual)
        except Exception:
            return False

    def transcribe(
        self,
        audio_path: str | None,
        url: str | None,
        language: str | None,
        progress: Callable[[float], None] | None = None,
    ) -> TranscriptionResult:
        if not url:
            raise ValueError("YtCaptionsProvider requires url")

        if progress:
            progress(0.0)

        with tempfile.TemporaryDirectory() as tmp:
            opts: dict = {
                "quiet": True,
                "skip_download": True,
                "writesubtitles": True,
                "writeautomaticsub": True,
                "subtitleslangs": [language or "en"],
                "subtitlesformat": "vtt",
                "outtmpl": str(Path(tmp) / "%(id)s.%(ext)s"),
            }
            opts.update(build_js_runtime_opts(load_config().js_runtime_path))
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(url, download=True)
                video_id = info["id"]

            vtt_files = list(Path(tmp).glob(f"{video_id}.*.vtt"))
            if not vtt_files:
                raise RuntimeError(f"No captions returned for language={language}")
            content = vtt_files[0].read_text(encoding="utf-8")

        segments = self._parse_vtt(content)
        if progress:
            progress(1.0)

        return TranscriptionResult(
            segments=segments,
            language=language or "unknown",
            source=self.name,
        )

    @staticmethod
    def _parse_vtt(content: str) -> list[TranscriptionSegment]:
        """Parse WebVTT into TranscriptionSegment list. Minimal — no styling tags."""
        cues = re.split(r"\n\n+", content.strip())
        segments: list[TranscriptionSegment] = []
        idx = 0
        for block in cues:
            if "-->" not in block:
                continue
            lines = [ln for ln in block.splitlines() if ln.strip()]
            time_line = next((ln for ln in lines if "-->" in ln), None)
            if not time_line:
                continue
            m = re.match(
                r"(\d+):(\d+):(\d+)\.(\d+)\s*-->\s*(\d+):(\d+):(\d+)\.(\d+)",
                time_line,
            )
            if not m:
                continue
            start = int(m[1]) * 3600 + int(m[2]) * 60 + int(m[3]) + int(m[4]) / 1000
            end = int(m[5]) * 3600 + int(m[6]) * 60 + int(m[7]) + int(m[8]) / 1000
            text_lines = [ln for ln in lines if "-->" not in ln and not ln.strip().isdigit()]
            text = " ".join(text_lines).strip()
            if not text:
                continue
            idx += 1
            segments.append(TranscriptionSegment(id=idx, start=start, end=end, text=text))
        return segments
