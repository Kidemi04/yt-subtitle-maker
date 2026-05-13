"""play-mpv accepts transcribeId / translateId for exact run selection."""
from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

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


def _make_multi_run_folder(out: Path, video_id: str = "abcDEFghIJK") -> Path:
    folder = out / f"My_Video_{video_id}"
    folder.mkdir()
    (folder / "transcripts").mkdir()
    (folder / "translations").mkdir()
    (folder / f"{video_id}.wav").write_bytes(b"\x00")

    (folder / "transcripts" / "openai-whisper-tiny-en.srt").write_text("a", encoding="utf-8")
    (folder / "transcripts" / "yt_captions-en.srt").write_text("b", encoding="utf-8")
    (folder / "translations" / "openai-whisper-tiny-en__gemini-flash__zh.srt").write_text("c", encoding="utf-8")
    (folder / "translations" / "openai-whisper-tiny-en__gemini-flash__ja.srt").write_text("d", encoding="utf-8")

    library_runs.append_transcribe(folder, {
        "id": "openai-whisper-tiny-en", "engine": "openai-whisper",
        "model": "tiny", "device": "cpu", "vadEnabled": False, "language": "en",
        "filename": "openai-whisper-tiny-en.srt",
        "createdAt": "2026-05-01T00:00:00+00:00",
        "durationMs": 1, "segmentCount": 1,
    })
    library_runs.append_transcribe(folder, {
        "id": "yt_captions-en", "engine": "yt_captions",
        "model": None, "device": None, "vadEnabled": None, "language": "en",
        "filename": "yt_captions-en.srt",
        "createdAt": "2026-05-01T00:01:00+00:00",
        "durationMs": 1, "segmentCount": 1,
    })
    library_runs.append_translation(folder, {
        "id": "openai-whisper-tiny-en__gemini-flash__zh",
        "sourceTranscribeId": "openai-whisper-tiny-en",
        "translator": "gemini", "translatorModel": "flash",
        "targetLang": "zh",
        "filename": "openai-whisper-tiny-en__gemini-flash__zh.srt",
        "createdAt": "2026-05-01T00:02:00+00:00",
        "durationMs": 1, "segmentCount": 1,
    })
    library_runs.append_translation(folder, {
        "id": "openai-whisper-tiny-en__gemini-flash__ja",
        "sourceTranscribeId": "openai-whisper-tiny-en",
        "translator": "gemini", "translatorModel": "flash",
        "targetLang": "ja",
        "filename": "openai-whisper-tiny-en__gemini-flash__ja.srt",
        "createdAt": "2026-05-01T00:03:00+00:00",
        "durationMs": 1, "segmentCount": 1,
    })
    return folder


@patch("api.routes.library.subprocess.Popen")
@patch("api.routes.library.shutil.which")
def test_play_mpv_with_transcribeId_picks_exact_srt(
    mock_which, mock_popen, fake_output_dir
):
    mock_which.return_value = "/fake/mpv"
    _make_multi_run_folder(fake_output_dir)

    resp = client.post(
        "/api/library/play-mpv",
        json={"videoId": "abcDEFghIJK", "transcribeId": "yt_captions-en"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["subtitle"] == "yt_captions-en.srt"

    cmd = mock_popen.call_args.args[0]
    # Run-id path → exactly ONE sub loaded (the run the caller named).
    sub_args = [a for a in cmd if a.startswith("--sub-file=")]
    assert len(sub_args) == 1, sub_args
    # Full path ending in transcripts/yt_captions-en.srt (works on both
    # POSIX `/` and Windows `\` — use os.sep-agnostic substring matches).
    assert sub_args[0].endswith("yt_captions-en.srt")
    assert "transcripts" in sub_args[0]


@patch("api.routes.library.subprocess.Popen")
@patch("api.routes.library.shutil.which")
def test_play_mpv_with_translateId_picks_exact_srt(
    mock_which, mock_popen, fake_output_dir
):
    mock_which.return_value = "/fake/mpv"
    _make_multi_run_folder(fake_output_dir)

    resp = client.post(
        "/api/library/play-mpv",
        json={
            "videoId": "abcDEFghIJK",
            "translateId": "openai-whisper-tiny-en__gemini-flash__ja",
        },
    )
    body = resp.json()
    assert body["ok"] is True
    assert body["subtitle"] == "openai-whisper-tiny-en__gemini-flash__ja.srt"

    cmd = mock_popen.call_args.args[0]
    sub_args = [a for a in cmd if a.startswith("--sub-file=")]
    assert len(sub_args) == 1, sub_args
    assert sub_args[0].endswith("openai-whisper-tiny-en__gemini-flash__ja.srt")
    assert "translations" in sub_args[0]


@patch("api.routes.library.subprocess.Popen")
@patch("api.routes.library.shutil.which")
def test_play_mpv_unknown_run_id_returns_soft_error(
    mock_which, mock_popen, fake_output_dir
):
    mock_which.return_value = "/fake/mpv"
    _make_multi_run_folder(fake_output_dir)

    resp = client.post(
        "/api/library/play-mpv",
        json={"videoId": "abcDEFghIJK", "transcribeId": "doesnt-exist"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert "run not found" in body["error"]
    mock_popen.assert_not_called()


@patch("api.routes.library.subprocess.Popen")
@patch("api.routes.library.shutil.which")
def test_play_mpv_both_run_ids_rejected(
    mock_which, mock_popen, fake_output_dir
):
    mock_which.return_value = "/fake/mpv"
    _make_multi_run_folder(fake_output_dir)

    resp = client.post(
        "/api/library/play-mpv",
        json={
            "videoId": "abcDEFghIJK",
            "transcribeId": "openai-whisper-tiny-en",
            "translateId": "openai-whisper-tiny-en__gemini-flash__zh",
        },
    )
    body = resp.json()
    assert body["ok"] is False
    assert "mutually exclusive" in body["error"]


@patch("api.routes.library.subprocess.Popen")
@patch("api.routes.library.shutil.which")
def test_play_mpv_subtitle_preference_uses_latest_translation(
    mock_which, mock_popen, fake_output_dir
):
    """Default behavior (no run id) still works: picks latest translation."""
    mock_which.return_value = "/fake/mpv"
    _make_multi_run_folder(fake_output_dir)

    resp = client.post(
        "/api/library/play-mpv",
        json={"videoId": "abcDEFghIJK"},
    )
    body = resp.json()
    assert body["ok"] is True
    # Latest translation is the ja one (last appended).
    assert body["subtitle"] == "openai-whisper-tiny-en__gemini-flash__ja.srt"


@patch("api.routes.library.subprocess.Popen")
@patch("api.routes.library.shutil.which")
def test_play_mpv_subtitle_preference_original_uses_latest_transcript(
    mock_which, mock_popen, fake_output_dir
):
    mock_which.return_value = "/fake/mpv"
    _make_multi_run_folder(fake_output_dir)

    resp = client.post(
        "/api/library/play-mpv",
        json={"videoId": "abcDEFghIJK", "subtitlePreference": "original"},
    )
    body = resp.json()
    assert body["ok"] is True
    # Latest transcript is yt_captions-en (last appended).
    assert body["subtitle"] == "yt_captions-en.srt"
