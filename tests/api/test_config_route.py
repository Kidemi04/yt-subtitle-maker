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

    # Verify it persisted
    resp2 = client.get("/api/config")
    assert resp2.json()["geminiApiKey"] == "new-key"
