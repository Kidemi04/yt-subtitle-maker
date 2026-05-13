"""Tests for /api/translator/test and /api/translator/list-models.

Phase 4d: /api/translator/test now does a real one-line round-trip via
`provider.translate_title("Hello, world.", target_lang)` and categorises
the errors into human-readable strings. It also accepts the saved-profile
form `{profileId, useSavedKey}` which resolves credentials server-side
through `get_active_translator`.
"""
import json
from unittest.mock import MagicMock, patch

import httpx
from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


# ── helpers ────────────────────────────────────────────────────────────────────

def _openai_response(status: int, message: str) -> httpx.Response:
    """Build an httpx.Response with an attached Request for openai SDK errors."""
    req = httpx.Request("POST", "https://api.openai.com/v1/chat/completions")
    return httpx.Response(
        status,
        json={"error": {"message": message, "type": "error"}},
        request=req,
    )


# ── success path ────────────────────────────────────────────────────────────────


@patch("api.routes.translator.get_translator")
def test_test_endpoint_success_adhoc(mock_get):
    """Ad-hoc spec (provider + baseUrl + model) returns structured success."""
    mock_provider = MagicMock()
    mock_provider.ping.return_value = "你好，世界。"
    mock_provider.model = "gemma-3-27b-it"
    mock_get.return_value = mock_provider

    resp = client.post("/api/translator/test", json={
        "provider": "local_openai",
        "baseUrl": "http://127.0.0.1:1234/v1",
        "model": "gemma-3-27b-it",
        "targetLang": "zh-CN",
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    # Phase 4d-fix: ping-based smoke check, no sample.
    assert "sample" not in body
    assert "latencyMs" in body
    assert isinstance(body["latencyMs"], int)
    assert body["model"] == "gemma-3-27b-it"
    mock_provider.ping.assert_called_once()


@patch("api.routes.translator.get_active_translator")
def test_test_endpoint_success_saved_profile_gemini(mock_gat, tmp_path, monkeypatch):
    """profileId='gemini' + useSavedKey=True resolves from saved config via get_active_translator."""
    fake_home = tmp_path / "h"
    fake_home.mkdir()
    monkeypatch.setenv("HOME", str(fake_home))
    monkeypatch.setenv("USERPROFILE", str(fake_home))
    cfg_dir = fake_home / ".yt_subtitle_tool"
    cfg_dir.mkdir()
    (cfg_dir / "config.json").write_text(json.dumps({
        "gemini_api_key": "gkey",
        "gemini_model": "gemini-2.5-flash-lite",
        "active_translator": "gemini",
    }), encoding="utf-8")

    mock_provider = MagicMock()
    mock_provider.ping.return_value = "你好，世界。"
    mock_provider.model = "gemini-2.5-flash-lite"
    mock_gat.return_value = mock_provider

    resp = client.post("/api/translator/test", json={
        "profileId": "gemini",
        "useSavedKey": True,
        "targetLang": "zh-CN",
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert "sample" not in body
    assert body["model"] == "gemini-2.5-flash-lite"
    mock_provider.ping.assert_called_once()
    mock_gat.assert_called_once()
    # The cfg passed to get_active_translator should have active_translator
    # set to the requested profileId.
    cfg_arg = mock_gat.call_args[0][0]
    assert cfg_arg.active_translator == "gemini"


@patch("api.routes.translator.get_active_translator")
def test_test_endpoint_success_saved_profile_custom(mock_gat, tmp_path, monkeypatch):
    """profileId='custom:<id>' + useSavedKey=True dispatches via get_active_translator."""
    fake_home = tmp_path / "h"
    fake_home.mkdir()
    monkeypatch.setenv("HOME", str(fake_home))
    monkeypatch.setenv("USERPROFILE", str(fake_home))
    cfg_dir = fake_home / ".yt_subtitle_tool"
    cfg_dir.mkdir()
    (cfg_dir / "config.json").write_text(json.dumps({
        "custom_translators": [{
            "id": "deepseek-1",
            "name": "DeepSeek",
            "base_url": "https://api.deepseek.com/v1",
            "api_key": "ds-key",
            "model": "deepseek-chat",
        }],
        "active_translator": "gemini",  # would normally be Gemini
    }), encoding="utf-8")

    mock_provider = MagicMock()
    mock_provider.ping.return_value = "你好"
    mock_provider.model = "deepseek-chat"
    mock_gat.return_value = mock_provider

    resp = client.post("/api/translator/test", json={
        "profileId": "custom:deepseek-1",
        "useSavedKey": True,
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    # cfg passed to get_active_translator should have been overridden to the requested profile
    cfg_arg = mock_gat.call_args[0][0]
    assert cfg_arg.active_translator == "custom:deepseek-1"


# ── error paths ────────────────────────────────────────────────────────────────


@patch("api.routes.translator.get_translator")
def test_test_endpoint_auth_error(mock_get):
    """openai.AuthenticationError (401) → 'Authentication failed' message."""
    from openai import AuthenticationError

    mock_provider = MagicMock()
    r = _openai_response(401, "invalid key")
    mock_provider.ping.side_effect = AuthenticationError(
        "invalid key", response=r, body={"error": {"message": "invalid key"}}
    )
    mock_provider.model = "gpt-4o"
    mock_get.return_value = mock_provider

    resp = client.post("/api/translator/test", json={
        "provider": "openai",
        "model": "gpt-4o",
        "apiKey": "bad-key",
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert "Authentication failed" in body["error"]
    # latencyMs and model are still reported on the failure shape
    assert "latencyMs" in body
    assert body["model"] == "gpt-4o"


@patch("api.routes.translator.get_translator")
def test_test_endpoint_model_not_found(mock_get):
    """openai.NotFoundError (404) → "Model '<model>' not found"."""
    from openai import NotFoundError

    mock_provider = MagicMock()
    r = _openai_response(404, "model not found")
    mock_provider.ping.side_effect = NotFoundError(
        "model not found", response=r, body={"error": {"message": "model not found"}}
    )
    mock_provider.model = "gpt-99"
    mock_get.return_value = mock_provider

    resp = client.post("/api/translator/test", json={
        "provider": "openai",
        "model": "gpt-99",
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert "not found" in body["error"].lower()
    assert "gpt-99" in body["error"]


@patch("api.routes.translator.get_translator")
def test_test_endpoint_connection_error(mock_get):
    """httpx.ConnectError → 'Couldn't reach …' message."""
    mock_provider = MagicMock()
    mock_provider.ping.side_effect = httpx.ConnectError("Connection refused")
    mock_provider.model = "gemma"
    mock_get.return_value = mock_provider

    resp = client.post("/api/translator/test", json={
        "provider": "local_openai",
        "model": "gemma",
        "baseUrl": "http://127.0.0.1:9999/v1",
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert "reach" in body["error"].lower() or "connect" in body["error"].lower()


@patch("api.routes.translator.get_translator")
def test_test_endpoint_timeout(mock_get):
    """httpx.TimeoutException → 'Request timed out'."""
    mock_provider = MagicMock()
    mock_provider.ping.side_effect = httpx.TimeoutException("timeout")
    mock_provider.model = "gemma"
    mock_get.return_value = mock_provider

    resp = client.post("/api/translator/test", json={
        "provider": "local_openai",
        "model": "gemma",
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert "timed out" in body["error"].lower()


@patch("api.routes.translator.get_translator")
def test_test_endpoint_quota_error(mock_get):
    """openai.RateLimitError (429) → 'Quota exceeded'."""
    from openai import RateLimitError

    mock_provider = MagicMock()
    r = _openai_response(429, "quota exceeded")
    mock_provider.ping.side_effect = RateLimitError(
        "quota exceeded", response=r, body={"error": {"message": "quota exceeded"}}
    )
    mock_provider.model = "gpt-4o"
    mock_get.return_value = mock_provider

    resp = client.post("/api/translator/test", json={
        "provider": "openai",
        "model": "gpt-4o",
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert "quota" in body["error"].lower()


@patch("api.routes.translator.get_translator")
def test_test_endpoint_unexpected_response_shape(mock_get):
    """KeyError/AttributeError/IndexError → 'Unexpected response shape' message.

    Simulates the case where an endpoint claims to be OpenAI-compatible
    but `resp.choices[0].message.content` raises (e.g. it's a different
    JSON shape). The categoriser maps that family to a friendlier hint.
    """
    mock_provider = MagicMock()
    mock_provider.ping.side_effect = KeyError("choices")
    mock_provider.model = "weird-model"
    mock_get.return_value = mock_provider

    resp = client.post("/api/translator/test", json={
        "provider": "local_openai",
        "model": "weird-model",
        "baseUrl": "http://127.0.0.1:1234/v1",
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert "unexpected response shape" in body["error"].lower()


@patch("api.routes.translator.get_translator")
def test_test_endpoint_default_target_lang(mock_get, tmp_path, monkeypatch):
    """Omitting targetLang falls back to the schema default ('zh-CN')."""
    mock_provider = MagicMock()
    mock_provider.ping.return_value = "你好"
    mock_provider.model = "x"
    mock_get.return_value = mock_provider

    resp = client.post("/api/translator/test", json={
        "provider": "local_openai",
        "model": "x",
    })
    assert resp.status_code == 200
    assert resp.json()["ok"] is True
    # ping takes no args — targetLang is now a no-op on the smoke check,
    # but the schema still accepts/defaults it for backward-compat.
    mock_provider.ping.assert_called_once()


# ── list-models ────────────────────────────────────────────────────────────────


@patch("api.routes.translator.get_translator")
def test_list_models_adhoc(mock_get):
    mock_provider = MagicMock()
    mock_provider.list_models.return_value = ["gemma-3-27b-it", "qwen2.5-7b"]
    mock_get.return_value = mock_provider

    resp = client.post("/api/translator/list-models", json={
        "provider": "local_openai",
        "baseUrl": "http://127.0.0.1:1234/v1",
    })
    assert resp.status_code == 200
    assert resp.json() == {"ok": True, "models": ["gemma-3-27b-it", "qwen2.5-7b"]}


@patch("api.routes.translator.get_active_translator")
def test_list_models_saved_profile(mock_gat, tmp_path, monkeypatch):
    fake_home = tmp_path / "h"
    fake_home.mkdir()
    monkeypatch.setenv("HOME", str(fake_home))
    monkeypatch.setenv("USERPROFILE", str(fake_home))
    cfg_dir = fake_home / ".yt_subtitle_tool"
    cfg_dir.mkdir()
    (cfg_dir / "config.json").write_text(json.dumps({
        "custom_translators": [{
            "id": "deepseek-1",
            "name": "DeepSeek",
            "base_url": "https://api.deepseek.com/v1",
            "api_key": "ds-key",
            "model": "deepseek-chat",
        }],
        "active_translator": "custom:deepseek-1",
    }), encoding="utf-8")

    mock_provider = MagicMock()
    mock_provider.list_models.return_value = ["deepseek-chat", "deepseek-coder"]
    mock_gat.return_value = mock_provider

    resp = client.post("/api/translator/list-models", json={
        "profileId": "custom:deepseek-1",
        "useSavedKey": True,
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert "deepseek-chat" in body["models"]
