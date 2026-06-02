"""Tests for get_active_translator — the AppConfig-aware dispatcher."""
from unittest.mock import MagicMock, patch

import pytest

from core.config import AppConfig
from core.translator import get_active_translator
from core.translator.gemini import GeminiTranslator
from core.translator.openai_compat import OpenAICompatTranslator


def _cfg(**kwargs) -> AppConfig:
    cfg = AppConfig()
    for k, v in kwargs.items():
        setattr(cfg, k, v)
    return cfg


def test_active_gemini():
    cfg = _cfg(active_translator="gemini", gemini_api_key="gkey", gemini_model="gemini-2.5-flash-lite")
    provider = get_active_translator(cfg)
    assert isinstance(provider, GeminiTranslator)
    assert provider.api_key == "gkey"


def test_active_local_openai():
    cfg = _cfg(
        active_translator="local_openai",
        local_openai_base_url="http://127.0.0.1:1234/v1",
        local_openai_model="gemma-3-27b",
        local_openai_api_key="",
    )
    provider = get_active_translator(cfg)
    assert isinstance(provider, OpenAICompatTranslator)
    assert provider.name == "local_openai"
    assert provider.api_key == "lm-studio"  # default sentinel


def test_active_custom_profile():
    cfg = _cfg(
        active_translator="custom:deepseek-1",
        custom_translators=[{
            "id": "deepseek-1",
            "name": "DeepSeek",
            "base_url": "https://api.deepseek.com/v1",
            "api_key": "ds-key",
            "model": "deepseek-chat",
        }],
    )
    provider = get_active_translator(cfg)
    assert isinstance(provider, OpenAICompatTranslator)
    assert provider.base_url == "https://api.deepseek.com/v1"
    assert provider.api_key == "ds-key"
    assert provider.model == "deepseek-chat"
    assert provider.name == "DeepSeek"


def test_stale_custom_id_falls_back_to_gemini():
    """If active_translator points to a non-existent custom id, fall back to Gemini."""
    cfg = _cfg(
        active_translator="custom:nope",
        custom_translators=[],
        gemini_api_key="gkey",
    )
    provider = get_active_translator(cfg)
    assert isinstance(provider, GeminiTranslator)


def test_pipeline_uses_get_active_translator_when_no_override():
    """pipeline._make_translator should call get_active_translator when the
    request dict has no translatorProvider override."""
    from core.pipeline import _make_translator

    cfg = AppConfig()
    cfg.active_translator = "gemini"
    cfg.gemini_api_key = "gkey"

    with patch("core.pipeline.get_active_translator") as mock_gat:
        mock_gat.return_value = MagicMock()
        _make_translator({}, cfg)
        mock_gat.assert_called_once_with(cfg)


def test_pipeline_per_job_override_still_wins():
    """A non-None translatorProvider in the request skips get_active_translator."""
    from core.pipeline import _make_translator

    cfg = AppConfig()
    with patch("core.pipeline.get_active_translator") as mock_gat:
        with patch("core.pipeline.get_translator") as mock_gt:
            mock_gt.return_value = MagicMock()
            _make_translator(
                {
                    "translatorProvider": "gemini",
                    "translatorBaseUrl": None,
                    "translatorModel": "gemini-2.5-flash-lite",
                    "translatorApiKey": None,
                },
                cfg,
            )
            mock_gat.assert_not_called()
            mock_gt.assert_called_once()


def test_pipeline_per_job_override_custom_profile():
    """`translatorProvider="custom:<id>"` per-job override dispatches via
    get_active_translator on a cfg copy with active_translator set. Lets the
    Generate screen pick a user-saved custom profile (e.g. DeepSeek) without
    re-typing credentials."""
    from core.pipeline import _make_translator

    cfg = AppConfig()
    cfg.custom_translators = [{
        "id": "deepseek-1",
        "name": "DeepSeek",
        "base_url": "https://api.deepseek.com/v1",
        "api_key": "ds-key",
        "model": "deepseek-chat",
    }]
    cfg.active_translator = "gemini"  # would be the default without override

    with patch("core.pipeline.get_active_translator") as mock_gat:
        with patch("core.pipeline.get_translator") as mock_gt:
            mock_gat.return_value = MagicMock()
            _make_translator(
                {"translatorProvider": "custom:deepseek-1"},
                cfg,
            )
            mock_gt.assert_not_called()
            mock_gat.assert_called_once()
            # The cfg passed to get_active_translator should have
            # active_translator overridden to the requested custom profile.
            (cfg_arg,) = mock_gat.call_args[0]
            assert cfg_arg.active_translator == "custom:deepseek-1"
            # And the original cfg must NOT have been mutated.
            assert cfg.active_translator == "gemini"


def test_pipeline_per_job_override_missing_custom_profile_raises_without_dispatch():
    from core.pipeline import _make_translator

    cfg = AppConfig()
    cfg.custom_translators = []
    cfg.active_translator = "gemini"

    with patch("core.pipeline.get_active_translator") as mock_gat:
        with patch("core.pipeline.get_translator") as mock_gt:
            with pytest.raises(
                ValueError,
                match="unknown custom translator profile.*nope",
            ):
                _make_translator({"translatorProvider": "custom:nope"}, cfg)

            mock_gat.assert_not_called()
            mock_gt.assert_not_called()


def test_pipeline_resolved_provider_uses_active_translator_without_override():
    from core.pipeline import _resolved_translator_provider

    cfg = AppConfig()
    cfg.active_translator = "custom:deepseek-1"
    cfg.custom_translators = [{
        "id": "deepseek-1",
        "name": "DeepSeek",
        "base_url": "https://api.deepseek.com/v1",
        "api_key": "ds-key",
        "model": "deepseek-chat",
    }]
    cfg.translator_provider = "gemini"

    assert _resolved_translator_provider({}, cfg) == "custom:deepseek-1"


def test_pipeline_resolved_provider_uses_legacy_when_active_missing():
    from core.pipeline import _resolved_translator_provider

    cfg = AppConfig()
    cfg.active_translator = ""
    cfg.translator_provider = "local_openai"

    assert _resolved_translator_provider({}, cfg) == "local_openai"


def test_pipeline_resolved_provider_falls_back_when_active_custom_missing():
    from core.pipeline import _resolved_translator_provider

    cfg = AppConfig()
    cfg.active_translator = "custom:nope"
    cfg.custom_translators = []
    cfg.translator_provider = "local_openai"

    assert _resolved_translator_provider({}, cfg) == "gemini"


def test_pipeline_translator_model_for_custom_profile():
    from core.pipeline import _translator_model_for

    cfg = AppConfig()
    cfg.custom_translators = [{
        "id": "deepseek-1",
        "name": "DeepSeek",
        "base_url": "https://api.deepseek.com/v1",
        "api_key": "ds-key",
        "model": "deepseek-chat",
    }]

    assert _translator_model_for("custom:deepseek-1", {}, cfg) == "deepseek-chat"


def test_pipeline_translator_model_override_still_wins_for_custom_profile():
    from core.pipeline import _translator_model_for

    cfg = AppConfig()
    cfg.custom_translators = [{
        "id": "deepseek-1",
        "name": "DeepSeek",
        "base_url": "https://api.deepseek.com/v1",
        "api_key": "ds-key",
        "model": "deepseek-chat",
    }]

    assert _translator_model_for(
        "custom:deepseek-1",
        {"translatorModel": "deepseek-reasoner"},
        cfg,
    ) == "deepseek-reasoner"
