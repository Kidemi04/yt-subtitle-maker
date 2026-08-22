"""Translator retry policy.

A one-hour video is hundreds of sequential API calls. Without retries a
single 429 or dropped connection aborted the run and discarded every batch
already paid for.
"""
from __future__ import annotations

import pytest

from core.translator.retry import is_permanent, translated_count, with_retries


class _FakeSegment:
    def __init__(self, translated=None):
        self.translated = translated


def test_transient_failure_is_retried_then_succeeds(monkeypatch):
    monkeypatch.setattr("core.translator.retry.time.sleep", lambda _s: None)
    attempts = []

    def flaky():
        attempts.append(1)
        if len(attempts) < 3:
            raise ConnectionError("connection reset")
        return "ok"

    notices: list[str] = []
    assert with_retries(flaky, label="batch", on_retry=notices.append) == "ok"
    assert len(attempts) == 3
    # Retries are announced, so a slow run doesn't just look frozen.
    assert len(notices) == 2
    assert "retry 1/3" in notices[0]


def test_backoff_grows_between_attempts(monkeypatch):
    delays: list[float] = []
    monkeypatch.setattr("core.translator.retry.time.sleep", delays.append)

    with pytest.raises(TimeoutError):
        with_retries(lambda: (_ for _ in ()).throw(TimeoutError("slow")), label="batch")

    assert delays == sorted(delays), "delays should be non-decreasing"
    assert len(delays) >= 2
    assert delays[1] > delays[0]


def test_permanent_failure_is_not_retried(monkeypatch):
    monkeypatch.setattr("core.translator.retry.time.sleep", lambda _s: None)
    attempts = []

    class AuthenticationError(Exception):
        pass

    def bad_key():
        attempts.append(1)
        raise AuthenticationError("API key not valid")

    with pytest.raises(AuthenticationError):
        with_retries(bad_key, label="batch")
    # Fails immediately — no point burning 20s on a wrong key.
    assert len(attempts) == 1


def test_exhausting_attempts_reraises_the_original_error(monkeypatch):
    monkeypatch.setattr("core.translator.retry.time.sleep", lambda _s: None)

    def always():
        raise ConnectionError("still down")

    with pytest.raises(ConnectionError, match="still down"):
        with_retries(always, label="batch", max_attempts=2)


@pytest.mark.parametrize(
    "exc,permanent",
    [
        (ConnectionError("reset"), False),
        (TimeoutError("timed out"), False),
        (Exception("429 rate limit exceeded"), False),
        (Exception("503 service unavailable"), False),
        (Exception("invalid_api_key"), True),
        (Exception("API key not valid"), True),
        (Exception("model_not_found"), True),
        (Exception("unauthorized"), True),
    ],
)
def test_classification(exc, permanent):
    assert is_permanent(exc) is permanent


def test_translated_count_ignores_blank_translations():
    segs = [_FakeSegment("a"), _FakeSegment(""), _FakeSegment(None), _FakeSegment("b")]
    assert translated_count(segs) == 2
