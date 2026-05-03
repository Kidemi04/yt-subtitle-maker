"""Translator provider registry."""
from __future__ import annotations

from typing import Any

from core.translator.base import TranslationProvider
from core.translator.gemini import GeminiTranslator
from core.translator.openai_compat import OpenAICompatTranslator

DEFAULT_LM_STUDIO_URL = "http://127.0.0.1:1234/v1"
DEFAULT_OPENAI_URL = "https://api.openai.com/v1"


def list_translators() -> list[str]:
    return ["gemini", "local_openai", "openai"]


def get_translator(name: str, **kwargs: Any) -> TranslationProvider:
    if name == "gemini":
        return GeminiTranslator(
            api_key=kwargs.get("api_key", ""),
            model=kwargs.get("model", "gemini-2.5-flash-lite"),
        )
    if name == "local_openai":
        return OpenAICompatTranslator(
            base_url=kwargs.get("base_url") or DEFAULT_LM_STUDIO_URL,
            model=kwargs["model"],
            api_key=kwargs.get("api_key") or "lm-studio",
        )
    if name == "openai":
        return OpenAICompatTranslator(
            base_url=kwargs.get("base_url") or DEFAULT_OPENAI_URL,
            model=kwargs["model"],
            api_key=kwargs.get("api_key", ""),
        )
    raise KeyError(f"unknown translator: {name!r}")


__all__ = [
    "TranslationProvider",
    "get_translator",
    "list_translators",
    "DEFAULT_LM_STUDIO_URL",
    "DEFAULT_OPENAI_URL",
]
