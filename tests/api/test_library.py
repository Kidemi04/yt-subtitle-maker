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
    """Build a legacy-layout folder. The library endpoint now reads via
    library_runs.read_sidecar which synthesizes legacy → new shape, so the
    list response will report 1 transcribe + (0 or 1) translations."""
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


def test_library_get_lists_one_video_with_summary_counts(fake_output_dir):
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

    # New summary shape: counts replace the 4-slot files object
    assert "files" not in item
    assert item["transcribesCount"] == 1
    assert item["translationsCount"] == 1
    assert item["audio"] == "/api/library/abcDEFghIJK/file/abcDEFghIJK.wav"
    assert item["hasVideo"] is False


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


@patch("api.routes.library.subprocess.Popen")
@patch("api.routes.library.shutil.which")
def test_library_play_mpv_streams_youtube_with_translated_srt(
    mock_which, mock_popen, fake_output_dir
):
    """Default: mpv streams the YouTube URL with the translated SRT overlaid."""
    mock_which.return_value = "/fake/mpv"
    _make_video_dir(fake_output_dir, "abcDEFghIJK", title="My Video", with_translated=True)

    resp = client.post("/api/library/play-mpv", json={"videoId": "abcDEFghIJK"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["subtitle"] == "abcDEFghIJK_zh-CN.srt"
    # Default playback uses the YouTube URL so the user gets actual video,
    # not just the .wav audio that was downloaded for transcription.
    assert body["media"] == "youtube:abcDEFghIJK"

    mock_popen.assert_called_once()
    cmd = mock_popen.call_args.args[0]
    assert cmd[0] == "/fake/mpv"
    assert "https://www.youtube.com/watch?v=abcDEFghIJK" in cmd
    assert "--force-window=immediate" in cmd
    # mpv on Windows requires the `--option=value` form for these flags;
    # the previous two-arg form caused mpv to exit rc=1 immediately.
    assert "--sub-files-append=abcDEFghIJK_zh-CN.srt" in cmd
    assert any(arg.startswith("--sub-file-paths=") for arg in cmd)
    assert "--sub-auto=exact" in cmd
    # Stream path needs mpv pointed at our yt-dlp + must enable EJS
    # remote components so n-challenge solving works.
    assert any(
        arg.startswith("--ytdl-raw-options-append=remote-components=") for arg in cmd
    )


@patch("api.routes.library.subprocess.Popen")
@patch("api.routes.library.shutil.which")
def test_library_play_mpv_uses_local_video_when_present(
    mock_which, mock_popen, fake_output_dir
):
    """If a local video file exists, prefer it over streaming (offline-OK)."""
    mock_which.return_value = "/fake/mpv"
    folder = _make_video_dir(fake_output_dir, "abcDEFghIJK", title="My Video", with_translated=True)
    # Drop a local mp4 alongside the .wav.
    (folder / "abcDEFghIJK.mp4").write_bytes(b"\x00" * 200)

    resp = client.post("/api/library/play-mpv", json={"videoId": "abcDEFghIJK"})
    body = resp.json()
    assert body["ok"] is True
    assert body["media"] == "abcDEFghIJK.mp4"


@patch("api.routes.library.subprocess.Popen")
@patch("api.routes.library.shutil.which")
def test_library_play_mpv_falls_back_to_original_srt(
    mock_which, mock_popen, fake_output_dir
):
    """When only the original SRT exists, that's what mpv should get."""
    mock_which.return_value = "/fake/mpv"
    _make_video_dir(fake_output_dir, "abcDEFghIJK", title="My Video", with_translated=False)

    resp = client.post("/api/library/play-mpv", json={"videoId": "abcDEFghIJK"})
    body = resp.json()
    assert body["ok"] is True
    assert body["subtitle"] == "abcDEFghIJK_original.srt"
    cmd = mock_popen.call_args.args[0]
    assert "--sub-files-append=abcDEFghIJK_original.srt" in cmd


@patch("api.routes.library.subprocess.Popen")
@patch("api.routes.library.shutil.which")
def test_library_play_mpv_subtitle_preference_original(
    mock_which, mock_popen, fake_output_dir
):
    """preference="original" forces original SRT even when translation exists."""
    mock_which.return_value = "/fake/mpv"
    _make_video_dir(fake_output_dir, "abcDEFghIJK", title="My Video", with_translated=True)

    resp = client.post(
        "/api/library/play-mpv",
        json={"videoId": "abcDEFghIJK", "subtitlePreference": "original"},
    )
    body = resp.json()
    assert body["ok"] is True
    assert body["subtitle"] == "abcDEFghIJK_original.srt"


@patch("api.routes.library.subprocess.Popen")
@patch("api.routes.library.shutil.which")
def test_library_play_mpv_subtitle_preference_none(
    mock_which, mock_popen, fake_output_dir
):
    """preference="none" launches without any subtitle overlay."""
    mock_which.return_value = "/fake/mpv"
    _make_video_dir(fake_output_dir, "abcDEFghIJK", title="My Video", with_translated=True)

    resp = client.post(
        "/api/library/play-mpv",
        json={"videoId": "abcDEFghIJK", "subtitlePreference": "none"},
    )
    body = resp.json()
    assert body["ok"] is True
    assert body["subtitle"] is None
    cmd = mock_popen.call_args.args[0]
    assert not any(arg.startswith("--sub-files-append") for arg in cmd)


@patch("api.routes.library.subprocess.Popen")
@patch("api.routes.library.shutil.which")
def test_library_play_mpv_no_subtitle_still_launches(
    mock_which, mock_popen, fake_output_dir
):
    """Folder with no SRT yet (e.g. user opened mid-pipeline) still streams."""
    mock_which.return_value = "/fake/mpv"
    folder = fake_output_dir / "Empty_abcDEFghIJK"
    folder.mkdir()

    resp = client.post("/api/library/play-mpv", json={"videoId": "abcDEFghIJK"})
    body = resp.json()
    assert body["ok"] is True
    assert body["subtitle"] is None
    assert body["media"] == "youtube:abcDEFghIJK"
    cmd = mock_popen.call_args.args[0]
    assert not any(arg.startswith("--sub-files-append") for arg in cmd)


@patch("api.routes.library.shutil.which")
def test_library_play_mpv_missing_executable_returns_soft_error(
    mock_which, fake_output_dir
):
    """If mpv isn't in PATH and no config override, return ok:false with a hint."""
    mock_which.return_value = None
    _make_video_dir(fake_output_dir, "abcDEFghIJK", title="My Video")

    resp = client.post("/api/library/play-mpv", json={"videoId": "abcDEFghIJK"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert "mpv" in body["error"].lower()


def test_library_play_mpv_unknown_video_returns_404(fake_output_dir):
    resp = client.post("/api/library/play-mpv", json={"videoId": "nonexistentX"})
    assert resp.status_code == 404
