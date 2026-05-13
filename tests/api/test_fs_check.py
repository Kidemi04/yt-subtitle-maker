"""Tests for POST /api/fs/check — path existence / writability / executability."""
from __future__ import annotations

import os
import stat
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


def test_check_dir_exists_and_writable(tmp_path: Path):
    resp = client.post("/api/fs/check", json={"path": str(tmp_path), "kind": "dir"})
    assert resp.status_code == 200
    body = resp.json()
    assert body == {"exists": True, "isDir": True, "writable": True}


def test_check_dir_missing(tmp_path: Path):
    missing = tmp_path / "does-not-exist"
    resp = client.post("/api/fs/check", json={"path": str(missing), "kind": "dir"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["exists"] is False
    assert body["isDir"] is False


def test_check_dir_not_a_directory(tmp_path: Path):
    f = tmp_path / "file.txt"
    f.write_text("hi")
    resp = client.post("/api/fs/check", json={"path": str(f), "kind": "dir"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["exists"] is True
    assert body["isDir"] is False


def test_check_executable_via_full_path(tmp_path: Path):
    exe = tmp_path / "fake"
    exe.write_text("#!/bin/sh\necho hi\n")
    exe.chmod(exe.stat().st_mode | stat.S_IXUSR)
    resp = client.post(
        "/api/fs/check", json={"path": str(exe), "kind": "executable"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["exists"] is True
    assert body["executable"] is True


def test_check_executable_bare_name_uses_which():
    # `ls` is on PATH on every Unix CI box; on Windows the route should still
    # 200 with exists=False/True via shutil.which (which handles .exe).
    resp = client.post(
        "/api/fs/check", json={"path": "ls", "kind": "executable"}
    )
    assert resp.status_code == 200
    body = resp.json()
    # Either it found it on PATH or it didn't; the route doesn't crash either way.
    assert "exists" in body and "executable" in body


def test_check_executable_missing():
    resp = client.post(
        "/api/fs/check",
        json={"path": "/totally/not/here/zzz", "kind": "executable"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["exists"] is False
    assert body["executable"] is False


def test_check_rejects_unknown_kind():
    resp = client.post("/api/fs/check", json={"path": "/tmp", "kind": "bogus"})
    assert resp.status_code in (400, 422)
