"""Translator provider abstraction.

Three concrete providers in V1: gemini, local_openai (LM Studio/Ollama),
openai-compat (real OpenAI/Groq/Together). They all satisfy this Protocol.
"""
from __future__ import annotations

from collections.abc import Callable
from typing import Protocol, runtime_checkable

from core.stt.base import TranscriptionSegment


@runtime_checkable
class TranslationProvider(Protocol):
    name: str

    def is_available(self) -> bool:
        """Quick reachability check.

        - Gemini: validates API key by listing models
        - local_openai: GET {base_url}/models
        - openai-compat: same as local_openai but against the configured base_url
        """
        ...

    def ping(self) -> None:
        """Same probe as is_available(), but RAISES on failure instead of
        returning False. Used by POST /api/translator/test so the route's
        error-categoriser can see the real exception type
        (httpx.ConnectError / openai.AuthenticationError / etc.) and produce
        a precise message. Implementations should be cheap — a `models.list()`
        round-trip, not an LLM inference.
        """
        ...

    def list_models(self) -> list[str]:
        """Return available model identifiers. UI dropdown source."""
        ...

    def translate_segments(
        self,
        segments: list[TranscriptionSegment],
        target_lang: str,
        progress: Callable[[float], None] | None = None,
    ) -> None:
        """Mutate segments in place; populate `.translated` on each."""
        ...

    def translate_title(self, title: str, target_lang: str) -> str: ...
