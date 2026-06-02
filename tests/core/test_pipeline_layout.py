"""Verify run_pipeline writes SRTs into the Plan-C subdirectory layout
and registers them in the new-shape sidecar.
"""
from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import patch

from core.config import AppConfig
from core.pipeline import run_pipeline
from core.stt.base import TranscriptionResult, TranscriptionSegment


class _FakeProvider:
    name = "openai-whisper"
    needs_audio = True

    def is_available(self, url=None):
        return True

    def transcribe(self, audio_path, url, language, progress=None):
        if progress:
            progress(0.5)
            progress(1.0)
        return TranscriptionResult(
            segments=[
                TranscriptionSegment(id=1, start=0.0, end=1.0, text="Hello"),
                TranscriptionSegment(id=2, start=1.0, end=2.0, text="World"),
            ],
            language=language or "en",
            source="openai-whisper",
        )


class _FakeTranslator:
    def translate_segments(self, segments, target_lang, progress=None):
        for s in segments:
            s.translated = f"[{target_lang}] {s.text}"
        if progress:
            progress(1.0)

    def translate_title(self, title, target_lang):
        return f"[{target_lang}] {title}"


def test_pipeline_writes_to_subdirs_and_appends_sidecar(tmp_path):
    out = tmp_path / "output"
    out.mkdir()

    cfg = AppConfig()
    cfg.output_dir = str(out)
    cfg.translator_provider = "gemini"
    cfg.gemini_model = "gemini-2.5-flash-lite"

    request = {
        "url": "https://www.youtube.com/watch?v=abcDEFghIJK",
        "sttSource": "whisper",
        "sttEngine": "openai-whisper",
        "whisperModel": "tiny",
        "whisperDevice": "cpu",
        "vadEnabled": True,
        "sourceLang": "en",
        "enableTranslation": True,
        "targetLang": "zh",
        "translatorProvider": "gemini",
        "translatorModel": "gemini-2.5-flash-lite",
        "_meta_title": "Hello Video",
        "_meta_thumbnail_url": "https://example/thumb.jpg",
        "_meta_channel": "Some Channel",
        "_meta_duration": 120,
        "_video_id": "abcDEFghIJK",
    }

    events: list[dict] = []
    with patch("core.pipeline._select_stt_provider", return_value=_FakeProvider()), patch(
        "core.pipeline._make_translator", return_value=_FakeTranslator()
    ), patch(
        "core.pipeline.download_audio",
        side_effect=lambda url, dst, **kw: (str(Path(dst) / "abcDEFghIJK.wav"), 1.0),
    ):
        run_pipeline(
            request["url"], request, cfg, on_event=events.append, cancel_event=None
        )

    folder = out / "Hello_Video_abcDEFghIJK"
    assert folder.is_dir()

    # Subdirectory layout
    transcripts = folder / "transcripts"
    translations = folder / "translations"
    assert transcripts.is_dir()
    assert translations.is_dir()

    # Transcript file lives at transcripts/<id>.srt with the deterministic id
    transcript_files = list(transcripts.glob("*.srt"))
    assert len(transcript_files) == 1
    assert transcript_files[0].name == "openai-whisper-tiny-en.srt"

    # Translation file lives at translations/<id>.srt
    translation_files = list(translations.glob("*.srt"))
    assert len(translation_files) == 1
    assert translation_files[0].name == (
        "openai-whisper-tiny-en__gemini-gemini-2-5-flash-lite__zh.srt"
    )

    # Old-shape SRTs MUST NOT be written at the folder root.
    root_srts = [f for f in folder.iterdir() if f.is_file() and f.suffix == ".srt"]
    assert root_srts == []

    # Sidecar is new-shape and reflects both runs
    sidecar = json.loads((folder / "_history.json").read_text(encoding="utf-8"))
    assert sidecar["videoId"] == "abcDEFghIJK"
    assert sidecar["titleOriginal"] == "Hello Video"
    assert sidecar["titleTranslated"] == "[zh] Hello Video"
    assert sidecar["channel"] == "Some Channel"
    assert sidecar["durationSeconds"] == 120
    assert sidecar["thumbnailUrl"] == "https://example/thumb.jpg"
    assert len(sidecar["transcribes"]) == 1
    assert sidecar["transcribes"][0]["id"] == "openai-whisper-tiny-en"
    assert sidecar["transcribes"][0]["filename"] == "openai-whisper-tiny-en.srt"
    assert sidecar["transcribes"][0]["segmentCount"] == 2
    assert len(sidecar["translations"]) == 1
    tr = sidecar["translations"][0]
    assert tr["sourceTranscribeId"] == "openai-whisper-tiny-en"
    assert tr["translator"] == "gemini"
    assert tr["translatorModel"] == "gemini-2.5-flash-lite"
    assert tr["targetLang"] == "zh"

    # `done` event carries new ids
    done = events[-1]
    assert done["status"] == "done"
    assert done["transcribeId"] == "openai-whisper-tiny-en"
    assert (
        done["translateId"]
        == "openai-whisper-tiny-en__gemini-gemini-2-5-flash-lite__zh"
    )
    # Path fields point into subdirs
    assert done["originalSrtPath"].endswith(
        str(Path("transcripts") / "openai-whisper-tiny-en.srt")
    )
    assert done["translatedSrtPath"].endswith(
        str(
            Path("translations")
            / "openai-whisper-tiny-en__gemini-gemini-2-5-flash-lite__zh.srt"
        )
    )


