from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)


def test_process_rejects_empty_language():
    resp = client.post("/api/process", json={
        "url": "https://youtu.be/x",
        "sttSource": "whisper",
        "whisperModel": "turbo",
        "whisperDevice": "auto",
        "vadEnabled": True,
        "sourceLang": "",   # invalid — "auto" is accepted, blank is not
        "enableTranslation": False,
    })
    assert resp.status_code == 422
