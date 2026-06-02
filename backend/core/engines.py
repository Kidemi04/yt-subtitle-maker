"""Engine descriptor builder for GET /api/engines."""
from __future__ import annotations

from core.dependency_manager import (
    MODEL_SIZES_MB,
    MODELS_URLS,
    STT_ENGINE_ADDONS,
    check_stt_engine_addon,
    check_whisper_model,
)

_WHISPER_MODEL_VARIANTS: list[dict] = [
    {"name": "tiny", "sizeMb": MODEL_SIZES_MB["tiny"], "note": "Fastest, rough drafts"},
    {"name": "base", "sizeMb": MODEL_SIZES_MB["base"], "note": "Small upgrade from tiny"},
    {"name": "small", "sizeMb": MODEL_SIZES_MB["small"], "note": "Everyday balance"},
    {"name": "medium", "sizeMb": MODEL_SIZES_MB["medium"], "note": "Higher accuracy, slower"},
    {"name": "large-v3", "sizeMb": MODEL_SIZES_MB["large-v3"], "note": "Best accuracy"},
    {"name": "turbo", "sizeMb": MODEL_SIZES_MB["turbo"], "note": "Fast large-v3-family option"},
]

_GGML_MODEL_VARIANTS: list[dict] = [
    {"name": "tiny", "sizeMb": MODEL_SIZES_MB["tiny"], "note": "GGML/GGUF equivalent"},
    {"name": "base", "sizeMb": MODEL_SIZES_MB["base"], "note": "GGML/GGUF equivalent"},
    {"name": "small", "sizeMb": MODEL_SIZES_MB["small"], "note": "GGML/GGUF equivalent"},
    {"name": "medium", "sizeMb": MODEL_SIZES_MB["medium"], "note": "GGML/GGUF equivalent"},
    {"name": "large-v3", "sizeMb": MODEL_SIZES_MB["large-v3"], "note": "GGML/GGUF equivalent"},
]

