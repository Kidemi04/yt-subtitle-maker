"""Tests for POST /api/system/open-config-dir and /api/system/test-playback."""
from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


def test_open_config_dir_calls_platform_opener(monkeypatch, tmp_path: Path):
    """The route invokes the OS-appropriate file-manager command on `config_dir()`."""
    import core.config as cfgmod

    monkeypatch.setattr(cfgmod, "config_dir", lambda: tmp_path)

    completed = MagicMock(returncode=0)
    with patch("api.routes.system_ops.subprocess.run", return_value=completed) as run:
        resp = client.post("/api/system/open-config-dir")
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}
    # The first arg to subprocess.run is the command list; the last element is the path.
    args, _kwargs = run.call_args
    cmd = args[0]
    assert str(tmp_path) in cmd
    # Platform-appropriate opener
    if sys.platform == "darwin":
        assert cmd[0] == "open"
    elif sys.platform.startswith("win"):
        assert cmd[0].lower() in ("explorer", "explorer.exe")
    else:
        assert cmd[0] == "xdg-open"


def test_open_config_dir_reports_failure(monkeypatch, tmp_path: Path):
    import core.config as cfgmod

    monkeypatch.setattr(cfgmod, "config_dir", lambda: tmp_path)

    with patch(
        "api.routes.system_ops.subprocess.run",
        side_effect=FileNotFoundError("no opener"),
    ):
        resp = client.post("/api/system/open-config-dir")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert "no opener" in body["error"]


def test_test_playback_launches_mpv_with_clip(monkeypatch):
    """Spawns mpv with the bundled clip and --sub-* args derived from config."""
    import core.config as cfgmod
    from core.config import AppConfig

    # A config with a couple of non-default subtitle styles set.
    cfg = AppConfig()
    cfg.sub_font = "Inter"
    cfg.sub_font_size = 48
    cfg.sub_bold = True
    monkeypatch.setattr(cfgmod, "load_config", lambda: cfg)

    proc = MagicMock(pid=12345)
    with patch("api.routes.system_ops.subprocess.Popen", return_value=proc) as popen, \
         patch("api.routes.system_ops.shutil.which", return_value="/usr/local/bin/mpv"):
        resp = client.post("/api/system/test-playback")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["pid"] == 12345
    args, _kwargs = popen.call_args
    argv = args[0]
    # First element is the mpv binary; the clip path is somewhere in the list;
    # at least one --sub-* arg was passed for the non-default fields.
    assert argv[0] == "/usr/local/bin/mpv"
    assert any(a.endswith("test_clip.mp4") for a in argv)
    joined = " ".join(argv)
    assert "--sub-font=Inter" in argv
    assert "--sub-font-size=48" in argv
    assert "--sub-bold=yes" in argv


def test_test_playback_uses_cfg_mpv_path(monkeypatch):
    """If cfg.mpv_path is set, use it instead of `which mpv`."""
    import core.config as cfgmod
    from core.config import AppConfig

    cfg = AppConfig()
    cfg.mpv_path = "/opt/mpv/bin/mpv"
    monkeypatch.setattr(cfgmod, "load_config", lambda: cfg)

    proc = MagicMock(pid=1)
    with patch("api.routes.system_ops.subprocess.Popen", return_value=proc) as popen, \
         patch("api.routes.system_ops.shutil.which", return_value="/should/not/be/used"):
        resp = client.post("/api/system/test-playback")
    assert resp.status_code == 200
    argv = popen.call_args[0][0]
    assert argv[0] == "/opt/mpv/bin/mpv"


def test_test_playback_no_mpv_found(monkeypatch):
    import core.config as cfgmod
    from core.config import AppConfig

    monkeypatch.setattr(cfgmod, "load_config", lambda: AppConfig())
    with patch("api.routes.system_ops.shutil.which", return_value=None):
        resp = client.post("/api/system/test-playback")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert "mpv" in body["error"].lower()


def test_test_playback_missing_clip(monkeypatch, tmp_path):
    import api.routes.system_ops as so
    import core.config as cfgmod
    from core.config import AppConfig

    monkeypatch.setattr(cfgmod, "load_config", lambda: AppConfig())
    # Point the route at a clip path that doesn't exist.
    monkeypatch.setattr(so, "_clip_path", lambda: tmp_path / "missing.mp4")
    with patch("api.routes.system_ops.shutil.which", return_value="/usr/bin/mpv"):
        resp = client.post("/api/system/test-playback")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert "clip" in body["error"].lower()
