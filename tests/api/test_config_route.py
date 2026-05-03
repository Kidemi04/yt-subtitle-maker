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
    assert resp.json() == {"ok": True}

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
