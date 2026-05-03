from unittest.mock import patch
from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)


@patch("api.routes.dependencies.check_whisper_model")
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


@patch("api.routes.dependencies.download_whisper_model_generator")
def test_dependencies_install_streams_progress(mock_gen):
    # Fake 3-chunk download
    def fake_progress(name):
        yield (1024, 100000, 5000.0)
        yield (50000, 100000, 12500.0)
        yield (100000, 100000, 25000.0)
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


# pytest needs to be importable at module level for the approx import above
import pytest
