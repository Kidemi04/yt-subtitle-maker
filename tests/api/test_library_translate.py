"""Tests for POST /api/library/{videoId}/translate — re-run translator on existing transcript."""
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
        cfg.translator_provider = "gemini"
        cfg.gemini_api_key = "fake"
        cfg.gemini_model = "gemini-2.5-flash-lite"
        return cfg

    monkeypatch.setattr("api.routes.library.load_config", fake_load)
    return out


def _make_folder_with_transcript(
    out: Path, video_id: str = "abcDEFghIJK"
) -> Path:
    folder = out / f"My_Video_{video_id}"
    folder.mkdir()
    (folder / "transcripts").mkdir()
    (folder / "translations").mkdir()
    (folder / f"{video_id}.wav").write_bytes(b"\x00" * 16)

    # Plant a transcript SRT
    (folder / "transcripts" / "openai-whisper-tiny-en.srt").write_text(
        "1\n00:00:01,000 --> 00:00:02,000\nHello\n\n"
        "2\n00:00:02,500 --> 00:00:03,500\nWorld\n\n",
        encoding="utf-8",
    )
    library_runs.append_transcribe(folder, {
        "id": "openai-whisper-tiny-en",
        "engine": "openai-whisper", "model": "tiny", "device": "cpu",
        "vadEnabled": True, "language": "en",
        "filename": "openai-whisper-tiny-en.srt",
        "createdAt": "2026-05-01T00:00:00+00:00",
        "durationMs": 1000, "segmentCount": 2,
    })
    library_runs.update_metadata(
        folder, url=f"https://www.youtube.com/watch?v={video_id}",
        title_original="My Video",
    )
    return folder


class _FakeTranslator:
    def translate_segments(self, segments, target_lang, progress=None):
        for s in segments:
            s.translated = f"[{target_lang}] {s.text}"
        if progress:
            progress(1.0)


def _stream(payload, video_id="abcDEFghIJK"):
    events: list[dict] = []
    with client.stream(
        "POST", f"/api/library/{video_id}/translate", json=payload
    ) as resp:
        for line in resp.iter_lines():
            if not line:
                continue
            events.append(json.loads(line))
    return events


def test_translate_writes_srt_and_appends_sidecar(fake_output_dir, monkeypatch):
    folder = _make_folder_with_transcript(fake_output_dir)
    monkeypatch.setattr(
        "api.routes.library._build_translator",
        lambda provider, req, cfg: _FakeTranslator(),
    )

    events = _stream({
        "sourceTranscribeId": "openai-whisper-tiny-en",
        "targetLang": "zh",
        "translatorProvider": "gemini",
        "translatorModel": "gemini-2.5-flash-lite",
    })

    done = events[-1]
    assert done["status"] == "done"
    expected_id = (
        "openai-whisper-tiny-en__gemini-gemini-2-5-flash-lite__zh"
    )
    assert done["translateId"] == expected_id
    assert done["sourceTranscribeId"] == "openai-whisper-tiny-en"
    assert done["url"] == (
        f"/api/library/abcDEFghIJK/file/translations/{expected_id}.srt"
    )
    assert done["segmentCount"] == 2

    # SRT written to translations/<id>.srt with translated content
    srt = folder / "translations" / f"{expected_id}.srt"
    assert srt.is_file()
    content = srt.read_text(encoding="utf-8")
    assert "[zh] Hello" in content
    assert "[zh] World" in content

    # Sidecar entry recorded
    sidecar = library_runs.read_sidecar(folder)
    matching = [t for t in sidecar["translations"] if t["id"] == expected_id]
    assert len(matching) == 1
    assert matching[0]["sourceTranscribeId"] == "openai-whisper-tiny-en"
    assert matching[0]["translator"] == "gemini"


def test_translate_unknown_video_returns_404(fake_output_dir):
    resp = client.post(
        "/api/library/unknownXXXXX/translate",
        json={
            "sourceTranscribeId": "x",
            "targetLang": "zh",
            "translatorProvider": "gemini",
        },
    )
    assert resp.status_code == 404


def test_translate_unknown_source_returns_soft_error(fake_output_dir):
    _make_folder_with_transcript(fake_output_dir)
    resp = client.post(
        "/api/library/abcDEFghIJK/translate",
        json={
            "sourceTranscribeId": "doesnt-exist",
            "targetLang": "zh",
            "translatorProvider": "gemini",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert "transcript not found" in body["error"]


def test_translate_idempotent_replaces_existing(fake_output_dir, monkeypatch):
    folder = _make_folder_with_transcript(fake_output_dir)
    monkeypatch.setattr(
        "api.routes.library._build_translator",
        lambda provider, req, cfg: _FakeTranslator(),
    )

    payload = {
        "sourceTranscribeId": "openai-whisper-tiny-en",
        "targetLang": "zh",
        "translatorProvider": "gemini",
        "translatorModel": "gemini-2.5-flash-lite",
    }
    _stream(payload)
    _stream(payload)

    sidecar = library_runs.read_sidecar(folder)
    expected_id = "openai-whisper-tiny-en__gemini-gemini-2-5-flash-lite__zh"
    matching = [t for t in sidecar["translations"] if t["id"] == expected_id]
    assert len(matching) == 1


def test_translate_legacy_source_after_migration(fake_output_dir, monkeypatch):
    """When asked to re-translate from a legacy transcript, lazy migration
    moves it into transcripts/legacy.srt and the route picks it up by id."""
    folder = fake_output_dir / "Legacy_abcDEFghIJK"
    folder.mkdir()
    (folder / "abcDEFghIJK.wav").write_bytes(b"\x00" * 16)
    (folder / "abcDEFghIJK_original.srt").write_text(
        "1\n00:00:01,000 --> 00:00:02,000\nLegacy text\n\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(
        "api.routes.library._build_translator",
        lambda provider, req, cfg: _FakeTranslator(),
    )

    events = _stream({
        "sourceTranscribeId": "legacy",
        "targetLang": "zh",
        "translatorProvider": "gemini",
        "translatorModel": "gemini-flash",
    })
    done = events[-1]
    assert done["status"] == "done"
    # Legacy file got migrated
    assert (folder / "transcripts" / "legacy.srt").is_file()
    assert not (folder / "abcDEFghIJK_original.srt").exists()
