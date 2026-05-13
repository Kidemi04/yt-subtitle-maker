"""Tests for the mpv subtitle-style flag builder."""
from __future__ import annotations

from core.config import AppConfig
from api.routes.library import _subtitle_style_flags


def test_no_overrides_emits_only_platform_default_font():
    """A fresh AppConfig produces ONLY a platform CJK-friendly --sub-font.

    mpv's built-in `sans-serif` resolves to a font with zero CJK coverage
    (Helvetica / DejaVu Sans / Arial), so translated subs render as tofu
    boxes. `_subtitle_style_flags` substitutes a platform default
    (PingFang SC on macOS, Microsoft YaHei on Windows, Noto Sans CJK SC
    elsewhere) when the user has no preference set. All OTHER style
    fields still pass through unchanged when their defaults are empty.
    """
    flags = _subtitle_style_flags(AppConfig())
    assert len(flags) == 1, flags
    assert flags[0].startswith("--sub-font=")


def test_per_language_override_wins_over_global_subfont():
    cfg = AppConfig()
    cfg.sub_font = "Inter"
    cfg.sub_fonts_by_lang = {"zh": "PingFang SC", "ja": "Hiragino Sans"}
    flags = _subtitle_style_flags(cfg, lang="zh-CN")  # primary-subtag prefix match
    assert "--sub-font=PingFang SC" in flags
    assert "--sub-font=Inter" not in flags


def test_per_language_exact_match_beats_prefix_match():
    cfg = AppConfig()
    cfg.sub_fonts_by_lang = {"zh": "Noto Sans CJK SC", "zh-TW": "Noto Serif CJK TC"}
    flags = _subtitle_style_flags(cfg, lang="zh-TW")
    assert "--sub-font=Noto Serif CJK TC" in flags


def test_global_subfont_used_when_no_lang_match():
    """For non-CJK languages with no per-language override, the global font wins."""
    cfg = AppConfig()
    cfg.sub_font = "Inter"
    cfg.sub_fonts_by_lang = {"ja": "Hiragino Sans"}
    flags = _subtitle_style_flags(cfg, lang="fr")
    assert "--sub-font=Inter" in flags


def test_cjk_falls_back_to_default_even_when_global_set():
    """CJK languages use the CJK default, not a Latin global font."""
    cfg = AppConfig()
    cfg.sub_font = "Helvetica"
    flags = _subtitle_style_flags(cfg, lang="zh-CN")
    assert "--sub-font=Helvetica" not in flags


def test_each_field_emits_its_flag():
    cfg = AppConfig()
    cfg.sub_font = "Noto Sans CJK SC"
    cfg.sub_font_size = 42
    cfg.sub_color = "#ffeb3b"
    cfg.sub_border_color = "#000000"
    cfg.sub_border_size = 4.5
    cfg.sub_back_color = "#00000080"
    cfg.sub_bold = True
    cfg.sub_margin_y = 60

    flags = _subtitle_style_flags(cfg)
    assert "--sub-font=Noto Sans CJK SC" in flags
    assert "--sub-font-size=42" in flags
    assert "--sub-color=#ffeb3b" in flags
    assert "--sub-border-color=#000000" in flags
    assert "--sub-border-size=4.5" in flags
    assert "--sub-back-color=#00000080" in flags
    assert "--sub-bold=yes" in flags
    assert "--sub-margin-y=60" in flags


def test_zero_border_size_is_emitted_as_no_outline():
    """0 means 'explicitly no outline'; only negative means 'use mpv default'."""
    cfg = AppConfig()
    cfg.sub_border_size = 0
    assert "--sub-border-size=0" in _subtitle_style_flags(cfg)


def test_negative_border_size_uses_mpv_default():
    cfg = AppConfig()
    cfg.sub_border_size = -1
    assert not any(f.startswith("--sub-border-size") for f in _subtitle_style_flags(cfg))


def test_bold_off_does_not_emit_flag():
    cfg = AppConfig()
    cfg.sub_bold = False
    assert not any(f.startswith("--sub-bold") for f in _subtitle_style_flags(cfg))
