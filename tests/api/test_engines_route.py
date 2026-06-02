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
    assert len(body) >= 7  # openai-whisper + planned add-on families


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


def test_engines_expose_implemented_engines_as_selectable():
    resp = client.get("/api/engines")
    assert resp.status_code == 200
    engines = {e["id"]: e for e in resp.json()}

    assert engines["openai-whisper"]["available"] is True
    assert engines["faster-whisper"]["available"] is True
    assert engines["faster-whisper"]["selectable"] is True
    assert engines["mlx-whisper"]["available"] in {True, False}
    assert engines["mlx-whisper"]["selectable"] in {True, False}
    assert engines["insanely-fast-whisper"]["available"] is False
    assert engines["insanely-fast-whisper"]["selectable"] is False


def test_remaining_planned_stubs_are_unavailable():
    resp = client.get("/api/engines")
    descs = resp.json()
    planned_ids = {
        "whisperx",
        "insanely-fast-whisper",
        "whisper-cpp",
        "stable-ts",
    }
    for d in descs:
        if d["id"] in planned_ids:
            assert d["available"] is False
            assert d["selectable"] is False
            assert d["models"] == []
            assert isinstance(d.get("modelVariants"), list)
            assert len(d["modelVariants"]) > 0


def test_whisper_family_addons_expose_model_variants():
    resp = client.get("/api/engines")
    descs = resp.json()
    expected = {"tiny", "base", "small", "medium", "large-v3", "turbo"}

    for engine_id in {"faster-whisper", "whisperx", "insanely-fast-whisper"}:
        desc = next(d for d in descs if d["id"] == engine_id)
        variants = {m["name"] for m in desc["modelVariants"]}
        assert expected.issubset(variants)


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


def test_faster_whisper_descriptor_refreshes_model_state(monkeypatch):
    def fake_models(engine):
        if engine == "faster-whisper":
            return [{"name": "tiny", "sizeMb": 75, "downloaded": True}]
        return []

    monkeypatch.setattr("core.engines.engine_models", fake_models)

    resp = client.get("/api/engines")

    faster = next(d for d in resp.json() if d["id"] == "faster-whisper")
    assert faster["models"] == [{"name": "tiny", "sizeMb": 75, "downloaded": True}]
