"""System operation endpoints: open config folder, test mpv playback.

Lives next to `system.py` (which serves the GET /api/system info report).
These are mutating side-effect endpoints — separate file so the info route
stays trivially cacheable.
"""
from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

from fastapi import APIRouter

from api.routes.library import _resolve_sub_font
from core import config as cfgmod

router = APIRouter(prefix="/api/system", tags=["system_ops"])


# ─── Open config folder ──────────────────────────────────────────────────────

def _platform_opener(path: Path) -> list[str]:
    if sys.platform == "darwin":
        return ["open", str(path)]
    if sys.platform.startswith("win"):
        return ["explorer", str(path)]
    return ["xdg-open", str(path)]


@router.post("/open-config-dir")
def open_config_dir() -> dict:
    path = cfgmod.config_dir()
    path.mkdir(parents=True, exist_ok=True)
    try:
        subprocess.run(_platform_opener(path), check=False)
        return {"ok": True}
    except Exception as e:  # FileNotFoundError, PermissionError, …
        return {"ok": False, "error": str(e)}


# ─── Test mpv playback with current subtitle style ───────────────────────────

def _clip_path() -> Path:
    """Resolve the bundled test clip in dev and packaged builds.

    Dev: `<repo>/backend/packaging/test_clip.mp4`.
    Packaged (PyInstaller one-dir): PyInstaller copies our `datas=[(…, "packaging")]`
    entry to `<bundle>/_internal/packaging/test_clip.mp4`; this module ends up at
    `<bundle>/_internal/api/routes/system_ops.py`, so `__file__`/../../../packaging
    resolves to the same dir in both cases.
    """
    return (Path(__file__).resolve().parent.parent.parent / "packaging" / "test_clip.mp4")


def _mpv_args_from_cfg(cfg: Any) -> list[str]:
    """Build --sub-* args, skipping empty/default sentinels per core/config.py."""
    args: list[str] = []
    font = _resolve_sub_font(cfg, None)  # No lang context for test playback
    if font:
        args.append(f"--sub-font={font}")
    if getattr(cfg, "sub_font_size", 0):
        args.append(f"--sub-font-size={cfg.sub_font_size}")
    if getattr(cfg, "sub_color", ""):
        args.append(f"--sub-color={cfg.sub_color}")
    if getattr(cfg, "sub_border_color", ""):
        args.append(f"--sub-border-color={cfg.sub_border_color}")
    bs = getattr(cfg, "sub_border_size", -1)
    if bs is not None and bs >= 0:
        args.append(f"--sub-border-size={bs}")
    if getattr(cfg, "sub_back_color", ""):
        args.append(f"--sub-back-color={cfg.sub_back_color}")
    if getattr(cfg, "sub_bold", False):
        args.append("--sub-bold=yes")
    if getattr(cfg, "sub_margin_y", 0):
        args.append(f"--sub-margin-y={cfg.sub_margin_y}")
    return args


@router.post("/test-playback")
def test_playback() -> dict:
    cfg = cfgmod.load_config()
    mpv = (getattr(cfg, "mpv_path", "") or "").strip() or shutil.which("mpv")
    if not mpv:
        return {
            "ok": False,
            "error": (
                "mpv not found. Install mpv (e.g. `brew install mpv`) or set "
                "Settings → Subtitles → MPV executable path."
            ),
        }
    clip = _clip_path()
    if not clip.exists():
        return {"ok": False, "error": f"Bundled test clip is missing: {clip}"}
    argv = [mpv, str(clip), *_mpv_args_from_cfg(cfg)]
    try:
        proc = subprocess.Popen(argv)  # fire-and-forget — user closes mpv themselves
        return {"ok": True, "pid": proc.pid}
    except Exception as e:
        return {"ok": False, "error": str(e)}
