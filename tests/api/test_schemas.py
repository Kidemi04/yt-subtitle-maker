import pytest
from pydantic import ValidationError
from api.schemas import ProcessRequest


def test_process_request_rejects_auto_language():
    """Spec §14 #6: 'auto' must never reach the API."""
    with pytest.raises(ValidationError, match="auto"):
        ProcessRequest(
            url="https://youtu.be/x",
            sttSource="whisper",
            whisperModel="turbo",
            whisperDevice="auto",
            vadEnabled=True,
            sourceLang="auto",
            enableTranslation=False,
        )


def test_process_request_accepts_concrete_language():
    req = ProcessRequest(
        url="https://youtu.be/x",
        sttSource="whisper",
        whisperModel="turbo",
        whisperDevice="auto",
        vadEnabled=True,
        sourceLang="en",
        enableTranslation=False,
    )
    assert req.sourceLang == "en"


def test_default_translator_provider_is_none_so_pipeline_falls_back_to_config():
    """`translatorProvider` defaults to None — pipeline.py uses
    `request.get(...) or cfg.translator_provider` so a non-None default would
    hide the user's Settings choice. Regression test for the Gemini-override bug.
    """
    req = ProcessRequest(
        url="https://youtu.be/x",
        sttSource="whisper",
        whisperModel="turbo",
        whisperDevice="auto",
        vadEnabled=True,
        sourceLang="en",
        enableTranslation=True,
        targetLang="zh-CN",
    )
    assert req.translatorProvider is None


def test_process_request_accepts_custom_translator_provider():
    """`translatorProvider` must accept the Phase 4d named-profile form
    "custom:<id>" — the Generate screen sends this when the user picks a
    saved custom_translators profile (e.g. DeepSeek). Pipeline-side support
    landed in c116d66 (pipeline._make_translator), but the Pydantic body
    schema kept the narrow 3-slot Literal and rejected the value at HTTP
    422 BEFORE the route handler ran. Regression test for that drift.
    """
    req = ProcessRequest(
        url="https://youtu.be/x",
        sttSource="whisper",
        whisperModel="turbo",
        whisperDevice="auto",
        vadEnabled=True,
        sourceLang="en",
        enableTranslation=True,
        targetLang="zh-CN",
        translatorProvider="custom:custom-mp3skdga",
    )
    assert req.translatorProvider == "custom:custom-mp3skdga"


def test_process_request_still_accepts_legacy_built_in_translator_provider():
    """Widening the field to str shouldn't break the 3 legacy values."""
    for legacy in ("gemini", "local_openai", "openai"):
        req = ProcessRequest(
            url="https://youtu.be/x",
            sttSource="whisper",
            whisperModel="turbo",
            whisperDevice="auto",
            vadEnabled=True,
            sourceLang="en",
            enableTranslation=True,
            targetLang="zh-CN",
            translatorProvider=legacy,
        )
        assert req.translatorProvider == legacy


def test_library_translate_request_accepts_custom_translator_provider():
    """Same widening on the library re-translate flow."""
    from api.routes.library import LibraryTranslateRequest
    req = LibraryTranslateRequest(
        sourceTranscribeId="t1",
        targetLang="zh-CN",
        translatorProvider="custom:custom-mp3skdga",
    )
    assert req.translatorProvider == "custom:custom-mp3skdga"
