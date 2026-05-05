"""Tests for backend/core/library_runs.py — sidecar registry + id helpers.

Covers:
  - id determinism (same params → same id; different params → different id)
  - legacy folder synthesis without touching disk
  - lazy migration: legacy SRTs moved into transcripts/ + translations/
  - append helpers idempotent by id
  - remove_entry cascades transcripts → translations
  - concurrency: append from multiple threads doesn't lose entries
"""
from __future__ import annotations

import json
import threading
from pathlib import Path

import pytest

from core import library_runs as lr


# ---------------------------------------------------------------------------
# id helpers
# ---------------------------------------------------------------------------

def test_transcribe_id_yt_captions_has_no_model():
    assert lr.transcribe_id("yt_captions", None, "en") == "yt_captions-en"
    # A model component is ignored for yt_captions.
    assert lr.transcribe_id("yt_captions", "ignored", "en") == "yt_captions-en"


def test_transcribe_id_whisper_includes_engine_model_lang():
    assert (
        lr.transcribe_id("openai-whisper", "turbo", "en")
        == "openai-whisper-turbo-en"
    )


def test_transcribe_id_is_deterministic():
    a = lr.transcribe_id("openai-whisper", "tiny", "en")
    b = lr.transcribe_id("openai-whisper", "tiny", "en")
    assert a == b


def test_translate_id_slugifies_dotty_model_names():
    tid = lr.translate_id(
        "openai-whisper-turbo-en", "gemini", "gemini-2.5-flash-lite", "zh"
    )
    assert tid == "openai-whisper-turbo-en__gemini-gemini-2-5-flash-lite__zh"


def test_translate_id_lowercases_model_slug():
    tid = lr.translate_id("openai-whisper-tiny-en", "openai", "GPT-4o", "ja")
    assert tid == "openai-whisper-tiny-en__openai-gpt-4o__ja"


# ---------------------------------------------------------------------------
# folder_layout + legacy detection
# ---------------------------------------------------------------------------

def _make_legacy_folder(out: Path, video_id: str = "abcDEFghIJK") -> Path:
    folder = out / f"My Title_{video_id}"
    folder.mkdir()
    (folder / f"{video_id}_original.srt").write_text(
        "1\n00:00:01,000 --> 00:00:02,000\nHello\n", encoding="utf-8"
    )
    (folder / f"{video_id}_zh.srt").write_text(
        "1\n00:00:01,000 --> 00:00:02,000\n你好\n", encoding="utf-8"
    )
    (folder / f"{video_id}.wav").write_bytes(b"\x00" * 100)
    return folder


def _make_new_folder(out: Path, video_id: str = "abcDEFghIJK") -> Path:
    folder = out / f"My Title_{video_id}"
    folder.mkdir()
    (folder / "transcripts").mkdir()
    (folder / "translations").mkdir()
    (folder / f"{video_id}.wav").write_bytes(b"\x00" * 100)
    return folder


def test_folder_layout_detects_legacy(tmp_path):
    folder = _make_legacy_folder(tmp_path)
    layout = lr.folder_layout(folder)
    assert layout["kind"] == "legacy"
    assert layout["legacy_original"] is not None
    assert len(layout["legacy_translations"]) == 1
    assert layout["audio"] is not None


def test_folder_layout_detects_new(tmp_path):
    folder = _make_new_folder(tmp_path)
    layout = lr.folder_layout(folder)
    assert layout["kind"] == "new"


def test_folder_layout_detects_empty(tmp_path):
    folder = tmp_path / f"Empty_{'a' * 11}"
    folder.mkdir()
    layout = lr.folder_layout(folder)
    assert layout["kind"] == "empty"


# ---------------------------------------------------------------------------
# read_sidecar — synthesis
# ---------------------------------------------------------------------------

