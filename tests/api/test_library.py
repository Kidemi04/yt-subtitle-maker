import json
import os
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


@pytest.fixture
def fake_output_dir(tmp_path, monkeypatch):
    """Set up a fake output dir + AppConfig pointing at it."""
    out = tmp_path / "output"
    out.mkdir()
    # Patch load_config to return AppConfig with output_dir = our tmp
    from core.config import AppConfig

    def fake_load():
        cfg = AppConfig()
        cfg.output_dir = str(out)
        return cfg

    monkeypatch.setattr("api.routes.library.load_config", fake_load)
    return out


def _make_video_dir(out: Path, video_id: str, title: str = "Test Video", with_translated: bool = False):
    folder = out / f"{title}_{video_id}"
    folder.mkdir()
    (folder / f"{video_id}_original.srt").write_text("1\n00:00:01,000 --> 00:00:02,000\nHello\n", encoding="utf-8")
    if with_translated:
        (folder / f"{video_id}_zh-CN.srt").write_text("1\n00:00:01,000 --> 00:00:02,000\n你好\n", encoding="utf-8")
    (folder / f"{video_id}.wav").write_bytes(b"\x00" * 100)  # dummy audio
    return folder


def test_library_get_empty_when_no_videos(fake_output_dir):
    resp = client.get("/api/library")
    assert resp.status_code == 200
    assert resp.json() == {"items": []}


def test_library_get_lists_one_video_with_url_endpoints(fake_output_dir):
    _make_video_dir(fake_output_dir, "abcDEFghIJK", title="My Video", with_translated=True)
    resp = client.get("/api/library")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["items"]) == 1

    item = body["items"][0]
    assert item["videoId"] == "abcDEFghIJK"
    assert item["url"] == "https://www.youtube.com/watch?v=abcDEFghIJK"
    assert item["thumbnailUrl"] == "https://img.youtube.com/vi/abcDEFghIJK/hqdefault.jpg"

    # CRITICAL: spec §14 #3 — no absolute paths
    serialized = json.dumps(item)
    assert "C:\\\\" not in serialized and "C:/" not in serialized
    assert str(fake_output_dir) not in serialized

    # Files exposed as download URLs (relative paths under /api/library/...)
    assert item["files"]["originalSrt"] == "/api/library/abcDEFghIJK/file/abcDEFghIJK_original.srt"
    assert item["files"]["translatedSrt"] == "/api/library/abcDEFghIJK/file/abcDEFghIJK_zh-CN.srt"
    assert item["files"]["audio"] == "/api/library/abcDEFghIJK/file/abcDEFghIJK.wav"


def test_library_download_serves_file(fake_output_dir):
    _make_video_dir(fake_output_dir, "abcDEFghIJK", title="My Video")
    resp = client.get("/api/library/abcDEFghIJK/file/abcDEFghIJK_original.srt")
    assert resp.status_code == 200
    assert "00:00:01" in resp.text


def test_library_download_rejects_path_traversal(fake_output_dir):
    _make_video_dir(fake_output_dir, "abcDEFghIJK", title="My Video")
    # Try to escape with ../ in filename
    resp = client.get("/api/library/abcDEFghIJK/file/..%2F..%2Fwindows%2Fsystem32%2Fnotepad.exe")
    assert resp.status_code in {400, 404}


def test_library_delete_removes_folder(fake_output_dir):
    folder = _make_video_dir(fake_output_dir, "abcDEFghIJK", title="My Video")
    assert folder.exists()

    resp = client.post("/api/library/delete", json={"videoId": "abcDEFghIJK"})
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}
    assert not folder.exists()


def test_library_delete_unknown_video_returns_404(fake_output_dir):
    resp = client.post("/api/library/delete", json={"videoId": "nonexistentX"})
    assert resp.status_code == 404


@patch("api.routes.library.subprocess.Popen")
def test_library_open_folder_invokes_os_opener(mock_popen, fake_output_dir):
    _make_video_dir(fake_output_dir, "abcDEFghIJK", title="My Video")
    resp = client.post("/api/library/open-folder", json={"videoId": "abcDEFghIJK"})
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}
    mock_popen.assert_called_once()
    # The first arg to Popen should reference the video's folder
    args, kwargs = mock_popen.call_args
    invocation = " ".join(args[0]) if isinstance(args[0], list) else str(args[0])
    assert "abcDEFghIJK" in invocation


def test_library_open_folder_unknown_returns_404(fake_output_dir):
    resp = client.post("/api/library/open-folder", json={"videoId": "nonexistentX"})
    assert resp.status_code == 404
