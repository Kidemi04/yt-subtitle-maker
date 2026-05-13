import os
import shutil
import sys

import requests

# Whisper model URLs.
#
# We deliberately read these from `whisper._MODELS` (the installed package)
# instead of hardcoding them. OpenAI periodically rotates the checkpoint
# hashes (the path segment after `/models/`) — when that happens, hardcoded
# URLs 404 with "The specified blob does not exist" and downloads break.
# `whisper._MODELS` is the canonical source: the same dict whisper itself
# uses to download/load models, so it always matches whatever whisper
# version is installed. Pinning to `whisper._MODELS` makes us automatically
# benefit from upstream URL updates whenever the whisper package is bumped.
#
# `whisper._MODELS` is technically a private symbol but has been stable for
# years; if it ever moves, the import below will fail loudly at startup and
# the fix is one line.
_MODEL_IDS = ["tiny", "base", "small", "medium", "large-v3", "turbo"]


def _load_models_urls() -> dict[str, str]:
    try:
        from whisper import _MODELS as _WHISPER_MODELS
    except ImportError as exc:
        raise ImportError(
            "Couldn't import whisper._MODELS — is the openai-whisper package "
            "installed in this venv?"
        ) from exc
    out: dict[str, str] = {}
    for model_id in _MODEL_IDS:
        if model_id not in _WHISPER_MODELS:
            # Should never happen with a current openai-whisper; if it does,
            # skip this id so the rest still work.
            continue
        out[model_id] = _WHISPER_MODELS[model_id]
    return out


MODELS_URLS = _load_models_urls()

# Published checkpoint sizes in MB (openai-whisper README, 2024).
# Used by GET /api/engines to populate the model catalog's sizeMb field.
MODEL_SIZES_MB: dict[str, int] = {
    "tiny": 75,
    "base": 145,
    "small": 484,
    "medium": 1536,
    "large-v3": 3093,
    "turbo": 1624,
}

def get_whisper_cache_dir():
    """Returns the directory where Whisper stores models (local 'models' folder)."""
    if getattr(sys, 'frozen', False):
        # Running as compiled exe
        # sys.executable is in release/backend/backend_api.exe
        # We want release/models (which is ../models relative to exe)
        base_dir = os.path.dirname(os.path.dirname(sys.executable))
    else:
        # Running as script
        # Get the project root (2 levels up from core/dependency_manager.py)
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    return os.path.join(base_dir, "models")

def check_whisper_model(model_name: str) -> bool:
    """Checks if the Whisper model is already downloaded."""
    if model_name not in MODELS_URLS:
        return False # Unknown model, assume not present or handled by whisper internal logic
    
    url = MODELS_URLS[model_name]
    filename = os.path.basename(url)
    cache_dir = get_whisper_cache_dir()
    file_path = os.path.join(cache_dir, filename)
    
    # Optional: Check file size if we wanted to be robust, but existence is usually enough
    return os.path.exists(file_path)

def check_ffmpeg() -> bool:
    """Checks if ffmpeg is available in PATH."""
    return shutil.which("ffmpeg") is not None

def check_mpv() -> bool:
    """Checks if mpv is available in PATH."""
    return shutil.which("mpv") is not None

def download_whisper_model_generator(model_name: str):
    """
    Downloads the Whisper model and yields progress (downloaded, total, speed).
    """
    if model_name not in MODELS_URLS:
        raise ValueError(f"Unknown model name: {model_name}")
        
    url = MODELS_URLS[model_name]
    cache_dir = get_whisper_cache_dir()
    os.makedirs(cache_dir, exist_ok=True)
    
    filename = os.path.basename(url)
    file_path = os.path.join(cache_dir, filename)
    
    print(f"Downloading {model_name} to {file_path}")
    
    import time
    start_time = time.time()
    
    response = requests.get(url, stream=True)
    response.raise_for_status()
    
    total_size = int(response.headers.get('content-length', 0))
    downloaded = 0
    
    with open(file_path, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            if chunk:
                f.write(chunk)
                downloaded += len(chunk)
                
                # Calculate speed
                elapsed = time.time() - start_time
                speed = downloaded / elapsed if elapsed > 0 else 0
                
                yield (downloaded, total_size, speed)
                
    print(f"Download complete: {file_path}")
