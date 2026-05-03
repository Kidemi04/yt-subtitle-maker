"""Translator-related endpoints: test reachability, list available models."""
from __future__ import annotations

from fastapi import APIRouter

from api.schemas import ListModelsRequest, TranslatorTestRequest
from core.translator import get_translator

router = APIRouter(prefix="/api/translator", tags=["translator"])


@router.post("/test")
def test_translator(req: TranslatorTestRequest):
    try:
        provider = get_translator(
            req.provider,
            base_url=req.baseUrl,
            model=req.model,
            api_key=req.apiKey,
        )
        if provider.is_available():
            return {"ok": True}
        return {"ok": False, "error": "Provider unreachable or auth failed"}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@router.post("/list-models")
def list_translator_models(req: ListModelsRequest):
    try:
        # We need a model identifier to construct the provider, but list_models
        # doesn't actually need it. Pass a placeholder.
        provider = get_translator(
            req.provider,
            base_url=req.baseUrl,
            model="placeholder",
            api_key=req.apiKey,
        )
        return {"ok": True, "models": provider.list_models()}
    except Exception as e:
        return {"ok": False, "error": str(e), "models": []}
