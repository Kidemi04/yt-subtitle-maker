from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)


def test_version_endpoint_returns_capabilities():
    resp = client.get("/api/version")
    assert resp.status_code == 200
    body = resp.json()
    assert "version" in body
    assert "mpvAvailable" in body
    assert "cudaAvailable" in body
    assert "installedSttEngines" in body
    assert "openai-whisper" in body["installedSttEngines"]
