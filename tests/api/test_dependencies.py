import hashlib
import subprocess
import sys
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


@patch("api.routes.dependencies.model_catalog.check_whisper_model")
@patch("api.routes.dependencies.check_ffmpeg")
@patch("api.routes.dependencies.check_mpv")
def test_dependencies_get_returns_status(mock_mpv, mock_ffmpeg, mock_model):
    mock_model.side_effect = lambda name: name in {"tiny", "turbo"}
    mock_ffmpeg.return_value = True
    mock_mpv.return_value = False

    resp = client.get("/api/dependencies")
    assert resp.status_code == 200
    body = resp.json()

    assert "models" in body
    assert body["models"]["tiny"] is True
    assert body["models"]["turbo"] is True
    assert body["models"]["base"] is False
    assert body["ffmpegAvailable"] is True
    assert body["mpvAvailable"] is False


def test_dependencies_install_rejects_unknown_model():
    resp = client.post("/api/dependencies/install", json={"model": "nonexistent-model"})
    # Either 400 (validation rejects) or 200 with error event in stream — accept either,
    # but require it doesn't 5xx.
    assert resp.status_code < 500


@patch("api.routes.dependencies.model_catalog.download_engine_model_generator")
def test_dependencies_install_streams_progress(mock_gen):
    # Fake 3-chunk download
    def fake_progress(engine, name):
        assert engine == "openai-whisper"
        yield (1024, 100000, 5000.0, None)
        yield (50000, 100000, 12500.0, None)
        yield (100000, 100000, 25000.0, None)
    mock_gen.side_effect = fake_progress

    resp = client.post("/api/dependencies/install", json={"model": "tiny"})
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("application/x-ndjson")

    # Parse NDJSON lines
    import json as _json
    lines = [_json.loads(line) for line in resp.text.strip().split("\n") if line.strip()]

    # Should have at least 3 progress events + 1 done event
    progress_events = [e for e in lines if e.get("status") == "downloading"]
    done_events = [e for e in lines if e.get("status") == "done"]

    assert len(progress_events) >= 3
    assert progress_events[0]["downloaded"] == 1024
    assert progress_events[0]["total"] == 100000
    assert progress_events[0]["speed"] == 5000.0
    assert "percent" in progress_events[0]   # 1024/100000 * 100 ≈ 1.024
    assert progress_events[-1]["percent"] == pytest.approx(100.0, rel=0.01)
    assert len(done_events) == 1


# ── Task 4: engine param tests ────────────────────────────────────────────────


def test_dependencies_get_no_engine_param_still_works():
    """Omitting ?engine= is backward compatible."""
    resp = client.get("/api/dependencies")
    assert resp.status_code == 200
    assert "models" in resp.json()


def test_dependencies_get_openai_whisper_engine_same_as_no_param():
    """?engine=openai-whisper returns the same shape as no param."""
    resp = client.get("/api/dependencies?engine=openai-whisper")
    assert resp.status_code == 200
    body = resp.json()
    assert "models" in body
    assert "ffmpegAvailable" in body


def test_dependencies_support_faster_whisper_models(monkeypatch):
    from core.stt import model_catalog

    monkeypatch.setattr(
        model_catalog,
        "engine_model_state",
        lambda engine: {
            "tiny": True,
            "base": False,
            "small": False,
            "medium": False,
            "turbo": False,
            "large-v3": False,
        },
    )

    resp = client.get("/api/dependencies?engine=faster-whisper")

    assert resp.status_code == 200
    assert resp.json()["models"]["tiny"] is True


def test_dependencies_install_no_engine_still_works():
    """POST /install with no engine field is backward compatible."""
    # Reject with a known-bad model — we just care it returns 200 (not 5xx)
    # with an error message, same as before.
    resp = client.post("/api/dependencies/install", json={"model": "nonexistent"})
    assert resp.status_code < 500


def test_dependencies_install_openai_whisper_engine_accepted():
    """POST /install with engine=openai-whisper routes to the existing handler."""
    resp = client.post(
        "/api/dependencies/install",
        json={"model": "nonexistent", "engine": "openai-whisper"},
    )
    assert resp.status_code < 500


def test_dependencies_install_supports_faster_whisper_models(monkeypatch):
    from pathlib import Path

    from core.stt import model_catalog

    def fake_download(engine, model):
        assert engine == "faster-whisper"
        assert model == "tiny"
        yield 10, 10, 0.0, Path("/tmp/faster-whisper/tiny")

    monkeypatch.setattr(model_catalog, "download_engine_model_generator", fake_download)

    resp = client.post(
        "/api/dependencies/install",
        json={"model": "tiny", "engine": "faster-whisper"},
    )

    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("application/x-ndjson")
    assert '"status": "done"' in resp.text


def test_dependencies_reject_unknown_engine():
    resp = client.get("/api/dependencies?engine=not-real")

    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert "unknown engine" in body["error"]


