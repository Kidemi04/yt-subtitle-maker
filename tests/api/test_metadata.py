from unittest.mock import patch
from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)


@patch("api.routes.metadata.fetch_video_metadata")
def test_metadata_endpoint_returns_canonical_shape(mock_fetch):
    mock_fetch.return_value = {
        "title": "Test Title",
        "thumbnail_url": "https://i.ytimg.com/vi/abc/hqdefault.jpg",
        "duration": 600,
    }
    resp = client.post("/api/metadata", json={"url": "https://www.youtube.com/watch?v=abcDEFghIJK"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["videoId"] == "abcDEFghIJK"
    assert body["titleOriginal"] == "Test Title"
    assert body["durationSeconds"] == 600
