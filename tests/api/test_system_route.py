"""Tests for GET /api/system — OS / arch / GPU report."""
from __future__ import annotations

from unittest.mock import patch

from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


def test_system_route_exists_and_returns_shape():
    """GET /api/system responds 200 with the expected top-level keys."""
    resp = client.get("/api/system")
    assert resp.status_code == 200
    body = resp.json()
    assert "os" in body
    assert "arch" in body
    assert "gpu" in body
    assert body["os"] in {"macos", "windows", "linux"}
    assert body["arch"] in {"arm64", "x86_64"}
    gpu = body["gpu"]
    assert "vendor" in gpu
    assert "name" in gpu       # str or null
    assert "cudaAvailable" in gpu
    assert "mpsAvailable" in gpu
    assert gpu["vendor"] in {"apple", "nvidia", "amd", "intel", "none"}
    assert isinstance(gpu["cudaAvailable"], bool)
    assert isinstance(gpu["mpsAvailable"], bool)


def test_system_route_never_crashes_on_bad_gpu(monkeypatch):
    """Even if torch or subprocess explodes, the route must return 200."""
    import core.system_info as si

    def boom():
        raise RuntimeError("simulated GPU explosion")

    monkeypatch.setattr(si, "_gpu_info", boom)
    resp = client.get("/api/system")
    assert resp.status_code == 200
    body = resp.json()
    # Fallback: vendor is "none"
    assert body["gpu"]["vendor"] == "none"
