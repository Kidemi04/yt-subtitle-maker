"""Translator-related endpoints: test reachability, list available models.

These endpoints fall back to the saved config when the client omits a field
or sends the GET-side mask sentinel `"***"`. That lets the Settings page
test a connection without making the user re-type their API key after
opening the page (GET masks secrets so they aren't leaked over the wire).
"""
from __future__ import annotations

from fastapi import APIRouter

from api.routes.config import MASK
from api.schemas import ListModelsRequest, TranslatorTestRequest
from core.config import AppConfig, load_config
from core.translator import get_translator

router = APIRouter(prefix="/api/translator", tags=["translator"])


def _saved_credentials(
    cfg: AppConfig, provider: str
) -> tuple[str | None, str, str]:
    """Return `(base_url, model, api_key)` from saved config for the provider.

    `base_url` is None for gemini (it ignores it), a real URL for the others.
    """
    if provider == "gemini":
        return None, cfg.gemini_model, cfg.gemini_api_key
    if provider == "local_openai":
        return (
            cfg.local_openai_base_url,
            cfg.local_openai_model,
            cfg.local_openai_api_key or "lm-studio",
        )
    if provider == "openai":
        return cfg.openai_base_url, cfg.openai_model, cfg.openai_api_key
    raise ValueError(f"unknown translator provider: {provider!r}")


def _resolve_field(client_value: str | None, saved_value: str | None) -> str | None:
    """Pick the client value unless it's blank or the GET-side mask sentinel."""
    if not client_value or client_value == MASK:
        return saved_value
    return client_value


@router.post("/test")
def test_translator(req: TranslatorTestRequest):
    cfg = load_config()
    saved_base, saved_model, saved_key = _saved_credentials(cfg, req.provider)

    base_url = _resolve_field(req.baseUrl, saved_base)
    model = _resolve_field(req.model, saved_model)
    api_key = _resolve_field(req.apiKey, saved_key)

    try:
        provider = get_translator(
            req.provider,
            base_url=base_url,
            model=model or "placeholder",
            api_key=api_key,
        )
        if provider.is_available():
            return {"ok": True}
        return {"ok": False, "error": "Provider unreachable or auth failed"}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@router.post("/list-models")
def list_translator_models(req: ListModelsRequest):
    cfg = load_config()
    saved_base, _, saved_key = _saved_credentials(cfg, req.provider)

    base_url = _resolve_field(req.baseUrl, saved_base)
    api_key = _resolve_field(req.apiKey, saved_key)

    try:
        # We need a model identifier to construct the provider, but list_models
        # doesn't actually use it. Pass a placeholder.
        provider = get_translator(
            req.provider,
            base_url=base_url,
            model="placeholder",
            api_key=api_key,
        )
        return {"ok": True, "models": provider.list_models()}
    except Exception as e:
        return {"ok": False, "error": str(e), "models": []}
