"""Version + capabilities endpoint. Frontend uses this for capability flags."""
from __future__ import annotations

import shutil

import torch
from fastapi import APIRouter

from api.schemas import BackendCapabilities
from core.config import load_config
from core.downloader.js_runtime import detect_js_runtime
from core.stt import list_providers as list_stt

router = APIRouter(prefix="/api", tags=["version"])

VERSION = "2.0.0a1"


def _which_mpv() -> bool:
    cfg = load_config()
    if cfg.mpv_path and shutil.which(cfg.mpv_path):
        return True
    return shutil.which("mpv") is not None


@router.get("/version", response_model=BackendCapabilities)
def get_version() -> BackendCapabilities:
    cfg = load_config()
    return BackendCapabilities(
        mpvAvailable=_which_mpv(),
        cudaAvailable=torch.cuda.is_available(),
        installedSttEngines=list_stt(),
        whisperModelsAvailable=[],   # populated in V1.1 by scanning cache_dir
        version=VERSION,
        jsRuntime=detect_js_runtime(cfg.js_runtime_path),
    )
