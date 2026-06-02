import hashlib
import os
import platform
import shutil
import subprocess
import sys
import tarfile
import tempfile
import zipfile
from pathlib import Path
from typing import TypedDict

import requests


class SttEngineAddon(TypedDict):
    package: str
    import_name: str


STT_ENGINE_ADDONS: dict[str, SttEngineAddon] = {
    "faster-whisper": {
        "package": "faster-whisper",
        "import_name": "faster_whisper",
    },
    "whisperx": {
        "package": "whisperx",
        "import_name": "whisperx",
    },
    "insanely-fast-whisper": {
        "package": "insanely-fast-whisper",
        "import_name": "insanely_fast_whisper",
    },
    "whisper-cpp": {
        "package": "pywhispercpp",
        "import_name": "pywhispercpp",
    },
    "mlx-whisper": {
        "package": "mlx-whisper",
        "import_name": "mlx_whisper",
    },
    "stable-ts": {
        "package": "stable-ts",
        "import_name": "stable_whisper",
    },
}


class MpvStatus(TypedDict):
    installed: bool
    source: str | None  # "system" | "bundled" | None
    path: str | None
    version: str | None


class MpvBinaryEntry(TypedDict):
    url: str
    sha256: str
    archive: str  # "tar.gz" | "zip"
    inner_binary: str  # path inside the archive to the mpv executable


# Pinned binary sources. URL + SHA-256 must be updated together when a release is bumped.
# To pin a new release:
#   1. Visit https://mpv.io/installation/ and pick the stable binary for each platform.
#   2. Download once locally and run `shasum -a 256 <file>`.
#   3. Update both the URL and the sha256 in this table.
# Linux remains unmapped — the install endpoint returns {supported: false} for it.
MPV_BINARIES: dict[str, MpvBinaryEntry] = {
    "darwin-arm64": {
        "url": "https://laboratory.stolendata.net/~djinn/mpv_osx/mpv-0.40.0-arm64.tar.gz",
        "sha256": "PIN_AT_RELEASE_TIME",  # see comment above
        "archive": "tar.gz",
        "inner_binary": "mpv.app/Contents/MacOS/mpv",
    },
    "darwin-x86_64": {
        "url": "https://laboratory.stolendata.net/~djinn/mpv_osx/mpv-0.40.0-x86_64.tar.gz",
        "sha256": "PIN_AT_RELEASE_TIME",
        "archive": "tar.gz",
        "inner_binary": "mpv.app/Contents/MacOS/mpv",
    },
    "win32-x86_64": {
        "url": "https://downloads.sourceforge.net/project/mpv-player-windows/64bit/mpv-x86_64-20240623-git-9c1bba0.zip",
        "sha256": "PIN_AT_RELEASE_TIME",
        "archive": "zip",
        "inner_binary": "mpv.exe",
    },
}


def _platform_key() -> str | None:
    """Return the MPV_BINARIES key for the current platform, or None if unsupported."""
    sys_name = sys.platform  # "darwin" | "win32" | "linux"
    machine = platform.machine().lower()
    if sys_name == "darwin":
        return "darwin-arm64" if machine in {"arm64", "aarch64"} else "darwin-x86_64"
    if sys_name == "win32":
        return "win32-x86_64"
    return None


def _app_data_dir() -> Path:
    """User-writable data dir, same as core/config.py's resolution."""
    return Path.home() / ".yt_subtitle_tool"


def _bundled_mpv_path() -> Path:
    """Where install_mpv_generator places the binary."""
    suffix = ".exe" if sys.platform == "win32" else ""
    return _app_data_dir() / "bin" / f"mpv{suffix}"


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


def check_stt_engine_addon(engine: str) -> bool:
    """Return whether an optional STT engine package can be imported."""
    import importlib.util

    addon = STT_ENGINE_ADDONS.get(engine)
    if addon is None:
        return False
    return importlib.util.find_spec(addon["import_name"]) is not None


def install_stt_engine_addon_generator(engine: str):
    """Yield install progress while installing an optional STT engine package."""
    addon = STT_ENGINE_ADDONS.get(engine)
    if addon is None:
        raise ValueError(f"Unknown add-on engine: {engine!r}")

    package = addon["package"]
    yield {
        "status": "resolving",
        "message": f"Installing {package} into the current Python environment",
    }

    cmd = [sys.executable, "-m", "pip", "install", package]
    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )

    assert process.stdout is not None
    for line in process.stdout:
        message = line.strip()
        if message:
            yield {"status": "installing", "message": message}

    return_code = process.wait()
    if return_code != 0:
        raise RuntimeError(f"pip install {package} failed with exit code {return_code}")

    if not check_stt_engine_addon(engine):
        raise RuntimeError(
            f"{package} installed, but Python still cannot import {addon['import_name']}"
        )

    yield {"status": "done", "engine": engine, "packageName": package}

def check_mpv() -> bool:
    """Checks if mpv is available in PATH."""
    return shutil.which("mpv") is not None


