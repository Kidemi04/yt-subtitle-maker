"""Engine descriptor builder for GET /api/engines."""
from __future__ import annotations

import platform

from core.dependency_manager import (
    MODEL_SIZES_MB,
    MODELS_URLS,
    STT_ENGINE_ADDONS,
    check_stt_engine_addon,
    check_whisper_model,
)
from core.stt.model_catalog import MODEL_NOTES, engine_models, model_variants

_WHISPER_MODEL_VARIANTS: list[dict] = [
    {"name": name, "sizeMb": MODEL_SIZES_MB[name], "note": MODEL_NOTES[name]}
    for name in ("tiny", "base", "small", "medium", "turbo", "large-v3")
]

_GGML_MODEL_VARIANTS: list[dict] = [
    {"name": "tiny", "sizeMb": MODEL_SIZES_MB["tiny"], "note": "GGML/GGUF equivalent"},
    {"name": "base", "sizeMb": MODEL_SIZES_MB["base"], "note": "GGML/GGUF equivalent"},
    {"name": "small", "sizeMb": MODEL_SIZES_MB["small"], "note": "GGML/GGUF equivalent"},
    {"name": "medium", "sizeMb": MODEL_SIZES_MB["medium"], "note": "GGML/GGUF equivalent"},
    {"name": "large-v3", "sizeMb": MODEL_SIZES_MB["large-v3"], "note": "GGML/GGUF equivalent"},
]

def _system_is_macos_arm64() -> bool:
    return platform.system() == "Darwin" and platform.machine().lower() in {"arm64", "aarch64"}


_ADDON_STUBS: list[dict] = [
    {
        "id": "faster-whisper",
        "label": "Faster Whisper",
        "available": True,
        "selectable": True,
        "installable": True,
        "packageName": STT_ENGINE_ADDONS["faster-whisper"]["package"],
        "packageSizeMb": 50,
        "requirements": {
            "platform": ["macos", "windows", "linux"],
            "accelerators": ["cpu", "nvidia_cuda"],
        },
        "models": [],
        "modelVariants": model_variants(),
        "tunables": [],
        "performance": {
            "speed": "Fast on CPU, very fast on CUDA",
            "bestFor": "Long videos, batch jobs, everyday local transcription",
            "tradeoff": "Needs CTranslate2 runtime and engine-specific model files",
            "hardware": "CPU works. NVIDIA CUDA gives the biggest speed-up.",
        },
        "note": "Optimized local Whisper runtime. Install the package and a model before use.",
    },
    {
        "id": "whisperx",
        "label": "WhisperX",
        "available": False,
        "selectable": False,
        "installable": False,
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
        "selectable": False,
        "installable": False,
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
            "tradeoff": "Narrow platform target; useful only on supported Apple Silicon setups",
            "hardware": "Built for Apple MPS on macOS arm64.",
        },
        "note": "Planned high-throughput engine. Not selectable yet.",
    },
    {
        "id": "whisper-cpp",
        "label": "Whisper.cpp",
        "available": False,
        "selectable": False,
        "installable": False,
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
        "note": "Planned lightweight CPU engine. Not selectable yet.",
    },
    {
        "id": "mlx-whisper",
        "label": "MLX Whisper",
        "available": False,
        "selectable": False,
        "installable": True,
        "packageName": STT_ENGINE_ADDONS["mlx-whisper"]["package"],
        "packageSizeMb": 80,
        "requirements": {
            "platform": ["macos"],
            "accelerators": ["apple_mps"],
        },
        "models": [],
        "modelVariants": model_variants(),
        "tunables": [],
        "performance": {
            "speed": "Fast on Apple Silicon",
            "bestFor": "Mac M-series users who prefer Apple's MLX stack",
            "tradeoff": "macOS arm64 only; not useful on Windows or Linux",
            "hardware": "Apple Silicon acceleration through MLX.",
        },
        "note": "Apple Silicon MLX runtime. Available on macOS arm64.",
    },
    {
        "id": "stable-ts",
        "label": "Stable-ts",
        "available": False,
        "selectable": False,
        "installable": False,
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
        "note": "Planned timestamp-polish engine. Not selectable yet.",
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
        "selectable": True,
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
        if item["id"] == "faster-whisper":
            item["models"] = engine_models("faster-whisper")
            item["modelVariants"] = model_variants()
        elif item["id"] == "mlx-whisper":
            supported = _system_is_macos_arm64()
            item["available"] = supported
            item["selectable"] = supported
            item["models"] = engine_models("mlx-whisper") if supported else []
            item["modelVariants"] = model_variants()
        item["installed"] = check_stt_engine_addon(stub["id"])
        stubs.append(item)
    return [_openai_whisper_descriptor(), *stubs]


PLANNED_ENGINE_IDS: frozenset[str] = frozenset(s["id"] for s in _ADDON_STUBS)
