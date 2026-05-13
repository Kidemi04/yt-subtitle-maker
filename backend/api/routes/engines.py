"""GET /api/engines — engine descriptor list for the TranscriptionTab."""
from __future__ import annotations

from fastapi import APIRouter

from core.engines import build_engine_descriptors

router = APIRouter(prefix="/api", tags=["engines"])


@router.get("/engines")
def get_engines() -> list:
    """Return the engine descriptor list.

    Shape per element:
      { id, label, available, packageSizeMb, requirements, models, tunables, note }

    openai-whisper is available; faster-whisper/whisperx/insanely-fast-whisper
    are static planned stubs (available=false, models=[]).
    """
    return build_engine_descriptors()
