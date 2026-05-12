from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)


def test_config_get_returns_dict():
    resp = client.get("/api/config")
    assert resp.status_code == 200
    body = resp.json()
    assert "backendUrl" in body
    assert "translatorProvider" in body


def test_config_post_partial_update_persists(tmp_path, monkeypatch):
    monkeypatch.setenv("USERPROFILE", str(tmp_path))
    monkeypatch.setenv("HOME", str(tmp_path))

    resp = client.post("/api/config", json={"geminiApiKey": "new-key"})
    assert resp.status_code == 200
    body = resp.json()
    # POST returns the full masked config (same shape as GET) so the frontend
    # can update its in-memory copy in one round-trip.
    assert body["geminiApiKey"] == "***"
    assert "backendUrl" in body
    assert "translatorProvider" in body

    # Verify it persisted (direct file inspection — GET masks secret keys)
    import json as _json
    cfg_path = tmp_path / ".yt_subtitle_tool" / "config.json"
    stored = _json.loads(cfg_path.read_text(encoding="utf-8"))
    assert stored["gemini_api_key"] == "new-key"


def test_config_get_masks_secret_keys(tmp_path, monkeypatch):
    """API keys must not be returned in plaintext from GET /api/config."""
    monkeypatch.setenv("USERPROFILE", str(tmp_path))
    monkeypatch.setenv("HOME", str(tmp_path))

    # Set a real key first
    client.post("/api/config", json={"geminiApiKey": "AIza-real-secret-key"})

    body = client.get("/api/config").json()
    assert body["geminiApiKey"] == "***"
    assert body["localOpenaiApiKey"] == ""   # empty stays empty (not masked)
    assert body["openaiApiKey"] == ""

    # POSTing the mask back should NOT clobber the stored real key
    client.post("/api/config", json={"geminiApiKey": "***"})
    # Direct file inspection: the stored value should still be the real key
    import json as _json
    cfg_path = tmp_path / ".yt_subtitle_tool" / "config.json"
    stored = _json.loads(cfg_path.read_text(encoding="utf-8"))
    assert stored["gemini_api_key"] == "AIza-real-secret-key"


def test_config_reset_restores_defaults(tmp_path, monkeypatch):
    # Point config at a temp dir so we don't clobber the real one.
    import core.config as cfgmod
    monkeypatch.setattr(cfgmod, "config_dir", lambda: tmp_path)

    # Make the saved config non-default.
    client.post("/api/config", json={"defaultTargetLang": "fr", "geminiApiKey": "sekret"})
    assert client.get("/api/config").json()["defaultTargetLang"] == "fr"

    # Reset.
    body = client.post("/api/config/reset").json()

    from dataclasses import asdict
    defaults = asdict(cfgmod.AppConfig())
    assert body["defaultTargetLang"] == defaults["default_target_lang"]
    # Secrets are masked in the response, but a default key is empty → not masked.
    assert body["geminiApiKey"] == ""
    # And it's persisted.
    assert client.get("/api/config").json()["defaultTargetLang"] == defaults["default_target_lang"]
