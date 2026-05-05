"""Tests for POST /api/library/{videoId}/transcribe — re-run STT on existing audio."""
from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from api.main import app
from core import library_runs
from core.stt.base import TranscriptionResult, TranscriptionSegment

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


def _make_folder_with_audio(out: Path, video_id: str = "abcDEFghIJK") -> Path:
    folder = out / f"My_Video_{video_id}"
    folder.mkdir()
    (folder / f"{video_id}.wav").write_bytes(b"\x00" * 16)
    (folder / "transcripts").mkdir()
    library_runs.update_metadata(
        folder,
        url=f"https://www.youtube.com/watch?v={video_id}",
        title_original="My Video",
    )
    return folder


class _FakeWhisper:
    name = "openai-whisper"
    needs_audio = True

    def __init__(self, **kwargs):
        self.kwargs = kwargs

    def transcribe(self, audio_path, url, language, progress=None):
        if progress:
            progress(0.5)
            progress(1.0)
        return TranscriptionResult(
            segments=[
                TranscriptionSegment(id=1, start=0.0, end=1.5, text="Re-run hello"),
            ],
            language=language or "en",
            source="openai-whisper",
        )


class _FakeYtCaptions:
    name = "yt_captions"
    needs_audio = False

    def is_available(self, url=None):
        return True

    def transcribe(self, audio_path, url, language, progress=None):
        return TranscriptionResult(
            segments=[
                TranscriptionSegment(id=1, start=0.0, end=2.0, text="Caption line"),
            ],
            language=language or "en",
            source="yt_captions",
        )


def _stream(payload, video_id="abcDEFghIJK"):
    events: list[dict] = []
    with client.stream(
        "POST", f"/api/library/{video_id}/transcribe", json=payload
    ) as resp:
        for line in resp.iter_lines():
            if not line:
                continue
            events.append(json.loads(line))
    return events


def test_transcribe_writes_srt_and_appends_sidecar(fake_output_dir, monkeypatch):
    folder = _make_folder_with_audio(fake_output_dir)
    monkeypatch.setattr(
        "core.stt.get_provider",
        lambda name, **kw: _FakeWhisper(**kw),
    )

    events = _stream({
        "sttEngine": "openai-whisper",
        "whisperModel": "tiny",
        "whisperDevice": "cpu",
        "vadEnabled": False,
        "sourceLang": "en",
    })

    done = events[-1]
    assert done["status"] == "done"
    assert done["transcribeId"] == "openai-whisper-tiny-en"
    assert done["filename"] == "openai-whisper-tiny-en.srt"
    assert done["url"] == (
        "/api/library/abcDEFghIJK/file/transcripts/openai-whisper-tiny-en.srt"
    )
    assert done["segmentCount"] == 1

    # File written to transcripts/<id>.srt
    srt = folder / "transcripts" / "openai-whisper-tiny-en.srt"
    assert srt.is_file()
    assert "Re-run hello" in srt.read_text(encoding="utf-8")

    # Sidecar updated with the new transcribe entry
    sidecar = library_runs.read_sidecar(folder)
    ids = [t["id"] for t in sidecar["transcribes"]]
    assert "openai-whisper-tiny-en" in ids


def test_transcribe_with_yt_captions_skips_audio_check(fake_output_dir, monkeypatch):
    """yt_captions needs no audio file — endpoint should accept folder w/o wav."""
    folder = fake_output_dir / "Caption_Only_abcDEFghIJK"
    folder.mkdir()
    library_runs.update_metadata(
        folder,
        url="https://www.youtube.com/watch?v=abcDEFghIJK",
        title_original="Caption Only",
    )

    monkeypatch.setattr(
        "core.stt.yt_captions.YtCaptionsProvider", _FakeYtCaptions
    )
    # Library route imports inline; patch the symbol it picks up.
    import api.routes.library as lib_mod
    monkeypatch.setattr(
        "core.stt.yt_captions.YtCaptionsProvider", _FakeYtCaptions, raising=True
    )
    # Replace the lazy import target inside the runner.
    import core.stt.yt_captions as yt_mod
    monkeypatch.setattr(yt_mod, "YtCaptionsProvider", _FakeYtCaptions)

    events = _stream({
        "sttEngine": "yt_captions",
        "whisperModel": None,
        "whisperDevice": None,
        "vadEnabled": False,
        "sourceLang": "en",
    })

    done = events[-1]
    assert done["status"] == "done"
    assert done["transcribeId"] == "yt_captions-en"

    srt = folder / "transcripts" / "yt_captions-en.srt"
    assert srt.is_file()


def test_transcribe_returns_soft_error_when_no_audio(fake_output_dir):
    folder = fake_output_dir / "No_Audio_abcDEFghIJK"
    folder.mkdir()
    (folder / "transcripts").mkdir()

    resp = client.post(
        "/api/library/abcDEFghIJK/transcribe",
        json={
            "sttEngine": "openai-whisper",
            "whisperModel": "tiny",
            "whisperDevice": "cpu",
            "vadEnabled": False,
            "sourceLang": "en",
        },
    )
    # Soft error → 200 + {ok: false}
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert "no audio" in body["error"].lower()


def test_transcribe_unknown_video_returns_404(fake_output_dir):
    resp = client.post(
        "/api/library/unknownXXXXX/transcribe",
        json={
            "sttEngine": "openai-whisper",
            "whisperModel": "tiny",
            "whisperDevice": "cpu",
            "vadEnabled": False,
            "sourceLang": "en",
        },
    )
    assert resp.status_code == 404


def test_transcribe_idempotent_replaces_existing_run(fake_output_dir, monkeypatch):
    """Running the same engine+model+lang twice replaces the entry (same id)."""
    folder = _make_folder_with_audio(fake_output_dir)
    monkeypatch.setattr(
        "core.stt.get_provider",
        lambda name, **kw: _FakeWhisper(**kw),
    )

    payload = {
        "sttEngine": "openai-whisper",
        "whisperModel": "tiny",
        "whisperDevice": "cpu",
        "vadEnabled": False,
        "sourceLang": "en",
    }
    _stream(payload)
    _stream(payload)

    sidecar = library_runs.read_sidecar(folder)
    matching = [t for t in sidecar["transcribes"] if t["id"] == "openai-whisper-tiny-en"]
    assert len(matching) == 1


def test_transcribe_lazy_migrates_legacy_folder(fake_output_dir, monkeypatch):
    """Legacy folder gets migrated into subdirs before the new run lands."""
    folder = fake_output_dir / "Legacy_abcDEFghIJK"
    folder.mkdir()
    (folder / "abcDEFghIJK.wav").write_bytes(b"\x00" * 16)
    (folder / "abcDEFghIJK_original.srt").write_text("legacy text", encoding="utf-8")

    monkeypatch.setattr(
        "core.stt.get_provider",
        lambda name, **kw: _FakeWhisper(**kw),
    )

    events = _stream({
        "sttEngine": "openai-whisper",
        "whisperModel": "turbo",
        "whisperDevice": "cpu",
        "vadEnabled": False,
        "sourceLang": "en",
    })
    assert events[-1]["status"] == "done"

    # Legacy file moved → transcripts/legacy.srt
    assert (folder / "transcripts" / "legacy.srt").is_file()
    # Old root file gone
    assert not (folder / "abcDEFghIJK_original.srt").exists()
    # New transcript file present
    assert (folder / "transcripts" / "openai-whisper-turbo-en.srt").is_file()
