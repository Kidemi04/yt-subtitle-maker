"""Translator-related endpoints: test reachability + real round-trip, list available models.

These endpoints fall back to the saved config when the client omits a field
or sends the GET-side mask sentinel `"***"`. That lets the Settings page
test a connection without making the user re-type their API key after
opening the page (GET masks secrets so they aren't leaked over the wire).

Phase 4d: POST /api/translator/test now performs a real one-line translation
round-trip (`provider.translate_title("Hello, world.", target_lang)`) and
categorises exceptions into human-readable strings. It accepts either an
ad-hoc spec (`provider` + optional credentials) OR a saved-profile reference
(`profileId` + `useSavedKey=True`), which is resolved server-side through
`get_active_translator`.
"""
from __future__ import annotations

import copy
import time
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter

from api.routes.config import MASK
from api.schemas import ListModelsRequest, TranslatorTestRequest
from core.config import AppConfig, load_config
from core.translator import get_active_translator, get_translator

router = APIRouter(prefix="/api/translator", tags=["translator"])

# The English source string used for the round-trip test. Kept short so the
# call is cheap (one tiny request) and the assertion in the UI ("you got a
# Chinese string back from `Hello, world.`") is unambiguous to the user.
_TEST_SRC = "Hello, world."


def _saved_credentials(
    cfg: AppConfig, provider: str
) -> tuple[str | None, str, str]:
    """Return `(base_url, model, api_key)` from saved config for a built-in provider.

    `base_url` is None for gemini (it ignores it), a real URL for the others.
    Raises `ValueError` for unknown providers.
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


def _resolve_provider_for_test(req: TranslatorTestRequest, cfg: AppConfig):
    """Return a `TranslationProvider` from either the profileId or ad-hoc spec."""
    # Saved-profile form: profileId + useSavedKey=True. Temporarily override
    # cfg.active_translator on a shallow copy so we don't mutate the
    # canonical config, then dispatch via get_active_translator.
    if req.profileId and req.useSavedKey:
        tmp_cfg = copy.copy(cfg)
        tmp_cfg.active_translator = req.profileId
        return get_active_translator(tmp_cfg)

    # Ad-hoc spec form: provider + optional credentials, with saved-config
    # fallback for any field the client omits or sends as the MASK sentinel.
    if req.provider:
        saved_base, saved_model, saved_key = _saved_credentials(cfg, req.provider)
        base_url = _resolve_field(req.baseUrl, saved_base)
        model = _resolve_field(req.model, saved_model) or "placeholder"
        api_key = _resolve_field(req.apiKey, saved_key)
        return get_translator(req.provider, base_url=base_url, model=model, api_key=api_key)

    raise ValueError(
        "TranslatorTestRequest must include either 'provider' (ad-hoc) "
        "or 'profileId' + 'useSavedKey=True' (saved-profile)"
    )


def _resolve_provider_for_models(req: ListModelsRequest, cfg: AppConfig):
    """Return a `TranslationProvider` for list-models — same dispatch rules."""
    if req.profileId and req.useSavedKey:
        tmp_cfg = copy.copy(cfg)
        tmp_cfg.active_translator = req.profileId
        return get_active_translator(tmp_cfg)

    if req.provider:
        saved_base, _, saved_key = _saved_credentials(cfg, req.provider)
        base_url = _resolve_field(req.baseUrl, saved_base)
        api_key = _resolve_field(req.apiKey, saved_key)
        return get_translator(
            req.provider, base_url=base_url, model="placeholder", api_key=api_key
        )

    raise ValueError(
        "ListModelsRequest must include either 'provider' (ad-hoc) "
        "or 'profileId' + 'useSavedKey=True' (saved-profile)"
    )


def _host_from_base_url(base_url: str | None) -> str | None:
    """Extract the host (no scheme/port/path) from a base URL, best-effort."""
    if not base_url:
        return None
    try:
        return urlparse(base_url).hostname
    except Exception:
        return None


def _categorise_error(exc: Exception, model: str | None, base_url: str | None) -> str:
    """Map a translator exception to a human-readable error string.

    Categories (in order; first match wins):
    - openai.AuthenticationError (401/403)     → "Authentication failed (check the API key)"
    - openai.NotFoundError (404)               → "Model '<model>' not found"
    - openai.RateLimitError (429)              → "Quota exceeded"
    - google.genai ClientError (best-effort)   → mapped on message content
    - httpx.ConnectError / DNS                 → "Couldn't reach <host>"
    - httpx.TimeoutException / asyncio TO      → "Request timed out"
    - KeyError / AttributeError / IndexError   → "Unexpected response shape (...)"
    - anything else                            → str(exc)

    The openai/google_genai imports are wrapped in try/except so this module
    keeps working if either dep is missing — failure mode is "fall through
    to str(exc)" rather than crash.
    """
    # httpx network categories come first because they may also be ValueError
    # subclasses (httpx.InvalidURL etc.) — we want the network message, not
    # the generic "Unexpected response shape" one.
    if isinstance(exc, httpx.TimeoutException):
        return "Request timed out"
    if isinstance(exc, httpx.ConnectError):
        host = _host_from_base_url(base_url)
        return f"Couldn't reach {host}" if host else "Couldn't reach the endpoint"

    # OpenAI SDK errors (real OpenAI / LM Studio / Ollama / Groq / Together)
    try:
        from openai import AuthenticationError, NotFoundError, RateLimitError

        if isinstance(exc, AuthenticationError):
            return "Authentication failed (check the API key)"
        if isinstance(exc, NotFoundError):
            return f"Model '{model}' not found"
        if isinstance(exc, RateLimitError):
            return "Quota exceeded"
    except ImportError:
        pass

    # google.genai surfaces a single ClientError; we sniff the message to
    # decide which bucket it falls into. (genai also has APIError / ServerError
    # — those fall through to str(exc) which is good enough.)
    try:
        from google.genai import errors as genai_errors

        client_error = getattr(genai_errors, "ClientError", None)
        if client_error is not None and isinstance(exc, client_error):
            msg = str(exc).lower()
            if any(t in msg for t in ("401", "403", "api_key", "api key", "permission")):
                return "Authentication failed (check the API key)"
            if "404" in msg or "not found" in msg:
                return f"Model '{model}' not found"
            if "429" in msg or "quota" in msg or "rate limit" in msg:
                return "Quota exceeded"
    except ImportError:
        pass

    # Generic HTTP status fallback for httpx.HTTPStatusError (no openai SDK)
    if isinstance(exc, httpx.HTTPStatusError):
        status = exc.response.status_code
        if status in (401, 403):
            return "Authentication failed (check the API key)"
        if status == 404:
            return f"Model '{model}' not found"
        if status == 429:
            return "Quota exceeded"

    # Response that doesn't look OpenAI-shaped — `resp.choices[0].message.content`
    # raises one of these. JSON-decode failures (json.JSONDecodeError ⊂ ValueError)
    # also land here, which matches the spirit of "this endpoint isn't speaking
    # the protocol we expect".
    if isinstance(exc, (KeyError, AttributeError, IndexError, ValueError)):
        return "Unexpected response shape (is this an OpenAI-compatible endpoint?)"

    return str(exc)


@router.post("/test")
def test_translator(req: TranslatorTestRequest):
    """Perform a real one-line translation round-trip and report structured result."""
    cfg = load_config()
    t0 = time.perf_counter()
    model_name: str | None = None
    base_url: str | None = None
    try:
        provider = _resolve_provider_for_test(req, cfg)
        # Both GeminiTranslator and OpenAICompatTranslator expose `.model`;
        # OpenAICompatTranslator also exposes `.base_url`. Capture them for
        # the response shape *and* for error messages (e.g. "Couldn't reach
        # 127.0.0.1") before issuing the round-trip call.
        model_name = getattr(provider, "model", None)
        base_url = getattr(provider, "base_url", None)
        target_lang = req.targetLang or cfg.default_target_lang
        dst = provider.translate_title(_TEST_SRC, target_lang)
        latency_ms = int((time.perf_counter() - t0) * 1000)
        return {
            "ok": True,
            "sample": {"src": _TEST_SRC, "dst": dst},
            "latencyMs": latency_ms,
            "model": model_name,
        }
    except Exception as exc:
        latency_ms = int((time.perf_counter() - t0) * 1000)
        return {
            "ok": False,
            "error": _categorise_error(exc, model_name, base_url),
            "latencyMs": latency_ms,
            "model": model_name,
        }


@router.post("/list-models")
def list_translator_models(req: ListModelsRequest):
    cfg = load_config()
    try:
        provider = _resolve_provider_for_models(req, cfg)
        return {"ok": True, "models": provider.list_models()}
    except Exception as e:
        return {"ok": False, "error": str(e), "models": []}