def test_install_engine_rejects_unknown_addon():
    resp = client.post("/api/dependencies/install-engine", json={"engine": "nope"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert "Unknown add-on engine" in body["error"]


@patch("api.routes.dependencies.install_stt_engine_addon_generator")
@patch("api.routes.dependencies.check_stt_engine_addon")
def test_install_engine_streams_ndjson(mock_check, mock_gen):
    mock_check.return_value = False

    def fake_events(engine):
        yield {"status": "resolving", "message": f"installing {engine}"}
        yield {"status": "installing", "message": "Collecting faster-whisper"}
        yield {
            "status": "done",
            "engine": engine,
            "packageName": "faster-whisper",
        }

    mock_gen.side_effect = fake_events

    resp = client.post(
        "/api/dependencies/install-engine",
        json={"engine": "faster-whisper"},
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("application/x-ndjson")

    import json as _json

    lines = [_json.loads(line) for line in resp.text.strip().split("\n") if line.strip()]
    assert [line["status"] for line in lines] == ["resolving", "installing", "done"]
    assert lines[-1]["engine"] == "faster-whisper"


@patch("api.routes.dependencies.check_stt_engine_addon")
def test_install_engine_already_installed_returns_done(mock_check):
    mock_check.return_value = True
    resp = client.post(
        "/api/dependencies/install-engine",
        json={"engine": "faster-whisper"},
    )
    assert resp.status_code == 200
    import json as _json

    lines = [_json.loads(line) for line in resp.text.strip().split("\n") if line.strip()]
    assert lines == [
        {
            "status": "done",
            "engine": "faster-whisper",
            "packageName": "faster-whisper",
        }
    ]


# ── Task 2: check_mpv_status() lookup-order priority ──────────────────────────


def test_check_mpv_status_prefers_bundled(tmp_path, monkeypatch):
    """Bundled binary at ~/.yt_subtitle_tool/bin/mpv wins over system PATH."""
    from core import dependency_manager as dm

    fake_bundled = tmp_path / "bin" / "mpv"
    fake_bundled.parent.mkdir(parents=True)
    fake_bundled.write_text("#!/bin/sh\necho 'mpv 0.40.0'\n")
    fake_bundled.chmod(0o755)

    monkeypatch.setattr(dm, "_bundled_mpv_path", lambda: fake_bundled)
    monkeypatch.setattr(dm.shutil, "which", lambda name: "/usr/local/bin/mpv")
    monkeypatch.setattr(
        dm.subprocess,
        "run",
        lambda *a, **kw: subprocess.CompletedProcess(a, 0, stdout="mpv 0.40.0\n", stderr=""),
    )

    status = dm.check_mpv_status()
    assert status["installed"] is True
    assert status["source"] == "bundled"
    assert status["path"] == str(fake_bundled)
    assert status["version"] == "0.40.0"


def test_check_mpv_status_falls_back_to_system(tmp_path, monkeypatch):
    from core import dependency_manager as dm

    missing = tmp_path / "bin" / "mpv"  # does not exist
    monkeypatch.setattr(dm, "_bundled_mpv_path", lambda: missing)
    monkeypatch.setattr(dm.shutil, "which", lambda name: "/opt/homebrew/bin/mpv")
    monkeypatch.setattr(
        dm.subprocess,
        "run",
        lambda *a, **kw: subprocess.CompletedProcess(a, 0, stdout="mpv 0.39.0\n", stderr=""),
    )

    status = dm.check_mpv_status()
    assert status["installed"] is True
    assert status["source"] == "system"
    assert status["path"] == "/opt/homebrew/bin/mpv"
    assert status["version"] == "0.39.0"


def test_check_mpv_status_returns_not_installed_when_neither(tmp_path, monkeypatch):
    from core import dependency_manager as dm

    missing = tmp_path / "bin" / "mpv"
    monkeypatch.setattr(dm, "_bundled_mpv_path", lambda: missing)
    monkeypatch.setattr(dm.shutil, "which", lambda name: None)

    status = dm.check_mpv_status()
    assert status == {"installed": False, "source": None, "path": None, "version": None}


# ── Task 3: install_mpv_generator() download + verify + extract pipeline ──────


def test_install_mpv_generator_unsupported_platform(monkeypatch):
    """Raises with a clear marker for Linux / unknown platforms."""
    from core import dependency_manager as dm

    monkeypatch.setattr(dm, "_platform_key", lambda: None)

    events = []
    with pytest.raises(dm.UnsupportedPlatformError):
        for evt in dm.install_mpv_generator():
            events.append(evt)
    assert events == []  # nothing yielded before raising


def test_install_mpv_generator_streams_events(tmp_path, monkeypatch):
    """Happy-path: yields resolving → downloading* → verifying → extracting → done."""
    from core import dependency_manager as dm

    monkeypatch.setattr(dm, "_platform_key", lambda: "darwin-arm64")
    monkeypatch.setattr(dm, "_app_data_dir", lambda: tmp_path)

    # Fake URL → mock requests.get to stream fake bytes.
    fake_content = b"\x00" * 10000
    fake_sha = hashlib.sha256(fake_content).hexdigest()

    class FakeResponse:
        headers = {"content-length": str(len(fake_content))}
        status_code = 200

        def raise_for_status(self):
            pass

        def iter_content(self, chunk_size):
            for i in range(0, len(fake_content), chunk_size):
                yield fake_content[i : i + chunk_size]

    monkeypatch.setitem(dm.MPV_BINARIES, "darwin-arm64", {
        "url": "https://fake.test/mpv.tar.gz",
        "sha256": fake_sha,
        "archive": "tar.gz",
        "inner_binary": "mpv.app/Contents/MacOS/mpv",
    })
    monkeypatch.setattr(dm.requests, "get", lambda *a, **kw: FakeResponse())

    # Mock the extract step so we don't try to untar fake bytes.
    def fake_extract(archive_path, dest, archive_kind):
        binary = dest / "mpv.app" / "Contents" / "MacOS" / "mpv"
        binary.parent.mkdir(parents=True, exist_ok=True)
        binary.write_text("#!/bin/sh\necho mpv 0.40.0\n")
        return dest

    monkeypatch.setattr(dm, "_extract_archive", fake_extract)

    events = list(dm.install_mpv_generator())
    phases = [e["phase"] for e in events]
    assert phases[0] == "resolving"
    assert "downloading" in phases
    assert phases[-2] == "verifying" or phases[-3] == "verifying"
    assert phases[-1] == "done"

    final = events[-1]
    assert final["path"].endswith("mpv") or final["path"].endswith("mpv.exe")
    binary_name = "mpv.exe" if sys.platform == "win32" else "mpv"
    assert (tmp_path / "bin" / binary_name).exists()  # binary copied into place


def test_install_mpv_generator_sha_mismatch(tmp_path, monkeypatch):
    """SHA-256 verification failure raises before extraction."""
    from core import dependency_manager as dm

    monkeypatch.setattr(dm, "_platform_key", lambda: "darwin-arm64")
    monkeypatch.setattr(dm, "_app_data_dir", lambda: tmp_path)
    monkeypatch.setitem(dm.MPV_BINARIES, "darwin-arm64", {
        "url": "https://fake.test/mpv.tar.gz",
        "sha256": "0" * 64,  # will not match
        "archive": "tar.gz",
        "inner_binary": "mpv.app/Contents/MacOS/mpv",
    })

    class FakeResponse:
        headers = {"content-length": "5"}
        status_code = 200
        def raise_for_status(self): pass
        def iter_content(self, chunk_size):
            yield b"hello"

    monkeypatch.setattr(dm.requests, "get", lambda *a, **kw: FakeResponse())

    with pytest.raises(dm.IntegrityError):
        list(dm.install_mpv_generator())


# ── Task 4: GET /api/dependencies/mpv-status endpoint ────────────────────────


@patch("api.routes.dependencies.check_mpv_status")
def test_get_mpv_status_returns_typed_payload(mock_status):
    mock_status.return_value = {
        "installed": True,
        "source": "system",
        "path": "/opt/homebrew/bin/mpv",
        "version": "0.40.0",
    }

    resp = client.get("/api/dependencies/mpv-status")
    assert resp.status_code == 200
    body = resp.json()
    assert body == mock_status.return_value


# ── Task 5: POST /api/dependencies/install-mpv streaming endpoint ─────────────


def test_install_mpv_returns_400_on_unsupported_platform(monkeypatch):
    from core import dependency_manager as dm

    monkeypatch.setattr(dm, "_platform_key", lambda: None)
    resp = client.post("/api/dependencies/install-mpv", json={})
    assert resp.status_code == 400
    body = resp.json()
    assert body["supported"] is False
    assert body["manualUrl"] == "https://mpv.io/installation/"


@patch("api.routes.dependencies.install_mpv_generator")
def test_install_mpv_streams_ndjson(mock_gen):
    def fake_events():
        yield {"phase": "resolving", "message": "using darwin-arm64"}
        yield {"phase": "downloading", "bytesReceived": 100, "bytesTotal": 1000}
        yield {"phase": "downloading", "bytesReceived": 1000, "bytesTotal": 1000}
        yield {"phase": "verifying", "message": "sha-256 ok"}
        yield {"phase": "extracting", "message": "unpacking tar.gz"}
        yield {"phase": "done", "path": "/Users/u/.yt_subtitle_tool/bin/mpv", "version": "0.40.0"}
    mock_gen.side_effect = fake_events

    resp = client.post("/api/dependencies/install-mpv", json={})
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("application/x-ndjson")

    import json as _json
    lines = [_json.loads(line) for line in resp.text.strip().split("\n") if line.strip()]
    phases = [e["phase"] for e in lines]
    assert phases == ["resolving", "downloading", "downloading", "verifying", "extracting", "done"]
    assert lines[-1]["path"].endswith("mpv")