def test_read_sidecar_synthesizes_from_legacy_without_sidecar(tmp_path):
    folder = _make_legacy_folder(tmp_path, "abcDEFghIJK")
    sidecar = lr.read_sidecar(folder)

    assert sidecar["videoId"] == "abcDEFghIJK"
    assert sidecar["titleOriginal"] == "My Title"
    assert sidecar["url"].endswith("=abcDEFghIJK")
    assert len(sidecar["transcribes"]) == 1
    assert sidecar["transcribes"][0]["id"] == "legacy"
    assert sidecar["transcribes"][0]["filename"] == "abcDEFghIJK_original.srt"
    assert len(sidecar["translations"]) == 1
    assert sidecar["translations"][0]["id"] == "legacy-zh"
    assert sidecar["translations"][0]["sourceTranscribeId"] == "legacy"
    assert sidecar["translations"][0]["targetLang"] == "zh"


def test_read_sidecar_synthesizes_from_legacy_sidecar(tmp_path):
    folder = _make_legacy_folder(tmp_path, "abcDEFghIJK")
    legacy = {
        "videoId": "abcDEFghIJK",
        "url": "https://www.youtube.com/watch?v=abcDEFghIJK",
        "titleOriginal": "My Title",
        "titleTranslated": "我的标题",
        "targetLang": "zh",
        "sttEngineUsed": "openai-whisper",
        "createdAt": "2026-04-01T12:00:00+00:00",
        "processingDurationMs": 12345,
        "thumbnailUrl": "https://img.youtube.com/vi/abcDEFghIJK/hqdefault.jpg",
    }
    (folder / "_history.json").write_text(json.dumps(legacy), encoding="utf-8")

    sidecar = lr.read_sidecar(folder)

    assert sidecar["titleTranslated"] == "我的标题"
    assert sidecar["createdAt"] == "2026-04-01T12:00:00+00:00"
    assert sidecar["transcribes"][0]["engine"] == "openai-whisper"
    assert sidecar["transcribes"][0]["durationMs"] == 12345
    assert sidecar["translations"][0]["targetLang"] == "zh"

    # Read should NOT touch disk: legacy sidecar still present in raw form.
    raw = json.loads((folder / "_history.json").read_text(encoding="utf-8"))
    assert "transcribes" not in raw
    assert raw["sttEngineUsed"] == "openai-whisper"


def test_read_sidecar_passes_through_new_shape(tmp_path):
    folder = _make_new_folder(tmp_path, "abcDEFghIJK")
    new_sidecar = {
        "videoId": "abcDEFghIJK",
        "url": "https://www.youtube.com/watch?v=abcDEFghIJK",
        "titleOriginal": "My Title",
        "titleTranslated": None,
        "thumbnailUrl": "https://img.youtube.com/vi/abcDEFghIJK/hqdefault.jpg",
        "channel": "Some Channel",
        "durationSeconds": 360,
        "createdAt": "2026-05-01T00:00:00+00:00",
        "updatedAt": "2026-05-01T00:00:00+00:00",
        "transcribes": [
            {
                "id": "openai-whisper-turbo-en",
                "engine": "openai-whisper",
                "model": "turbo",
                "device": "auto",
                "vadEnabled": True,
                "language": "en",
                "filename": "openai-whisper-turbo-en.srt",
                "createdAt": "2026-05-01T00:00:00+00:00",
                "durationMs": 1000,
                "segmentCount": 47,
            }
        ],
        "translations": [],
    }
    (folder / "_history.json").write_text(json.dumps(new_sidecar), encoding="utf-8")

    out = lr.read_sidecar(folder)
    assert out["channel"] == "Some Channel"
    assert out["durationSeconds"] == 360
    assert len(out["transcribes"]) == 1
    assert out["transcribes"][0]["id"] == "openai-whisper-turbo-en"


# ---------------------------------------------------------------------------
# migrate_legacy_folder
# ---------------------------------------------------------------------------

def test_migrate_legacy_folder_moves_files_and_writes_sidecar(tmp_path):
    folder = _make_legacy_folder(tmp_path, "abcDEFghIJK")

    sidecar = lr.migrate_legacy_folder(folder)

    # Subdirs created
    assert (folder / "transcripts").is_dir()
    assert (folder / "translations").is_dir()
    # Legacy original moved → transcripts/legacy.srt
    assert (folder / "transcripts" / "legacy.srt").is_file()
    assert not (folder / "abcDEFghIJK_original.srt").exists()
    # Legacy translation moved → translations/legacy-zh.srt
    assert (folder / "translations" / "legacy-zh.srt").is_file()
    assert not (folder / "abcDEFghIJK_zh.srt").exists()
    # Audio left alone
    assert (folder / "abcDEFghIJK.wav").is_file()
    # Sidecar written in new shape with updated filenames
    assert (folder / "_history.json").is_file()
    assert sidecar["transcribes"][0]["filename"] == "legacy.srt"
    assert sidecar["translations"][0]["filename"] == "legacy-zh.srt"


