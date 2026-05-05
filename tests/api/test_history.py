"""Tests for GET /api/history."""
from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


@pytest.fixture
def fake_output_dir(tmp_path, monkeypatch):
    out = tmp_path / "output"
    out.mkdir()
    from core.config import AppConfig

    def fake_load():
        cfg = AppConfig()
        cfg.output_dir = str(out)
        return cfg

    monkeypatch.setattr("api.routes.history.load_config", fake_load)
    return out


def _make_video_dir(out: Path, video_id: str, title: str = "Test Video", sidecar: dict | None = None) -> Path:
    folder = out / f"{title}_{video_id}"
    folder.mkdir()
    (folder / f"{video_id}_original.srt").write_text("1\n00:00:01,000 --> 00:00:02,000\nHello\n", encoding="utf-8")
    if sidecar is not None:
        (folder / "_history.json").write_text(json.dumps(sidecar), encoding="utf-8")
    return folder


def _new_sidecar(
    *,
    video_id: str,
    title_original: str,
    title_translated: str | None = None,
    transcribes: list[dict] | None = None,
    translations: list[dict] | None = None,
    created_at: str = "2026-05-01T00:00:00+00:00",
) -> dict:
    return {
        "videoId": video_id,
        "url": f"https://www.youtube.com/watch?v={video_id}",
        "titleOriginal": title_original,
        "titleTranslated": title_translated,
        "thumbnailUrl": f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg",
        "channel": None,
        "durationSeconds": None,
        "createdAt": created_at,
        "updatedAt": created_at,
        "transcribes": transcribes or [],
        "translations": translations or [],
    }


def test_history_get_empty(fake_output_dir):
    resp = client.get("/api/history")
    assert resp.status_code == 200
    assert resp.json() == {"items": []}


def test_history_get_uses_sidecar_when_present(fake_output_dir):
    sidecar = _new_sidecar(
        video_id="abcDEFghIJK",
        title_original="My Video",
        title_translated="Mi Video",
        created_at="2026-01-15T12:00:00+00:00",
        transcribes=[{
            "id": "openai-whisper-tiny-en", "engine": "openai-whisper",
            "model": "tiny", "device": "cpu", "vadEnabled": True,
            "language": "en", "filename": "openai-whisper-tiny-en.srt",
            "createdAt": "2026-01-15T12:00:00+00:00",
            "durationMs": 10000, "segmentCount": 1,
        }],
        translations=[{
            "id": "openai-whisper-tiny-en__gemini-flash__es",
            "sourceTranscribeId": "openai-whisper-tiny-en",
            "translator": "gemini", "translatorModel": "flash",
            "targetLang": "es", "filename": "x.srt",
            "createdAt": "2026-01-15T12:00:30+00:00",
            "durationMs": 2345, "segmentCount": 1,
        }],
    )
    _make_video_dir(fake_output_dir, "abcDEFghIJK", title="My Video", sidecar=sidecar)

    resp = client.get("/api/history")
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert len(items) == 1

    item = items[0]
    assert item["videoId"] == "abcDEFghIJK"
    assert item["titleOriginal"] == "My Video"
    assert item["titleTranslated"] == "Mi Video"
    assert item["targetLang"] == "es"
    # sttEngineUsed = latest transcribe's engine
    assert item["sttEngineUsed"] == "openai-whisper"
    assert item["createdAt"] == "2026-01-15T12:00:00+00:00"
    # processingDurationMs = SUM of all run durations (transcribes + translations)
    assert item["processingDurationMs"] == 10000 + 2345
    assert item["thumbnailUrl"] == "https://img.youtube.com/vi/abcDEFghIJK/hqdefault.jpg"
    assert item["transcribesCount"] == 1
    assert item["translationsCount"] == 1
    # Path fields are intentionally null in V1; library page handles file URLs.
    assert item["subtitlePath"] is None
    assert item["audioPath"] is None
    assert item["videoPath"] is None