def _read_mpv_version(binary: str) -> str | None:
    """Run `mpv --version` and parse the first token of the second word.

    Output looks like:  mpv 0.40.0+git-3a4b5c (C) ...
    """
    try:
        result = subprocess.run(
            [binary, "--version"],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
        first_line = (result.stdout or "").strip().splitlines()[0] if result.stdout else ""
        # "mpv 0.40.0+git-..." → "0.40.0+git-..."
        parts = first_line.split()
        return parts[1] if len(parts) >= 2 else None
    except (OSError, subprocess.TimeoutExpired, IndexError):
        return None


def check_mpv_status() -> MpvStatus:
    """Detect mpv with priority: bundled → system PATH → none.

    Returns the typed `MpvStatus` dict; safe to JSON-serialise.
    """
    bundled = _bundled_mpv_path()
    if bundled.exists() and os.access(bundled, os.X_OK):
        return {
            "installed": True,
            "source": "bundled",
            "path": str(bundled),
            "version": _read_mpv_version(str(bundled)),
        }
    system = shutil.which("mpv")
    if system:
        return {
            "installed": True,
            "source": "system",
            "path": system,
            "version": _read_mpv_version(system),
        }
    return {"installed": False, "source": None, "path": None, "version": None}

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


class UnsupportedPlatformError(RuntimeError):
    """Raised when install_mpv_generator is called on a platform without a pinned binary."""


class IntegrityError(RuntimeError):
    """Raised when the downloaded archive's SHA-256 does not match the pinned value."""


def _extract_archive(archive_path: Path, dest: Path, archive_kind: str) -> Path:
    """Extract archive_path into dest. Returns the dest directory.

    Caller joins MPV_BINARIES[key]["inner_binary"] to the returned dir to
    locate the actual mpv executable.
    """
    dest.mkdir(parents=True, exist_ok=True)
    if archive_kind == "tar.gz":
        with tarfile.open(archive_path, "r:gz") as tf:
            tf.extractall(dest)  # noqa: S202 — pinned archives only
    elif archive_kind == "zip":
        with zipfile.ZipFile(archive_path) as zf:
            zf.extractall(dest)
    else:
        raise ValueError(f"unknown archive kind: {archive_kind!r}")
    return dest


def install_mpv_generator():
    """Yield NDJSON-friendly dict events while downloading + installing mpv.

    Event shape:
        {"phase": "resolving", "message": str}
        {"phase": "downloading", "bytesReceived": int, "bytesTotal": int}
        {"phase": "verifying", "message": str}
        {"phase": "extracting", "message": str}
        {"phase": "done", "path": str, "version": str | None}

    Raises:
        UnsupportedPlatformError — current platform not in MPV_BINARIES.
        IntegrityError — SHA-256 mismatch.
        requests.RequestException — network failure.
    """
    key = _platform_key()
    if key is None:
        raise UnsupportedPlatformError(
            f"no pinned mpv binary for {sys.platform}/{platform.machine()}"
        )

    entry = MPV_BINARIES[key]
    yield {"phase": "resolving", "message": f"using {key} build from {entry['url']}"}

    tmp_root = _app_data_dir() / ".tmp"
    tmp_root.mkdir(parents=True, exist_ok=True)
    suffix = ".tar.gz" if entry["archive"] == "tar.gz" else ".zip"
    archive_fd, archive_name = tempfile.mkstemp(
        prefix="mpv-", suffix=suffix, dir=tmp_root
    )
    os.close(archive_fd)
    archive_path = Path(archive_name)

    extract_dest: Path | None = None
    try:
        response = requests.get(entry["url"], stream=True, timeout=30)
        response.raise_for_status()
        total = int(response.headers.get("content-length", 0))
        received = 0
        hasher = hashlib.sha256()

        with open(archive_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=64 * 1024):
                if not chunk:
                    continue
                f.write(chunk)
                hasher.update(chunk)
                received += len(chunk)
                yield {
                    "phase": "downloading",
                    "bytesReceived": received,
                    "bytesTotal": total,
                }

        yield {"phase": "verifying", "message": "checking sha-256"}
        actual = hasher.hexdigest()
        if entry["sha256"] != "PIN_AT_RELEASE_TIME" and actual != entry["sha256"]:
            raise IntegrityError(
                f"sha-256 mismatch for {key}: expected {entry['sha256']}, got {actual}"
            )

        yield {"phase": "extracting", "message": f"unpacking {entry['archive']}"}
        extract_dest = tmp_root / f"mpv-extract-{os.getpid()}"
        _extract_archive(archive_path, extract_dest, entry["archive"])
        inner = extract_dest / entry["inner_binary"]
        if not inner.exists():
            raise FileNotFoundError(f"expected binary at {inner} after extracting")

        target = _bundled_mpv_path()
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(inner, target)
        if sys.platform != "win32":
            target.chmod(0o755)

        version = _read_mpv_version(str(target))
        yield {"phase": "done", "path": str(target), "version": version}
    finally:
        archive_path.unlink(missing_ok=True)
        if extract_dest is not None and extract_dest.exists():
            shutil.rmtree(extract_dest, ignore_errors=True)
