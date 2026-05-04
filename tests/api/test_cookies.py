"""Tests for POST /api/test-cookies."""
from __future__ import annotations

from unittest.mock import MagicMock

from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


def _patch_yt_dlp(monkeypatch, info: dict | None, raises: Exception | None = None):
    """Replace yt_dlp.YoutubeDL with a context-manager stub."""
    fake_ydl = MagicMock()
    if raises is not None:
        fake_ydl.extract_info.side_effect = raises
    else:
        fake_ydl.extract_info.return_value = info

    fake_cm = MagicMock()
    fake_cm.__enter__ = MagicMock(return_value=fake_ydl)
    fake_cm.__exit__ = MagicMock(return_value=False)

    fake_class = MagicMock(return_value=fake_cm)
    monkeypatch.setattr("api.routes.cookies.yt_dlp.YoutubeDL", fake_class)
    return fake_class


def test_test_cookies_returns_ok_true_on_success(monkeypatch):
    _patch_yt_dlp(monkeypatch, info={"title": "Never Gonna Give You Up"})
    resp = client.post("/api/test-cookies")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["title"] == "Never Gonna Give You Up"


def test_test_cookies_returns_ok_false_on_yt_dlp_exception(monkeypatch):
    _patch_yt_dlp(monkeypatch, info=None, raises=RuntimeError("cookie file not found"))
    resp = client.post("/api/test-cookies")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert "cookie file not found" in body["error"]


def test_test_cookies_returns_ok_false_when_extract_returns_none(monkeypatch):
    _patch_yt_dlp(monkeypatch, info=None)
    resp = client.post("/api/test-cookies")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
