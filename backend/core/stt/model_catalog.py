from __future__ import annotations

import importlib.util
import os
from collections.abc import Iterator
from pathlib import Path

from core.dependency_manager import MODEL_SIZES_MB, check_whisper_model

MODEL_VARIETIES = ["tiny", "base", "small", "medium", "turbo", "large-v3"]

MODEL_NOTES = {
    "tiny": "Fastest. Good for quick tests.",
    "base": "Very quick. Better than Tiny.",
    "small": "Light daily option. CPU friendly.",
    "medium": "More accurate. Slower on CPU.",
    "turbo": "Recommended default. Strong speed and quality balance.",
    "large-v3": "Best quality. Slowest and largest.",
}

IMPLEMENTED_ENGINES = {"openai-whisper", "faster-whisper", "mlx-whisper"}


def engine_cache_root() -> Path:
    base = os.environ.get("YT_SUBTITLE_ENGINE_CACHE")
    if base:
        return Path(base)
    return Path.home() / ".yt_subtitle_tool" / "stt-models"


def engine_model_dir(engine: str, model: str) -> Path:
    return engine_cache_root() / engine / model


def model_variants() -> list[dict]:
    return [
        {
            "name": name,
            "sizeMb": MODEL_SIZES_MB[name],
            "note": MODEL_NOTES[name],
        }
        for name in MODEL_VARIETIES
    ]


def engine_model_state(engine: str) -> dict[str, bool]:
    if engine == "openai-whisper":
        return {name: check_whisper_model(name) for name in MODEL_VARIETIES}
    if engine in {"faster-whisper", "mlx-whisper"}:
        return {name: engine_model_dir(engine, name).is_dir() for name in MODEL_VARIETIES}
    raise ValueError(f"unknown engine: {engine!r}")


def engine_models(engine: str) -> list[dict]:
    state = engine_model_state(engine)
    return [
        {
            "name": name,
            "sizeMb": MODEL_SIZES_MB[name],
            "downloaded": state[name],
        }
        for name in MODEL_VARIETIES
    ]


def model_hf_repo(engine: str, model: str) -> str:
    if model not in MODEL_VARIETIES:
        raise ValueError(f"unknown model: {model!r}")
    if engine == "faster-whisper":
        return f"Systran/faster-whisper-{model}"
    if engine == "mlx-whisper":
        return f"mlx-community/whisper-{model}"
    raise ValueError(f"engine {engine!r} does not use Hugging Face model repos")


def download_engine_model_generator(
    engine: str,
    model: str,
) -> Iterator[tuple[int, int, float, Path]]:
    if engine == "openai-whisper":
        from core.dependency_manager import download_whisper_model_generator

        for downloaded, total, speed in download_whisper_model_generator(model):
            yield downloaded, total, speed, Path("")
        return

    if engine not in {"faster-whisper", "mlx-whisper"}:
        raise ValueError(f"unknown engine: {engine!r}")

    target = engine_model_dir(engine, model)
    target.parent.mkdir(parents=True, exist_ok=True)
    repo = model_hf_repo(engine, model)

    from huggingface_hub import snapshot_download

    snapshot_download(repo_id=repo, local_dir=str(target), local_dir_use_symlinks=False)
    total = MODEL_SIZES_MB[model] * 1024 * 1024
    yield total, total, 0.0, target


def engine_package_available(import_name: str) -> bool:
    return importlib.util.find_spec(import_name) is not None
