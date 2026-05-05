"""Tests for the mpv subtitle-style flag builder."""
from __future__ import annotations

from core.config import AppConfig
from api.routes.library import _subtitle_style_flags


def test_no_overrides_emits_no_flags():
    """A fresh AppConfig should produce zero flags so mpv keeps its defaults."""
    assert _subtitle_style_flags(AppConfig()) == []


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
