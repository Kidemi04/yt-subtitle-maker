"""Tests for GET /api/library/{videoId} + POST /api/library/{videoId}/delete-srt."""
from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from api.main import app
from core import library_runs

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

    monkeypatch.setattr("api.routes.library.load_config", fake_load)
    return out


def _make_legacy_folder(out: Path, video_id: str = "abcDEFghIJK") -> Path:
    """Pre-Plan-C folder layout (flat SRTs, no sidecar)."""
    folder = out / f"My_Video_{video_id}"
    folder.mkdir()
    (folder / f"{video_id}_original.srt").write_text(
        "1\n00:00:01,000 --> 00:00:02,000\nHello\n", encoding="utf-8"
    )
    (folder / f"{video_id}_zh.srt").write_text(
        "1\n00:00:01,000 --> 00:00:02,000\n你好\n", encoding="utf-8"
    )
    (folder / f"{video_id}.wav").write_bytes(b"\x00" * 16)
    return folder


def _make_new_folder(out: Path, video_id: str = "abcDEFghIJK") -> Path:
    """New Plan-C subdir layout with two transcripts + one translation."""
    folder = out / f"My_Video_{video_id}"
    folder.mkdir()
    (folder / "transcripts").mkdir()
    (folder / "translations").mkdir()
    (folder / f"{video_id}.wav").write_bytes(b"\x00" * 16)

    (folder / "transcripts" / "openai-whisper-tiny-en.srt").write_text(
        "1\n00:00:01,000 --> 00:00:02,000\nHello\n", encoding="utf-8"
    )
    (folder / "transcripts" / "yt_captions-en.srt").write_text(
        "1\n00:00:01,000 --> 00:00:02,000\nHi\n", encoding="utf-8"
    )
    (folder / "translations" / "openai-whisper-tiny-en__gemini-flash__zh.srt").write_text(
        "1\n00:00:01,000 --> 00:00:02,000\n你好\n", encoding="utf-8"
    )

    library_runs.append_transcribe(folder, {
        "id": "openai-whisper-tiny-en",
        "engine": "openai-whisper", "model": "tiny", "device": "cpu",
        "vadEnabled": True, "language": "en",
        "filename": "openai-whisper-tiny-en.srt",
        "createdAt": "2026-05-01T00:00:00+00:00",
        "durationMs": 1000, "segmentCount": 1,
    })
    library_runs.append_transcribe(folder, {
        "id": "yt_captions-en",
        "engine": "yt_captions", "model": None, "device": None,
        "vadEnabled": None, "language": "en",
        "filename": "yt_captions-en.srt",
        "createdAt": "2026-05-01T00:01:00+00:00",
        "durationMs": 50, "segmentCount": 1,
    })
    library_runs.append_translation(folder, {
        "id": "openai-whisper-tiny-en__gemini-flash__zh",
        "sourceTranscribeId": "openai-whisper-tiny-en",
        "translator": "gemini", "translatorModel": "flash", "targetLang": "zh",
        "filename": "openai-whisper-tiny-en__gemini-flash__zh.srt",
        "createdAt": "2026-05-01T00:02:00+00:00",
        "durationMs": 100, "segmentCount": 1,
    })
    library_runs.update_metadata(
        folder,
        title_original="My Video",
        channel="Some Channel",
        duration_seconds=42,
    )
    return folder


# ---------------------------------------------------------------------------
# detail endpoint — new layout
# ---------------------------------------------------------------------------

def test_detail_returns_full_videodetail_for_new_layout(fake_output_dir):
    _make_new_folder(fake_output_dir)
    resp = client.get("/api/library/abcDEFghIJK")
    assert resp.status_code == 200
    body = resp.json()

    assert body["videoId"] == "abcDEFghIJK"
    assert body["titleOriginal"] == "My Video"
    assert body["channel"] == "Some Channel"
    assert body["durationSeconds"] == 42
    assert body["audio"] == "/api/library/abcDEFghIJK/file/abcDEFghIJK.wav"
    assert body["hasVideo"] is False

    # Two transcribes
    ids = [t["id"] for t in body["transcribes"]]
    assert sorted(ids) == ["openai-whisper-tiny-en", "yt_captions-en"]
    # URL points into transcripts/
    whisper = next(t for t in body["transcribes"] if t["id"] == "openai-whisper-tiny-en")
    assert whisper["url"] == (
        "/api/library/abcDEFghIJK/file/transcripts/openai-whisper-tiny-en.srt"
    )

    # One translation, URL points into translations/
    assert len(body["translations"]) == 1
    tr = body["translations"][0]
    assert tr["sourceTranscribeId"] == "openai-whisper-tiny-en"
    assert tr["url"] == (
        "/api/library/abcDEFghIJK/file/translations/"
        "openai-whisper-tiny-en__gemini-flash__zh.srt"
    )

    # Spec §14 #3: no absolute paths leaked.
    serialized = json.dumps(body)
    assert str(fake_output_dir) not in serialized


