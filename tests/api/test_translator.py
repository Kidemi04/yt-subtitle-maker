from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)


@patch("api.routes.translator.get_translator")
def test_translator_test_endpoint_success(mock_get):
    mock_provider = MagicMock()
    mock_provider.is_available.return_value = True
    mock_get.return_value = mock_provider

    resp = client.post("/api/translator/test", json={
        "provider": "local_openai",
        "baseUrl": "http://127.0.0.1:1234/v1",
        "model": "gemma-3-27b-it",
    })
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}


@patch("api.routes.translator.get_translator")
def test_translator_test_endpoint_unreachable(mock_get):
    mock_provider = MagicMock()
    mock_provider.is_available.return_value = False
    mock_get.return_value = mock_provider

    resp = client.post("/api/translator/test", json={
        "provider": "local_openai", "model": "gemma-3-27b-it",
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert "error" in body


@patch("api.routes.translator.get_translator")
def test_list_models_endpoint(mock_get):
    mock_provider = MagicMock()
    mock_provider.list_models.return_value = ["gemma-3-27b-it", "qwen2.5-7b"]
    mock_get.return_value = mock_provider

    resp = client.post("/api/translator/list-models", json={
        "provider": "local_openai",
        "baseUrl": "http://127.0.0.1:1234/v1",
    })
    assert resp.status_code == 200
    assert resp.json() == {"ok": True, "models": ["gemma-3-27b-it", "qwen2.5-7b"]}
