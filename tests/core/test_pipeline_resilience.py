"""Pipeline failure-mode tests.

These cover the three ways a run used to destroy work it had already done:
a failed download leaving a clickable-but-empty library entry, a mid-run
translation failure discarding every batch already paid for, and a cosmetic
title translation taking the finished SRT down with it.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from core.config import AppConfig
from core.pipeline import run_pipeline
from core.stt.base import TranscriptionResult, TranscriptionSegment

VIDEO_ID = "abc12345678"


def _segments(n: int) -> list[TranscriptionSegment]:
    return [
        TranscriptionSegment(id=i + 1, start=float(i), end=float(i) + 1.0, text=f"line {i + 1}")
        for i in range(n)
    ]


class _StubProvider:
    """Stands in for a Whisper provider; needs no audio and no network."""

    name = "openai-whisper"
    needs_audio = False

    def __init__(self, segments):
        self._segments = segments

    def is_available(self, *_a, **_k):
        return True

    def transcribe(self, audio_path=None, url=None, language=None, progress=None):
        if progress:
            progress(1.0)
        return TranscriptionResult(
            segments=self._segments, language=language or "en", source=self.name
        )


def _request(**over):
    req = {
        "sttSource": "whisper",
        "sttEngine": "openai-whisper",
        "whisperModel": "turbo",
        "whisperDevice": "cpu",
        "vadEnabled": True,
        "sourceLang": "en",
        "enableTranslation": False,
        "_meta_title": "My Video",
        "_video_id": VIDEO_ID,
    }
    req.update(over)
    return req


@pytest.fixture
def cfg(tmp_path):
    c = AppConfig()
    c.output_dir = str(tmp_path / "output")
    return c


def test_failed_run_leaves_no_ghost_library_entry(cfg, monkeypatch):
    """list_library() treats any `<title>_<videoId>` dir as an entry."""
    def boom(*_a, **_k):
        raise RuntimeError("download failed")

    monkeypatch.setattr("core.pipeline._select_stt_provider", boom)

    with pytest.raises(RuntimeError):
        run_pipeline("https://youtu.be/x", _request(), cfg, lambda e: None)

    out = Path(cfg.output_dir)
    assert not any(p.is_dir() for p in out.iterdir()) if out.is_dir() else True


def test_prune_never_touches_a_folder_with_real_output(cfg, monkeypatch):
    """A re-run against an existing video must not delete what's there."""
    folder = Path(cfg.output_dir) / f"My_Video_{VIDEO_ID}"
    folder.mkdir(parents=True)
    keeper = folder / "already-here.srt"
    keeper.write_text("1\n")

    monkeypatch.setattr(
        "core.pipeline._select_stt_provider",
        lambda *a, **k: (_ for _ in ()).throw(RuntimeError("nope")),
    )
    with pytest.raises(RuntimeError):
        run_pipeline("https://youtu.be/x", _request(), cfg, lambda e: None)

    assert keeper.exists()


def test_partial_translation_is_saved_when_translation_dies(cfg, monkeypatch):
    """Segments are translated in place; a mid-run failure must not bin them."""
    segs = _segments(10)
    monkeypatch.setattr(
        "core.pipeline._select_stt_provider", lambda *a, **k: _StubProvider(segs)
    )

    class HalfwayTranslator:
        name = "gemini"

        def translate_segments(self, segments, target_lang, progress=None, on_notice=None):
            for s in segments[:6]:
                s.translated = f"translated {s.id}"
            raise RuntimeError("429 rate limited")

        def translate_title(self, title, target_lang):  # pragma: no cover
            raise AssertionError("should not be reached")

    monkeypatch.setattr("core.pipeline._make_translator", lambda *a, **k: HalfwayTranslator())

    events: list[dict] = []
    with pytest.raises(RuntimeError):
        run_pipeline(
            "https://youtu.be/x",
            _request(enableTranslation=True, targetLang="zh-CN"),
            cfg,
            events.append,
        )

    folder = Path(cfg.output_dir) / f"My_Video_{VIDEO_ID}"
    partials = list((folder / "translations").glob("*.partial.srt"))
    assert len(partials) == 1
    body = partials[0].read_text()
    assert "translated 1" in body and "translated 6" in body

    # Recorded as incomplete, not passed off as a finished translation.
    sidecar = json.loads((folder / "_history.json").read_text())
    entry = sidecar["translations"][-1]
    assert entry["partial"] is True
    assert entry["translatedSegmentCount"] == 6

    warnings = [e for e in events if e.get("status") == "warning"]
    assert warnings and "6/10" in warnings[0]["message"]


def test_title_translation_failure_does_not_lose_the_subtitles(cfg, monkeypatch):
    """Title translation is cosmetic and now runs after the SRT is on disk."""
    segs = _segments(4)
    monkeypatch.setattr(
        "core.pipeline._select_stt_provider", lambda *a, **k: _StubProvider(segs)
    )

    class TitleFailsTranslator:
        name = "gemini"

        def translate_segments(self, segments, target_lang, progress=None, on_notice=None):
            for s in segments:
                s.translated = f"translated {s.id}"

        def translate_title(self, title, target_lang):
            raise RuntimeError("safety filter blocked the title")

    monkeypatch.setattr(
        "core.pipeline._make_translator", lambda *a, **k: TitleFailsTranslator()
    )

    events: list[dict] = []
    run_pipeline(
        "https://youtu.be/x",
        _request(enableTranslation=True, targetLang="zh-CN"),
        cfg,
        events.append,
    )

    done = [e for e in events if e.get("status") == "done"]
    assert done, "run should complete despite the title failing"
    translated = Path(done[0]["translatedSrtPath"])
    assert translated.exists()
    assert "translated 4" in translated.read_text()
    assert not translated.name.endswith(".partial.srt")

    warnings = [e for e in events if e.get("status") == "warning"]
    assert warnings and "title translation failed" in warnings[0]["message"]


def test_translator_without_on_notice_still_works(cfg, monkeypatch):
    """Providers predating the retry-notice callback must not TypeError."""
    segs = _segments(3)
    monkeypatch.setattr(
        "core.pipeline._select_stt_provider", lambda *a, **k: _StubProvider(segs)
    )

    class LegacyTranslator:
        name = "gemini"

        def translate_segments(self, segments, target_lang, progress=None):
            for s in segments:
                s.translated = f"t{s.id}"

        def translate_title(self, title, target_lang):
            return "translated title"

    monkeypatch.setattr("core.pipeline._make_translator", lambda *a, **k: LegacyTranslator())

    events: list[dict] = []
    run_pipeline(
        "https://youtu.be/x",
        _request(enableTranslation=True, targetLang="zh-CN"),
        cfg,
        events.append,
    )
    assert any(e.get("status") == "done" for e in events)
