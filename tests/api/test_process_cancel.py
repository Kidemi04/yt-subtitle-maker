"""Tests for POST /api/process/cancel and cooperative cancellation."""
from __future__ import annotations

import json
import threading
import time

from fastapi.testclient import TestClient

from api import jobs
from api.main import app

client = TestClient(app)


def test_cancel_with_no_active_job_returns_ok_false():
    # Make sure no active event from prior tests is hanging around.
    jobs._slot["event"] = None
    resp = client.post("/api/process/cancel")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert "no active job" in body["error"]


def test_cancel_terminates_inflight_pipeline(monkeypatch):
    """Mock run_pipeline to busy-loop; verify cancel triggers PipelineCancelled."""
    started = threading.Event()

    def fake_metadata(url, **kwargs):
        return {"title": "Fake Title", "thumbnail_url": None, "duration": 0, "channel": None}

    def fake_run_pipeline(url, request_dict, cfg, on_event, cancel_event=None):
        on_event({"status": "starting", "message": "starting"})
        started.set()
        # Spin until cancel observed, then raise like the real pipeline would.
        while True:
            if cancel_event is not None and cancel_event.is_set():
                from core.pipeline import PipelineCancelled
                raise PipelineCancelled("cancelled")
            time.sleep(0.01)

    monkeypatch.setattr("api.routes.process.fetch_video_metadata", fake_metadata)
    monkeypatch.setattr("api.routes.process.run_pipeline", fake_run_pipeline)

    payload = {
        "url": "https://youtu.be/abcDEFghIJK",
        "sttSource": "whisper",
        "whisperModel": "tiny",
        "whisperDevice": "cpu",
        "vadEnabled": False,
        "sourceLang": "en",
        "enableTranslation": False,
    }

    # Stream the response in a background thread so we can fire cancel mid-stream.
    collected: list[dict] = []

    def reader():
        with client.stream("POST", "/api/process", json=payload) as resp:
            assert resp.status_code == 200
            for line in resp.iter_lines():
                if not line:
                    continue
                collected.append(json.loads(line))

    t = threading.Thread(target=reader, daemon=True)
    t.start()

    # Wait for the pipeline runner to actually start before cancelling.
    assert started.wait(timeout=5.0), "fake pipeline never started"

    cancel_resp = client.post("/api/process/cancel")
    assert cancel_resp.status_code == 200
    assert cancel_resp.json() == {"ok": True}

    t.join(timeout=5.0)
    assert not t.is_alive(), "stream did not terminate after cancel"

    # Final event should be the cancellation, surfaced as a recoverable error.
    assert len(collected) >= 1
    final = collected[-1]
    assert final["status"] == "error"
    assert final["error"] == "cancelled"
    assert final["recoverable"] is True