def test_history_aggregates_multiple_runs(fake_output_dir):
    """3 transcripts + 2 translations → counts surfaced, latest engine reported."""
    sidecar = _new_sidecar(
        video_id="abcDEFghIJK", title_original="My Video",
        transcribes=[
            {"id": "yt_captions-en", "engine": "yt_captions", "model": None,
             "device": None, "vadEnabled": None, "language": "en",
             "filename": "yt_captions-en.srt", "createdAt": "2026-05-01T00:00:00+00:00",
             "durationMs": 100, "segmentCount": 1},
            {"id": "openai-whisper-tiny-en", "engine": "openai-whisper",
             "model": "tiny", "device": "cpu", "vadEnabled": True, "language": "en",
             "filename": "openai-whisper-tiny-en.srt",
             "createdAt": "2026-05-01T00:01:00+00:00",
             "durationMs": 1000, "segmentCount": 1},
            {"id": "openai-whisper-turbo-en", "engine": "openai-whisper",
             "model": "turbo", "device": "auto", "vadEnabled": True, "language": "en",
             "filename": "openai-whisper-turbo-en.srt",
             "createdAt": "2026-05-01T00:02:00+00:00",
             "durationMs": 2000, "segmentCount": 1},
        ],
        translations=[
            {"id": "x", "sourceTranscribeId": "openai-whisper-tiny-en",
             "translator": "gemini", "translatorModel": "flash",
             "targetLang": "zh", "filename": "x.srt",
             "createdAt": "2026-05-01T00:03:00+00:00",
             "durationMs": 100, "segmentCount": 1},
            {"id": "y", "sourceTranscribeId": "openai-whisper-turbo-en",
             "translator": "openai", "translatorModel": "gpt-4o",
             "targetLang": "ja", "filename": "y.srt",
             "createdAt": "2026-05-01T00:04:00+00:00",
             "durationMs": 200, "segmentCount": 1},
        ],
    )
    _make_video_dir(fake_output_dir, "abcDEFghIJK", title="My Video", sidecar=sidecar)

    item = client.get("/api/history").json()["items"][0]
    assert item["transcribesCount"] == 3
    assert item["translationsCount"] == 2
    # Latest transcribe is openai-whisper (turbo)
    assert item["sttEngineUsed"] == "openai-whisper"
    # Latest translation's targetLang
    assert item["targetLang"] == "ja"
    assert item["processingDurationMs"] == 100 + 1000 + 2000 + 100 + 200


def test_history_get_synthesizes_when_no_sidecar(fake_output_dir):
    _make_video_dir(fake_output_dir, "abcDEFghIJK", title="My_Video")

    resp = client.get("/api/history")
    items = resp.json()["items"]
    assert len(items) == 1

    item = items[0]
    assert item["videoId"] == "abcDEFghIJK"
    assert item["titleOriginal"] == "My_Video"
    assert item["titleTranslated"] is None
    # Legacy folder synthesis returns 1 transcribe with engine "unknown"
    # (no sidecar to remember the original engine), so count is 1 here.
    assert item["transcribesCount"] == 1
    assert item["sttEngineUsed"] == "unknown"
    assert item["thumbnailUrl"] == "https://img.youtube.com/vi/abcDEFghIJK/hqdefault.jpg"
    assert "createdAt" in item


def test_history_sorted_newest_first(fake_output_dir):
    _make_video_dir(
        fake_output_dir, "aaaaaaaaaaa", title="Old",
        sidecar=_new_sidecar(
            video_id="aaaaaaaaaaa", title_original="Old",
            created_at="2020-01-01T00:00:00+00:00",
        ),
    )
    _make_video_dir(
        fake_output_dir, "bbbbbbbbbbb", title="New",
        sidecar=_new_sidecar(
            video_id="bbbbbbbbbbb", title_original="New",
            created_at="2026-01-01T00:00:00+00:00",
        ),
    )
    items = client.get("/api/history").json()["items"]
    assert [i["videoId"] for i in items] == ["bbbbbbbbbbb", "aaaaaaaaaaa"]


def test_history_skips_non_videoid_dirs(fake_output_dir):
    # Random dirs without 11-char video_id suffix should be ignored.
    (fake_output_dir / "random_folder").mkdir()
    (fake_output_dir / "loose_file.txt").write_text("x", encoding="utf-8")
    resp = client.get("/api/history")
    assert resp.json() == {"items": []}
