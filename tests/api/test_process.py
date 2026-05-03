from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)


def test_process_rejects_auto_language():
    resp = client.post("/api/process", json={
        "url": "https://youtu.be/x",
        "sttSource": "whisper",
        "whisperModel": "turbo",
        "whisperDevice": "auto",
        "vadEnabled": True,
        "sourceLang": "auto",   # invalid
        "enableTranslation": False,
    })
    assert resp.status_code == 422
