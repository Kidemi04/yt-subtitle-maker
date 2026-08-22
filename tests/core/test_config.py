import json
from pathlib import Path
from core.config import AppConfig, load_config, save_config


def test_default_config_has_lm_studio_url():
    cfg = AppConfig()
    assert cfg.local_openai_base_url == "http://127.0.0.1:1234/v1"


def test_default_translator_provider_is_gemini():
    cfg = AppConfig()
    assert cfg.translator_provider == "gemini"


def test_default_source_lang_is_auto():
    """Detection is the safe default; a wrong pinned language is not.

    This asserted "en" while `sourceLang="auto"` was rejected API-side. That
    combination silently mis-transcribed every non-English video, because
    Whisper forced to the wrong language emits confident nonsense rather than
    an error. "auto" is now accepted end-to-end and every engine maps it to
    its own detection path.
    """
    cfg = AppConfig()
    assert cfg.default_source_lang == "auto"


def test_save_and_load_roundtrip(tmp_path: Path, monkeypatch):
    fake_home = tmp_path / "fakehome"
    fake_home.mkdir()
    monkeypatch.setenv("USERPROFILE", str(fake_home))  # Windows
    monkeypatch.setenv("HOME", str(fake_home))         # POSIX

    cfg = AppConfig()
    cfg.gemini_api_key = "test-key"
    save_config(cfg)
    loaded = load_config()
    assert loaded.gemini_api_key == "test-key"


# ── migration tests ────────────────────────────────────────────────────────────

def test_new_fields_have_defaults():
    cfg = AppConfig()
    assert cfg.custom_translators == []
    assert cfg.active_translator == "gemini"


def test_migration_legacy_openai_becomes_custom_entry(tmp_path, monkeypatch):
    """A config.json with openai_* set + translator_provider='openai'
    should load with a 'openai-legacy' custom_translators entry and
    active_translator='custom:openai-legacy'."""
    fake_home = tmp_path / "h"
    fake_home.mkdir()
    monkeypatch.setenv("HOME", str(fake_home))
    monkeypatch.setenv("USERPROFILE", str(fake_home))

    cfg_dir = fake_home / ".yt_subtitle_tool"
    cfg_dir.mkdir()
    (cfg_dir / "config.json").write_text(json.dumps({
        "openai_api_key": "sk-abc",
        "openai_model": "gpt-4o",
        "openai_base_url": "https://api.openai.com/v1",
        "translator_provider": "openai",
    }), encoding="utf-8")

    loaded = load_config()
    assert len(loaded.custom_translators) == 1
    entry = loaded.custom_translators[0]
    assert entry["id"] == "openai-legacy"
    assert entry["name"] == "OpenAI"
    assert entry["api_key"] == "sk-abc"
    assert entry["model"] == "gpt-4o"
    assert entry["base_url"] == "https://api.openai.com/v1"
    assert loaded.active_translator == "custom:openai-legacy"


def test_migration_legacy_openai_is_idempotent(tmp_path, monkeypatch):
    """Running load_config() twice on the same file does not duplicate
    the 'openai-legacy' entry."""
    fake_home = tmp_path / "h"
    fake_home.mkdir()
    monkeypatch.setenv("HOME", str(fake_home))
    monkeypatch.setenv("USERPROFILE", str(fake_home))

    cfg_dir = fake_home / ".yt_subtitle_tool"
    cfg_dir.mkdir()
    (cfg_dir / "config.json").write_text(json.dumps({
        "openai_api_key": "sk-abc",
        "openai_model": "gpt-4o",
        "translator_provider": "openai",
    }), encoding="utf-8")

    loaded1 = load_config()
    save_config(loaded1)
    loaded2 = load_config()
    assert len(loaded2.custom_translators) == 1


def test_migration_gemini_provider_sets_active_translator(tmp_path, monkeypatch):
    """Legacy config with translator_provider='gemini' and no openai_api_key
    → active_translator='gemini', custom_translators=[]."""
    fake_home = tmp_path / "h"
    fake_home.mkdir()
    monkeypatch.setenv("HOME", str(fake_home))
    monkeypatch.setenv("USERPROFILE", str(fake_home))

    cfg_dir = fake_home / ".yt_subtitle_tool"
    cfg_dir.mkdir()
    (cfg_dir / "config.json").write_text(json.dumps({
        "translator_provider": "gemini",
        "gemini_api_key": "gkey",
    }), encoding="utf-8")

    loaded = load_config()
    assert loaded.active_translator == "gemini"
    assert loaded.custom_translators == []


def test_migration_local_openai_provider_sets_active_translator(tmp_path, monkeypatch):
    fake_home = tmp_path / "h"
    fake_home.mkdir()
    monkeypatch.setenv("HOME", str(fake_home))
    monkeypatch.setenv("USERPROFILE", str(fake_home))

    cfg_dir = fake_home / ".yt_subtitle_tool"
    cfg_dir.mkdir()
    (cfg_dir / "config.json").write_text(json.dumps({
        "translator_provider": "local_openai",
    }), encoding="utf-8")

    loaded = load_config()
    assert loaded.active_translator == "local_openai"


def test_already_migrated_config_roundtrips(tmp_path, monkeypatch):
    """A config.json that already has custom_translators + active_translator
    round-trips without modification."""
    fake_home = tmp_path / "h"
    fake_home.mkdir()
    monkeypatch.setenv("HOME", str(fake_home))
    monkeypatch.setenv("USERPROFILE", str(fake_home))

    cfg_dir = fake_home / ".yt_subtitle_tool"
    cfg_dir.mkdir()
    profile = {
        "id": "openai-legacy",
        "name": "OpenAI",
        "base_url": "https://api.openai.com/v1",
        "api_key": "sk-abc",
        "model": "gpt-4o",
    }
    (cfg_dir / "config.json").write_text(json.dumps({
        "custom_translators": [profile],
        "active_translator": "custom:openai-legacy",
        "openai_api_key": "sk-abc",
        "openai_model": "gpt-4o",
        "translator_provider": "openai",
    }), encoding="utf-8")

    loaded = load_config()
    assert len(loaded.custom_translators) == 1
    assert loaded.active_translator == "custom:openai-legacy"