def test_pipeline_lazy_migrates_legacy_folder(tmp_path):
    """A legacy folder gets migrated into transcripts/ + translations/
    when a new pipeline run lands on it."""
    out = tmp_path / "output"
    out.mkdir()
    folder = out / "Hello_Video_abcDEFghIJK"
    folder.mkdir()
    # Plant legacy SRTs
    (folder / "abcDEFghIJK_original.srt").write_text(
        "1\n00:00:01,000 --> 00:00:02,000\nLegacy\n", encoding="utf-8"
    )
    (folder / "abcDEFghIJK_zh.srt").write_text(
        "1\n00:00:01,000 --> 00:00:02,000\n旧\n", encoding="utf-8"
    )

    cfg = AppConfig()
    cfg.output_dir = str(out)

    request = {
        "url": "https://www.youtube.com/watch?v=abcDEFghIJK",
        "sttSource": "whisper",
        "sttEngine": "openai-whisper",
        "whisperModel": "turbo",
        "whisperDevice": "cpu",
        "vadEnabled": False,
        "sourceLang": "en",
        "enableTranslation": False,
        "_meta_title": "Hello Video",
        "_video_id": "abcDEFghIJK",
    }
    events: list[dict] = []
    with patch("core.pipeline._select_stt_provider", return_value=_FakeProvider()), patch(
        "core.pipeline.download_audio",
        side_effect=lambda url, dst, **kw: (str(Path(dst) / "abcDEFghIJK.wav"), 1.0),
    ):
        run_pipeline(
            request["url"], request, cfg, on_event=events.append, cancel_event=None
        )

    # Legacy files moved into subdirs, no flat SRTs left at root
    assert not (folder / "abcDEFghIJK_original.srt").exists()
    assert not (folder / "abcDEFghIJK_zh.srt").exists()
    assert (folder / "transcripts" / "legacy.srt").is_file()
    assert (folder / "translations" / "legacy-zh.srt").is_file()

    # New transcript also written under transcripts/
    new_t = folder / "transcripts" / "openai-whisper-turbo-en.srt"
    assert new_t.is_file()

    # Sidecar lists both legacy + new transcripts (and the legacy translation)
    sidecar = json.loads((folder / "_history.json").read_text(encoding="utf-8"))
    ids = {t["id"] for t in sidecar["transcribes"]}
    assert ids == {"legacy", "openai-whisper-turbo-en"}
    assert any(t["id"] == "legacy-zh" for t in sidecar["translations"])
