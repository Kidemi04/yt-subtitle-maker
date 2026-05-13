"""Tests for the custom_translators camelCase + masking plumbing in /api/config."""
import json

import pytest
from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


@pytest.fixture()
def config_with_profiles(tmp_path, monkeypatch):
    """Point config I/O at a tmp dir with a pre-populated config.json."""
    fake_home = tmp_path / "h"
    fake_home.mkdir()
    monkeypatch.setenv("HOME", str(fake_home))
    monkeypatch.setenv("USERPROFILE", str(fake_home))

    cfg_dir = fake_home / ".yt_subtitle_tool"
    cfg_dir.mkdir()
    data = {
        "custom_translators": [
            {
                "id": "openai-legacy",
                "name": "OpenAI",
                "base_url": "https://api.openai.com/v1",
                "api_key": "sk-secret",
                "model": "gpt-4o",
            }
        ],
        "active_translator": "custom:openai-legacy",
    }
    (cfg_dir / "config.json").write_text(json.dumps(data), encoding="utf-8")
    return cfg_dir


def test_get_config_masks_profile_api_key(config_with_profiles):
    resp = client.get("/api/config")
    assert resp.status_code == 200
    body = resp.json()
    profiles = body.get("customTranslators", [])
    assert len(profiles) == 1
    assert profiles[0]["apiKey"] == "***"
    assert profiles[0]["id"] == "openai-legacy"
    assert profiles[0]["name"] == "OpenAI"
    assert profiles[0]["baseUrl"] == "https://api.openai.com/v1"
    assert profiles[0]["model"] == "gpt-4o"


def test_get_config_blank_api_key_not_masked(tmp_path, monkeypatch):
    """A profile with empty api_key should come back as '' not '***'."""
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
            "api_key": "",
            "model": "deepseek-chat",
        }],
        "active_translator": "custom:deepseek-1",
    }), encoding="utf-8")

    resp = client.get("/api/config")
    assert resp.status_code == 200
    profile = resp.json()["customTranslators"][0]
    assert profile["apiKey"] == ""


def test_get_config_active_translator_present(config_with_profiles):
    resp = client.get("/api/config")
    assert resp.status_code == 200
    assert resp.json()["activeTranslator"] == "custom:openai-legacy"


def test_post_config_with_masked_api_key_keeps_saved_key(config_with_profiles):
    """POST with apiKey='***' on an existing profile preserves the saved key."""
    resp = client.post("/api/config", json={
        "customTranslators": [{
            "id": "openai-legacy",
            "name": "OpenAI updated",
            "baseUrl": "https://api.openai.com/v1",
            "apiKey": "***",
            "model": "gpt-4o-mini",
        }]
    })
    assert resp.status_code == 200
    # The returned profile should still have the masked key (not the literal ***)
    profile = resp.json()["customTranslators"][0]
    assert profile["apiKey"] == "***"
    assert profile["name"] == "OpenAI updated"
    assert profile["model"] == "gpt-4o-mini"

    # Confirm the raw saved value is still 'sk-secret'
    from core.config import load_config
    cfg = load_config()
    assert cfg.custom_translators[0]["api_key"] == "sk-secret"


def test_post_config_with_real_api_key_updates_it(config_with_profiles):
    """POST with a new real key updates the stored value."""
    resp = client.post("/api/config", json={
        "customTranslators": [{
            "id": "openai-legacy",
            "name": "OpenAI",
            "baseUrl": "https://api.openai.com/v1",
            "apiKey": "sk-newkey",
            "model": "gpt-4o",
        }]
    })
    assert resp.status_code == 200

    from core.config import load_config
    cfg = load_config()
    assert cfg.custom_translators[0]["api_key"] == "sk-newkey"


def test_post_config_add_new_profile(config_with_profiles):
    """Sending a list with an extra profile adds it."""
    resp = client.post("/api/config", json={
        "customTranslators": [
            {
                "id": "openai-legacy",
                "name": "OpenAI",
                "baseUrl": "https://api.openai.com/v1",
                "apiKey": "***",
                "model": "gpt-4o",
            },
            {
                "id": "deepseek-1",
                "name": "DeepSeek",
                "baseUrl": "https://api.deepseek.com/v1",
                "apiKey": "ds-key",
                "model": "deepseek-chat",
            },
        ]
    })
    assert resp.status_code == 200

    from core.config import load_config
    cfg = load_config()
    assert len(cfg.custom_translators) == 2
    ids = {e["id"] for e in cfg.custom_translators}
    assert "deepseek-1" in ids


def test_post_config_remove_profile_by_omission(config_with_profiles):
    """Sending an empty list removes all custom profiles."""
    resp = client.post("/api/config", json={"customTranslators": []})
    assert resp.status_code == 200

    from core.config import load_config
    cfg = load_config()
    assert cfg.custom_translators == []


def test_post_config_active_translator_roundtrips(config_with_profiles):
    resp = client.post("/api/config", json={"activeTranslator": "gemini"})
    assert resp.status_code == 200
    assert resp.json()["activeTranslator"] == "gemini"