_ADDON_STUBS: list[dict] = [
    {
        "id": "faster-whisper",
        "label": "Faster Whisper",
        "available": False,
        "installable": True,
        "packageName": STT_ENGINE_ADDONS["faster-whisper"]["package"],
        "packageSizeMb": 50,
        "requirements": {
            "platform": ["macos", "windows", "linux"],
            "accelerators": ["cpu", "nvidia_cuda"],
        },
        "models": [],
        "modelVariants": _WHISPER_MODEL_VARIANTS,
        "tunables": [],
        "performance": {
            "speed": "Fast on CPU, very fast on CUDA",
            "bestFor": "Long videos, batch jobs, everyday local transcription",
            "tradeoff": "Needs CTranslate2 runtime; adapter work is still pending here",
            "hardware": "CPU works. NVIDIA CUDA gives the biggest speed-up.",
        },
        "note": "Add-on package available. Transcription adapter is still pending.",
    },
    {
        "id": "whisperx",
        "label": "WhisperX",
        "available": False,
        "installable": True,
        "packageName": STT_ENGINE_ADDONS["whisperx"]["package"],
        "packageSizeMb": 200,
        "requirements": {
            "platform": ["macos", "linux"],
            "accelerators": ["cpu", "nvidia_cuda"],
        },
        "models": [],
        "modelVariants": _WHISPER_MODEL_VARIANTS,
        "tunables": [],
        "performance": {
            "speed": "Medium for raw transcription, slower with alignment",
            "bestFor": "Word-level timestamps, alignment, diarisation workflows",
            "tradeoff": "Heavier install and more moving parts than plain Whisper",
            "hardware": "Best on NVIDIA CUDA. CPU works for smaller jobs.",
        },
        "note": "Add-on package available. Adapter for word-level timestamps is still pending.",
    },
    {
        "id": "insanely-fast-whisper",
        "label": "Insanely Fast Whisper",
        "available": False,
        "installable": True,
        "packageName": STT_ENGINE_ADDONS["insanely-fast-whisper"]["package"],
        "packageSizeMb": 300,
        "requirements": {
            "platform": ["macos"],
            "accelerators": ["apple_mps"],
        },
        "models": [],
        "modelVariants": _WHISPER_MODEL_VARIANTS,
        "tunables": [],
        "performance": {
            "speed": "Very fast on Apple Silicon",
            "bestFor": "Mac M-series users who want maximum local speed",
            "tradeoff": "Narrow platform target; not useful on this Windows machine",
            "hardware": "Built for Apple MPS on macOS arm64.",
        },
        "note": "Add-on package available. Apple Silicon adapter is still pending.",
    },
    {
        "id": "whisper-cpp",
        "label": "Whisper.cpp",
        "available": False,
        "installable": True,
        "packageName": STT_ENGINE_ADDONS["whisper-cpp"]["package"],
        "packageSizeMb": 40,
        "requirements": {
            "platform": ["macos", "windows", "linux"],
            "accelerators": ["cpu"],
        },
        "models": [],
        "modelVariants": _GGML_MODEL_VARIANTS,
        "tunables": [],
        "performance": {
            "speed": "Good CPU speed, low memory",
            "bestFor": "Portable local runs, older laptops, offline CPU workflows",
            "tradeoff": "Uses GGML/GGUF-style model assets; adapter and model mapping are pending",
            "hardware": "CPU-first. Native builds can use more backends, but this app has not wired them yet.",
        },
        "note": "Add-on package available. Lightweight CPU adapter is still pending.",
    },
    {
        "id": "mlx-whisper",
        "label": "MLX Whisper",
        "available": False,
        "installable": True,
        "packageName": STT_ENGINE_ADDONS["mlx-whisper"]["package"],
        "packageSizeMb": 80,
        "requirements": {
            "platform": ["macos"],
            "accelerators": ["apple_mps"],
        },
        "models": [],
        "modelVariants": _WHISPER_MODEL_VARIANTS,
        "tunables": [],
        "performance": {
            "speed": "Fast on Apple Silicon",
            "bestFor": "Mac M-series users who prefer Apple's MLX stack",
            "tradeoff": "macOS arm64 only; not useful on Windows or Linux",
            "hardware": "Apple Silicon acceleration through MLX.",
        },
        "note": "Add-on package available. MLX adapter is still pending.",
    },
    {
        "id": "stable-ts",
        "label": "Stable-ts",
        "available": False,
        "installable": True,
        "packageName": STT_ENGINE_ADDONS["stable-ts"]["package"],
        "packageSizeMb": 90,
        "requirements": {
            "platform": ["macos", "windows", "linux"],
            "accelerators": ["cpu", "nvidia_cuda"],
        },
        "models": [],
        "modelVariants": _WHISPER_MODEL_VARIANTS,
        "tunables": [],
        "performance": {
            "speed": "Baseline to medium, depends on Whisper backend",
            "bestFor": "Cleaner timestamps, fewer hallucinated silence segments, subtitle timing polish",
            "tradeoff": "More processing choices and slower setup than plain OpenAI Whisper",
            "hardware": "CPU works. CUDA can help when the underlying Whisper backend supports it.",
        },
        "note": "Add-on package available. Stable timestamp adapter is still pending.",
    },
]


def _openai_whisper_descriptor() -> dict:
    models = [
        {
            "name": name,
            "sizeMb": MODEL_SIZES_MB[name],
            "downloaded": check_whisper_model(name),
        }
        for name in MODELS_URLS
    ]
    return {
        "id": "openai-whisper",
        "label": "OpenAI Whisper",
        "available": True,
        "installable": False,
        "installed": True,
        "packageName": "openai-whisper",
        "packageSizeMb": None,
        "requirements": {
            "platform": ["macos", "windows", "linux"],
            "accelerators": ["cpu"],
        },
        "models": models,
        "modelVariants": _WHISPER_MODEL_VARIANTS,
        "tunables": [],
        "performance": {
            "speed": "Baseline speed",
            "bestFor": "Reliable default, broad compatibility, simple setup",
            "tradeoff": "Usually slower than optimized add-ons on the same hardware",
            "hardware": "CPU everywhere. GPU depends on the local PyTorch install.",
        },
        "note": None,
    }


def build_engine_descriptors() -> list[dict]:
    stubs: list[dict] = []
    for stub in _ADDON_STUBS:
        item = dict(stub)
        item["installed"] = check_stt_engine_addon(stub["id"])
        stubs.append(item)
    return [_openai_whisper_descriptor(), *stubs]


PLANNED_ENGINE_IDS: frozenset[str] = frozenset(s["id"] for s in _ADDON_STUBS)
