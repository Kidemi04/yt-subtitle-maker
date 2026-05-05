"""Tests for the downloadOnly short-circuit in run_pipeline."""
from __future__ import annotations

import json
from pathlib import Path

from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


def test_download_only_skips_stt_and_writes_no_srt(tmp_path, monkeypatch):
    """downloadOnly=True should download audio, emit done, and produce no SRT."""
    out_dir = tmp_path / "output"
    out_dir.mkdir()

    # Patch load_config so the pipeline's output_dir points at tmp.
    from core.config import AppConfig

    def fake_load_config():
        cfg = AppConfig()
        cfg.output_dir = str(out_dir)
        return cfg

    monkeypatch.setattr("core.pipeline.load_config", fake_load_config, raising=False)
    monkeypatch.setattr("api.routes.process.load_config", fake_load_config)

    # Stub yt-dlp metadata pre-fetch.
    monkeypatch.setattr(
        "api.routes.process.fetch_video_metadata",
        lambda url, **kwargs: {
            "title": "Fake Video",
            "thumbnail_url": None,
            "duration": 0,
            "channel": None,
        },
    )

    # Stub the audio downloader so the test doesn't need network access.
    fake_audio_calls: list[tuple] = []

    def fake_download_audio(url, dst_dir, **kwargs):
        fake_audio_calls.append((url, dst_dir))
        wav_path = Path(dst_dir) / "abcDEFghIJK.wav"
        wav_path.write_bytes(b"\x00" * 16)
        return str(wav_path), 0.5

    monkeypatch.setattr("core.pipeline.download_audio", fake_download_audio)

    # Should NOT be called when downloadOnly=True.
    def _no_stt(*args, **kwargs):
        raise AssertionError("STT provider should not be selected in downloadOnly mode")

    monkeypatch.setattr("core.pipeline._select_stt_provider", _no_stt)

    payload = {
        "url": "https://www.youtube.com/watch?v=abcDEFghIJK",
        "sttSource": "auto",
        "whisperModel": "tiny",
        "whisperDevice": "cpu",
        "vadEnabled": False,
        "sourceLang": "en",
        "enableTranslation": False,
        "downloadOnly": True,
    }

    events: list[dict] = []
    with client.stream("POST", "/api/process", json=payload) as resp:
        assert resp.status_code == 200
        for line in resp.iter_lines():
            if not line:
                continue
            events.append(json.loads(line))

    # Sanity: download_audio was hit exactly once.
    assert len(fake_audio_calls) == 1

    # Final event is `done` with downloadOnly markers.
    assert events[-1]["status"] == "done"
    done = events[-1]
    assert done["videoId"] == "abcDEFghIJK"
    assert done["originalSrtPath"] == ""
    assert done["translatedSrtPath"] is None
    assert done["audioPath"].endswith("abcDEFghIJK.wav")
    assert done["sttSourceUsed"] == "download_only"
    assert isinstance(done["durationMs"], int)
    assert done["durationMs"] >= 0
    assert done["previewSegments"] == []

    # No SRT files should have been written (anywhere — including subdirs).
    folder = next(p for p in out_dir.iterdir() if p.is_dir())
    srts = list(folder.rglob("*.srt"))
    assert srts == [], f"expected no SRTs in downloadOnly mode, found {srts}"

    # New-shape sidecar exists with empty transcribes/translations.
    sidecar = folder / "_history.json"
    assert sidecar.is_file()
    saved = json.loads(sidecar.read_text(encoding="utf-8"))
    assert saved["videoId"] == "abcDEFghIJK"
    assert saved["titleOriginal"] == "Fake Video"
    assert saved["titleTranslated"] is None
    assert saved["transcribes"] == []
    assert saved["translations"] == []