def test_migrate_legacy_folder_idempotent(tmp_path):
    folder = _make_legacy_folder(tmp_path, "abcDEFghIJK")
    lr.migrate_legacy_folder(folder)
    # Second call should be a no-op
    sidecar = lr.migrate_legacy_folder(folder)
    assert sidecar["transcribes"][0]["filename"] == "legacy.srt"
    assert (folder / "transcripts" / "legacy.srt").is_file()


def test_migrate_already_new_folder_noop(tmp_path):
    folder = _make_new_folder(tmp_path)
    new_sidecar = lr._empty_sidecar(folder, "abcDEFghIJK")
    new_sidecar["transcribes"].append(
        {
            "id": "openai-whisper-turbo-en",
            "engine": "openai-whisper",
            "model": "turbo",
            "device": "auto",
            "vadEnabled": True,
            "language": "en",
            "filename": "openai-whisper-turbo-en.srt",
            "createdAt": lr._now_iso(),
            "durationMs": 1000,
            "segmentCount": 5,
        }
    )
    lr.write_sidecar(folder, new_sidecar)

    sidecar = lr.migrate_legacy_folder(folder)
    assert sidecar["transcribes"][0]["id"] == "openai-whisper-turbo-en"


# ---------------------------------------------------------------------------
# append + remove
# ---------------------------------------------------------------------------

def test_append_transcribe_idempotent_by_id(tmp_path):
    folder = _make_new_folder(tmp_path)
    entry = {
        "id": "openai-whisper-tiny-en",
        "engine": "openai-whisper",
        "model": "tiny",
        "device": "cpu",
        "vadEnabled": False,
        "language": "en",
        "filename": "openai-whisper-tiny-en.srt",
        "createdAt": lr._now_iso(),
        "durationMs": 1000,
        "segmentCount": 5,
    }
    lr.append_transcribe(folder, entry)
    # Append same id with new durationMs → replaces (not duplicate).
    entry2 = dict(entry, durationMs=9999, segmentCount=42)
    sidecar = lr.append_transcribe(folder, entry2)
    assert len(sidecar["transcribes"]) == 1
    assert sidecar["transcribes"][0]["durationMs"] == 9999
    assert sidecar["transcribes"][0]["segmentCount"] == 42


def test_append_translation_idempotent_by_id(tmp_path):
    folder = _make_new_folder(tmp_path)
    entry = {
        "id": "openai-whisper-tiny-en__gemini-flash__zh",
        "sourceTranscribeId": "openai-whisper-tiny-en",
        "translator": "gemini",
        "translatorModel": "flash",
        "targetLang": "zh",
        "filename": "openai-whisper-tiny-en__gemini-flash__zh.srt",
        "createdAt": lr._now_iso(),
        "durationMs": 1000,
        "segmentCount": 5,
    }
    lr.append_translation(folder, entry)
    sidecar = lr.append_translation(folder, dict(entry, durationMs=2222))
    assert len(sidecar["translations"]) == 1
    assert sidecar["translations"][0]["durationMs"] == 2222


