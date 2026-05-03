from pathlib import Path
from core.config import AppConfig, load_config, save_config


def test_default_config_has_lm_studio_url():
    cfg = AppConfig()
    assert cfg.local_openai_base_url == "http://127.0.0.1:1234/v1"


def test_default_translator_provider_is_gemini():
    cfg = AppConfig()
    assert cfg.translator_provider == "gemini"


def test_default_source_lang_is_english_not_auto():
    cfg = AppConfig()
    assert cfg.default_source_lang == "en"


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
