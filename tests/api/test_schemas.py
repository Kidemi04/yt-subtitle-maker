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


def test_default_translator_provider_is_gemini():
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
    assert req.translatorProvider == "gemini"
