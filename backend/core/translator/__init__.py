"""Translator provider registry."""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from core.translator.base import TranslationProvider
from core.translator.gemini import GeminiTranslator
from core.translator.openai_compat import OpenAICompatTranslator

if TYPE_CHECKING:
    from core.config import AppConfig

log = logging.getLogger(__name__)

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
            name="local_openai",
        )
    if name == "openai":
        return OpenAICompatTranslator(
            base_url=kwargs.get("base_url") or DEFAULT_OPENAI_URL,
            model=kwargs["model"],
            api_key=kwargs.get("api_key", ""),
            name="openai",
        )
    raise KeyError(f"unknown translator: {name!r}")


def get_active_translator(cfg: AppConfig) -> TranslationProvider:
    """Resolve cfg.active_translator to a TranslationProvider.

    Dispatch rules:
    - "gemini"       → GeminiTranslator with the built-in gemini_* credentials.
    - "local_openai" → OpenAICompatTranslator with local_openai_* credentials.
    - "custom:<id>"  → look up cfg.custom_translators by id;
                       if not found, log a warning and fall back to Gemini.
    Any other value also falls back to Gemini.
    """
    active = cfg.active_translator

    if active == "gemini":
        return GeminiTranslator(
            api_key=cfg.gemini_api_key,
            model=cfg.gemini_model,
        )

    if active == "local_openai":
        return OpenAICompatTranslator(
            base_url=cfg.local_openai_base_url or DEFAULT_LM_STUDIO_URL,
            model=cfg.local_openai_model or "placeholder",
            api_key=cfg.local_openai_api_key or "lm-studio",
            name="local_openai",
        )

    if active.startswith("custom:"):
        profile_id = active[len("custom:"):]
        entry = next(
            (e for e in cfg.custom_translators if e.get("id") == profile_id),
            None,
        )
        if entry:
            return OpenAICompatTranslator(
                base_url=entry.get("base_url", DEFAULT_OPENAI_URL),
                model=entry.get("model", "placeholder"),
                api_key=entry.get("api_key") or "placeholder",
                name=entry.get("name", profile_id),
            )
        log.warning(
            "active_translator=%r points to unknown custom profile %r; "
            "falling back to Gemini",
            active,
            profile_id,
        )

    # Unknown or stale — fall back to Gemini
    return GeminiTranslator(
        api_key=cfg.gemini_api_key,
        model=cfg.gemini_model,
    )


__all__ = [
    "TranslationProvider",
    "get_active_translator",
    "get_translator",
    "list_translators",
    "DEFAULT_LM_STUDIO_URL",
    "DEFAULT_OPENAI_URL",
]
