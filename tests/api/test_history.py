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


def test_history_get_empty(fake_output_dir):
    resp = client.get("/api/history")
    assert resp.status_code == 200
    assert resp.json() == {"items": []}


def test_history_get_uses_sidecar_when_present(fake_output_dir):
    sidecar = {
        "videoId": "abcDEFghIJK",
        "url": "https://www.youtube.com/watch?v=abcDEFghIJK",
        "titleOriginal": "My Video",
        "titleTranslated": "Mi Video",
        "targetLang": "es",
        "sttEngineUsed": "openai-whisper",
        "createdAt": "2026-01-15T12:00:00+00:00",
        "processingDurationMs": 12345,
        "thumbnailUrl": "https://img.youtube.com/vi/abcDEFghIJK/hqdefault.jpg",
    }
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
    assert item["sttEngineUsed"] == "openai-whisper"
    assert item["createdAt"] == "2026-01-15T12:00:00+00:00"
    assert item["processingDurationMs"] == 12345
    assert item["thumbnailUrl"] == "https://img.youtube.com/vi/abcDEFghIJK/hqdefault.jpg"
    # Path fields are intentionally null in V1; library page handles file URLs.
    assert item["subtitlePath"] is None
    assert item["audioPath"] is None
    assert item["videoPath"] is None


def test_history_get_synthesizes_when_no_sidecar(fake_output_dir):
    _make_video_dir(fake_output_dir, "abcDEFghIJK", title="My_Video")

    resp = client.get("/api/history")
    items = resp.json()["items"]
    assert len(items) == 1

    item = items[0]
    assert item["videoId"] == "abcDEFghIJK"
    assert item["titleOriginal"] == "My_Video"
    assert item["titleTranslated"] is None
    assert item["sttEngineUsed"] == "unknown"
    assert item["processingDurationMs"] == 0
    assert item["thumbnailUrl"] == "https://img.youtube.com/vi/abcDEFghIJK/hqdefault.jpg"
    assert "createdAt" in item


def test_history_sorted_newest_first(fake_output_dir):
    _make_video_dir(
        fake_output_dir, "aaaaaaaaaaa", title="Old", sidecar={
            "videoId": "aaaaaaaaaaa", "url": "u", "titleOriginal": "Old",
            "titleTranslated": None, "targetLang": None, "sttEngineUsed": "x",
            "createdAt": "2020-01-01T00:00:00+00:00", "processingDurationMs": 1,
            "thumbnailUrl": "t",
        },
    )
    _make_video_dir(
        fake_output_dir, "bbbbbbbbbbb", title="New", sidecar={
            "videoId": "bbbbbbbbbbb", "url": "u", "titleOriginal": "New",
            "titleTranslated": None, "targetLang": None, "sttEngineUsed": "x",
            "createdAt": "2026-01-01T00:00:00+00:00", "processingDurationMs": 1,
            "thumbnailUrl": "t",
        },
    )
    items = client.get("/api/history").json()["items"]
    assert [i["videoId"] for i in items] == ["bbbbbbbbbbb", "aaaaaaaaaaa"]


def test_history_skips_non_videoid_dirs(fake_output_dir):
    # Random dirs without 11-char video_id suffix should be ignored.
    (fake_output_dir / "random_folder").mkdir()
    (fake_output_dir / "loose_file.txt").write_text("x", encoding="utf-8")
    resp = client.get("/api/history")
    assert resp.json() == {"items": []}