def test_remove_transcribe_cascades_to_translations(tmp_path):
    folder = _make_new_folder(tmp_path)
    # Create files on disk
    t_path = folder / "transcripts" / "openai-whisper-tiny-en.srt"
    t_path.write_text("dummy", encoding="utf-8")
    tr_path = folder / "translations" / "openai-whisper-tiny-en__gemini-flash__zh.srt"
    tr_path.write_text("dummy", encoding="utf-8")
    other_t = folder / "transcripts" / "yt_captions-en.srt"
    other_t.write_text("other", encoding="utf-8")

    # Set up sidecar
    lr.append_transcribe(folder, {
        "id": "openai-whisper-tiny-en",
        "engine": "openai-whisper", "model": "tiny", "device": "cpu",
        "vadEnabled": False, "language": "en",
        "filename": "openai-whisper-tiny-en.srt",
        "createdAt": lr._now_iso(), "durationMs": 100, "segmentCount": 5,
    })
    lr.append_transcribe(folder, {
        "id": "yt_captions-en",
        "engine": "yt_captions", "model": None, "device": None,
        "vadEnabled": None, "language": "en",
        "filename": "yt_captions-en.srt",
        "createdAt": lr._now_iso(), "durationMs": 50, "segmentCount": 5,
    })
    lr.append_translation(folder, {
        "id": "openai-whisper-tiny-en__gemini-flash__zh",
        "sourceTranscribeId": "openai-whisper-tiny-en",
        "translator": "gemini", "translatorModel": "flash", "targetLang": "zh",
        "filename": "openai-whisper-tiny-en__gemini-flash__zh.srt",
        "createdAt": lr._now_iso(), "durationMs": 100, "segmentCount": 5,
    })

    deleted = lr.remove_entry(folder, "transcribe", "openai-whisper-tiny-en")
    deleted_names = {p.name for p in deleted}
    assert "openai-whisper-tiny-en.srt" in deleted_names
    assert "openai-whisper-tiny-en__gemini-flash__zh.srt" in deleted_names

    # Untouched entry survives
    assert other_t.is_file()
    sidecar = lr.read_sidecar(folder)
    assert len(sidecar["transcribes"]) == 1
    assert sidecar["transcribes"][0]["id"] == "yt_captions-en"
    assert len(sidecar["translations"]) == 0


def test_remove_translation_only(tmp_path):
    folder = _make_new_folder(tmp_path)
    tr_path = folder / "translations" / "openai-whisper-tiny-en__gemini-flash__zh.srt"
    tr_path.write_text("dummy", encoding="utf-8")
    lr.append_translation(folder, {
        "id": "openai-whisper-tiny-en__gemini-flash__zh",
        "sourceTranscribeId": "openai-whisper-tiny-en",
        "translator": "gemini", "translatorModel": "flash", "targetLang": "zh",
        "filename": "openai-whisper-tiny-en__gemini-flash__zh.srt",
        "createdAt": lr._now_iso(), "durationMs": 100, "segmentCount": 5,
    })
    deleted = lr.remove_entry(
        folder, "translate", "openai-whisper-tiny-en__gemini-flash__zh"
    )
    assert len(deleted) == 1
    assert not tr_path.exists()
    sidecar = lr.read_sidecar(folder)
    assert sidecar["translations"] == []


def test_remove_entry_invalid_kind(tmp_path):
    folder = _make_new_folder(tmp_path)
    with pytest.raises(ValueError):
        lr.remove_entry(folder, "bogus", "x")


# ---------------------------------------------------------------------------
# concurrency
# ---------------------------------------------------------------------------

def test_concurrent_appends_dont_lose_entries(tmp_path):
    """Two threads each appending a different transcribe id → both visible."""
    folder = _make_new_folder(tmp_path)

    def worker(idx: int):
        lr.append_transcribe(folder, {
            "id": f"engine-{idx}",
            "engine": f"engine-{idx}", "model": None, "device": None,
            "vadEnabled": None, "language": "en",
            "filename": f"engine-{idx}.srt",
            "createdAt": lr._now_iso(), "durationMs": 0, "segmentCount": 0,
        })

    threads = [threading.Thread(target=worker, args=(i,)) for i in range(8)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    sidecar = lr.read_sidecar(folder)
    ids = sorted(t["id"] for t in sidecar["transcribes"])
    assert ids == [f"engine-{i}" for i in range(8)]


# ---------------------------------------------------------------------------
# update_metadata
# ---------------------------------------------------------------------------

def test_update_metadata_partial(tmp_path):
    folder = _make_new_folder(tmp_path)
    sidecar = lr.update_metadata(folder, channel="Family Guy", duration_seconds=360)
    assert sidecar["channel"] == "Family Guy"
    assert sidecar["durationSeconds"] == 360
    # Unspecified fields untouched
    sidecar2 = lr.update_metadata(folder, duration_seconds=600)
    assert sidecar2["channel"] == "Family Guy"
    assert sidecar2["durationSeconds"] == 600
