"""Engine descriptor builder for GET /api/engines.

Returns the descriptor list the frontend's TranscriptionTab renders.
openai-whisper is the only *available* engine; faster-whisper, whisperx,
and insanely-fast-whisper are static "planned" stubs with available=False.

The descriptor contract (camelCase JSON keys) is defined in:
  docs/superpowers/specs/2026-05-12-settings-tab-production-ready-design.md
  §"Transcription tab — engine-driven"
"""
from __future__ import annotations

from core.dependency_manager import MODEL_SIZES_MB, MODELS_URLS, check_whisper_model

# Static planned stubs — not available yet.
# When a real implementation lands (e.g. faster-whisper), move it to a
# real descriptor built dynamically like openai-whisper's.
_PLANNED_STUBS: list[dict] = [
    {
        "id": "faster-whisper",
        "label": "Faster Whisper",
        "available": False,
        "packageSizeMb": 50,
        "requirements": {
            "platform": ["macos", "windows", "linux"],
            "accelerators": ["cpu", "nvidia_cuda"],
        },
        "models": [],
        "tunables": [],
        "note": "Add-on — planned. Will support compute_type, beam_size, and VAD filter.",
    },
    {
        "id": "whisperx",
        "label": "WhisperX",
        "available": False,
        "packageSizeMb": 200,
        "requirements": {
            "platform": ["macos", "linux"],
            "accelerators": ["cpu", "nvidia_cuda"],
        },
        "models": [],
        "tunables": [],
        "note": "Add-on — planned. Word-level timestamps + speaker diarisation.",
    },
    {
        "id": "insanely-fast-whisper",
        "label": "Insanely Fast Whisper",
        "available": False,
        "packageSizeMb": 300,
        "requirements": {
            "platform": ["macos"],
            "accelerators": ["apple_mps"],
        },
        "models": [],
        "tunables": [],
        "note": "Add-on — planned. Apple Silicon only (MPS).",
    },
]


def _openai_whisper_descriptor() -> dict:
    """Build the openai-whisper descriptor with live download-state per model."""
    models = [
        {
            "name": name,
            "sizeMb": MODEL_SIZES_MB[name],
            "downloaded": check_whisper_model(name),
        }
        for name in MODELS_URLS  # preserves insertion order: tiny → turbo
    ]
    return {
        "id": "openai-whisper",
        "label": "OpenAI Whisper",
        "available": True,
        "packageSizeMb": None,  # torch is a hard dep — no incremental install
        "requirements": {
            "platform": ["macos", "windows", "linux"],
            "accelerators": ["cpu"],  # gpu is a bonus, not required
        },
        "models": models,
        "tunables": [],  # device/lang/VAD/ffmpeg-resample are general config
        "note": None,
    }


def build_engine_descriptors() -> list[dict]:
    """Return the full engine descriptor list (available first, then planned)."""
    return [_openai_whisper_descriptor(), *_PLANNED_STUBS]
