"""Tests for GET /api/engines — engine descriptor list."""
from __future__ import annotations

from unittest.mock import patch

from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


def test_engines_returns_list():
    resp = client.get("/api/engines")
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body, list)
    assert len(body) >= 4  # openai-whisper + 3 planned stubs


def test_openai_whisper_descriptor_shape():
    with patch("core.engines.check_whisper_model") as mock_check:
        # Simulate tiny + turbo downloaded, rest not.
        mock_check.side_effect = lambda name: name in {"tiny", "turbo"}
        resp = client.get("/api/engines")
    assert resp.status_code == 200
    descs = resp.json()
    ow = next(d for d in descs if d["id"] == "openai-whisper")

    assert ow["available"] is True
    assert ow["packageSizeMb"] is None
    assert isinstance(ow["requirements"], dict)
    assert "platform" in ow["requirements"]
    assert "accelerators" in ow["requirements"]

    # models list: 6 entries, each with name/sizeMb/downloaded
    assert len(ow["models"]) == 6
    model_names = {m["name"] for m in ow["models"]}
    assert model_names == {"tiny", "base", "small", "medium", "large-v3", "turbo"}

    for m in ow["models"]:
        assert isinstance(m["sizeMb"], int)
        assert m["sizeMb"] > 0
        assert isinstance(m["downloaded"], bool)

    # tiny and turbo are downloaded per our mock
    tiny = next(m for m in ow["models"] if m["name"] == "tiny")
    turbo = next(m for m in ow["models"] if m["name"] == "turbo")
    base = next(m for m in ow["models"] if m["name"] == "base")
    assert tiny["downloaded"] is True
    assert turbo["downloaded"] is True
    assert base["downloaded"] is False

    # tunables is empty list (no engine-specific tunables for openai-whisper)
    assert ow["tunables"] == []


def test_planned_stubs_present_and_unavailable():
    resp = client.get("/api/engines")
    descs = resp.json()
    planned_ids = {"faster-whisper", "whisperx", "insanely-fast-whisper"}
    found = {d["id"] for d in descs if d["id"] in planned_ids}
    assert found == planned_ids

    for d in descs:
        if d["id"] in planned_ids:
            assert d["available"] is False
            assert d["models"] == []
            assert isinstance(d["packageSizeMb"], int)
            assert d["packageSizeMb"] > 0
            assert isinstance(d.get("note"), str)


def test_model_sizes_match_known_values():
    """Verify the sizeMb values for the openai-whisper models match spec."""
    resp = client.get("/api/engines")
    ow = next(d for d in resp.json() if d["id"] == "openai-whisper")
    sizes = {m["name"]: m["sizeMb"] for m in ow["models"]}
    assert sizes["tiny"] == 75
    assert sizes["base"] == 145
    assert sizes["small"] == 484
    assert sizes["medium"] == 1536
    assert sizes["large-v3"] == 3093
    assert sizes["turbo"] == 1624
