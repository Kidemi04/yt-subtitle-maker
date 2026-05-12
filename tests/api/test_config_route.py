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


def test_config_response_includes_effective_defaults(tmp_path, monkeypatch):
    import core.config as cfgmod
    monkeypatch.setattr(cfgmod, "config_dir", lambda: tmp_path)

    body = client.get("/api/config").json()
    assert "_defaults" in body
    d = body["_defaults"]
    # camelCase keys, same shape as the config:
    assert d["defaultWhisperModel"] == "turbo"
    assert d["backendUrl"] == "http://127.0.0.1:8000"
    assert d["geminiApiKey"] == ""          # default secret is empty => not masked
    assert d["subFontSize"] == 0
    # path fields are RESOLVED, not blank:
    assert d["outputDir"] and d["outputDir"].endswith("output")
    assert d["downloadDir"] and d["downloadDir"].endswith("downloads")
    assert d["whisperCacheDir"] and d["whisperCacheDir"].endswith("models")
    # The POSTs carry _defaults too, and _defaults is always the factory
    # defaults — never the (now-dirty) live config:
    dirty = client.post("/api/config", json={"defaultTargetLang": "fr"}).json()
    assert "_defaults" in dirty
    assert dirty["defaultTargetLang"] == "fr"                 # live config changed
    assert dirty["_defaults"]["defaultTargetLang"] == "zh-CN" # _defaults did not
    reset = client.post("/api/config/reset").json()
    assert "_defaults" in reset
    assert reset["defaultTargetLang"] == "zh-CN"