def test_detail_synthesizes_legacy_layout_without_migration(fake_output_dir):
    folder = _make_legacy_folder(fake_output_dir)
    resp = client.get("/api/library/abcDEFghIJK")
    assert resp.status_code == 200
    body = resp.json()

    # Legacy entries synthesized
    assert len(body["transcribes"]) == 1
    assert body["transcribes"][0]["id"] == "legacy"
    # URL points to the file at the folder root (pre-migration)
    assert body["transcribes"][0]["url"] == (
        "/api/library/abcDEFghIJK/file/abcDEFghIJK_original.srt"
    )

    assert len(body["translations"]) == 1
    assert body["translations"][0]["id"] == "legacy-zh"
    assert body["translations"][0]["url"] == (
        "/api/library/abcDEFghIJK/file/abcDEFghIJK_zh.srt"
    )

    # Read-only synthesis: legacy files NOT yet moved to subdirs
    assert (folder / "abcDEFghIJK_original.srt").is_file()
    assert not (folder / "transcripts").exists()


def test_detail_returns_404_for_unknown_video(fake_output_dir):
    resp = client.get("/api/library/unknownXXXXX")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# delete-srt endpoint
# ---------------------------------------------------------------------------

def test_delete_translation_removes_file_and_sidecar_entry(fake_output_dir):
    folder = _make_new_folder(fake_output_dir)

    resp = client.post(
        "/api/library/abcDEFghIJK/delete-srt",
        json={"id": "openai-whisper-tiny-en__gemini-flash__zh", "kind": "translate"},
    )
    assert resp.status_code == 200
    assert resp.json()["ok"] is True
    assert resp.json()["deleted"] == [
        "openai-whisper-tiny-en__gemini-flash__zh.srt"
    ]

    # File gone, sidecar updated
    assert not (
        folder / "translations" / "openai-whisper-tiny-en__gemini-flash__zh.srt"
    ).exists()
    sidecar = library_runs.read_sidecar(folder)
    assert sidecar["translations"] == []
    # Transcripts untouched
    assert len(sidecar["transcribes"]) == 2


def test_delete_transcript_cascades_to_child_translations(fake_output_dir):
    folder = _make_new_folder(fake_output_dir)

    resp = client.post(
        "/api/library/abcDEFghIJK/delete-srt",
        json={"id": "openai-whisper-tiny-en", "kind": "transcribe"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    deleted = set(body["deleted"])
    assert "openai-whisper-tiny-en.srt" in deleted
    assert "openai-whisper-tiny-en__gemini-flash__zh.srt" in deleted

    # The OTHER transcript survives
    sidecar = library_runs.read_sidecar(folder)
    assert [t["id"] for t in sidecar["transcribes"]] == ["yt_captions-en"]
    assert sidecar["translations"] == []


def test_delete_unknown_video_returns_404(fake_output_dir):
    resp = client.post(
        "/api/library/unknownXXXXX/delete-srt",
        json={"id": "x", "kind": "transcribe"},
    )
    assert resp.status_code == 404


def test_delete_invalid_kind_returns_422(fake_output_dir):
    _make_new_folder(fake_output_dir)
    resp = client.post(
        "/api/library/abcDEFghIJK/delete-srt",
        json={"id": "x", "kind": "bogus"},
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# file route accepts subpaths
# ---------------------------------------------------------------------------

def test_file_route_serves_subdir_paths(fake_output_dir):
    _make_new_folder(fake_output_dir)
    resp = client.get(
        "/api/library/abcDEFghIJK/file/transcripts/openai-whisper-tiny-en.srt"
    )
    assert resp.status_code == 200
    assert "Hello" in resp.text


def test_file_route_rejects_traversal_via_subpath(fake_output_dir):
    _make_new_folder(fake_output_dir)
    # `..` inside the subpath is rejected by sandbox
    resp = client.get(
        "/api/library/abcDEFghIJK/file/transcripts/..%2F..%2Fboot.ini"
    )
    assert resp.status_code in {400, 404}
