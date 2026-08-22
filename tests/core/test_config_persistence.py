"""Config persistence hardening: atomic writes, quarantine, validation, mode.

Each test here corresponds to a way the previous implementation could lose the
user's settings (API keys included) without saying anything.
"""
from __future__ import annotations

import json

import pytest

import core.config as cfgmod
from core.config import AppConfig, last_load_error, load_config, save_config


@pytest.fixture
def home(tmp_path, monkeypatch):
    """Point config_dir() at a scratch HOME."""
    monkeypatch.setenv("HOME", str(tmp_path))
    monkeypatch.delenv("USERPROFILE", raising=False)
    return tmp_path


def test_save_config_is_atomic_and_private(home):
    cfg = AppConfig()
    cfg.gemini_api_key = "secret-key"
    save_config(cfg)

    p = cfgmod.config_path()
    assert p.exists()
    # 0600: the file holds plaintext provider keys.
    assert p.stat().st_mode & 0o777 == 0o600
    # No temp files left behind by the write-then-rename.
    assert [f.name for f in cfgmod.config_dir().iterdir()] == [p.name]
    assert load_config().gemini_api_key == "secret-key"


def test_truncated_config_is_quarantined_not_discarded(home):
    cfg = AppConfig()
    cfg.gemini_api_key = "secret-key"
    cfg.output_dir = "/somewhere/custom"
    save_config(cfg)

    # A crash mid-write used to be possible; simulate its result.
    cfgmod.config_path().write_text('{"gemini_api_key": "secret-k')

    loaded = load_config()
    # We fall back to defaults so the app still boots...
    assert loaded.gemini_api_key == ""
    # ...but the damaged file is preserved, and we say so.
    corrupt = [f for f in cfgmod.config_dir().iterdir() if "corrupt" in f.name]
    assert len(corrupt) == 1
    assert "secret-k" in corrupt[0].read_text()
    assert not cfgmod.config_path().exists()
    err = last_load_error()
    assert err and "not valid JSON" in err


def test_repeated_corruption_does_not_overwrite_earlier_quarantine(home):
    for i in range(3):
        cfgmod.config_dir().mkdir(parents=True, exist_ok=True)
        cfgmod.config_path().write_text(f"not json {i}")
        load_config()
    corrupt = sorted(f.name for f in cfgmod.config_dir().iterdir() if "corrupt" in f.name)
    assert len(corrupt) == 3


def test_invalid_values_fall_back_per_field_and_are_reported(home):
    cfgmod.config_dir().mkdir(parents=True, exist_ok=True)
    cfgmod.config_path().write_text(
        json.dumps(
            {
                "sub_font_size": "not-a-number",
                "sub_border_size": -9999,
                "sub_margin_y": 10**9,
                "logs_verbosity": "banana",
                "translator_provider": "definitely-not-valid",
                "vad_enabled": "yes-please",
                "sub_fonts_by_lang": {"zh": 123},
                # Valid neighbours must survive the cleanup.
                "gemini_api_key": "keep-me",
                "default_target_lang": "ja",
            }
        )
    )

    cfg = load_config()
    defaults = AppConfig()
    assert cfg.sub_font_size == defaults.sub_font_size
    assert cfg.sub_border_size == defaults.sub_border_size
    assert cfg.sub_margin_y == defaults.sub_margin_y
    assert cfg.logs_verbosity == defaults.logs_verbosity
    assert cfg.translator_provider == defaults.translator_provider
    assert cfg.vad_enabled == defaults.vad_enabled
    assert cfg.sub_fonts_by_lang == {}
    # Untouched valid fields
    assert cfg.gemini_api_key == "keep-me"
    assert cfg.default_target_lang == "ja"

    err = last_load_error()
    assert err and "sub_font_size" in err and "logs_verbosity" in err


def test_garbage_never_reaches_the_mpv_command_line(home):
    """The concrete consequence the validation exists to prevent."""
    from api.routes.system_ops import _mpv_args_from_cfg

    cfgmod.config_dir().mkdir(parents=True, exist_ok=True)
    cfgmod.config_path().write_text(
        json.dumps({"sub_font_size": "not-a-number", "sub_margin_y": 10**9})
    )
    args = _mpv_args_from_cfg(load_config())
    assert not any("not-a-number" in a for a in args)
    assert not any("1000000000" in a for a in args)


def test_clean_load_reports_no_error(home):
    save_config(AppConfig())
    load_config()
    assert last_load_error() is None


def test_load_tightens_permissions_written_by_an_older_build(home):
    """Existing installs shouldn't have to wait for a save to get 0600."""
    import os

    save_config(AppConfig())
    p = cfgmod.config_path()
    os.chmod(p, 0o644)  # what every pre-fix build left behind
    assert p.stat().st_mode & 0o777 == 0o644

    load_config()
    assert p.stat().st_mode & 0o777 == 0o600


def test_unknown_keys_are_tolerated_silently(home):
    """Forward/backward compatibility: a key we don't know is not an error."""
    cfgmod.config_dir().mkdir(parents=True, exist_ok=True)
    cfgmod.config_path().write_text(
        json.dumps({"some_future_setting": 1, "gemini_api_key": "k"})
    )
    assert load_config().gemini_api_key == "k"
    assert last_load_error() is None
