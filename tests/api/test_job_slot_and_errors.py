"""Job-slot enforcement and the /api/process error path.

Before: a metadata failure (bad/private/blocked URL — the most common error
there is) escaped the request handler as a bare HTTP 500 with a text/plain
body instead of the NDJSON the client reads, and leaked the job slot, after
which /api/process/cancel reported success with nothing running. And a
double-clicked Generate started a second transcription that raced the first.
"""
from __future__ import annotations

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from api import jobs
from api.main import app

client = TestClient(app, raise_server_exceptions=False)

BODY = {
    "url": "https://youtu.be/aaaaaaaaaaa",
    "sttSource": "whisper",
    "sttEngine": "openai-whisper",
    "whisperModel": "turbo",
    "whisperDevice": "cpu",
    "vadEnabled": True,
    "sourceLang": "en",
    "enableTranslation": False,
}


@pytest.fixture(autouse=True)
def clean_slot():
    jobs._slot["event"] = None
    yield
    jobs._slot["event"] = None


def test_metadata_failure_arrives_as_a_stream_event_not_a_500():
    with patch(
        "api.routes.process.fetch_video_metadata",
        side_effect=RuntimeError("Video unavailable"),
    ):
        resp = client.post("/api/process", json=BODY)

    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("application/x-ndjson")
    lines = [line for line in resp.text.strip().split("\n") if line]
    assert lines, "expected at least one NDJSON event"
    import json

    last = json.loads(lines[-1])
    assert last["status"] == "error"
    # The real reason survives, rather than being flattened to "500".
    assert "Video unavailable" in last["error"]


def test_metadata_failure_does_not_leak_the_job_slot():
    with patch(
        "api.routes.process.fetch_video_metadata",
        side_effect=RuntimeError("Video unavailable"),
    ):
        client.post("/api/process", json=BODY)

    assert jobs.active_event() is None
    # And cancel tells the truth about there being nothing to cancel.
    assert jobs.cancel_active() == {"ok": False, "error": "no active job"}


def test_second_concurrent_job_is_refused_with_409():
    held = jobs.claim_slot()
    try:
        resp = client.post("/api/process", json=BODY)
        assert resp.status_code == 409
        assert "already running" in resp.json()["detail"]
    finally:
        jobs.release_slot(held)


def test_slot_is_reusable_after_release():
    held = jobs.claim_slot()
    jobs.release_slot(held)
    assert not jobs.is_busy()
    with patch(
        "api.routes.process.fetch_video_metadata",
        side_effect=RuntimeError("x"),
    ):
        assert client.post("/api/process", json=BODY).status_code == 200


def test_claim_slot_raises_job_busy_rather_than_orphaning_the_occupant():
    first = jobs.claim_slot()
    with pytest.raises(jobs.JobBusy):
        jobs.claim_slot()
    # The original occupant is still the one cancel_active() signals.
    assert jobs.active_event() is first
    assert jobs.cancel_active() == {"ok": True}
    assert first.is_set()
    jobs.release_slot(first)


def test_force_claim_slot_is_the_deliberate_escape_hatch():
    stuck = jobs.claim_slot()
    fresh = jobs.force_claim_slot()
    assert jobs.active_event() is fresh
    assert not stuck.is_set()
    jobs.release_slot(fresh)


def test_release_slot_only_clears_its_own_event():
    first = jobs.claim_slot()
    second = jobs.force_claim_slot()
    jobs.release_slot(first)  # stale owner — must be a no-op
    assert jobs.active_event() is second
    jobs.release_slot(second)
    assert jobs.active_event() is None
