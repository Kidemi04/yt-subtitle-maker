import os
import sys
import requests
import shutil
from typing import Callable, Optional

# Constants for Whisper models
# Sourced from openai-whisper source code
MODELS_URLS = {
    "tiny": "https://openaipublic.azureedge.net/main/whisper/models/65147644a518d12f04e32d6f3b26facc3f8dd46e5390956a9424a650c0ce22b9/tiny.pt",
    "base": "https://openaipublic.azureedge.net/main/whisper/models/ed3a0b6b1c0edf879ad9b11b1af5a30983d3d18dec85f1ac08908445ce230c38/base.pt",
    "small": "https://openaipublic.azureedge.net/main/whisper/models/9ecf779972d90ba4920f711861e6c2756d59539df9087c528944054a4305c925/small.pt",
    "medium": "https://openaipublic.azureedge.net/main/whisper/models/345ae4da62f9b3d59415adc60127b97dc8de4ea6d666816184264c4e894efff9/medium.pt",
    "large-v3": "https://openaipublic.azureedge.net/main/whisper/models/e5b1a55b89c1367dacf97e3e19bfd829a01530b52028048e7866ec630b540183/large-v3.pt",
    "turbo": "https://openaipublic.azureedge.net/main/whisper/models/aff26ae408abcba5fbf8813c21e62b0941638c5f6eebfb145be0c9839262a19a/large-v3-turbo.pt",
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
    
    if not os.path.exists(file_path):
        return False
        
    # Optional: Check file size if we wanted to be robust, but existence is usually enough
    return True

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
